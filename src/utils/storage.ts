import { Application, SOPDocument, AuditLogEntry, UserRole, PendingAssessment } from '../types';
import {
  loadSsoConfig,
  loadScimConfig,
  loadGroupMappings,
  loadProvisionedUsers,
  loadScimAuditLogs,
  loadActiveSsoUser
} from './ssoScimStorage';

const APPS_KEY = 'appsec_criticality_apps_v1';
const SOP_KEY = 'appsec_criticality_sop_v1';
const AUDIT_KEY = 'appsec_criticality_audit_v1';
const ROLE_KEY = 'appsec_criticality_user_role_v1';
const PENDING_KEY = 'appsec_criticality_pending_v1';

const defaultSopDocument: SOPDocument = {
  activeVersion: 'v1.0.0',
  history: [
    {
      version: 'v1.0.0',
      title: 'Standard Operating Procedure for Application Criticality Rating',
      content: 'Standard operating procedure document for application security criticality evaluation.',
      uploadedBy: 'AppSec Lead',
      uploadedAt: new Date().toISOString(),
      changeSummary: 'Initial System SOP Setup',
      fileName: 'sop-v1.0.0.pdf'
    }
  ]
};

export function loadPendingAssessments(): PendingAssessment[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load pending assessments from localStorage:', err);
    return [];
  }
}

export function savePendingAssessments(assessments: PendingAssessment[]): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(assessments));
    // Sync to PostgreSQL backend
    assessments.forEach(p => {
      fetch('/api/pending-assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p)
      }).catch(err => console.warn('PostgreSQL pending assessment sync warning:', err));
    });
  } catch (err) {
    console.error('Failed to save pending assessments to localStorage:', err);
  }
}

export function loadApplications(): Application[] {
  try {
    const raw = localStorage.getItem(APPS_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load applications from localStorage:', err);
    return [];
  }
}

export function saveApplications(apps: Application[]): void {
  try {
    localStorage.setItem(APPS_KEY, JSON.stringify(apps));
    // Sync to PostgreSQL backend
    apps.forEach(app => {
      fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(app)
      }).catch(err => console.warn('PostgreSQL app sync warning:', err));
    });
  } catch (err) {
    console.error('Failed to save applications to localStorage:', err);
  }
}

export function deleteApplicationFromDb(id: string): void {
  fetch(`/api/apps/${id}`, { method: 'DELETE' })
    .catch(err => console.warn('PostgreSQL delete app sync warning:', err));
}

export function loadSOPDocument(): SOPDocument {
  try {
    const raw = localStorage.getItem(SOP_KEY);
    if (!raw) {
      saveSOPDocument(defaultSopDocument);
      return defaultSopDocument;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load SOP document from localStorage:', err);
    return defaultSopDocument;
  }
}

export function saveSOPDocument(sop: SOPDocument): void {
  try {
    localStorage.setItem(SOP_KEY, JSON.stringify(sop));
    fetch('/api/sop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sop)
    }).catch(err => console.warn('PostgreSQL SOP sync warning:', err));
  } catch (err) {
    console.error('Failed to save SOP document to localStorage:', err);
  }
}

export function loadAuditLogs(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load audit logs from localStorage:', err);
    return [];
  }
}

export function saveAuditLogs(logs: AuditLogEntry[]): void {
  try {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(logs));
    if (logs.length > 0) {
      fetch('/api/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logs[0])
      }).catch(err => console.warn('PostgreSQL audit log sync warning:', err));
    }
  } catch (err) {
    console.error('Failed to save audit logs to localStorage:', err);
  }
}

export function addAuditLog(
  user: string,
  role: UserRole,
  action: AuditLogEntry['action'],
  details: string,
  appId?: string,
  appName?: string,
  component?: string,
  complianceTag?: string
): AuditLogEntry {
  const currentLogs = loadAuditLogs();
  const newEntry: AuditLogEntry = {
    id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
    timestamp: new Date().toISOString(),
    user,
    role,
    action,
    details,
    appId,
    appName,
    component: component || 'Applications Database',
    complianceTag: complianceTag || 'SOC2-CC6.1-AUDIT-TRAIL'
  };
  const updated = [newEntry, ...currentLogs];
  saveAuditLogs(updated);
  return newEntry;
}

export function loadUserRole(): UserRole {
  try {
    const raw = localStorage.getItem(ROLE_KEY);
    if (raw === 'APPSEC_ADMIN' || raw === 'IT_VIEWER') {
      return raw as UserRole;
    }
    return 'APPSEC_ADMIN'; // Default view mode for full testing
  } catch {
    return 'APPSEC_ADMIN';
  }
}

export function saveUserRole(role: UserRole): void {
  try {
    localStorage.setItem(ROLE_KEY, role);
  } catch (err) {
    console.error('Failed to save user role:', err);
  }
}

export async function asyncFetchFromPostgreSQL(): Promise<{
  apps?: Application[];
  sop?: SOPDocument;
  logs?: AuditLogEntry[];
  pending?: PendingAssessment[];
}> {
  const result: {
    apps?: Application[];
    sop?: SOPDocument;
    logs?: AuditLogEntry[];
    pending?: PendingAssessment[];
  } = {};
  try {
    const [appsRes, sopRes, logsRes, pendingRes] = await Promise.all([
      fetch('/api/apps').then(r => r.json()).catch(() => null),
      fetch('/api/sop').then(r => r.json()).catch(() => null),
      fetch('/api/audit-logs').then(r => r.json()).catch(() => null),
      fetch('/api/pending-assessments').then(r => r.json()).catch(() => null),
    ]);

    if (appsRes?.apps?.length > 0) {
      result.apps = appsRes.apps;
      localStorage.setItem(APPS_KEY, JSON.stringify(appsRes.apps));
    }
    if (sopRes?.sop) {
      result.sop = sopRes.sop;
      localStorage.setItem(SOP_KEY, JSON.stringify(sopRes.sop));
    }
    if (logsRes?.logs?.length > 0) {
      result.logs = logsRes.logs;
      localStorage.setItem(AUDIT_KEY, JSON.stringify(logsRes.logs));
    }
    if (pendingRes?.pending?.length > 0) {
      result.pending = pendingRes.pending;
      localStorage.setItem(PENDING_KEY, JSON.stringify(pendingRes.pending));
    }
  } catch (err) {
    console.warn('Error fetching state from PostgreSQL API:', err);
  }
  return result;
}

export function resetToDemoData(): { apps: Application[]; sop: SOPDocument; logs: AuditLogEntry[]; pending: PendingAssessment[] } {
  localStorage.removeItem(APPS_KEY);
  localStorage.removeItem(SOP_KEY);
  localStorage.removeItem(AUDIT_KEY);
  localStorage.removeItem(PENDING_KEY);
  saveApplications([]);
  saveSOPDocument(defaultSopDocument);
  saveAuditLogs([]);
  savePendingAssessments([]);
  return { apps: [], sop: defaultSopDocument, logs: [], pending: [] };
}

export function exportDatabaseJSON(
  apps: Application[],
  sop: SOPDocument,
  logs: AuditLogEntry[],
  pending?: PendingAssessment[]
): void {
  const pendingData = pending || loadPendingAssessments();
  const ssoConfig = loadSsoConfig();
  const scimConfig = loadScimConfig();
  const groupMappings = loadGroupMappings();
  const provisionedUsers = loadProvisionedUsers();
  const scimAuditLogs = loadScimAuditLogs();
  const activeSsoUser = loadActiveSsoUser();

  const data = {
    exportedAt: new Date().toISOString(),
    schemaVersion: '2.4',
    applicationsCount: apps.length,
    ticketsCount: pendingData.length,
    scimUsersCount: provisionedUsers.length,
    applications: apps,
    sopDocument: sop,
    pendingAssessments: pendingData,
    auditLogs: logs,
    ssoConfig,
    scimConfig,
    groupMappings,
    provisionedUsers,
    scimAuditLogs,
    activeSsoUser
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AppSec_Criticality_Full_Backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportTicketsCSV(tickets: PendingAssessment[]): void {
  const headers = [
    'Ticket ID', 'App Code', 'App Name', 'Submitter', 'Department',
    'Submitted At', 'Status', 'Proposed Tier', 'Calculated Score',
    'Hosting Env', 'Data Classification', 'Internet Exposed',
    'Admin Decision By', 'Admin Decision At', 'Decision Notes', 'Comments Count'
  ];

  const rows = tickets.map(t => [
    t.id,
    t.appCode,
    `"${t.appName.replace(/"/g, '""')}"`,
    `"${t.submitterName.replace(/"/g, '""')}"`,
    `"${t.department}"`,
    t.submittedAt,
    t.status,
    t.proposedTier,
    t.calculatedScore.toFixed(1),
    `"${t.hostingEnv}"`,
    t.dataClassification,
    t.internetExposed ? 'Yes' : 'No',
    `"${(t.adminDecisionBy || '').replace(/"/g, '""')}"`,
    t.adminDecisionAt || '',
    `"${(t.adminDecisionNotes || '').replace(/"/g, '""')}"`,
    t.comments?.length || 0
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Criticality_Review_Tickets_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportApplicationsCSV(apps: Application[]): void {
  const headers = [
    'ID', 'Code', 'Name', 'Tier', 'Score', 'Department',
    'AppSec Owner', 'IT Owner', 'Data Classification',
    'Internet Exposed', 'Hosting Env', 'Status', 'Last Assessed'
  ];

  const rows = apps.map(app => [
    app.id,
    app.code,
    `"${app.name.replace(/"/g, '""')}"`,
    app.tier,
    app.calculatedScore,
    `"${app.department}"`,
    `"${app.ownerAppSec}"`,
    `"${app.ownerIT}"`,
    app.dataClassification,
    app.internetExposed ? 'Yes' : 'No',
    `"${app.hostingEnv}"`,
    app.status,
    app.lastAssessed
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `App_Criticality_Database_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
