/**
 * CONTROLLER-SIDE SANDBOX MANAGER
 * ===============================
 * Runs on the HOST system. Spawns Docker containers for probe workers,
 * reads results, handles fallback sandboxes, and manages cleanup.
 * NEVER runs the probe code itself on the host.
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import { validateSandboxOutput, type SandboxValidationResult } from './sandbox-validator';
import type { Issue } from './types';

// ─── Sandbox Types ───────────────────────────────────────────────────

export type SandboxType = 'DOCKER' | 'SEATBELT' | 'NAMESPACE' | 'UNSANDBOXED' | 'NONE';

export interface SandboxConfig {
  targetUrl?: string;
  targetHeaders?: Record<string, string>;
  scanId: string;
  stdioCommand?: string;
  stdioArgs?: string[];
  timeoutMs?: number;
}

export interface SandboxResult {
  success: boolean;
  sandboxType: SandboxType;
  outputPath: string;
  rawOutput: unknown;
  probes: Record<string, unknown>;
  toolHash: string | null;
  rawTools: unknown[] | null;
  toolRiskMatrix: Array<{ tool: string; risk: string; reason: string }> | null;
  validation: SandboxValidationResult;
  error?: string;
  /** Issues raised by the sandbox (e.g., fallback sandbox warnings). */
  fallbackIssues?: Issue[];
}

const CONFIG_DIR = process.env.MCPGUARDIAN_CONFIG_DIR || path.join(
  process.env.HOME || process.env.USERPROFILE || '/tmp',
  '.mcpguardian',
);

const SCAN_OUTPUT_DIR = path.join(CONFIG_DIR, 'scan-output');

// ─── Available Sandbox Detection ─────────────────────────────────────

export type SandboxAvailability = {
  docker: boolean;
  seatbelt: boolean;
  nsenter: boolean;
};

export function detectSandboxAvailability(): SandboxAvailability {
  return {
    docker: checkDockerAvailable(),
    seatbelt: checkSeatbeltAvailable(),
    nsenter: checkNsenterAvailable(),
  };
}

function checkDockerAvailable(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function checkSeatbeltAvailable(): boolean {
  if (process.platform !== 'darwin') return false;
  try {
    execSync('which sandbox-exec', { stdio: 'ignore', timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

function checkNsenterAvailable(): boolean {
  // 'which unshare' checks availability; also requires Linux
  if (process.platform !== 'linux') return false;
  try {
    execSync('which unshare', { stdio: 'ignore', timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

// ─── Docker Image Management ─────────────────────────────────────────

export function ensureDockerImage(imageName: string = 'scanner-probe:latest'): boolean {
  try {
    execSync(`docker image inspect ${imageName}`, { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    try {
      execSync(
        `docker build -t ${imageName} -f Dockerfile.scanner-probe .`,
        { stdio: 'inherit', timeout: 120_000 },
      );
      return true;
    } catch {
      return false;
    }
  }
}

function errResult(err: string, sandboxType: SandboxType): SandboxResult {
  return {
    success: false,
    sandboxType,
    outputPath: '',
    rawOutput: null,
    probes: {},
    toolHash: null,
    rawTools: null,
    toolRiskMatrix: null,
    validation: { valid: false, errors: [err], warnings: [] },
    error: err,
  };
}

// ─── Spawn and Run Sandbox ───────────────────────────────────────────

export async function runSandboxedProbe(config: SandboxConfig): Promise<SandboxResult> {
  const scanId = config.scanId;
  const availability = detectSandboxAvailability();

  if (!fs.existsSync(SCAN_OUTPUT_DIR)) {
    fs.mkdirSync(SCAN_OUTPUT_DIR, { recursive: true });
  }

  const outputPath = path.join(SCAN_OUTPUT_DIR, `${scanId}-results.json`);

  // ── Priority 1: Docker (highest security) ────────────────────────
  if (availability.docker) {
    return runDockerSandbox(config, outputPath);
  }

  // ── Priority 2: macOS Seatbelt ───────────────────────────────────
  if (process.platform === 'darwin' && availability.seatbelt) {
    const result = await runSeatbeltSandbox(config, outputPath);
    if (!result.success) return result;
    result.fallbackIssues = [{
      type: 'FALLBACK_SANDBOX_MACOS',
      severity: 'MEDIUM',
      title: 'macOS Seatbelt sandbox used instead of Docker',
      description: 'Docker is not available on this system. Using macOS Seatbelt sandbox for isolation — reduced isolation confidence compared to Docker.',
      fix: 'Install Docker to enable full sandbox isolation with network isolation and resource limits.',
      deduction: 10,
    }];
    return result;
  }

  // ── Priority 3: Linux Namespace ──────────────────────────────────
  if (process.platform === 'linux' && availability.nsenter) {
    const result = await runNamespaceSandbox(config, outputPath);
    if (!result.success) return result;
    result.fallbackIssues = [{
      type: 'FALLBACK_SANDBOX_LINUX',
      severity: 'MEDIUM',
      title: 'Linux namespace sandbox used instead of Docker',
      description: 'Docker is not available on this system. Using Linux namespace isolation (unshare) — reduced isolation confidence compared to Docker.',
      fix: 'Install Docker to enable full sandbox isolation.',
      deduction: 10,
    }];
    return result;
  }

  // ── No sandbox available ─────────────────────────────────────────
  return errResult(
    'No sandbox available (Docker not found). Cannot safely probe server. Run static analysis only.',
    'NONE',
  );
}

// ─── Docker Sandbox ─────────────────────────────────────────────────

async function runDockerSandbox(config: SandboxConfig, outputPath: string): Promise<SandboxResult> {
  const imageName = 'scanner-probe:latest';
  if (!ensureDockerImage(imageName)) {
    return errResult('Failed to build scanner-probe Docker image', 'DOCKER');
  }

  const args = [
    'run', '--rm',
    '--network', 'scanner-isolated',
    '--read-only',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    '--pids-limit=50',
    '--memory=512m',
    '--cpus=0.5',
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m',
    '-v', `${SCAN_OUTPUT_DIR}:/tmp/scan-output:rw`,
    '-e', `SCAN_ID=${config.scanId}`,
    '--stop-timeout', String(Math.ceil((config.timeoutMs ?? 30000) / 1000)),
  ];

  if (config.targetUrl) {
    args.push('-e', `TARGET_URL=${config.targetUrl}`);
    if (config.targetHeaders && Object.keys(config.targetHeaders).length > 0) {
      args.push('-e', `TARGET_HEADERS=${JSON.stringify(config.targetHeaders)}`);
    }
  }

  if (config.stdioCommand) {
    args.push('--network=none');
    args.push('-e', `STDIO_COMMAND=${config.stdioCommand}`);
    if (config.stdioArgs && config.stdioArgs.length > 0) {
      args.push('-e', `STDIO_ARGS=${JSON.stringify(config.stdioArgs)}`);
    }
  }

  // Create isolated network
  try {
    execSync('docker network create scanner-isolated 2>/dev/null', { stdio: 'ignore' });
  } catch { /* may already exist */ }

  args.push(imageName);

  try {
    execSync(`docker ${args.join(' ')}`, {
      timeout: (config.timeoutMs ?? 30000) + 5000,
      stdio: 'pipe',
    });
    return readAndValidateSandboxOutput(outputPath, 'DOCKER');
  } catch (err) {
    const result = readAndValidateSandboxOutput(outputPath, 'DOCKER');
    if (result.success) return result;
    return errResult(
      `Docker sandbox failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      'DOCKER',
    );
  }
}

// ─── Read and Validate Sandbox Output ───────────────────────────────

function readAndValidateSandboxOutput(outputPath: string, sandboxType: SandboxType): SandboxResult {
  try {
    if (!fs.existsSync(outputPath)) {
      return errResult('Sandbox output file not found', sandboxType);
    }

    const raw = fs.readFileSync(outputPath, 'utf-8');
    const validation = validateSandboxOutput(raw, '', 10 * 1024 * 1024);

    if (!validation.valid) {
      return errResult(
        `Sandbox output validation failed: ${validation.errors.join(', ')}`,
        sandboxType,
      );
    }

    const parsed = JSON.parse(raw);
    return {
      success: true,
      sandboxType,
      outputPath,
      rawOutput: parsed,
      probes: parsed.probes || {},
      toolHash: parsed.tool_hash || null,
      rawTools: parsed.raw_tools || null,
      toolRiskMatrix: parsed.tool_risk_matrix || null,
      validation,
    };
  } catch (err) {
    return errResult(
      `Failed to read sandbox output: ${err instanceof Error ? err.message : 'Unknown error'}`,
      sandboxType,
    );
  }
}

// ─── Run Command With Seatbelt (macOS) ──────────────────────────────
// Executes a command inside a macOS Seatbelt sandbox using sandbox-exec.
// The sandbox profile denies default access and only allows:
// - Process execution/fork
// - Read access to system libraries and /tmp
// - Write access to /tmp only
// - Network is denied for STDIO commands, allowed for URL probes

interface RawSandboxResult {
  output: string;
  exitCode: number;
  timedOut: boolean;
}

async function runWithSeatbelt(
  command: string,
  args: string[],
  allowNetwork = false,
  timeoutMs = 30000,
  extraEnv?: Record<string, string>,
): Promise<RawSandboxResult> {
  const uuid = crypto.randomUUID();
  const profilePath = `/tmp/mcpguardian-${uuid}.sb`;

  const projectRoot = path.resolve(__dirname, '..', '..');

  const profile = [
    '(version 1)',
    '(deny default)',
    '(allow process-exec)',
    '(allow process-fork)',
    '(allow file-read* (subpath "/usr/lib"))',
    '(allow file-read* (subpath "/usr/local/lib"))',
    '(allow file-read* (subpath "/tmp"))',
    '(allow file-read* (subpath "/private/tmp"))',
    `(allow file-read* (subpath "${projectRoot}"))`,
    '(allow file-write* (subpath "/tmp"))',
    '(allow file-write* (subpath "/private/tmp"))',
    '(allow sysctl-read)',
    allowNetwork ? '(allow network*)' : '(deny network*)',
    '(deny ipc*)',
  ].join('\n');

  try {
    fs.writeFileSync(profilePath, profile, 'utf-8');

    const fullArgs = ['-f', profilePath, command, ...args];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await new Promise<RawSandboxResult>((resolve) => {
        const child = spawn('sandbox-exec', fullArgs, {
          stdio: ['ignore', 'pipe', 'pipe'],
          signal: controller.signal,
          env: { ...process.env, ...extraEnv },
        });

        let stdout = '';
        let stderr = '';
        let resolved = false;

        child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
        child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

        child.on('close', (code) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);
          resolve({ output: stdout || stderr, exitCode: code ?? -1, timedOut: false });
        });

        child.on('error', () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);
          resolve({ output: stderr || stdout, exitCode: -1, timedOut: false });
        });

        controller.signal.addEventListener('abort', () => {
          if (resolved) return;
          resolved = true;
          child.kill('SIGKILL');
          resolve({ output: stdout || stderr, exitCode: -1, timedOut: true });
        });
      });
    } finally {
      clearTimeout(timer);
    }
  } finally {
    try {
      if (fs.existsSync(profilePath)) fs.unlinkSync(profilePath);
    } catch { /* non-critical cleanup */ }
  }
}

// ─── Run Command With Linux Namespace ───────────────────────────────
// Uses unshare to create new user, network, IPC, and PID namespaces
// with --map-root-user for unprivileged operation.

async function runWithNamespace(
  command: string,
  args: string[],
  allowNetwork = false,
  timeoutMs = 30000,
  extraEnv?: Record<string, string>,
): Promise<RawSandboxResult> {
  const unshareArgs = [
    '--user',
    '--ipc',
    '--pid',
    '--fork',
    '--mount-proc',
    '--map-root-user',
  ];

  // Only isolate network for STDIO commands; allow network for URL probes
  if (!allowNetwork) {
    unshareArgs.push('--net');
  }

  unshareArgs.push(command, ...args);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await new Promise<RawSandboxResult>((resolve) => {
      const child = spawn('unshare', unshareArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        signal: controller.signal,
        env: { ...process.env, ...extraEnv },
      });

      let stdout = '';
      let stderr = '';
      let resolved = false;

      child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
      child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

      child.on('close', (code) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        resolve({ output: stdout || stderr, exitCode: code ?? -1, timedOut: false });
      });

      child.on('error', () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        resolve({ output: stderr || stdout, exitCode: -1, timedOut: false });
      });

      controller.signal.addEventListener('abort', () => {
        if (resolved) return;
        resolved = true;
        child.kill('SIGKILL');
        resolve({ output: stdout || stderr, exitCode: -1, timedOut: true });
      });
    });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Fallback: macOS Seatbelt Sandbox ───────────────────────────────

/** Resolve the project root directory (scripts/ lives here). */
function getProjectRoot(): string {
  // Use process.cwd() so it works in both dev and production (e.g., Vercel, .next)
  return process.cwd();
}

async function runSeatbeltSandbox(config: SandboxConfig, outputPath: string): Promise<SandboxResult> {
  const scanId = config.scanId;
  const projectRoot = getProjectRoot();
  const workerScript = path.join(projectRoot, 'scripts', 'probe-worker.js');

  // Build the probe worker command
  const nodeArgs: string[] = [workerScript];
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    SCAN_ID: scanId,
  };

  if (config.targetUrl) {
    env.TARGET_URL = config.targetUrl;
    if (config.targetHeaders && Object.keys(config.targetHeaders).length > 0) {
      env.TARGET_HEADERS = JSON.stringify(config.targetHeaders);
    }
  }

  if (config.stdioCommand) {
    env.STDIO_COMMAND = config.stdioCommand;
    if (config.stdioArgs && config.stdioArgs.length > 0) {
      env.STDIO_ARGS = JSON.stringify(config.stdioArgs);
    }
  }

  const allowNetwork = !!config.targetUrl;
  const timeoutMs = config.timeoutMs ?? 30000;

  // Ensure the temp output directory exists
  const tempOutputDir = '/tmp/scan-output';
  try {
    fs.mkdirSync(tempOutputDir, { recursive: true });
  } catch { /* may already exist */ }

  try {
    const sandboxArgs = [...nodeArgs];
    await runWithSeatbelt('node', sandboxArgs, allowNetwork, timeoutMs, env);

    // The probe-worker.js writes to /tmp/scan-output/results.json on the host
    const workerOutputPath = path.join(tempOutputDir, 'results.json');
    if (fs.existsSync(workerOutputPath)) {
      // Copy to expected output path so readAndValidateSandboxOutput can find it
      try { fs.copyFileSync(workerOutputPath, outputPath); } catch { /* non-critical */ }
      return readAndValidateSandboxOutput(outputPath, 'SEATBELT');
    }

    return errResult(
      'Seatbelt sandbox completed but no results file found. The probe worker may have failed to start.',
      'SEATBELT',
    );
  } catch (err) {
    return errResult(
      `Seatbelt sandbox failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      'SEATBELT',
    );
  }
}

// ─── Fallback: Linux Namespace Sandbox ──────────────────────────────

async function runNamespaceSandbox(config: SandboxConfig, outputPath: string): Promise<SandboxResult> {
  const scanId = config.scanId;
  const projectRoot = getProjectRoot();
  const workerScript = path.join(projectRoot, 'scripts', 'probe-worker.js');

  // Build the probe worker environment
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    SCAN_ID: scanId,
  };

  if (config.targetUrl) {
    env.TARGET_URL = config.targetUrl;
    if (config.targetHeaders && Object.keys(config.targetHeaders).length > 0) {
      env.TARGET_HEADERS = JSON.stringify(config.targetHeaders);
    }
  }

  if (config.stdioCommand) {
    env.STDIO_COMMAND = config.stdioCommand;
    if (config.stdioArgs && config.stdioArgs.length > 0) {
      env.STDIO_ARGS = JSON.stringify(config.stdioArgs);
    }
  }

  const allowNetwork = !!config.targetUrl;
  const timeoutMs = config.timeoutMs ?? 30000;

  // Ensure the temp output directory exists
  const tempOutputDir = '/tmp/scan-output';
  try {
    fs.mkdirSync(tempOutputDir, { recursive: true });
  } catch { /* may already exist */ }

  try {
    await runWithNamespace('node', [workerScript], allowNetwork, timeoutMs, env);

    // The probe-worker.js writes to /tmp/scan-output/results.json on the host
    const workerOutputPath = path.join(tempOutputDir, 'results.json');
    if (fs.existsSync(workerOutputPath)) {
      // Copy to expected output path so readAndValidateSandboxOutput can find it
      try { fs.copyFileSync(workerOutputPath, outputPath); } catch { /* non-critical */ }
      return readAndValidateSandboxOutput(outputPath, 'NAMESPACE');
    }

    return errResult(
      'Namespace sandbox completed but no results file found. The probe worker may have failed to start.',
      'NAMESPACE',
    );
  } catch (err) {
    return errResult(
      `Namespace sandbox failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      'NAMESPACE',
    );
  }
}

// ─── Sandbox Cleanup ────────────────────────────────────────────────

export function cleanupSandbox(scanId: string): void {
  const outputPath = path.join(SCAN_OUTPUT_DIR, `${scanId}-results.json`);
  try {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  } catch { /* non-critical */ }
}

export function cleanupAllSandboxes(): void {
  try {
    if (fs.existsSync(SCAN_OUTPUT_DIR)) {
      const files = fs.readdirSync(SCAN_OUTPUT_DIR);
      for (const file of files) {
        if (file.endsWith('-results.json')) {
          fs.unlinkSync(path.join(SCAN_OUTPUT_DIR, file));
        }
      }
    }
  } catch { /* non-critical */ }
}

// ─── Network Cleanup ────────────────────────────────────────────────

export function cleanupIsolatedNetwork(): void {
  try {
    execSync('docker network rm scanner-isolated 2>/dev/null', { stdio: 'ignore' });
  } catch { /* may be in use */ }
}
