import { CriticalityFactors, CriticalityRating } from '../types';

/**
 * Calculates weighted criticality score based on Appendix II - Criticality Rating Framework
 * Criteria:
 * - Sensitive Data (32.5%): 0 (Public), 4 (Internal), 8 (Restricted), 12 (Confidential)
 * - Public-Facing / Exposure (32.5%): 0 (Internal only), 6 (Public with controls), 12 (Fully public / Gaming-network)
 * - Newly Developed / Unstable (10.0%): 0 (No feature update in recent 1 yr), 6 (Recently updated), 12 (Newly built)
 * - History of Cyber-Attacks (15.0%): 0 (None), 6 (Attempted only), 12 (Compromised)
 * - System Downtime Impact (10.0%): 0 (No impact), 6 (Minor disruption), 12 (Critical business impact)
 */
export function calculateCriticalityScore(factors: CriticalityFactors): number {
  const sensitive = (factors.sensitiveDataScore ?? 0) * 0.325;
  const exposure = (factors.exposureScore ?? 0) * 0.325;
  const stability = (factors.stabilityScore ?? 0) * 0.10;
  const attack = (factors.attackHistoryScore ?? 0) * 0.15;
  const downtime = (factors.downtimeImpactScore ?? 0) * 0.10;

  const totalScore = sensitive + exposure + stability + attack + downtime;
  // Round to 2 decimal places or 1 decimal place
  return Math.round(totalScore * 100) / 100;
}

/**
 * Maps score to Criticality Rating Code according to Appendix II
 * - ≥ 9: C (Critical)
 * - ≥ 6 to < 9: H (High)
 * - ≥ 3 to < 6: M (Medium)
 * - < 3: L (Low)
 */
export function scoreToRating(score: number): CriticalityRating {
  if (score >= 9) return 'C';
  if (score >= 6) return 'H';
  if (score >= 3) return 'M';
  return 'L';
}

// Alias for compatibility
export const scoreToTier = scoreToRating;

export function getRecommendedSLAs(rating: CriticalityRating): { rto: string; rpo: string; availability: string } {
  switch (rating) {
    case 'C':
      return { rto: '15 - 30 Minutes', rpo: '5 Minutes', availability: '99.99%' };
    case 'H':
      return { rto: '2 - 4 Hours', rpo: '1 Hour', availability: '99.9%' };
    case 'M':
      return { rto: '12 - 24 Hours', rpo: '12 Hours', availability: '99.0%' };
    case 'L':
      return { rto: '48 - 72 Hours', rpo: '24 - 48 Hours', availability: 'Best Effort' };
  }
}

export function getTierBadgeProps(rating: CriticalityRating) {
  switch (rating) {
    case 'C':
      return {
        code: 'C',
        label: 'Critical (C)',
        fullLabel: 'Critical (C): Immediate attention needed; high data sensitivity or business impact',
        shortLabel: 'Critical [C]',
        bg: 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
        badgeBg: 'bg-rose-600 text-white',
        dot: 'bg-rose-600',
        accentColor: '#e11d48'
      };
    case 'H':
      return {
        code: 'H',
        label: 'High (H)',
        fullLabel: 'High (H): Significant risk; system may be vulnerable or exposed',
        shortLabel: 'High [H]',
        bg: 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
        badgeBg: 'bg-amber-600 text-white',
        dot: 'bg-amber-500',
        accentColor: '#f59e0b'
      };
    case 'M':
      return {
        code: 'M',
        label: 'Medium (M)',
        fullLabel: 'Medium (M): Moderate importance; monitor and improve where possible',
        shortLabel: 'Medium [M]',
        bg: 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
        badgeBg: 'bg-blue-600 text-white',
        dot: 'bg-blue-500',
        accentColor: '#3b82f6'
      };
    case 'L':
      return {
        code: 'L',
        label: 'Low (L)',
        fullLabel: 'Low (L): Minimal risk or impact; lowest priority for mitigation',
        shortLabel: 'Low [L]',
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
        badgeBg: 'bg-emerald-600 text-white',
        dot: 'bg-emerald-500',
        accentColor: '#10b981'
      };
  }
}

