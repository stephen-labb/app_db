import { AccessLogEntry, UserRole, ActiveSsoUser } from '../types';

const ACCESS_LOGS_KEY = 'appsec_access_logs_v1';
const SESSION_TIMEOUT_KEY = 'appsec_session_timeout_minutes';

export const DEFAULT_SESSION_TIMEOUT_MINUTES = 15;

export function loadSessionTimeoutMinutes(): number {
  if (typeof window === 'undefined') return DEFAULT_SESSION_TIMEOUT_MINUTES;
  try {
    const stored = localStorage.getItem(SESSION_TIMEOUT_KEY);
    if (!stored) return DEFAULT_SESSION_TIMEOUT_MINUTES;
    const num = parseInt(stored, 10);
    return isNaN(num) || num <= 0 ? DEFAULT_SESSION_TIMEOUT_MINUTES : num;
  } catch {
    return DEFAULT_SESSION_TIMEOUT_MINUTES;
  }
}

export function saveSessionTimeoutMinutes(minutes: number): void {
  if (typeof window === 'undefined') return;
  try {
    const val = Math.max(1, Math.min(1440, minutes)); // between 1 min and 24 hours
    localStorage.setItem(SESSION_TIMEOUT_KEY, String(val));
    // Also notify server settings if needed
    fetch('/api/settings/session-timeout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeoutMinutes: val })
    }).catch(() => {});
  } catch (err) {
    console.error('Failed to save session timeout setting:', err);
  }
}

export function loadAccessLogs(): AccessLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ACCESS_LOGS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load access logs:', err);
    return [];
  }
}

export function saveAccessLogs(logs: AccessLogEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACCESS_LOGS_KEY, JSON.stringify(logs.slice(0, 500)));
  } catch (err) {
    console.error('Failed to save access logs:', err);
  }
}

export function clearAccessLogsStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ACCESS_LOGS_KEY);
    fetch('/api/access-logs', { method: 'DELETE' }).catch(() => {});
  } catch (err) {
    console.error('Failed to clear access logs:', err);
  }
}

export function addAccessLog(entry: Omit<AccessLogEntry, 'id' | 'timestamp'> & { timestamp?: string }): AccessLogEntry {
  const current = loadAccessLogs();
  const rand = Math.floor(10000 + Math.random() * 90000);
  const newEntry: AccessLogEntry = {
    id: `ACC-${Date.now().toString(36).toUpperCase()}-${rand}`,
    timestamp: entry.timestamp || new Date().toISOString(),
    userEmail: entry.userEmail || 'anonymous@local',
    displayName: entry.displayName || 'Anonymous User',
    role: entry.role || 'IT_VIEWER',
    loginMethod: entry.loginMethod,
    action: entry.action,
    resource: entry.resource || 'DevSecOps Management Console',
    ipAddress: entry.ipAddress || (typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1'),
    userAgent: entry.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'System/Client'),
    status: entry.status,
    details: entry.details
  };

  const updated = [newEntry, ...current].slice(0, 500);
  saveAccessLogs(updated);

  // Sync with server API
  fetch('/api/access-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newEntry)
  }).catch((err) => {
    // Non-blocking sync warning
    console.debug('Access log backend sync:', err);
  });

  return newEntry;
}

export const recordAccessLog = addAccessLog;

export function exportAccessLogsCSV(logs: AccessLogEntry[]): void {
  if (typeof window === 'undefined' || !logs || logs.length === 0) return;
  const headers = [
    'Log ID',
    'Timestamp',
    'User Email',
    'Display Name',
    'Role',
    'Action',
    'Status',
    'Resource / Module',
    'IP Address',
    'Login Method',
    'Details'
  ];

  const rows = logs.map((l) => [
    l.id,
    l.timestamp,
    `"${l.userEmail}"`,
    `"${l.displayName}"`,
    l.role,
    l.action,
    l.status,
    `"${(l.resource || '').replace(/"/g, '""')}"`,
    l.ipAddress || '127.0.0.1',
    l.loginMethod || 'N/A',
    `"${(l.details || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `DevSecOps_Access_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
