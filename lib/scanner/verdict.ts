import { Issue, Grade, Verdict } from './types';

// ─── Confidence Levels ───────────────────────────────────────────────

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export function calculateConfidence(score: number): Confidence {
  if (score >= 90) return 'HIGH';
  if (score >= 75) return 'MEDIUM';
  if (score >= 60) return 'LOW';
  return 'NONE';
}

// ─── Scoring Caps ────────────────────────────────────────────────────

export interface CapRule {
  check: (issues: Issue[]) => boolean;
  maxScore: number;
  description: string;
}

const scoringCaps: CapRule[] = [
  {
    check: (issues) =>
      issues.some(i => i.type === 'MISSING_AUTH_HEADER' || i.type === 'MISSING_AUTHENTICATION') &&
      issues.some(i => i.type === 'SECRET_IN_URL'),
    maxScore: 40,
    description: 'Missing auth + secret in URL → MAX 40 (F)',
  },
  {
    check: (issues) =>
      issues.some(i => i.type === 'MISSING_AUTH_HEADER' || i.type === 'MISSING_AUTHENTICATION') &&
      !issues.some(i => i.type === 'SECRET_IN_URL'),
    maxScore: 70,
    description: 'Missing auth only → MAX 70 (C)',
  },
  {
    check: (issues) =>
      !issues.some(i => i.type === 'MISSING_AUTH_HEADER' || i.type === 'MISSING_AUTHENTICATION') &&
      issues.some(i => i.type === 'SECRET_IN_URL'),
    maxScore: 45,
    description: 'Secret in URL only → MAX 45 (F)',
  },
  {
    check: (issues) =>
      issues.some(i => i.type === 'HARDCODED_SECRET_IN_HEADERS'),
    maxScore: 60,
    description: 'Hardcoded secret in headers → MAX 60 (D)',
  },
  {
    check: (issues) =>
      issues.some(i => i.type === 'INSECURE_URL') &&
      !issues.some(i => i.type === 'MISSING_AUTH_HEADER'),
    maxScore: 65,
    description: 'HTTP without TLS → MAX 65 (D)',
  },
  {
    check: (issues) =>
      issues.some(i => i.type === 'SOURCE_UNAVAILABLE'),
    maxScore: 60,
    description: 'Source code unavailable → MAX 60 (D)',
  },
  {
    check: (issues) =>
      issues.some(i => i.type === 'PROBE_FAILED' || i.type === 'BEHAVIORAL_PROBE_SKIPPED'),
    maxScore: 70,
    description: 'Behavioral probe not completed → MAX 70 (C)',
  },
  {
    check: (issues) =>
      issues.some(i => i.type === 'PROBE_UNSANDBOXED'),
    maxScore: 75,
    description: 'Probe ran unsandboxed → MAX 75 (C)',
  },
];

/**
 * Apply scoring caps after computing raw deduction-based score.
 */
export function applyScoringCaps(score: number, issues: Issue[]): { score: number; capApplied: string | null } {
  for (const cap of scoringCaps) {
    if (cap.check(issues)) {
      if (score > cap.maxScore) {
        return { score: cap.maxScore, capApplied: cap.description };
      }
    }
  }
  return { score, capApplied: null };
}

// ─── Verdicts ────────────────────────────────────────────────────────

export function determineVerdict(
  score: number,
  issues: Issue[],
  probeSucceeded: boolean,
  domainBlocked: boolean,
  hashChanged: boolean,
  sandboxType?: string,
): Verdict {
  if (domainBlocked) return 'DO_NOT_CONNECT';
  if (hashChanged) return 'DO_NOT_CONNECT';

  const criticalCount = issues.filter(i => i.severity === 'CRITICAL').length;
  const highCount = issues.filter(i => i.severity === 'HIGH').length;

  // Never issue SAFE if only static analysis was performed
  if (!probeSucceeded && score >= 85) return 'CAUTION';

  // Any CRITICAL or score < 65: DO NOT CONNECT
  if (criticalCount > 0 || score < 65) return 'DO_NOT_CONNECT';

  // Probe failed and score is borderline: UNVERIFIED
  if (!probeSucceeded && score < 85) return 'UNVERIFIED';

  // Probe ran without sandbox: never SAFE
  if (!probeSucceeded || sandboxType === 'UNSANDBOXED' || sandboxType === 'NONE') {
    if (score >= 65 && score < 85) return 'CAUTION';
    return 'UNVERIFIED';
  }

  // Score 65-84, no critical, max 2 high: CAUTION
  if (score >= 65 && score < 85 && highCount <= 2) return 'CAUTION';

  // Score >= 85 with no critical and probe completed in sandbox: SAFE
  if (score >= 85) return 'SAFE';

  return 'CAUTION';
}

// ─── Helpers ─────────────────────────────────────────────────────────

export function verdictToLabel(verdict: Verdict): string {
  switch (verdict) {
    case 'SAFE': return '✅ SAFE TO CONNECT';
    case 'CAUTION': return '⚠️ CONNECT WITH CAUTION';
    case 'DO_NOT_CONNECT': return '🚫 DO NOT CONNECT';
    case 'UNVERIFIED': return '🔍 UNVERIFIED';
  }
}

export function calculateGrade(score: number): Grade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
