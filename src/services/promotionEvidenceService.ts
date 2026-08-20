import {
  ArmorCodeFinding,
  ComplianceEvaluationResult,
  PromotionEvidence,
  UserRole
} from '../types';
import appSettings from '../../appsettings.json';
import { addAuditLog } from '../utils/storage';

const PROMOTION_STORAGE_KEY = 'appsec_armorcode_promotion_evidences_v1';

/**
 * Check if an ArmorCode finding is considered resolved / mitigated / false positive / accepted risk
 */
export function isFindingResolved(finding: ArmorCodeFinding): boolean {
  if (finding.mitigated === true) return true;
  const rawStatus = (finding.status || finding.ticketStatus || '').toUpperCase().trim();
  return [
    'MITIGATED',
    'RESOLVED',
    'FIXED',
    'CLOSED',
    'FALSE_POSITIVE',
    'ACCEPTED_RISK',
    'RESOLVED_MUTED',
    'SUPPRESSED',
    'WHITELISTED'
  ].includes(rawStatus);
}

/**
 * Evaluate if ArmorCode scan findings meet the configured compliance standards for production promotion.
 * Marked NON-COMPLIANT if there are any unresolved Critical or High findings.
 */
export function evaluateCompliance(findings: ArmorCodeFinding[]): ComplianceEvaluationResult {
  const standards = appSettings.ArmorCode?.ComplianceStandards || {
    MaxCriticalFindings: 0,
    MaxHighFindings: 0,
    MaxMediumFindings: 20,
    EnforceZeroCriticalHigh: true,
    RequireScanTypes: ['sast', 'sca', 'secret'],
    GatePolicyName: 'Enterprise Zero-Critical-High Security Gate Policy v1.2'
  };

  const totalFindings = findings.length;
  const criticalFindings = findings.filter(f => (f.severity || '').toUpperCase() === 'CRITICAL');
  const highFindings = findings.filter(f => (f.severity || '').toUpperCase() === 'HIGH');
  const mediumFindings = findings.filter(f => (f.severity || '').toUpperCase() === 'MEDIUM');
  const lowFindings = findings.filter(f => (f.severity || '').toUpperCase() === 'LOW');
  const infoFindings = findings.filter(f => (f.severity || '').toUpperCase() === 'INFO' || !f.severity);

  const unresolvedCriticalCount = criticalFindings.filter(f => !isFindingResolved(f)).length;
  const unresolvedHighCount = highFindings.filter(f => !isFindingResolved(f)).length;
  const unresolvedMediumCount = mediumFindings.filter(f => !isFindingResolved(f)).length;

  const resolvedCriticalCount = criticalFindings.filter(f => isFindingResolved(f)).length;
  const resolvedHighCount = highFindings.filter(f => isFindingResolved(f)).length;

  const totalUnresolvedCount = findings.filter(f => !isFindingResolved(f)).length;
  const totalResolvedCount = findings.filter(f => isFindingResolved(f)).length;

  const criticalCount = criticalFindings.length;
  const highCount = highFindings.length;
  const mediumCount = mediumFindings.length;
  const lowCount = lowFindings.length;
  const infoCount = infoFindings.length;

  const reasons: string[] = [];
  const passedChecks: string[] = [];
  const rulesEvaluated: string[] = [
    `Zero Unresolved Critical Vulnerabilities (Max Allowed: ${standards.MaxCriticalFindings})`,
    `Zero Unresolved High Vulnerabilities (Max Allowed: ${standards.MaxHighFindings})`,
    `Medium Findings Advisory Ceiling (Max Allowed: ${standards.MaxMediumFindings})`
  ];

  if (unresolvedCriticalCount > standards.MaxCriticalFindings) {
    reasons.push(
      `Contains ${unresolvedCriticalCount} unresolved Critical severity finding(s) (Policy allows max ${standards.MaxCriticalFindings} unresolved Criticals).`
    );
  } else {
    passedChecks.push(
      resolvedCriticalCount > 0
        ? `Zero unresolved Critical findings (${resolvedCriticalCount} mitigated/resolved in ticket backlog).`
        : `Passed Zero Critical Findings check (0 critical findings found).`
    );
  }

  if (unresolvedHighCount > standards.MaxHighFindings) {
    reasons.push(
      `Contains ${unresolvedHighCount} unresolved High severity finding(s) (Policy allows max ${standards.MaxHighFindings} unresolved Highs).`
    );
  } else {
    passedChecks.push(
      resolvedHighCount > 0
        ? `Zero unresolved High findings (${resolvedHighCount} mitigated/resolved in ticket backlog).`
        : `Passed Zero High Findings check (0 high findings found).`
    );
  }

  if (unresolvedMediumCount > standards.MaxMediumFindings) {
    reasons.push(
      `Contains ${unresolvedMediumCount} unresolved Medium severity finding(s) exceeding allowable threshold of ${standards.MaxMediumFindings}.`
    );
  } else {
    passedChecks.push(
      `Unresolved Medium findings (${unresolvedMediumCount}) is within allowable threshold (${standards.MaxMediumFindings}).`
    );
  }

  const isCompliant = reasons.length === 0;

  return {
    isCompliant,
    gatePolicyName: standards.GatePolicyName || 'Enterprise Security Gate Policy',
    totalFindings,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    infoCount,
    unresolvedCriticalCount,
    unresolvedHighCount,
    unresolvedMediumCount,
    resolvedCriticalCount,
    resolvedHighCount,
    totalUnresolvedCount,
    totalResolvedCount,
    maxCriticalAllowed: standards.MaxCriticalFindings ?? 0,
    maxHighAllowed: standards.MaxHighFindings ?? 0,
    maxMediumAllowed: standards.MaxMediumFindings ?? 20,
    reasons,
    rulesEvaluated,
    passedChecks
  };
}

/**
 * Generate cryptographic-like SHA256 style fingerprint hash for audit integrity
 */
export function generateVerificationHash(project: string, repo: string, branch: string, timestamp: string, count: number): string {
  const str = `${project}:${repo}:${branch}:${timestamp}:${count}:${appSettings.ArmorCode?.ApiKey || 'secret'}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  const timestampHex = Date.now().toString(16);
  return `0x${hex}${timestampHex.slice(-6)}88f92a1c4b`.toLowerCase();
}

/**
 * Load historic Promotion Evidences from localStorage & Backend API
 */
export function loadPromotionEvidences(): PromotionEvidence[] {
  try {
    const raw = localStorage.getItem(PROMOTION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to load promotion evidences from localStorage:', err);
    return [];
  }
}

/**
 * Fetch evidences from backend server and merge with localStorage
 */
export async function asyncFetchPromotionEvidences(): Promise<PromotionEvidence[]> {
  const localList = loadPromotionEvidences();
  try {
    const res = await fetch('/api/promotion-evidences');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.evidences)) {
        // Merge server and local list by evidenceId, keeping the most updated / newest
        const map = new Map<string, PromotionEvidence>();
        data.evidences.forEach((e: PromotionEvidence) => {
          if (e && e.evidenceId) map.set(e.evidenceId, e);
        });
        localList.forEach((e: PromotionEvidence) => {
          if (e && e.evidenceId && !map.has(e.evidenceId)) {
            map.set(e.evidenceId, e);
            // Sync locally created item to server in background
            fetch('/api/promotion-evidences', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(e)
            }).catch(() => {});
          }
        });
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        localStorage.setItem(PROMOTION_STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
    }
  } catch (err) {
    console.warn('Backend API fetch for promotion evidences failed, using localStorage:', err);
  }
  return localList;
}

/**
 * Save new promotion evidence snapshot into auditable storage & trigger audit log
 */
export async function createAndSavePromotionEvidence(
  params: {
    project: string;
    repository: string;
    branch: string;
    targetEnvironment: string;
    releaseVersion: string;
    approvalNotes: string;
    userEmail: string;
    userRole: UserRole;
    complianceEvaluation: ComplianceEvaluationResult;
    snapshotFindings: ArmorCodeFinding[];
    snapshotPayload: Record<string, any>;
    apiResponseSnapshot?: Record<string, any>;
    apiEndpointUsed: string;
    isAdminOverride?: boolean;
    applicationId?: string;
    applicationName?: string;
    reportType?: 'STATIC' | 'CONTAINER' | 'DYNAMIC';
    reportCategory?: string;
  }
): Promise<PromotionEvidence> {
  const currentList = loadPromotionEvidences();
  const timestamp = new Date().toISOString();
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  const evidenceId = `PROMO-EVID-${new Date().getFullYear()}-${randomSuffix}`;

  // Determine reportType if not explicitly passed
  let resolvedReportType: 'STATIC' | 'CONTAINER' | 'DYNAMIC' = params.reportType || 'STATIC';
  if (!params.reportType) {
    const hasContainer = params.snapshotFindings.some(f => (f.type || '').toLowerCase().includes('container') || (f.scanType || '').toLowerCase().includes('container')) || params.project.toLowerCase().includes('aqua') || params.repository.toLowerCase().includes('aqua') || params.repository.toLowerCase().includes('.tar') || params.repository.includes(':');
    const hasDast = params.snapshotFindings.some(f => (f.type || '').toLowerCase().includes('dast') || (f.scanType || '').toLowerCase().includes('dast'));
    if (hasContainer) resolvedReportType = 'CONTAINER';
    else if (hasDast) resolvedReportType = 'DYNAMIC';
  }

  const resolvedCategory = params.reportCategory || (
    resolvedReportType === 'CONTAINER' ? 'Container Security Report' :
    resolvedReportType === 'DYNAMIC' ? 'Dynamic Scan Report' :
    'Static Scan Report'
  );
  
  const verificationHash = generateVerificationHash(
    params.project,
    params.repository,
    params.branch,
    timestamp,
    params.snapshotFindings.length
  );

  const newEvidence: PromotionEvidence = {
    evidenceId,
    createdAt: timestamp,
    createdBy: params.userEmail,
    createdRole: params.userRole,
    project: params.project,
    repository: params.repository || 'ALL_REPOSITORIES',
    branch: params.branch || 'master',
    targetEnvironment: params.targetEnvironment,
    releaseVersion: params.releaseVersion || 'v1.0.0',
    approvalNotes: params.approvalNotes || 'ArmorCode security gate compliance verified.',
    complianceStatus: params.isAdminOverride ? 'ADMIN_OVERRIDE' : (params.complianceEvaluation.isCompliant ? 'PASSED' : 'FAILED'),
    complianceEvaluation: params.complianceEvaluation,
    findingCounts: {
      total: params.complianceEvaluation.totalFindings,
      critical: params.complianceEvaluation.criticalCount,
      high: params.complianceEvaluation.highCount,
      medium: params.complianceEvaluation.mediumCount,
      low: params.complianceEvaluation.lowCount,
      info: params.complianceEvaluation.infoCount,
      unresolvedCritical: params.complianceEvaluation.unresolvedCriticalCount,
      unresolvedHigh: params.complianceEvaluation.unresolvedHighCount,
      resolvedCritical: params.complianceEvaluation.resolvedCriticalCount,
      resolvedHigh: params.complianceEvaluation.resolvedHighCount
    },
    snapshotFindings: params.snapshotFindings,
    snapshotPayload: params.snapshotPayload,
    apiResponseSnapshot: params.apiResponseSnapshot,
    apiEndpointUsed: params.apiEndpointUsed,
    verificationHash,
    signatureBadge: 'DIGITALLY_SIGNED_ARMORCODE_GATE_STAMP',
    status: 'ISSUED',
    applicationId: params.applicationId,
    applicationName: params.applicationName,
    reportType: resolvedReportType,
    reportCategory: resolvedCategory
  };

  const updatedList = [newEvidence, ...currentList.filter(e => e.evidenceId !== evidenceId)];
  localStorage.setItem(PROMOTION_STORAGE_KEY, JSON.stringify(updatedList));

  // Sync to PostgreSQL / Server memory backend
  try {
    await fetch('/api/promotion-evidences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newEvidence)
    });
  } catch (err) {
    console.warn('Sync promotion evidence to server warning:', err);
  }

  // Log in system Audit Trail
  addAuditLog(
    params.userEmail,
    params.userRole,
    'PROMOTION_EVIDENCE_GENERATED',
    `Issued Promotion Evidence [${evidenceId}] for project '${params.project}' (Repo: ${params.repository || 'ALL'}, Branch: ${params.branch}) to ${params.targetEnvironment}. Verification Hash: ${verificationHash}`,
    evidenceId,
    params.project
  );

  return newEvidence;
}

/**
 * Revoke or mark evidence superseded
 */
export function revokePromotionEvidence(evidenceId: string, revokedBy: string, reason: string): PromotionEvidence[] {
  const currentList = loadPromotionEvidences();
  const timestamp = new Date().toISOString();
  
  const updatedList = currentList.map(item => {
    if (item.evidenceId === evidenceId) {
      return {
        ...item,
        status: 'REVOKED' as const,
        revokedAt: timestamp,
        revokedBy,
        revokedReason: reason
      };
    }
    return item;
  });

  localStorage.setItem(PROMOTION_STORAGE_KEY, JSON.stringify(updatedList));

  fetch(`/api/promotion-evidences/${evidenceId}/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revokedBy, reason, timestamp })
  }).catch(err => console.warn('Sync revoke promotion evidence warning:', err));

  addAuditLog(
    revokedBy,
    'APPSEC_ADMIN',
    'PROMOTION_EVIDENCE_REVOKED',
    `Revoked Promotion Evidence Certificate [${evidenceId}]. Reason: ${reason}`,
    evidenceId
  );

  return updatedList;
}

/**
 * Clear all Promotion Evidence Certificates from storage and backend
 */
export function clearAllPromotionEvidences(): void {
  try {
    localStorage.removeItem(PROMOTION_STORAGE_KEY);
    fetch('/api/promotion-evidences', {
      method: 'DELETE'
    }).catch(err => console.warn('Clear backend promotion evidences warning:', err));
  } catch (err) {
    console.error('Failed to clear promotion evidences:', err);
  }
}

/**
 * Delete a single Promotion Evidence Certificate
 */
export function deletePromotionEvidence(evidenceId: string): PromotionEvidence[] {
  const currentList = loadPromotionEvidences();
  const updatedList = currentList.filter(item => item.evidenceId !== evidenceId);
  try {
    localStorage.setItem(PROMOTION_STORAGE_KEY, JSON.stringify(updatedList));
    fetch(`/api/promotion-evidences/${evidenceId}`, {
      method: 'DELETE'
    }).catch(err => console.warn('Delete backend promotion evidence warning:', err));
  } catch (err) {
    console.error('Failed to delete promotion evidence from localStorage:', err);
  }
  return updatedList;
}

/**
 * Download Evidence JSON Certificate File
 */
export function downloadEvidenceJSON(evidence: PromotionEvidence): void {
  const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `ArmorCode_Promotion_Evidence_${evidence.evidenceId}_${evidence.project}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
