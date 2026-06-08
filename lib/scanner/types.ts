export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface Issue {
  type: string;
  severity: Severity;
  title: string;
  description: string;
  fix: string;
  deduction: number;
}

export interface ServerResult {
  name: string;
  score: number;
  grade: Grade;
  issues: Issue[];
}

export interface ScanResult {
  grade: Grade;
  score: number;
  serversScanned: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  servers: ServerResult[];
  scannedAt: string;
}

export interface SecretMatch {
  patternName: string;
  match: string;
  severity: Severity;
}

export interface VulnerablePackage {
  name: string;
  versions: string;
  cve: string;
  severity: Severity;
  description: string;
  fix: string;
}