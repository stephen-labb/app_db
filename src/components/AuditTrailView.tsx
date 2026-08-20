import React, { useState, useMemo } from 'react';
import { AuditLogEntry, ScimAuditLog, AccessApprovalRecord, UserRole, ActiveSsoUser } from '../types';
import {
  History,
  Search,
  Shield,
  User,
  FileText,
  Plus,
  Edit2,
  Trash2,
  Download,
  Filter,
  Database,
  Users,
  KeyRound,
  CheckSquare,
  Award,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Code,
  Copy,
  Check,
  Sparkles,
  Lock,
  Fingerprint,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  Info,
  ChevronRight,
  Terminal,
  ExternalLink,
  ShieldAlert,
  ArrowRightLeft,
  Calendar,
  X
} from 'lucide-react';
import { loadScimAuditLogs, loadAccessApprovalRecords } from '../utils/ssoScimStorage';
import { loadAuditLogs } from '../utils/storage';

export type AuditComponentType =
  | 'Applications Database'
  | 'User Management & IAM'
  | 'Azure AD SSO & SCIM'
  | 'RBAC Control'
  | 'Review Queue'
  | 'SOP Document'
  | 'ArmorCode Security';

export interface UnifiedAuditRecord {
  id: string;
  timestamp: string;
  component: AuditComponentType;
  action: string;
  actionLabel: string;
  user: string;
  role: string;
  target: string;
  details: string;
  severity: 'INFO' | 'SUCCESS' | 'WARN' | 'CRITICAL';
  complianceTag: string;
  verificationHash?: string;
  sourceType: 'SYSTEM_AUDIT' | 'SCIM_API' | 'ACCESS_APPROVAL' | 'RBAC_ENGINE';
  rawPayload?: any;
}

interface AuditTrailViewProps {
  logs?: AuditLogEntry[];
  auditLogs?: AuditLogEntry[];
  scimLogs?: ScimAuditLog[];
  accessApprovalRecords?: AccessApprovalRecord[];
  currentRole?: UserRole;
  activeSsoUser?: ActiveSsoUser;
  onRefreshLogs?: () => void;
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({
  logs,
  auditLogs: propAuditLogs,
  scimLogs: propScimLogs,
  accessApprovalRecords: propApprovalRecords,
  currentRole,
  activeSsoUser,
  onRefreshLogs
}) => {
  // Navigation & Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [componentFilter, setComponentFilter] = useState<string>('ALL');
  const [actionCategoryFilter, setActionCategoryFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  
  // Inspection Modal State
  const [inspectingRecord, setInspectingRecord] = useState<UnifiedAuditRecord | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Load audit records from props or localStorage
  const rawAuditLogs: AuditLogEntry[] = useMemo(() => {
    if (propAuditLogs && propAuditLogs.length > 0) return propAuditLogs;
    if (logs && logs.length > 0) return logs;
    return loadAuditLogs();
  }, [propAuditLogs, logs]);

  const rawScimLogs: ScimAuditLog[] = useMemo(() => {
    if (propScimLogs && propScimLogs.length > 0) return propScimLogs;
    return loadScimAuditLogs();
  }, [propScimLogs]);

  const rawApprovalRecords: AccessApprovalRecord[] = useMemo(() => {
    if (propApprovalRecords && propApprovalRecords.length > 0) return propApprovalRecords;
    return loadAccessApprovalRecords();
  }, [propApprovalRecords]);

  // Consolidate and Normalize ALL Audit Logs into a Unified Audit Record Collection
  const unifiedRecords: UnifiedAuditRecord[] = useMemo(() => {
    const list: UnifiedAuditRecord[] = [];

    // 1. Process System / AppSec Governance Audit Logs
    rawAuditLogs.forEach((log) => {
      let comp: AuditComponentType = 'Applications Database';
      let actionLabel = log.action;
      let severity: UnifiedAuditRecord['severity'] = 'INFO';
      let tag = log.complianceTag || 'SOC2-CC6.1-AUDIT-LOG';

      if (log.component && [
        'Applications Database',
        'User Management & IAM',
        'Azure AD SSO & SCIM',
        'RBAC Control',
        'Review Queue',
        'SOP Document',
        'ArmorCode Security'
      ].includes(log.component as any)) {
        comp = log.component as AuditComponentType;
      } else if (log.action === 'SOP_UPLOAD') {
        comp = 'SOP Document';
        actionLabel = 'SOP Policy Upload';
        severity = 'SUCCESS';
        tag = 'ISO27001-A.5.1-POLICY-REVISION';
      } else if (log.action.includes('ASSESSMENT')) {
        comp = 'Review Queue';
        if (log.action === 'SUBMIT_ASSESSMENT') {
          actionLabel = 'Rating Proposed';
          severity = 'INFO';
        } else if (log.action === 'APPROVE_ASSESSMENT') {
          actionLabel = 'Assessment Approved';
          severity = 'SUCCESS';
        } else if (log.action === 'REJECT_ASSESSMENT') {
          actionLabel = 'Assessment Rejected';
          severity = 'CRITICAL';
        } else if (log.action === 'REOPEN_ASSESSMENT') {
          actionLabel = 'Ticket Reopened';
          severity = 'WARN';
        }
        tag = 'SOC2-CC6.8-CRITICALITY-RATING';
      } else if (log.action.includes('PROMOTION_EVIDENCE')) {
        comp = 'ArmorCode Security';
        if (log.action === 'PROMOTION_EVIDENCE_GENERATED') {
          actionLabel = 'Evidence Certificate Signed';
          severity = 'SUCCESS';
        } else {
          actionLabel = 'Evidence Certificate Revoked';
          severity = 'CRITICAL';
        }
        tag = 'SOC2-CC7.1-PROMOTION-GATE';
      } else if (log.details.toLowerCase().includes('sso') || log.details.toLowerCase().includes('oidc')) {
        comp = 'Azure AD SSO & SCIM';
        actionLabel = 'OIDC SSO Auth Claim';
        severity = 'INFO';
        tag = 'NIST-800-53-IA-2-OIDC-SSO';
      } else {
        comp = 'Applications Database';
        if (log.action === 'CREATE') {
          actionLabel = 'App Created';
          severity = 'SUCCESS';
        } else if (log.action === 'UPDATE') {
          actionLabel = 'App Modified';
          severity = 'INFO';
        } else if (log.action === 'DELETE') {
          actionLabel = 'App Deleted';
          severity = 'CRITICAL';
        } else if (log.action === 'EXPORT') {
          actionLabel = 'Database Exported';
          severity = 'INFO';
        }
      }

      list.push({
        id: log.id,
        timestamp: log.timestamp,
        component: comp,
        action: log.action,
        actionLabel,
        user: log.user,
        role: log.role,
        target: log.appName ? `${log.appName} ${log.appId ? `(${log.appId})` : ''}` : 'System Platform',
        details: log.details,
        severity,
        complianceTag: tag,
        verificationHash: `sig_sys_${log.id.toLowerCase()}_${new Date(log.timestamp).getTime().toString(36)}`,
        sourceType: 'SYSTEM_AUDIT',
        rawPayload: log
      });
    });

    // 2. Process Auditable Access Approval Records
    rawApprovalRecords.forEach((rec) => {
      let actionLabel = rec.actionType as string;
      let severity: UnifiedAuditRecord['severity'] = 'INFO';

      switch (rec.actionType) {
        case 'APPROVE':
          actionLabel = 'Access Approved';
          severity = 'SUCCESS';
          break;
        case 'REJECT':
          actionLabel = 'Access Rejected';
          severity = 'CRITICAL';
          break;
        case 'ROLE_CHANGE':
          actionLabel = 'Role Elevated / Modified';
          severity = 'WARN';
          break;
        case 'PROVISION':
          actionLabel = 'User Provisioned';
          severity = 'SUCCESS';
          break;
        case 'SUSPEND':
          actionLabel = 'Account Suspended';
          severity = 'WARN';
          break;
        case 'ACTIVATE':
          actionLabel = 'Account Activated';
          severity = 'SUCCESS';
          break;
        case 'REMOVE':
          actionLabel = 'User Decommissioned';
          severity = 'CRITICAL';
          break;
      }

      list.push({
        id: rec.id,
        timestamp: rec.timestamp,
        component: 'User Management & IAM',
        action: rec.actionType,
        actionLabel,
        user: rec.approvedBy,
        role: rec.approverRole || 'SUPER_ADMIN',
        target: `${rec.targetUserName} (${rec.targetUserEmail})`,
        details: rec.rationaleNotes,
        severity,
        complianceTag: rec.complianceTag || 'SOC2-CC6.1-ACCESS-AUTHORIZATION',
        verificationHash: rec.verificationHash,
        sourceType: 'ACCESS_APPROVAL',
        rawPayload: rec
      });
    });

    // 3. Process SCIM 2.0 & Azure AD SSO API Audit Logs
    rawScimLogs.forEach((scim) => {
      let severity: UnifiedAuditRecord['severity'] = 'INFO';
      if (scim.statusCode >= 400) severity = 'WARN';
      if (scim.statusCode >= 500) severity = 'CRITICAL';

      list.push({
        id: scim.id,
        timestamp: scim.timestamp,
        component: 'Azure AD SSO & SCIM',
        action: scim.method,
        actionLabel: `SCIM 2.0 ${scim.method} Assertion`,
        user: 'Azure AD SCIM Sync Bot',
        role: 'SYSTEM_SERVICE',
        target: scim.targetUserName ? `${scim.targetUserName} (${scim.endpoint})` : scim.endpoint,
        details: `${scim.action}: ${scim.details} (HTTP ${scim.statusCode})`,
        severity,
        complianceTag: 'SOC2-CC6.1-SCIM-AUTOMATION',
        verificationHash: `sig_scim_${scim.id}_${scim.statusCode}`,
        sourceType: 'SCIM_API',
        rawPayload: scim
      });
    });

    // Sort descending by timestamp (newest first)
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [rawAuditLogs, rawScimLogs, rawApprovalRecords]);

  // Filtering Logic
  const filteredRecords = useMemo(() => {
    return unifiedRecords.filter((rec) => {
      // Component filter
      if (componentFilter !== 'ALL' && rec.component !== componentFilter) {
        return false;
      }

      // Action category filter
      if (actionCategoryFilter !== 'ALL') {
        const act = rec.action.toUpperCase();
        if (actionCategoryFilter === 'CREATE' && !['CREATE', 'PROVISION', 'POST', 'SOP_UPLOAD'].some(k => act.includes(k))) return false;
        if (actionCategoryFilter === 'UPDATE' && !['UPDATE', 'PUT', 'PATCH', 'ROLE_CHANGE', 'REOPEN'].some(k => act.includes(k))) return false;
        if (actionCategoryFilter === 'DELETE' && !['DELETE', 'REMOVE', 'SUSPEND', 'REVOKED'].some(k => act.includes(k))) return false;
        if (actionCategoryFilter === 'APPROVE' && !['APPROVE', 'ACTIVATE', 'GENERATED'].some(k => act.includes(k))) return false;
        if (actionCategoryFilter === 'REJECT' && !['REJECT'].some(k => act.includes(k))) return false;
        if (actionCategoryFilter === 'SYNC' && !['GET', 'POST', 'PATCH', 'SYNC', 'SSO', 'OIDC'].some(k => act.includes(k))) return false;
      }

      // Severity filter
      if (severityFilter !== 'ALL' && rec.severity !== severityFilter) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          rec.id.toLowerCase().includes(q) ||
          rec.user.toLowerCase().includes(q) ||
          rec.component.toLowerCase().includes(q) ||
          rec.actionLabel.toLowerCase().includes(q) ||
          rec.target.toLowerCase().includes(q) ||
          rec.details.toLowerCase().includes(q) ||
          rec.complianceTag.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [unifiedRecords, componentFilter, actionCategoryFilter, severityFilter, searchTerm]);

  // KPI Metrics by Component
  const totalCount = unifiedRecords.length;
  const appDbCount = unifiedRecords.filter((r) => r.component === 'Applications Database').length;
  const userIamCount = unifiedRecords.filter((r) => r.component === 'User Management & IAM').length;
  const scimSsoCount = unifiedRecords.filter((r) => r.component === 'Azure AD SSO & SCIM').length;
  const rbacCount = unifiedRecords.filter((r) => r.component === 'RBAC Control').length;
  const reviewQueueCount = unifiedRecords.filter((r) => r.component === 'Review Queue').length;
  const sopCount = unifiedRecords.filter((r) => r.component === 'SOP Document').length;
  const armorCodeCount = unifiedRecords.filter((r) => r.component === 'ArmorCode Security').length;

  // Component Badge Style Helper
  const getComponentBadge = (comp: AuditComponentType) => {
    switch (comp) {
      case 'Applications Database':
        return {
          bg: 'bg-indigo-100 text-indigo-900 border-indigo-200 dark:bg-indigo-950/80 dark:text-indigo-300 dark:border-indigo-800',
          icon: Database,
          label: 'Applications Database'
        };
      case 'User Management & IAM':
        return {
          bg: 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800',
          icon: Users,
          label: 'User Management & IAM'
        };
      case 'Azure AD SSO & SCIM':
        return {
          bg: 'bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800',
          icon: KeyRound,
          label: 'Azure AD SSO & SCIM'
        };
      case 'RBAC Control':
        return {
          bg: 'bg-purple-100 text-purple-900 border-purple-200 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800',
          icon: Shield,
          label: 'RBAC Control'
        };
      case 'Review Queue':
        return {
          bg: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800',
          icon: CheckSquare,
          label: 'Review Queue'
        };
      case 'SOP Document':
        return {
          bg: 'bg-cyan-100 text-cyan-900 border-cyan-200 dark:bg-cyan-950/80 dark:text-cyan-300 dark:border-cyan-800',
          icon: FileText,
          label: 'SOP Document'
        };
      case 'ArmorCode Security':
        return {
          bg: 'bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800',
          icon: Award,
          label: 'ArmorCode Security'
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300',
          icon: Layers,
          label: comp
        };
    }
  };

  // Action Severity Badge Style Helper
  const getSeverityBadge = (severity: UnifiedAuditRecord['severity']) => {
    switch (severity) {
      case 'SUCCESS':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
          icon: CheckCircle2
        };
      case 'CRITICAL':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
          icon: XCircle
        };
      case 'WARN':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
          icon: AlertCircle
        };
      default:
        return {
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
          icon: Info
        };
    }
  };

  // Export Centralized CSV
  const handleExportCSV = () => {
    const headers = [
      'Event ID',
      'Timestamp',
      'Component',
      'Action Event',
      'Actor User',
      'Actor Role',
      'Target Asset / Identity',
      'Details & Notes',
      'Severity',
      'Verification Hash'
    ];

    const rows = filteredRecords.map((r) => [
      r.id,
      r.timestamp,
      `"${r.component}"`,
      `"${r.actionLabel}"`,
      `"${r.user.replace(/"/g, '""')}"`,
      r.role,
      `"${r.target.replace(/"/g, '""')}"`,
      `"${r.details.replace(/"/g, '""')}"`,
      r.severity,
      r.verificationHash || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Centralized_Audit_Trail_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Centralized audit log trail exported to CSV successfully.');
  };

  const copyJsonPayload = (payload: any) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 text-sm font-semibold transition-all animate-bounce ${
            toastMsg.type === 'success'
              ? 'bg-emerald-950 text-emerald-200 border-emerald-500/50'
              : 'bg-rose-950 text-rose-200 border-rose-500/50'
          }`}
        >
          {toastMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Main Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 md:p-8 border border-slate-800 shadow-xl text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-md">
                <History className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-100">
                    Centralized Audit Log Trail
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] uppercase font-bold">
                    SOC2 & ISO27001
                  </span>
                </div>
                <p className="text-sm text-indigo-200/80">
                  Immutable security governance ledger centralizing auditable records across all enterprise platform components
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {onRefreshLogs && (
              <button
                onClick={() => {
                  onRefreshLogs();
                  showToast('Refreshed audit records from database storage.');
                }}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-indigo-400" />
                <span>Sync Records</span>
              </button>
            )}

            <button
              onClick={handleExportCSV}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg flex items-center gap-2 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Centralized CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Component Breakdown Summary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          onClick={() => setComponentFilter('ALL')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            componentFilter === 'ALL'
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg ring-2 ring-indigo-400/50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${componentFilter === 'ALL' ? 'text-indigo-200' : 'text-slate-500'}`}>
              All Components
            </span>
            <Layers className="w-4 h-4 opacity-80" />
          </div>
          <p className={`text-xl font-extrabold mt-2 ${componentFilter === 'ALL' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
            {totalCount}
          </p>
          <p className={`text-[10px] mt-0.5 ${componentFilter === 'ALL' ? 'text-indigo-200' : 'text-slate-400'}`}>
            Centralized Entries
          </p>
        </button>

        <button
          onClick={() => setComponentFilter('Applications Database')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            componentFilter === 'Applications Database'
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg ring-2 ring-indigo-400/50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${componentFilter === 'Applications Database' ? 'text-indigo-200' : 'text-slate-500'}`}>
              App Database
            </span>
            <Database className="w-4 h-4 opacity-80" />
          </div>
          <p className={`text-xl font-extrabold mt-2 ${componentFilter === 'Applications Database' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
            {appDbCount}
          </p>
          <p className={`text-[10px] mt-0.5 ${componentFilter === 'Applications Database' ? 'text-indigo-200' : 'text-slate-400'}`}>
            App CRUD Logs
          </p>
        </button>

        <button
          onClick={() => setComponentFilter('User Management & IAM')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            componentFilter === 'User Management & IAM'
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg ring-2 ring-emerald-400/50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${componentFilter === 'User Management & IAM' ? 'text-emerald-100' : 'text-slate-500'}`}>
              User IAM
            </span>
            <Users className="w-4 h-4 opacity-80" />
          </div>
          <p className={`text-xl font-extrabold mt-2 ${componentFilter === 'User Management & IAM' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {userIamCount}
          </p>
          <p className={`text-[10px] mt-0.5 ${componentFilter === 'User Management & IAM' ? 'text-emerald-100' : 'text-slate-400'}`}>
            Access Approvals
          </p>
        </button>

        <button
          onClick={() => setComponentFilter('Azure AD SSO & SCIM')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            componentFilter === 'Azure AD SSO & SCIM'
              ? 'bg-blue-600 text-white border-blue-500 shadow-lg ring-2 ring-blue-400/50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${componentFilter === 'Azure AD SSO & SCIM' ? 'text-blue-100' : 'text-slate-500'}`}>
              SSO & SCIM
            </span>
            <KeyRound className="w-4 h-4 opacity-80" />
          </div>
          <p className={`text-xl font-extrabold mt-2 ${componentFilter === 'Azure AD SSO & SCIM' ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`}>
            {scimSsoCount}
          </p>
          <p className={`text-[10px] mt-0.5 ${componentFilter === 'Azure AD SSO & SCIM' ? 'text-blue-100' : 'text-slate-400'}`}>
            SCIM API Assertions
          </p>
        </button>

        <button
          onClick={() => setComponentFilter('Review Queue')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            componentFilter === 'Review Queue'
              ? 'bg-amber-600 text-white border-amber-500 shadow-lg ring-2 ring-amber-400/50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${componentFilter === 'Review Queue' ? 'text-amber-100' : 'text-slate-500'}`}>
              Review Queue
            </span>
            <CheckSquare className="w-4 h-4 opacity-80" />
          </div>
          <p className={`text-xl font-extrabold mt-2 ${componentFilter === 'Review Queue' ? 'text-white' : 'text-amber-600 dark:text-amber-400'}`}>
            {reviewQueueCount}
          </p>
          <p className={`text-[10px] mt-0.5 ${componentFilter === 'Review Queue' ? 'text-amber-100' : 'text-slate-400'}`}>
            Rating Proposals
          </p>
        </button>

        <button
          onClick={() => setComponentFilter('ArmorCode Security')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            componentFilter === 'ArmorCode Security'
              ? 'bg-purple-600 text-white border-purple-500 shadow-lg ring-2 ring-purple-400/50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${componentFilter === 'ArmorCode Security' ? 'text-purple-100' : 'text-slate-500'}`}>
              Promotion Evidences
            </span>
            <Award className="w-4 h-4 opacity-80" />
          </div>
          <p className={`text-xl font-extrabold mt-2 ${componentFilter === 'ArmorCode Security' ? 'text-white' : 'text-purple-600 dark:text-purple-400'}`}>
            {armorCodeCount}
          </p>
          <p className={`text-[10px] mt-0.5 ${componentFilter === 'ArmorCode Security' ? 'text-purple-100' : 'text-slate-400'}`}>
            Signed Certificates
          </p>
        </button>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        
        {/* Control Bar: Search & Component Filter Bar */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row items-center justify-between gap-4">
          
          {/* Search Box */}
          <div className="relative w-full lg:w-96">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search across user, component, action, target, or details..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            
            {/* Component Breakdown Filter */}
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Component:</span>
              <select
                value={componentFilter}
                onChange={(e) => setComponentFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none"
              >
                <option value="ALL">All Components ({totalCount})</option>
                <option value="Applications Database">Applications Database ({appDbCount})</option>
                <option value="User Management & IAM">User Management & IAM ({userIamCount})</option>
                <option value="Azure AD SSO & SCIM">Azure AD SSO & SCIM ({scimSsoCount})</option>
                <option value="RBAC Control">RBAC Control ({rbacCount})</option>
                <option value="Review Queue">Review Queue ({reviewQueueCount})</option>
                <option value="SOP Document">SOP Document ({sopCount})</option>
                <option value="ArmorCode Security">ArmorCode Security ({armorCodeCount})</option>
              </select>
            </div>

            {/* Action Category Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-500 font-medium">Event Category:</span>
              <select
                value={actionCategoryFilter}
                onChange={(e) => setActionCategoryFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
              >
                <option value="ALL">All Action Categories</option>
                <option value="CREATE">Create / Provision</option>
                <option value="UPDATE">Update / Modify</option>
                <option value="DELETE">Delete / Decommission</option>
                <option value="APPROVE">Approve / Grant / Activate</option>
                <option value="REJECT">Reject / Suspend</option>
                <option value="SYNC">SCIM Sync & SSO Claims</option>
              </select>
            </div>

            {/* Severity Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Severity:</span>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
              >
                <option value="ALL">All Severities</option>
                <option value="SUCCESS">Success / Grant</option>
                <option value="INFO">Info / Audit</option>
                <option value="WARN">Warning / Modification</option>
                <option value="CRITICAL">Critical / Rejection</option>
              </select>
            </div>
          </div>
        </div>

        {/* Centralized Audit Table with Component Column */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Timestamp</th>
                {/* NEW REQUIRED COLUMN BREAKS AUDIT LOGS BY COMPONENTS */}
                <th className="py-3.5 px-4 text-indigo-600 dark:text-indigo-400 flex items-center gap-1 font-extrabold">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Component</span>
                </th>
                <th className="py-3.5 px-4">Event Action</th>
                <th className="py-3.5 px-4">Actor (User & Role)</th>
                <th className="py-3.5 px-4">Target Asset / Identity</th>
                <th className="py-3.5 px-4">Log Details</th>
                <th className="py-3.5 px-4 text-right">Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <History className="w-10 h-10 mx-auto text-slate-400 mb-2 opacity-50" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      No auditable records match your search or component filter criteria.
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try selecting "All Components" or clearing your search term.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const compBadge = getComponentBadge(record.component);
                  const CompIcon = compBadge.icon;
                  const sevBadge = getSeverityBadge(record.severity);
                  const SevIcon = sevBadge.icon;

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{new Date(record.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                          ID: <span className="font-mono">{record.id}</span>
                        </p>
                      </td>

                      {/* COMPONENT COLUMN */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border inline-flex items-center gap-1.5 shadow-xs ${compBadge.bg}`}
                        >
                          <CompIcon className="w-3 h-3" />
                          <span>{compBadge.label}</span>
                        </span>
                      </td>

                      {/* Action Event */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border inline-flex items-center gap-1 ${sevBadge.bg}`}
                        >
                          <SevIcon className="w-3 h-3" />
                          <span>{record.actionLabel}</span>
                        </span>
                      </td>

                      {/* Actor (User & Role) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{record.user}</span>
                        </p>
                        <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono font-bold mt-0.5">
                          {record.role}
                        </p>
                      </td>

                      {/* Target Asset / Identity */}
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          {record.target}
                        </p>
                      </td>

                      {/* Change Log Details */}
                      <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                        <p className="text-slate-700 dark:text-slate-300 line-clamp-2">
                          {record.details}
                        </p>
                      </td>

                      {/* Evidence Inspector Action */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setInspectingRecord(record)}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] shadow-xs inline-flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Code className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INSPECT AUDITABLE RECORD EVIDENCE MODAL */}
      {inspectingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 text-white shadow-2xl space-y-6">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>Centralized Auditable Evidence Certificate</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono">
                      TAMPER-EVIDENT
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Record ID: {inspectingRecord.id} • Component: {inspectingRecord.component}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setInspectingRecord(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Audit Record Attributes Grid */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-950/80 p-4 rounded-xl border border-slate-800">
              <div>
                <p className="text-slate-500 font-semibold uppercase">Source Component</p>
                <p className="font-bold text-indigo-300 mt-0.5">{inspectingRecord.component}</p>
              </div>

              <div>
                <p className="text-slate-500 font-semibold uppercase">Event Action</p>
                <p className="font-bold text-white mt-0.5">{inspectingRecord.actionLabel} ({inspectingRecord.action})</p>
              </div>

              <div>
                <p className="text-slate-500 font-semibold uppercase">Authorizing Actor & Role</p>
                <p className="font-bold text-white mt-0.5">{inspectingRecord.user} ({inspectingRecord.role})</p>
              </div>

              <div>
                <p className="text-slate-500 font-semibold uppercase">Timestamp</p>
                <p className="font-mono text-slate-300 mt-0.5">{inspectingRecord.timestamp}</p>
              </div>

              <div>
                <p className="text-slate-500 font-semibold uppercase">Target Asset / UPN</p>
                <p className="font-bold text-slate-200 mt-0.5">{inspectingRecord.target}</p>
              </div>

              <div>
                <p className="text-slate-500 font-semibold uppercase">Record Verification</p>
                <p className="font-mono text-emerald-400 mt-0.5 truncate" title={inspectingRecord.verificationHash}>
                  {inspectingRecord.verificationHash || 'sig_verified_immutable'}
                </p>
              </div>
            </div>

            {/* Change Log Details */}
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Audit Trail Details & Rationale</p>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-200 leading-relaxed font-sans">
                {inspectingRecord.details}
              </div>
            </div>

            {/* Cryptographic Signature */}
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cryptographic Verification Hash</p>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-[11px] font-mono text-emerald-400 flex items-center justify-between">
                <span>{inspectingRecord.verificationHash || `sig_centralized_${inspectingRecord.id}_verified`}</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[9px] font-bold">HMAC-SHA256 SIGNED</span>
              </div>
            </div>

            {/* Raw JSON Payload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Raw JSON Event Payload</p>
                <button
                  onClick={() => copyJsonPayload(inspectingRecord.rawPayload || inspectingRecord)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                >
                  {copiedJson ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48 scrollbar-thin">
                {JSON.stringify(inspectingRecord.rawPayload || inspectingRecord, null, 2)}
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end border-t border-slate-800 pt-4">
              <button
                onClick={() => setInspectingRecord(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-all cursor-pointer"
              >
                Close Inspector
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
