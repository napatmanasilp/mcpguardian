import { z } from 'zod';
import {
  ServerResult, VulnerablePackage,
  Verdict, McpServerInput, ExtendedScanResult,
} from './types';
import { generateSbom } from './known-vulnerabilities';
import { analyzeCrossServerRisks } from './cross-server';
import { enrichIssuesWithCompliance, buildComplianceSummary } from '../compliance-mappings';
import { calculateGrade } from './verdict';
import { runFreeModePipeline } from './pipeline';

export type { McpServerInput } from './types';

const McpServerSchema = z.looseObject({
  command: z.string().optional(),
  url: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  sbomPath: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  cwd: z.string().optional(),
});

const McpConfigSchema = z.object({
  mcpServers: z.record(z.string(), McpServerSchema),
});

export async function scanMcpConfig(configJson: string, vulnerabilities?: VulnerablePackage[]): Promise<ExtendedScanResult> {
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
      verdict: 'SAFE',
      scanMode: 'FREE',
      serversScanned: 0,
      criticalIssues: 0,
      highIssues: 0,
      mediumIssues: 0,
      servers: [],
      scannedAt: new Date().toISOString(),
      worstServer: '',
      secondaryScore: 100,
      totalPromptsScanned: 0,
      totalResourcesScanned: 0,
    };
  }

  // Run the full pipeline for each server
  const pipelineResults = await Promise.all(
    serverNames.map(name =>
      runFreeModePipeline(name, mcpServers[name] as McpServerInput),
    ),
  );

  // Build backward-compatible ServerResult array
  const serverResults: ServerResult[] = pipelineResults.map(pr => ({
    name: pr.report.serverName,
    score: pr.serverScore,
    grade: pr.report.grade,
    issues: pr.serverIssues,
    toolsHash: pr.toolsHash,
    rawTools: pr.rawTools,
    serverUrl: pr.report.serverUrl,
    promptsCount: pr.promptsCount,
    resourcesCount: pr.resourcesCount,
  }));

  const pipelineReports = pipelineResults.map(pr => pr.report);

  const totalScore = serverResults.reduce((sum, s) => sum + s.score, 0);
  const secondaryScore = Math.round(totalScore / serverResults.length);

  let worstServer = serverResults[0].name;
  let worstScore = serverResults[0].score;

  let criticalIssues = 0;
  let highIssues = 0;
  let mediumIssues = 0;

  for (const server of serverResults) {
    if (server.score < worstScore) {
      worstScore = server.score;
      worstServer = server.name;
    }
    for (const issue of server.issues) {
      if (issue.severity === 'CRITICAL') criticalIssues++;
      else if (issue.severity === 'HIGH') highIssues++;
      else if (issue.severity === 'MEDIUM') mediumIssues++;
    }
  }

  // Determine overall verdict: worst case wins
  const worstVerdict: Verdict = pipelineReports.reduce((worst, r) => {
    const order: Record<Verdict, number> = {
      'DO_NOT_CONNECT': 4,
      'UNVERIFIED': 3,
      'CAUTION': 2,
      'SAFE': 1,
    };
    return order[r.verdict] > order[worst] ? r.verdict : worst;
  }, 'SAFE' as Verdict);

  const { risks: rawCrossServerRisks, extraDeduction: crossServerDeduction } = analyzeCrossServerRisks(serverResults, serverNames);
  const totalScoreWithCrossServer = Math.max(0, worstScore - crossServerDeduction);

  const crossServerRisks = enrichIssuesWithCompliance(rawCrossServerRisks);

  if (crossServerDeduction > 0) {
    for (const risk of crossServerRisks) {
      if (risk.severity === 'CRITICAL') criticalIssues++;
      else if (risk.severity === 'HIGH') highIssues++;
      else if (risk.severity === 'MEDIUM') mediumIssues++;
    }
  }

  const allIssues = serverResults.flatMap(s => s.issues);
  const { entries: sbom, issues: sbomIssues } = generateSbom(mcpServers as Record<string, McpServerInput>, vulnerabilities);
  allIssues.push(...sbomIssues);
  const complianceSummary = buildComplianceSummary(allIssues, crossServerRisks);

  const totalPromptsScanned = serverResults.reduce((sum, s) => sum + s.promptsCount, 0);
  const totalResourcesScanned = serverResults.reduce((sum, s) => sum + s.resourcesCount, 0);

  return {
    grade: calculateGrade(totalScoreWithCrossServer),
    score: totalScoreWithCrossServer,
    verdict: worstVerdict,
    scanMode: 'FREE',
    serversScanned: serverResults.length,
    criticalIssues,
    highIssues,
    mediumIssues,
    servers: serverResults,
    pipelineReports,
    scannedAt: new Date().toISOString(),
    worstServer,
    secondaryScore,
    totalPromptsScanned,
    totalResourcesScanned,
    crossServerRisks: crossServerRisks.length > 0 ? crossServerRisks : undefined,
    crossServerDeduction: crossServerDeduction > 0 ? crossServerDeduction : undefined,
    complianceSummary,
    sbom: sbom.length > 0 ? sbom : undefined,
  };
}