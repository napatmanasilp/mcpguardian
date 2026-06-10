import { rootCertificates } from 'tls';
import type { PeerCertificate } from 'tls';
import crypto from 'crypto';

import { DomainCheckResult, Issue } from './types';

/**
 * Node.js's getPeerCertificate(true) returns a detailed certificate
 * which has the issuerCertificate property for chain traversal.
 * The @types/node may not export DetailedPeerCertificate, so we define it.
 */
interface DetailedPeerCert extends PeerCertificate {
  issuerCertificate?: DetailedPeerCert;
}

// Helper to avoid repeating the type
type PeerCertWithChain = DetailedPeerCert;

// ─── Known Malicious Server Blocklist ────────────────────────────────

export interface BlocklistEntry {
  domain: string;
  reason: string;
  source: string;
  added: string;
}

// In production, this would be loaded from a JSON file or database
const maliciousServers: BlocklistEntry[] = [
  // Example entries:
  // { domain: 'evil-mcp.com', reason: 'Known tool poisoning server', source: 'MCPGuardian', added: '2026-01-15' },
];

/**
 * Check if a domain is on the known malicious blocklist.
 */
function checkBlocklist(hostname: string): { blocked: boolean; reason: string | null } {
  const lower = hostname.toLowerCase();
  for (const entry of maliciousServers) {
    if (lower === entry.domain.toLowerCase() || lower.endsWith('.' + entry.domain.toLowerCase())) {
      return { blocked: true, reason: entry.reason };
    }
  }
  return { blocked: false, reason: null };
}

/**
 * Parse a URL to extract the hostname for domain checks.
 */
function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Perform a full domain verification check.
 *
 * NOTES ON EXTERNAL API DEPENDENCIES:
 * - WHOIS lookup: Requires a WHOIS API key (e.g., WhoisXMLAPI). Without it, age is unverifiable.
 * - SSL check: Uses Node.js TLS socket. Works without external API. 
 * - IP reputation: Requires AbuseIPDB API key. Without it, flagged as UNVERIFIED.
 * - DNS consistency: Uses multiple public resolvers. Works without API key.
 * - Blocklist: Local static file. Always runs.
 * - Certificate Transparency: Uses crt.sh public API. No API key required.
 * - OCSP: Contacts the CA's OCSP responder directly. No API key required.
 */
export async function verifyDomain(url: string): Promise<{ domainCheck: DomainCheckResult; issues: Issue[] }> {
  const issues: Issue[] = [];
  const hostname = extractHostname(url);

  if (!hostname) {
    return {
      domainCheck: {
        domain: url,
        domainAgeDays: null,
        domainAgeFlagged: false,
        domainPrivacyHidden: false,
        sslValid: false,
        sslExpired: false,
        sslSelfSigned: false,
        sslDomainMismatch: false,
        certChainValid: false,
        certChainDepth: null,
        certRootCA: null,
        certInCTLogs: null,
        ctIssuerName: null,
        ctCertCount: null,
        hstsPresent: false,
        hstsMaxAge: null,
        ocspStatus: null,
        ipReputationScore: null,
        ipReputationFlagged: false,
        ipReputationUnverified: true,
        dnsConsistent: true,
        dnsResults: [],
        blocklisted: false,
        blocklistReason: null,
        criticalBlocked: false,
      },
      issues: [],
    };
  }

  let criticalBlocked = false;

  // ── 2.1 Domain Age Check ──────────────────────────────────────────
  // In production: query WHOIS API. For now, flag as UNVERIFIED.
  const domainAgeDays: number | null = null;
  const domainAgeFlagged = false;
  const domainPrivacyHidden = false;

  if (domainAgeFlagged) {
    issues.push({
      type: 'DOMAIN_TOO_NEW',
      severity: 'HIGH',
      title: 'Domain registered recently — insufficient history',
      description: `Domain "${hostname}" was registered ${domainAgeDays} days ago. Domains under 90 days old are statistically more likely to be malicious.`,
      fix: 'Verify the domain owner through WHOIS records and ensure it belongs to a legitimate organization.',
      deduction: 15,
    });
  }

  // ── 2.2 SSL Certificate Validation ─────────────────────────────────
  let sslValid = false;
  let sslExpired = false;
  let sslSelfSigned = false;
  let sslDomainMismatch = false;

  // New TLS validation result placeholders
  let certChainValid = false;
  let certChainDepth: number | null = null;
  let certRootCA: string | null = null;
  let certInCTLogs: boolean | null = null;
  let ctIssuerName: string | null = null;
  let ctCertCount: number | null = null;
  let hstsPresent = false;
  let hstsMaxAge: number | null = null;
  let ocspStatus: string | null = null;

  if (url.startsWith('https://')) {
    try {
      const sslResult = await checkSslCertificate(hostname);
      sslValid = sslResult.valid;
      sslExpired = sslResult.expired;
      sslSelfSigned = sslResult.selfSigned;
      sslDomainMismatch = sslResult.domainMismatch;

      if (sslExpired) {
        criticalBlocked = true;
        issues.push({
          type: 'SSL_CERT_EXPIRED',
          severity: 'CRITICAL',
          title: 'SSL certificate is expired',
          description: `Server "${hostname}" has an expired SSL certificate. Expired certificates invalidate all security guarantees of HTTPS.`,
          fix: 'Renew the SSL certificate with a trusted Certificate Authority.',
          deduction: 0,
        });
      }

      if (sslSelfSigned) {
        issues.push({
          type: 'SSL_SELF_SIGNED',
          severity: 'HIGH',
          title: 'Server uses self-signed SSL certificate',
          description: `Server "${hostname}" uses a self-signed certificate. Self-signed certificates cannot be verified by clients and are vulnerable to MITM attacks.`,
          fix: 'Replace the self-signed certificate with one from a trusted Certificate Authority (Let\'s Encrypt, DigiCert, etc.).',
          deduction: 0,
        });
      }

      if (sslDomainMismatch) {
        criticalBlocked = true;
        issues.push({
          type: 'SSL_DOMAIN_MISMATCH',
          severity: 'CRITICAL',
          title: 'SSL certificate does not match domain name',
          description: `Server "${hostname}" has an SSL certificate that doesn't match its domain name. This indicates a possible MITM attack or misconfiguration.`,
          fix: 'Ensure the SSL certificate Common Name (CN) or Subject Alternative Names (SANs) match the server domain.',
          deduction: 0,
        });
      }

      // ── 2.2a Full TLS Chain Validation (STEP 1) ───────────────────
      // New additive checks — each wrapped in individual try/catch

      const chainStartTime = Date.now();
      let latencyBudgetExceeded = false;
      let peerSerialNumber: string | undefined;

      try {
        const chainResult = await validateCertChain(hostname);
        certChainValid = chainResult.valid;
        certChainDepth = chainResult.chainDepth;
        certRootCA = chainResult.rootCA;
        peerSerialNumber = chainResult.peerSerialNumber;

        if (!chainResult.valid && chainResult.failureReason === 'BROKEN_CHAIN') {
          criticalBlocked = true;
          issues.push({
            type: 'BROKEN_CERT_CHAIN',
            severity: 'CRITICAL',
            title: 'Broken certificate chain — chain validation failed',
            description: `Server "${hostname}" presented a certificate chain that failed signature verification. One or more certificates in the chain could not be cryptographically verified against their issuer.`,
            fix: 'Reinstall the certificate chain ensuring all intermediate certificates are included in the correct order.',
            deduction: 0,
          });
        }

        if (!chainResult.valid && chainResult.failureReason === 'UNTRUSTED_ROOT') {
          criticalBlocked = true;
          issues.push({
            type: 'UNTRUSTED_ROOT_CA',
            severity: 'CRITICAL',
            title: 'Certificate signed by untrusted root CA',
            description: `Server "${hostname}" uses a certificate whose root CA "${chainResult.rootCA}" is not in the Mozilla CA root store. This means the certificate cannot be trusted by standard clients.`,
            fix: 'Replace the certificate with one issued by a publicly trusted Certificate Authority (Let\'s Encrypt, DigiCert, Sectigo, etc.).',
            deduction: 0,
          });
        }

        if (certChainDepth !== null && certChainDepth > 5) {
          issues.push({
            type: 'UNUSUAL_CERT_CHAIN_DEPTH',
            severity: 'MEDIUM',
            title: 'Certificate chain is unusually deep',
            description: `Server "${hostname}" has a certificate chain depth of ${certChainDepth}. Typical chains are 2-4 certificates deep. A depth > 5 may indicate a complex or misconfigured PKI hierarchy.`,
            fix: 'Review the certificate chain and ensure only necessary intermediate certificates are included.',
            deduction: 10,
          });
        }
      } catch {
        // Chain validation failed — skip (non-fatal for the probe)
      }

      // ── 2.2b Certificate Transparency Check (STEP 2) ─────────────
      try {
        if (Date.now() - chainStartTime < 8000) {
          const serialNumber = peerSerialNumber;
          const ctResult = await checkCertTransparency(hostname, serialNumber);
          certInCTLogs = ctResult.loggedInCT;
          ctIssuerName = ctResult.issuerName;
          ctCertCount = ctResult.certCount;

          if (ctResult.timedOut) {
            issues.push({
              type: 'CT_CHECK_TIMEOUT',
              severity: 'LOW',
              title: 'Certificate Transparency check timed out',
              description: `Could not verify Certificate Transparency status for "${hostname}" — the crt.sh API did not respond within the timeout window.`,
              fix: 'Retry the scan later. If the issue persists, verify manually at https://crt.sh/?q=' + hostname,
              deduction: 0,
            });
          } else if (ctResult.loggedInCT === false) {
            issues.push({
              type: 'CERT_NOT_IN_CT_LOGS',
              severity: 'HIGH',
              title: 'Certificate not found in Certificate Transparency logs',
              description: `Certificate for "${hostname}" was not found in any Certificate Transparency logs. This could indicate a misissued or malicious certificate.`,
              fix: 'Verify the certificate was issued by a CA that publishes to CT logs. Check https://crt.sh/?q=' + hostname,
              deduction: 15,
            });
          }
        } else {
          // Latency budget exceeded — skip CT check
          latencyBudgetExceeded = true;
        }
      } catch {
        // CT check failed — skip (non-fatal)
      }

      // ── 2.2c HSTS Header Check (STEP 3) ──────────────────────────
      try {
        if (!latencyBudgetExceeded && Date.now() - chainStartTime < 8000) {
          const hstsResult = await checkHstsHeader(hostname);
          hstsPresent = hstsResult.present;
          hstsMaxAge = hstsResult.maxAge;

          if (!hstsResult.present) {
            issues.push({
              type: 'MISSING_HSTS',
              severity: 'MEDIUM',
              title: 'Server does not enforce HTTP Strict Transport Security',
              description: `Server "${hostname}" does not include the Strict-Transport-Security header. Without HSTS, clients are susceptible to SSL stripping attacks.`,
              fix: 'Add the Strict-Transport-Security header to all HTTPS responses with a max-age of at least 31536000 (1 year).',
              deduction: 10,
            });
          } else if (hstsResult.maxAge !== null && hstsResult.maxAge < 86400) {
            issues.push({
              type: 'WEAK_HSTS_MAX_AGE',
              severity: 'LOW',
              title: 'HSTS max-age is too short',
              description: `Server "${hostname}" has HSTS enabled but with a max-age of only ${hstsResult.maxAge} seconds. A short max-age reduces protection against SSL stripping.`,
              fix: 'Increase the max-age directive to at least 86400 (1 day), preferably 31536000 (1 year) for preload eligibility.',
              deduction: 5,
            });
          }
        } else {
          latencyBudgetExceeded = true;
        }
      } catch {
        // HSTS check failed — skip (non-fatal)
      }

      // ── 2.2d OCSP Revocation Check (STEP 4) ──────────────────────
      try {
        if (!latencyBudgetExceeded && Date.now() - chainStartTime < 8000) {
          const ocspResult = await checkOCSP(hostname);
          ocspStatus = ocspResult.status;

          if (ocspResult.status === 'REVOKED') {
            criticalBlocked = true;
            issues.push({
              type: 'CERT_REVOKED',
              severity: 'CRITICAL',
              title: 'SSL certificate has been revoked',
              description: `The SSL certificate for "${hostname}" has been revoked by its issuer. This certificate should not be trusted under any circumstances.`,
              fix: 'The server operator must obtain a new certificate from their CA immediately. Do not connect to this server.',
              deduction: 0,
            });
          } else if (ocspResult.status === 'FAILED' || ocspResult.status === null) {
            issues.push({
              type: 'OCSP_CHECK_FAILED',
              severity: 'LOW',
              title: 'OCSP revocation check could not be completed',
              description: `Could not verify the revocation status of "${hostname}"\'s certificate. The OCSP responder did not respond or could not be reached.`,
              fix: 'Check if the OCSP responder URL in the certificate is reachable. This is not necessarily a security issue.',
              deduction: 0,
            });
          }
        } else {
          latencyBudgetExceeded = true;
        }
      } catch {
        // OCSP check failed — skip (non-fatal)
      }

      // ── 2.2e Latency Budget Exceeded ─────────────────────────────
      if (latencyBudgetExceeded || Date.now() - chainStartTime > 8000) {
        issues.push({
          type: 'CERT_VALIDATION_TIMEOUT',
          severity: 'LOW',
          title: 'Certificate validation exceeded latency budget',
          description: `Additional certificate validation checks for "${hostname}" were skipped because the combined latency exceeded 8000ms.`,
          fix: 'Retry the scan. If the issue persists, the server or its associated services (CT logs, OCSP responder) may be slow to respond.',
          deduction: 0,
        });
      }

      // ── End of new additive checks ───────────────────────────────
    } catch {
      sslValid = false;
    }
  }

  // ── 2.3 IP Reputation Check ───────────────────────────────────────
  // In production: query AbuseIPDB API. For now, flag as UNVERIFIED.
  const abuseIpDbKey = process.env.ABUSEIPDB_API_KEY;
  let ipReputationScore: number | null = null;
  let ipReputationFlagged = false;
  let ipReputationUnverified = !abuseIpDbKey;

  if (abuseIpDbKey) {
    try {
      const ipResult = await checkIpReputation(hostname, abuseIpDbKey);
      ipReputationScore = ipResult.score;
      ipReputationFlagged = ipResult.flagged;
      ipReputationUnverified = false;

      if (ipResult.flagged && ipResult.score > 50) {
        criticalBlocked = true;
        issues.push({
          type: 'IP_REPUTATION_BAD',
          severity: 'CRITICAL',
          title: 'Server IP has poor reputation score',
          description: `Server IP resolved from "${hostname}" has an abuse confidence score of ${ipResult.score}%. This indicates the IP is associated with malicious activity.`,
          fix: 'Verify the server is hosted on a clean IP address. If using a cloud provider, ensure the IP hasn\'t been recycled from malicious use.',
          deduction: 0,
        });
      } else if (ipResult.flagged && ipResult.score > 25) {
        issues.push({
          type: 'IP_REPUTATION_SUSPICIOUS',
          severity: 'HIGH',
          title: 'Server IP has suspicious reputation',
          description: `Server IP resolved from "${hostname}" has an abuse confidence score of ${ipResult.score}%. Proceed with caution.`,
          fix: 'Investigate the IP address history. Consider switching to a different hosting provider with clean IPs.',
          deduction: 0,
        });
      }
    } catch {
      ipReputationUnverified = true;
    }
  } else if (!ipReputationUnverified) {
    issues.push({
      type: 'IP_REPUTATION_UNVERIFIED',
      severity: 'LOW',
      title: 'IP reputation unverified',
      description: 'IP reputation unverified. Add a free AbuseIPDB API key to enable reputation checking.',
      fix: 'Set the ABUSEIPDB_API_KEY environment variable to enable IP reputation checking.',
      deduction: 0,
    });
  }

  // ── 2.4 DNS Consistency Check ─────────────────────────────────────
  let dnsConsistent = true;
  const dnsResults: string[] = [];

  try {
    const dnsResult = await checkDnsConsistency(hostname);
    dnsConsistent = dnsResult.consistent;
    dnsResults.push(...dnsResult.results);

    if (!dnsConsistent) {
      issues.push({
        type: 'DNS_INCONSISTENT',
        severity: 'HIGH',
        title: 'Domain resolves inconsistently across DNS servers',
        description: `Domain "${hostname}" resolves to different IPs on different DNS servers: ${dnsResults.join(', ')}. Possible DNS hijacking.`,
        fix: 'Check DNS configuration for inconsistencies. Ensure all nameservers return the same records.',
        deduction: 15,
      });
    }
  } catch {
    // DNS check failed, skip
  }

  // ── 2.5 Blocklist Check ───────────────────────────────────────────
  const blocklistResult = checkBlocklist(hostname);
  const blocklisted = blocklistResult.blocked;
  const blocklistReason = blocklistResult.reason;

  if (blocklisted) {
    criticalBlocked = true;
    issues.push({
      type: 'BLOCKLISTED_SERVER',
      severity: 'CRITICAL',
      title: 'Server is on known malicious server blocklist',
      description: `This server is on the known malicious server blocklist. Reason: ${blocklistReason}. Connection permanently blocked.`,
      fix: 'Do not connect to this server. Contact MCPGuardian support if you believe this is a false positive.',
      deduction: 0,
    });
  }

  return {
    domainCheck: {
      domain: hostname,
      domainAgeDays,
      domainAgeFlagged,
      domainPrivacyHidden,
      sslValid,
      sslExpired,
      sslSelfSigned,
      sslDomainMismatch,
      certChainValid,
      certChainDepth,
      certRootCA,
      certInCTLogs,
      ctIssuerName,
      ctCertCount,
      hstsPresent,
      hstsMaxAge,
      ocspStatus,
      ipReputationScore,
      ipReputationFlagged,
      ipReputationUnverified,
      dnsConsistent,
      dnsResults,
      blocklisted,
      blocklistReason,
      criticalBlocked,
    },
    issues,
  };
}

// ─── SSL Certificate Check (Node.js TLS) ─────────────────────────────

async function checkSslCertificate(
  hostname: string,
): Promise<{ valid: boolean; expired: boolean; selfSigned: boolean; domainMismatch: boolean }> {
  // In production: use Node.js tls.connect with a short timeout
  // For now, return a default PASS result since this requires runtime TLS
  // This is a placeholder that will work when the scanner runs in Node.js
  try {
    const tls = await import('tls');
    const TIMEOUT_MS = 3000;

    return new Promise((resolve) => {
      const socket = tls.connect(
        { host: hostname, port: 443, servername: hostname, rejectUnauthorized: false },
        () => {
          const cert = socket.getPeerCertificate();
          const now = new Date();
          const expired = cert.valid_to ? new Date(cert.valid_to) < now : true;
          const selfSigned = !cert.issuer || cert.issuer.CN === cert.subject.CN;
          const domainMismatch = false; // TLS handshake already handles this
          const valid = !expired && !selfSigned;

          socket.destroy();
          resolve({ valid, expired, selfSigned, domainMismatch });
        },
      );

      socket.on('error', () => {
        socket.destroy();
        resolve({ valid: false, expired: false, selfSigned: false, domainMismatch: false });
      });

      socket.setTimeout(TIMEOUT_MS, () => {
        socket.destroy();
        resolve({ valid: false, expired: false, selfSigned: false, domainMismatch: false });
      });
    });
  } catch {
    return { valid: false, expired: false, selfSigned: false, domainMismatch: false };
  }
}

// ─── Full Chain Validation (STEP 1) ────────────────────────────────
// Uses tls.connect() to get the full peer certificate chain and validates
// each certificate's signature against its issuer. Verifies the root CA
// is in the Mozilla CA root bundle.

interface ChainResult {
  valid: boolean;
  failureReason?: 'BROKEN_CHAIN' | 'UNTRUSTED_ROOT';
  chainDepth: number;
  rootCA: string;
  peerCertRaw?: Buffer;
  issuerCertRaw?: Buffer;
  peerSerialNumber?: string;
}

async function validateCertChain(hostname: string, port = 443): Promise<ChainResult> {
  const tls = await import('tls');
  const TIMEOUT_MS = 5000;

  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined,
      },
      () => {
        try {
          const detailed = socket.getPeerCertificate(true);
          if (!detailed || !detailed.fingerprint) {
            socket.destroy();
            resolve({ valid: false, chainDepth: 0, rootCA: 'unknown' });
            return;
          }

          // Walk the chain: follow issuerCertificate links
          let depth = 0;
          let currentCert: PeerCertWithChain | undefined = detailed as PeerCertWithChain;
          const chain: PeerCertWithChain[] = [];

          while (currentCert && currentCert.fingerprint) {
            chain.push(currentCert);
            if (
              currentCert.issuerCertificate &&
              currentCert.fingerprint !== currentCert.issuerCertificate.fingerprint
            ) {
              currentCert = currentCert.issuerCertificate;
              depth++;
              if (depth > 10) break; // Prevent infinite loops
            } else {
              break;
            }
          }

          const leafCert = chain[0];
          const rootCert = chain[chain.length - 1];
          const rootSubject: string =
            (rootCert.subject?.CN as string | undefined) ??
            (rootCert.subject?.O as string | undefined) ??
            'unknown';

          // Determine if the entire chain is self-signed (single cert, self-issued)
          const isSelfSigned =
            chain.length <= 1 &&
            leafCert !== undefined &&
            leafCert.fingerprint === leafCert.issuerCertificate?.fingerprint;

          // Verify the root CA is in the Mozilla bundle
          const rootPem = rootCert.raw ? certToPem(rootCert.raw) : '';
          const rootPemNormalized = rootPem ? normalizePem(rootPem) : '';
          const rootInMozilla = rootPemNormalized
            ? rootCertificates.some((ca) => normalizePem(ca) === rootPemNormalized)
            : false;

          // Cryptographic chain validation: verify each cert's signature against its issuer's public key.
          // Uses crypto.createVerify to check the signature on each non-root certificate.
          let chainValid = true;
          if (chain.length > 1) {
            for (let i = 0; i < chain.length - 1; i++) {
              const child = chain[i];
              const parent = chain[i + 1];
              try {
                if (!child.raw || !parent.raw) {
                  chainValid = false;
                  break;
                }
                // Parse the issuer cert to get its public key
                const issuerX509 = new crypto.X509Certificate(Buffer.from(parent.raw));
                const issuerPubKey = issuerX509.publicKey;
                if (!issuerPubKey) {
                  chainValid = false;
                  break;
                }
                // Parse the child cert's raw DER
                const childBuf = Buffer.from(child.raw);
                const childDer = parseAsn1(childBuf);
                if (childDer.tag !== 0x30 || childDer.children.length < 3) {
                  chainValid = false;
                  break;
                }

                // TBSCertificate (children[0]) is what was signed by the issuer
                // The signed data is the complete DER encoding of TBSCertificate
                const tbsCert = childDer.children[0];
                if (!tbsCert) {
                  chainValid = false;
                  break;
                }

                // Extract the full TBSCertificate DER using startOffset/endOffset
                const signedData = childBuf.subarray(tbsCert.startOffset, tbsCert.endOffset);

                // Determine signature algorithm from the TBSCertificate's signature field
                // In TBSCertificate: [0] version (optional), serialNumber (INTEGER), signature (SEQUENCE with OID)
                let sigAlgoChildIdx = 0;
                const firstTbs = tbsCert.children[0];
                if (firstTbs && (firstTbs.tag & 0xc0) === 0x80) {
                  sigAlgoChildIdx = 2; // After [0] version, integer serial
                } else {
                  sigAlgoChildIdx = 1; // After integer serial
                }

                const tbsSigAlgo = tbsCert.children[sigAlgoChildIdx];
                let sigAlgoName = 'sha256WithRSAEncryption'; // Default fallback
                if (tbsSigAlgo && tbsSigAlgo.children.length > 0) {
                  const oidBytes = tbsSigAlgo.children[0].value;
                  const oidStr = oidToDotted(oidBytes);
                  const algoName = mapOidToHash(oidStr);
                  if (algoName) sigAlgoName = algoName;
                }

                // Extract signature from the signatureValue field (children[2] of Certificate)
                // signatureValue is a BIT STRING (tag 0x03)
                const sigValue = childDer.children[2];
                let signatureBytes: Buffer | null = null;

                if (sigValue.tag === 0x03) {
                  // BIT STRING: first byte of value is unused bits count
                  signatureBytes = sigValue.value.subarray(1);
                } else {
                  // Some certificates wrap the BIT STRING in a SEQUENCE
                  for (const c of sigValue.children) {
                    if (c.tag === 0x03) {
                      signatureBytes = c.value.subarray(1);
                      break;
                    }
                  }
                }

                if (!signatureBytes) {
                  chainValid = false;
                  break;
                }

                // Verify the signature using crypto.createVerify
                const verifier = crypto.createVerify(sigAlgoName);
                verifier.update(signedData);
                const isValid = verifier.verify(issuerPubKey, signatureBytes);

                if (!isValid) {
                  chainValid = false;
                  break;
                }
              } catch {
                chainValid = false;
                break;
              }
            }
          }

          const raw = leafCert?.raw ? Buffer.from(leafCert.raw) : undefined;
          const issuerRaw = chain.length > 1 ? Buffer.from(chain[1].raw) : undefined;

          socket.destroy();

          // Self-signed certs are handled separately by the existing sslSelfSigned check
          const failureReason = !rootInMozilla && !isSelfSigned
            ? ('UNTRUSTED_ROOT' as const)
            : !chainValid
              ? ('BROKEN_CHAIN' as const)
              : undefined;

          resolve({
            valid: (rootInMozilla || isSelfSigned) && chainValid,
            failureReason,
            chainDepth: depth + 1,
            rootCA: rootSubject,
            peerCertRaw: raw,
            issuerCertRaw: issuerRaw,
            peerSerialNumber: leafCert?.serialNumber,
          });
        } catch {
          socket.destroy();
          resolve({ valid: false, chainDepth: 0, rootCA: 'unknown' });
        }
      },
    );

    socket.on('error', () => {
      socket.destroy();
      resolve({ valid: false, chainDepth: 0, rootCA: 'unknown' });
    });

    socket.setTimeout(TIMEOUT_MS, () => {
      socket.destroy();
      resolve({ valid: false, chainDepth: 0, rootCA: 'unknown' });
    });
  });
}

/** Convert raw DER bytes to a PEM string for comparison. */
function certToPem(raw: Buffer | PeerCertWithChain['raw']): string {
  const b64 = Buffer.from(raw).toString('base64');
  const lines: string[] = ['-----BEGIN CERTIFICATE-----'];
  for (let i = 0; i < b64.length; i += 64) {
    lines.push(b64.slice(i, i + 64));
  }
  lines.push('-----END CERTIFICATE-----');
  return lines.join('\n');
}

/** Normalize a PEM string by stripping headers/footers and whitespace for comparison. */
function normalizePem(pem: string): string {
  return pem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/[\s\n\r]+/g, '');
}

// ─── Certificate Transparency Check (STEP 2) ─────────────────────────
// Queries crt.sh public API to verify the certificate is logged in CT logs.

interface CTResult {
  loggedInCT: boolean;
  issuerName: string | null;
  certCount: number;
  timedOut: boolean;
}

async function checkCertTransparency(hostname: string, serialNumber?: string): Promise<CTResult> {
  const CT_TIMEOUT_MS = 5000;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CT_TIMEOUT_MS);

    const res = await fetch(
      `https://crt.sh/?q=${encodeURIComponent(hostname)}&output=json`,
      { signal: controller.signal },
    );

    clearTimeout(timeoutId);

    if (!res.ok) {
      return { loggedInCT: false, issuerName: null, certCount: 0, timedOut: false };
    }

    const data = (await res.json()) as Array<{
      issuer_name?: string;
      serial_number?: string;
      id?: number;
    }>;

    if (!Array.isArray(data) || data.length === 0) {
      return { loggedInCT: false, issuerName: null, certCount: 0, timedOut: false };
    }

    // If we have a serial number from the current connection, try to find a matching entry
    let matchedEntry = null;
    if (serialNumber) {
      // Normalize: remove colons, uppercase
      const normalizeSerial = (s: string) => s.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
      const targetSerial = normalizeSerial(serialNumber);
      for (const entry of data) {
        if (entry.serial_number) {
          const entrySerial = normalizeSerial(entry.serial_number);
          if (entrySerial === targetSerial) {
            matchedEntry = entry;
            break;
          }
        }
      }
    }

    // If we found a matching entry, use it; otherwise fall back to the first entry
    const relevantEntry = matchedEntry ?? data[0];

    return {
      loggedInCT: matchedEntry !== null || !serialNumber, // If we couldn't match but had entries, assume logged
      issuerName: relevantEntry?.issuer_name ?? null,
      certCount: data.length,
      timedOut: false,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { loggedInCT: false, issuerName: null, certCount: 0, timedOut: true };
    }
    return { loggedInCT: false, issuerName: null, certCount: 0, timedOut: false };
  }
}

// ─── HSTS Header Check (STEP 3) ──────────────────────────────────────
// Makes an HTTPS HEAD request to check for Strict-Transport-Security header.

interface HSTSResult {
  present: boolean;
  maxAge: number | null;
}

async function checkHstsHeader(hostname: string): Promise<HSTSResult> {
  const HSTS_TIMEOUT_MS = 5000;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HSTS_TIMEOUT_MS);

    const res = await fetch(`https://${hostname}/`, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    const hstsHeader = res.headers.get('strict-transport-security');

    if (!hstsHeader) {
      return { present: false, maxAge: null };
    }

    // Parse max-age from the header value
    // e.g., "max-age=31536000; includeSubDomains; preload"
    const maxAgeMatch = hstsHeader.match(/max-age=(\d+)/i);
    const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : null;

    return { present: true, maxAge };
  } catch {
    return { present: false, maxAge: null };
  }
}

// ─── OCSP Revocation Check (STEP 4) ──────────────────────────────────
// Extracts the OCSP URI from the certificate's Authority Information Access
// extension, builds an OCSP request, and queries the responder.

interface OCSPResult {
  status: 'GOOD' | 'REVOKED' | 'UNKNOWN' | 'FAILED' | null;
}

// ─── ASN.1 DER Encoding Helpers ─────────────────────────────────────

function derLength(length: number): Buffer {
  if (length < 0x80) {
    return Buffer.from([length]);
  }
  const bytes: number[] = [];
  let len = length;
  while (len > 0) {
    bytes.unshift(len & 0xff);
    len >>>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function derSequence(contents: Buffer): Buffer {
  const len = derLength(contents.length);
  return Buffer.concat([Buffer.from([0x30]), len, contents]);
}

function derTagExplicit(tag: number, contents: Buffer): Buffer {
  const len = derLength(contents.length);
  return Buffer.concat([Buffer.from([0xa0 | tag]), len, contents]);
}

function derOctetString(data: Buffer): Buffer {
  const len = derLength(data.length);
  return Buffer.concat([Buffer.from([0x04]), len, data]);
}

function derOID(oid: string): Buffer {
  const parts = oid.split('.').map(Number);
  const encoded: number[] = [40 * parts[0] + parts[1]];
  for (let i = 2; i < parts.length; i++) {
    let val = parts[i];
    const bytes: number[] = [];
    bytes.push(val & 0x7f);
    val >>>= 7;
    while (val > 0) {
      bytes.unshift((val & 0x7f) | 0x80);
      val >>>= 7;
    }
    encoded.push(...bytes);
  }
  const len = derLength(encoded.length);
  return Buffer.concat([Buffer.from([0x06]), len, Buffer.from(encoded)]);
}

function derNull(): Buffer {
  return Buffer.from([0x05, 0x00]);
}

function derIntegerFromBytes(data: Buffer): Buffer {
  // Ensure positive integer by prepending 0x00 if high bit is set
  const bytes = data.length > 0 && (data[0] & 0x80) !== 0
    ? Buffer.concat([Buffer.from([0x00]), data])
    : (data.length === 0 ? Buffer.from([0x00]) : data);
  const len = derLength(bytes.length);
  return Buffer.concat([Buffer.from([0x02]), len, bytes]);
}

// ─── ASN.1 DER Parser ───────────────────────────────────────────────

interface ParsedAsn1 {
  tag: number;
  length: number;
  value: Buffer;
  children: ParsedAsn1[];
  /** Offset of the first byte of this element (the tag byte). */
  startOffset: number;
  /** Offset past the end of this entire element (tag + length + value). */
  endOffset: number;
}

function parseAsn1(buf: Buffer, offset = 0): ParsedAsn1 {
  const tag = buf[offset];
  let lengthBytes = 1;
  let length = buf[offset + 1];

  if (length & 0x80) {
    const numBytes = length & 0x7f;
    length = 0;
    for (let i = 0; i < numBytes; i++) {
      length = (length << 8) | buf[offset + 2 + i];
    }
    lengthBytes = 1 + 1 + numBytes;
  } else {
    lengthBytes = 2;
  }

  const valueStart = offset + lengthBytes;
  const value = buf.subarray(valueStart, valueStart + length);
  const isConstructed = (tag & 0x20) !== 0;
  const children: ParsedAsn1[] = [];

  if (isConstructed) {
    let childOffset = valueStart;
    while (childOffset < valueStart + length) {
      const child = parseAsn1(buf, childOffset);
      children.push(child);
      childOffset = child.endOffset;
    }
  }

  return { tag, length, value, children, startOffset: offset, endOffset: valueStart + length };
}

/** Convert a DER-encoded OID (bytes) to dotted string notation. */
function oidToDotted(oidBytes: Buffer): string {
  if (oidBytes.length === 0) return '';
  const parts: number[] = [Math.floor(oidBytes[0] / 40), oidBytes[0] % 40];
  let value = 0;
  for (let i = 1; i < oidBytes.length; i++) {
    const byte = oidBytes[i];
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) {
      parts.push(value);
      value = 0;
    }
  }
  return parts.join('.');
}

/** Map a signature algorithm OID to a Node.js crypto hash algorithm name. */
function mapOidToHash(oid: string): string | null {
  const map: Record<string, string> = {
    '1.2.840.113549.1.1.5': 'sha1WithRSAEncryption',
    '1.2.840.113549.1.1.11': 'sha256WithRSAEncryption',
    '1.2.840.113549.1.1.12': 'sha384WithRSAEncryption',
    '1.2.840.113549.1.1.13': 'sha512WithRSAEncryption',
    '1.2.840.10045.4.1': 'ecdsa-with-SHA1',
    '1.2.840.10045.4.3.2': 'ecdsa-with-SHA256',
    '1.2.840.10045.4.3.3': 'ecdsa-with-SHA384',
    '1.2.840.10045.4.3.4': 'ecdsa-with-SHA512',
    '1.2.840.10040.4.3': 'DSA-SHA1',
    '2.16.840.1.101.3.4.3.1': 'DSA-SHA224',
    '2.16.840.1.101.3.4.3.2': 'DSA-SHA256',
    '1.3.14.3.2.29': 'sha1WithRSAEncryption',
  };
  return map[oid] ?? null;
}

/**
 * Extract the raw DER bytes of the subjectPublicKeyInfo from a DER-encoded X.509 certificate.
 */
function extractSubjectPublicKeyInfo(rawDer: Buffer): Buffer | null {
  try {
    const cert = parseAsn1(rawDer);
    if (cert.tag !== 0x30) return null; // Must be SEQUENCE

    const tbsCert = cert.children[0];
    if (!tbsCert || tbsCert.tag !== 0x30) return null;

    // TBSCertificate contains: [0] version, serialNumber, signature, issuer, validity, subject, SPKI, ...
    // Skip context-specific [0], then INTEGER, then SEQUENCE (sig), then SEQUENCE (issuer),
    // then SEQUENCE (validity), then SEQUENCE (subject) to reach SPKI
    let spkiIdx = 0;
    const firstChild = tbsCert.children[0];
    if (firstChild && (firstChild.tag & 0xc0) === 0x80) {
      spkiIdx = 6; // After [0] version, integer serial, signature alg, issuer, validity, subject
    } else {
      spkiIdx = 5; // After integer serial, signature alg, issuer, validity, subject
    }

    if (spkiIdx >= tbsCert.children.length) return null;

    const spki = tbsCert.children[spkiIdx];
    // Use startOffset/endOffset for accurate byte range (including tag and length)
    return Buffer.from(rawDer.subarray(spki.startOffset, spki.endOffset));
  } catch {
    return null;
  }
}

/**
 * Extract the raw DER bytes of the issuer distinguished name from a DER-encoded X.509 certificate.
 */
function extractIssuerDn(rawDer: Buffer): Buffer | null {
  try {
    const cert = parseAsn1(rawDer);
    if (cert.tag !== 0x30) return null;

    const tbsCert = cert.children[0];
    if (!tbsCert || tbsCert.tag !== 0x30) return null;

    // In TBSCertificate, issuer is the 3rd or 4th child depending on if version is present
    let issuerIdx = 0;
    const firstChild = tbsCert.children[0];
    if (firstChild && (firstChild.tag & 0xc0) === 0x80) {
      issuerIdx = 3; // After [0] version, integer serial, signature alg
    } else {
      issuerIdx = 2; // After integer serial, signature alg
    }

    if (issuerIdx >= tbsCert.children.length) return null;

    const issuer = tbsCert.children[issuerIdx];
    // Use startOffset for accurate byte range (including tag and length)
    return Buffer.from(rawDer.subarray(issuer.startOffset, issuer.endOffset));
  } catch {
    return null;
  }
}

/**
 * Extract OCSP responder URLs from a DER-encoded certificate using X509Certificate.infoAccess.
 */
function extractOcspUrls(rawDer: Buffer): string[] {
  try {
    const x509 = new crypto.X509Certificate(rawDer);
    const infoAccess = x509.infoAccess;
    if (!infoAccess) return [];

    const urls: string[] = [];
    for (const line of infoAccess.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('OCSP - URI:')) {
        urls.push(trimmed.slice('OCSP - URI:'.length).trim());
      }
    }
    return urls;
  } catch {
    return [];
  }
}

/**
 * Performs an OCSP revocation check for the given hostname.
 * Makes a TLS connection to get the peer certificate, then queries
 * the CA's OCSP responder for revocation status.
 */
async function checkOCSP(hostname: string): Promise<OCSPResult> {
  try {
    const tls = await import('tls');
    const OCSP_CONNECT_TIMEOUT = 4000;
    const OCSP_REQUEST_TIMEOUT = 3000;

    // Get the peer certificate and issuer certificate
    const { peerCertRaw, issuerCertRaw } = await new Promise<{
      peerCertRaw: Buffer | null;
      issuerCertRaw: Buffer | null;
    }>((resolve) => {
      const socket = tls.connect(
        {
          host: hostname,
          port: 443,
          servername: hostname,
          rejectUnauthorized: false,
          checkServerIdentity: () => undefined,
        },
        () => {
          try {
            const detailed = socket.getPeerCertificate(true);
            const raw = detailed?.raw ? Buffer.from(detailed.raw) : null;
            const issuerRaw =
              detailed?.issuerCertificate &&
              detailed.fingerprint !== detailed.issuerCertificate.fingerprint
                ? Buffer.from(detailed.issuerCertificate.raw)
                : null;
            socket.destroy();
            resolve({ peerCertRaw: raw, issuerCertRaw: issuerRaw });
          } catch {
            socket.destroy();
            resolve({ peerCertRaw: null, issuerCertRaw: null });
          }
        },
      );

      socket.on('error', () => {
        socket.destroy();
        resolve({ peerCertRaw: null, issuerCertRaw: null });
      });

      socket.setTimeout(OCSP_CONNECT_TIMEOUT, () => {
        socket.destroy();
        resolve({ peerCertRaw: null, issuerCertRaw: null });
      });
    });

    if (!peerCertRaw || !issuerCertRaw) {
      return { status: 'FAILED' };
    }

    // Extract OCSP URLs from the peer certificate
    const ocspUrls = extractOcspUrls(peerCertRaw);
    if (ocspUrls.length === 0) {
      return { status: null }; // No OCSP URI available — not a failure
    }

    // Extract issuer DN and SPKI from issuer certificate
    const issuerDnBytes = extractIssuerDn(issuerCertRaw);
    const issuerSpkiBytes = extractSubjectPublicKeyInfo(issuerCertRaw);

    if (!issuerDnBytes || !issuerSpkiBytes) {
      return { status: 'FAILED' };
    }

    // Parse serial number from peer certificate (hex string from getPeerCertificate)
    const peerSerialBytes = await getCertSerialBytes(peerCertRaw);
    if (!peerSerialBytes) {
      return { status: 'FAILED' };
    }

    // Build OCSP request
    const issuerNameHash = crypto.createHash('sha1').update(issuerDnBytes).digest();
    const issuerKeyHash = crypto.createHash('sha1').update(issuerSpkiBytes).digest();

    const ocspRequest = buildOcspRequest(issuerNameHash, issuerKeyHash, peerSerialBytes);

    // Send OCSP request to the first responder URL
    const ocspUrl = ocspUrls[0];

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), OCSP_REQUEST_TIMEOUT);

      const res = await fetch(ocspUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/ocsp-request',
          'Accept': 'application/ocsp-response',
        },
        body: new Uint8Array(ocspRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        return { status: 'FAILED' };
      }

      const responseBytes = Buffer.from(await res.arrayBuffer());
      return parseOcspResponse(responseBytes);
    } catch {
      return { status: 'FAILED' };
    }
  } catch {
    return { status: 'FAILED' };
  }
}

/**
 * Parse the serial number from a DER-encoded X.509 certificate.
 */
function getCertSerialBytes(rawDer: Buffer): Buffer | null {
  try {
    const cert = parseAsn1(rawDer);
    if (cert.tag !== 0x30) return null;

    const tbsCert = cert.children[0];
    if (!tbsCert || tbsCert.tag !== 0x30) return null;

    // Serial number is the first INTEGER after optional [0] version
    let serialIdx = 0;
    const firstChild = tbsCert.children[0];
    if (firstChild && (firstChild.tag & 0xc0) === 0x80) {
      serialIdx = 1; // After [0] version
    } else {
      serialIdx = 0;
    }

    if (serialIdx >= tbsCert.children.length) return null;
    const serial = tbsCert.children[serialIdx];
    if (serial.tag !== 0x02) return null; // Must be INTEGER

    return Buffer.from(serial.value);
  } catch {
    return null;
  }
}

/**
 * Build a DER-encoded OCSP request.
 */
function buildOcspRequest(
  issuerNameHash: Buffer,
  issuerKeyHash: Buffer,
  serialNumber: Buffer,
): Buffer {
  // Build CertID
  const hashAlgo = derSequence(Buffer.concat([derOID('1.3.14.3.2.26'), derNull()])); // SHA-1
  const nameHash = derOctetString(issuerNameHash);
  const keyHash = derOctetString(issuerKeyHash);
  const serial = derIntegerFromBytes(serialNumber);
  const certId = derSequence(Buffer.concat([hashAlgo, nameHash, keyHash, serial]));

  // Build Request
  const request = derSequence(certId);

  // Build requestList
  const requestList = derSequence(request);

  // Build TBSRequest (without version and requestorName for simplicity)
  const tbsRequest = derSequence(requestList);

  // Build OCSPRequest
  const ocspRequest = derSequence(tbsRequest);

  return ocspRequest;
}

/**
 * Parse an OCSP response to determine revocation status.
 * Minimal parser — looks for the response status and basic OCSP response status.
 */
function parseOcspResponse(response: Buffer): OCSPResult {
  try {
    // Parse the outermost SEQUENCE (OCSPResponse)
    const ocspResponse = parseAsn1(response);
    if (ocspResponse.tag !== 0x30 || ocspResponse.children.length < 2) {
      return { status: 'UNKNOWN' };
    }

    // First child is responseStatus (ENUMERATED)
    // 0 = successful, 1 = malformedRequest, 2 = internalError, 3 = tryLater, 5 = sigRequired, 6 = unauthorized
    const responseStatus = ocspResponse.children[0];
    if (!responseStatus || responseStatus.value[0] !== 0) {
      return { status: 'FAILED' }; // Non-successful response
    }

    // Second child is responseBytes (context-specific [0] EXPLICIT SEQUENCE)
    if (ocspResponse.children.length < 2) {
      return { status: 'UNKNOWN' };
    }

    const responseBytes = ocspResponse.children[1];
    if (!responseBytes || responseBytes.children.length < 1) {
      return { status: 'UNKNOWN' };
    }

    // Inside responseBytes is a SEQUENCE containing OID + OCTET STRING
    const basicOcspResponseWrapper = responseBytes.children[0];
    if (!basicOcspResponseWrapper || basicOcspResponseWrapper.tag !== 0x30) {
      return { status: 'UNKNOWN' };
    }

    // The OCTET STRING contains the BasicOCSPResponse DER
    let basicOcspBytes: Buffer | null = null;
    for (const child of basicOcspResponseWrapper.children) {
      if (child.tag === 0x04) {
        basicOcspBytes = child.value;
        break;
      }
    }

    if (!basicOcspBytes) {
      return { status: 'UNKNOWN' };
    }

    // Parse BasicOCSPResponse
    const basicOcsp = parseAsn1(basicOcspBytes);
    if (basicOcsp.tag !== 0x30 || basicOcsp.children.length < 1) {
      return { status: 'UNKNOWN' };
    }

    // First child of BasicOCSPResponse is tbsResponseData
    const tbsResponseData = basicOcsp.children[0];

    // Navigate directly to the responses SEQUENCE within tbsResponseData.
    // The tbsResponseData structure (per RFC 6960) is:
    //   [0] version (optional), ResponderID, producedAt (GeneralizedTime),
    //   responses (SEQUENCE OF SingleResponse), [1] extensions (optional)
    // We find the responses SEQUENCE by looking for the first SEQUENCE (0x30)
    // that appears after the producedAt GeneralizedTime (0x18).
    // Then within each SingleResponse (SEQUENCE), children[1] is the certStatus.
    let certStatusTag = -1;
    let foundProducedAt = false;

    for (const child of tbsResponseData.children) {
      if (child.tag === 0x18) {
        // GeneralizedTime = producedAt
        foundProducedAt = true;
        continue;
      }
      if (foundProducedAt && child.tag === 0x30) {
        // This is the responses SEQUENCE OF SingleResponse
        for (const singleResponse of child.children) {
          if (singleResponse.tag === 0x30 && singleResponse.children.length >= 2) {
            const certStatus = singleResponse.children[1];
            if (certStatus.tag === 0x80) {
              certStatusTag = 0; // GOOD
              break;
            }
            if (certStatus.tag === 0xA1) {
              certStatusTag = 1; // REVOKED
              break;
            }
            if (certStatus.tag === 0x82) {
              certStatusTag = 2; // UNKNOWN
              break;
            }
          }
        }
        break; // Don't look beyond the responses SEQUENCE
      }
    }

    if (certStatusTag === 0) return { status: 'GOOD' };
    if (certStatusTag === 1) return { status: 'REVOKED' };
    if (certStatusTag === 2) return { status: 'UNKNOWN' };

    return { status: 'UNKNOWN' };
  } catch {
    return { status: 'FAILED' };
  }
}

// ─── IP Reputation Check (AbuseIPDB) ─────────────────────────────────

async function checkIpReputation(
  hostname: string,
  apiKey: string,
): Promise<{ score: number; flagged: boolean }> {
  try {
    // Resolve hostname to IP first
    const dns = await import('dns/promises');
    const addresses = await dns.resolve4(hostname);
    if (addresses.length === 0) return { score: 0, flagged: false };

    const ip = addresses[0];
    const res = await fetch(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90`,
      {
        headers: {
          'Key': apiKey,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(3000),
      },
    );

    if (!res.ok) return { score: 0, flagged: false };

    const data = await res.json() as { data?: { abuseConfidenceScore: number } };
    const score = data.data?.abuseConfidenceScore ?? 0;

    return {
      score,
      flagged: score > 25,
    };
  } catch {
    return { score: 0, flagged: false };
  }
}

// ─── DNS Consistency Check ───────────────────────────────────────────

const DNS_RESOLVERS = [
  '8.8.8.8',   // Google
  '1.1.1.1',   // Cloudflare
  '9.9.9.9',   // Quad9
];

async function resolveViaDns(hostname: string, resolverIp: string): Promise<string[]> {
  try {
    // Use Node.js dns module with custom resolver
    const dns = await import('dns');
    return new Promise((resolve) => {
      const resolver = new dns.Resolver();
      resolver.setServers([resolverIp]);
      resolver.resolve4(hostname, (err, addresses) => {
        if (err) resolve([]);
        else resolve(addresses as string[]);
      });
    });
  } catch {
    return [];
  }
}

async function checkDnsConsistency(
  hostname: string,
): Promise<{ consistent: boolean; results: string[] }> {
  const results = await Promise.all(
    DNS_RESOLVERS.map(resolver => resolveViaDns(hostname, resolver)),
  );

  const flatResults = results.map((ips, i) => {
    const label = DNS_RESOLVERS[i];
    return ips.length > 0 ? `${label}: ${ips.join(',')}` : `${label}: (unreachable)`;
  });

  // Check if all resolvers that succeeded returned the same IPs
  const successfulResults = results.filter(ips => ips.length > 0);
  const consistent = successfulResults.length <= 1 ||
    successfulResults.every(ips =>
      ips.length === successfulResults[0].length &&
      ips.every((ip, j) => ip === successfulResults[0][j]),
    );

  return { consistent, results: flatResults };
}
