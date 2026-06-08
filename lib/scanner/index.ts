import { z } from 'zod';
import { Issue, ScanResult, ServerResult, Grade, Severity } from './types';
import { scanForSecrets } from './patterns';
import { checkForVulnerablePackages } from './known-vulnerabilities';

const McpServerSchema = z.looseObject({
  command: z.string().optional(),
  url: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
});

const McpConfigSchema = z.object({
  mcpServers: z.record(z.string(), McpServerSchema),
});

function calculateGrade(score: number): Grade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function scanServer(name: string, server: z.infer<typeof McpServerSchema>): ServerResult {
  const issues: Issue[] = [];
  let deduction = 0;

  const serverString = JSON.stringify(server);
  const argsLower = (server.args || []).join(' ').toLowerCase();
  const nameLower = name.toLowerCase();
  const envValues = server.env ? Object.values(server.env).join(' ') : '';

  const secrets = scanForSecrets(serverString);
  if (secrets.length > 0) {
    const secretDeduction = Math.min(30, secrets.length * 30);
    deduction += secretDeduction;
    issues.push({
      type: 'HARDCODED_SECRETS',
      severity: 'CRITICAL',
      title: 'Hardcoded secrets detected in server configuration',
      description: `Found ${secrets.length} secret(s): ${secrets.map(s => `${s.patternName} (${s.match})`).join(', ')}`,
      fix: 'Remove hardcoded secrets and use environment variables with ${VAR_NAME} syntax instead',
      deduction: secretDeduction,
    });
  }

  if (server.command) {
    deduction += 20;
    issues.push({
      type: 'STDIO_TRANSPORT',
      severity: 'HIGH',
      title: 'Server uses STDIO transport',
      description: `Server "${name}" uses STDIO transport via command "${server.command}" which may allow arbitrary local execution`,
      fix: 'Use HTTPS-based transport instead of STDIO when possible, or restrict the command to a known-safe binary',
      deduction: 20,
    });
  }

  if (server.url && !server.url.startsWith('https://')) {
    deduction += 20;
    issues.push({
      type: 'INSECURE_URL',
      severity: 'HIGH',
      title: 'Server uses insecure URL',
      description: `Server "${name}" uses URL "${server.url}" without HTTPS encryption`,
      fix: 'Change the URL to use https:// to ensure encrypted communication',
      deduction: 20,
    });
  }

  const vulnerablePackages = checkForVulnerablePackages(serverString);
  for (const pkg of vulnerablePackages) {
    let pkgDeduction = 0;
    if (pkg.severity === 'CRITICAL') pkgDeduction = 25;
    else if (pkg.severity === 'HIGH') pkgDeduction = 15;
    else if (pkg.severity === 'MEDIUM') pkgDeduction = 10;
    deduction += pkgDeduction;
    issues.push({
      type: 'VULNERABLE_PACKAGE',
      severity: pkg.severity as Severity,
      title: `Vulnerable package detected: ${pkg.name}`,
      description: `${pkg.name} (${pkg.versions}) - ${pkg.description} (${pkg.cve})`,
      fix: pkg.fix,
      deduction: pkgDeduction,
    });
  }

  const hasFilesystemKeywords = /filesystem|file-system|server-filesystem/.test(nameLower + ' ' + argsLower);
  const hasDirectoryFlag = /--directory|--root-dir/.test(argsLower);
  if (hasFilesystemKeywords && !hasDirectoryFlag) {
    deduction += 20;
    issues.push({
      type: 'UNRESTRICTED_FILESYSTEM',
      severity: 'HIGH',
      title: 'Server has unrestricted filesystem access',
      description: `Server "${name}" appears to be a filesystem server without a directory restriction flag`,
      fix: 'Add --directory or --root-dir flag to restrict access to a specific directory',
      deduction: 20,
    });
  }

  const hasExecKeywords = /exec|shell|bash|terminal|mcp-server-shell/.test(nameLower + ' ' + argsLower);
  if (hasExecKeywords) {
    deduction += 15;
    issues.push({
      type: 'COMMAND_EXECUTION',
      severity: 'HIGH',
      title: 'Server allows arbitrary command execution',
      description: `Server "${name}" may allow arbitrary command execution based on its configuration`,
      fix: 'Remove or restrict command execution capabilities; use sandboxed alternatives',
      deduction: 15,
    });
  }

  const envSecrets = scanForSecrets(envValues);
  if (envSecrets.length > 0) {
    const hasTemplateVar = /\$\{[^}]*\}/.test(envValues);
    if (!hasTemplateVar) {
      deduction += 10;
      issues.push({
        type: 'ENV_VARIABLE_EXPOSURE',
        severity: 'MEDIUM',
        title: 'Environment variables may expose secrets',
        description: `Found ${envSecrets.length} potential secret(s) in environment variables of server "${name}"`,
        fix: 'Use ${VARIABLE_NAME} template syntax to reference secrets instead of hardcoding them in env values',
        deduction: 10,
      });
    }
  }

  const argsJoined = (server.args || []).join(' ');
  const hasBroadPath = /\/\.ssh|\/etc|\/root|C:\\\\/.test(argsJoined);
  if (hasBroadPath) {
    deduction += 10;
    issues.push({
      type: 'BROAD_PERMISSIONS',
      severity: 'MEDIUM',
      title: 'Server has broad filesystem permissions',
      description: `Server "${name}" has arguments that reference sensitive system paths (/.ssh, /etc, /root, C:\\)`,
      fix: 'Restrict server arguments to only the necessary directories and avoid sensitive system paths',
      deduction: 10,
    });
  }

  const score = Math.max(0, 100 - deduction);

  return {
    name,
    score,
    grade: calculateGrade(score),
    issues,
  };
}

export function scanMcpConfig(configJson: string): ScanResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(configJson);
  } catch {
    throw new Error('Invalid JSON: The provided configuration is not valid JSON');
  }

  const result = McpConfigSchema.safeParse(parsed);
  if (!result.success) {
    const errorMessages = result.error.issues.map(i => i.message).join(', ');
    if (result.error.issues[0]?.path?.length === 0) {
      throw new Error('Invalid configuration: The JSON must contain an "mcpServers" key');
    }
    throw new Error(`Invalid configuration: ${errorMessages}`);
  }

  const mcpServers = result.data.mcpServers;
  const serverNames = Object.keys(mcpServers);

  if (serverNames.length === 0) {
    return {
      grade: 'A',
      score: 100,
      serversScanned: 0,
      criticalIssues: 0,
      highIssues: 0,
      mediumIssues: 0,
      servers: [],
      scannedAt: new Date().toISOString(),
    };
  }

  const serverResults = serverNames.map(name => scanServer(name, mcpServers[name] as z.infer<typeof McpServerSchema>));

  const totalScore = serverResults.reduce((sum, s) => sum + s.score, 0);
  const averageScore = Math.round(totalScore / serverResults.length);

  let criticalIssues = 0;
  let highIssues = 0;
  let mediumIssues = 0;

  for (const server of serverResults) {
    for (const issue of server.issues) {
      if (issue.severity === 'CRITICAL') criticalIssues++;
      else if (issue.severity === 'HIGH') highIssues++;
      else if (issue.severity === 'MEDIUM') mediumIssues++;
    }
  }

  return {
    grade: calculateGrade(averageScore),
    score: averageScore,
    serversScanned: serverResults.length,
    criticalIssues,
    highIssues,
    mediumIssues,
    servers: serverResults,
    scannedAt: new Date().toISOString(),
  };
}