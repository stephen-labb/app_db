import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  Download,
  Trash2,
  RefreshCw,
  Clock,
  User,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  Copy,
  Check,
  Globe,
  Monitor,
  Terminal,
  Lock,
  Hourglass
} from 'lucide-react';
import { AccessLogEntry, UserRole, ActiveSsoUser } from '../types';
import {
  loadAccessLogs,
  clearAccessLogsStorage,
  exportAccessLogsCSV,
  loadSessionTimeoutMinutes
} from '../utils/accessLogsStorage';

interface AccessLogsViewProps {
  currentRole: UserRole;
  activeSsoUser?: ActiveSsoUser;
  onOpenSettings?: () => void;
}

export const AccessLogsView: React.FC<AccessLogsViewProps> = ({
  currentRole,
  activeSsoUser,
  onOpenSettings
}) => {
  const [logs, setLogs] = useState<AccessLogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [selectedLog, setSelectedLog] = useState<AccessLogEntry | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [timeoutMinutes, setTimeoutMinutes] = useState<number>(loadSessionTimeoutMinutes());

  const isAdmin = currentRole === 'APPSEC_ADMIN' || currentRole === 'SUPER_ADMIN';

  const fetchLogs = async () => {
    setIsRefreshing(true);
    try {
      // Fetch from API or fallback to localStorage
      const res = await fetch('/api/access-logs');
      if (res.ok) {
        const data = await res.json();
        if (data.logs && Array.isArray(data.logs) && data.logs.length > 0) {
          setLogs(data.logs);
          setIsRefreshing(false);
          return;
        }
      }
    } catch {
      // Fallback
    }
    setLogs(loadAccessLogs());
    setTimeoutMinutes(loadSessionTimeoutMinutes());
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleClearLogs = () => {
    if (!isAdmin) return;
    if (window.confirm('Are you sure you want to clear all access logs from local and server storage?')) {
      clearAccessLogsStorage();
      setLogs([]);
    }
  };

  const handleExportCSV = () => {
    exportAccessLogsCSV(filteredLogs);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtering
  const filteredLogs = logs.filter((log) => {
    if (statusFilter !== 'ALL' && log.status !== statusFilter) return false;
    if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;

    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.userEmail.toLowerCase().includes(term) ||
      log.displayName.toLowerCase().includes(term) ||
      log.role.toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term) ||
      (log.resource && log.resource.toLowerCase().includes(term)) ||
      (log.details && log.details.toLowerCase().includes(term)) ||
      (log.ipAddress && log.ipAddress.toLowerCase().includes(term)) ||
      log.id.toLowerCase().includes(term)
    );
  });

  // Metrics
  const totalCount = logs.length;
  const loginSuccessCount = logs.filter((l) => l.action === 'LOGIN_SUCCESS').length;
  const timeoutCount = logs.filter((l) => l.action === 'SESSION_TIMEOUT' || l.status === 'EXPIRED').length;
  const deniedCount = logs.filter((l) => l.status === 'DENIED' || l.action === 'PERMISSION_DENIED').length;

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      if (diffSecs < 60) return `${diffSecs}s ago`;
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Success</span>
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Hourglass className="w-3.5 h-3.5" />
            <span>Session Expired</span>
          </span>
        );
      case 'DENIED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            <span>Denied</span>
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Warning</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Activity className="w-3.5 h-3.5" />
            <span>{status || 'Info'}</span>
          </span>
        );
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'LOGIN_SUCCESS':
        return (
          <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            LOGIN_SUCCESS
          </span>
        );
      case 'SESSION_TIMEOUT':
        return (
          <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            SESSION_TIMEOUT
          </span>
        );
      case 'LOGOUT':
        return (
          <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            LOGOUT
          </span>
        );
      case 'PERMISSION_DENIED':
        return (
          <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            PERMISSION_DENIED
          </span>
        );
      case 'TAB_ACCESS':
        return (
          <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
            TAB_ACCESS
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded font-mono text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {action}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 shrink-0">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900">
                  User Access & Session Logging
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Active Monitoring
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Timeout: {timeoutMinutes} min</span>
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1 max-w-3xl">
                Continuous security access audit trail recording authentication, session creation, RBAC checks, and inactivity timeouts for all Super Admin and OIDC/SSO users.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={fetchLogs}
              disabled={isRefreshing}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-600' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={filteredLogs.length === 0}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export CSV</span>
            </button>

            {isAdmin && (
              <button
                onClick={handleClearLogs}
                disabled={logs.length === 0}
                className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                title="Clear access log history (Admins only)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Logs</span>
              </button>
            )}

            {onOpenSettings && isAdmin && (
              <button
                onClick={onOpenSettings}
                className="px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Configure Timeout</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Access Events
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {totalCount}
            </div>
            <span className="text-xs text-slate-400 mt-0.5 block">
              Recorded in session store
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Successful Logins
            </span>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              {loginSuccessCount}
            </div>
            <span className="text-xs text-emerald-600/80 mt-0.5 block">
              OIDC & Super Admin
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Inactivity Timeouts
            </span>
            <div className="text-2xl font-bold text-amber-600 mt-1">
              {timeoutCount}
            </div>
            <span className="text-xs text-amber-600/80 mt-0.5 block">
              Auto-terminated sessions
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Hourglass className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Denied / Challenges
            </span>
            <div className="text-2xl font-bold text-rose-600 mt-1">
              {deniedCount}
            </div>
            <span className="text-xs text-rose-600/80 mt-0.5 block">
              Unauthorized access blocked
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by user email, display name, action, resource, IP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent bg-slate-50/50 hover:bg-white transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-600">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="EXPIRED">Session Expired</option>
              <option value="DENIED">Denied</option>
              <option value="WARNING">Warning</option>
              <option value="INFO">Info</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <span className="text-xs font-semibold text-slate-600">Action:</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="text-xs bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Actions</option>
              <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
              <option value="SESSION_TIMEOUT">SESSION_TIMEOUT</option>
              <option value="LOGOUT">LOGOUT</option>
              <option value="TAB_ACCESS">TAB_ACCESS</option>
              <option value="PERMISSION_DENIED">PERMISSION_DENIED</option>
            </select>
          </div>
        </div>

      </div>

      {/* Access Logs Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">User & Role</th>
                <th className="py-3.5 px-4">Action Event</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Resource / Module</th>
                <th className="py-3.5 px-4">Client IP</th>
                <th className="py-3.5 px-4">Details</th>
                <th className="py-3.5 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <KeyRound className="w-8 h-8 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-600">
                        {logs.length === 0 ? 'No access logs recorded yet' : 'No matching access logs found'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {logs.length === 0
                          ? 'User logins, identity events, and session activity will appear here automatically.'
                          : 'Try changing your search query or filter settings.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/75 transition-colors group cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    {/* Timestamp */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatRelativeTime(log.timestamp)}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </td>

                    {/* User & Role */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-[11px] text-slate-600">
                          {log.displayName ? log.displayName[0].toUpperCase() : 'U'}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-800 block leading-tight">
                            {log.displayName || 'Anonymous'}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 block">
                            {log.userEmail}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getStatusBadge(log.status)}
                    </td>

                    {/* Resource */}
                    <td className="py-3 px-4 max-w-[160px] truncate text-slate-700 font-medium">
                      {log.resource || 'DevSecOps Console'}
                    </td>

                    {/* Client IP */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {log.ipAddress || '127.0.0.1'}
                    </td>

                    {/* Details */}
                    <td className="py-3 px-4 max-w-[220px] truncate text-slate-500" title={log.details}>
                      {log.details}
                    </td>

                    {/* Action button */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        <div className="bg-slate-50/80 px-4 py-3 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between flex-wrap gap-2">
          <span>Showing {filteredLogs.length} of {logs.length} total access events</span>
          <span className="text-[11px] font-mono text-slate-400">
            Session inactivity timeout limit: {timeoutMinutes} minutes
          </span>
        </div>
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Access Log Event Details
                  </h3>
                  <p className="text-xs font-mono text-cyan-300 mt-0.5">
                    {selectedLog.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Event Status</span>
                  <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Action Type</span>
                  <div className="mt-1">{getActionBadge(selectedLog.action)}</div>
                </div>
              </div>

              <div className="space-y-2 border border-slate-200 rounded-xl p-4 bg-white">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Timestamp (ISO)</span>
                  <span className="font-mono text-slate-800">{selectedLog.timestamp}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">User Display Name</span>
                  <span className="font-semibold text-slate-800">{selectedLog.displayName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">User Email</span>
                  <span className="font-mono text-slate-800">{selectedLog.userEmail}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Role</span>
                  <span className="font-semibold text-indigo-700">{selectedLog.role}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Login / Auth Method</span>
                  <span className="font-mono text-slate-800">{selectedLog.loginMethod || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Target Resource</span>
                  <span className="font-medium text-slate-800">{selectedLog.resource}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Client IP Address</span>
                  <span className="font-mono text-slate-800">{selectedLog.ipAddress || '127.0.0.1'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">User Agent</span>
                  <span className="font-mono text-[11px] text-slate-600 max-w-[280px] truncate" title={selectedLog.userAgent}>
                    {selectedLog.userAgent || 'Browser Client'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block mb-1">Details & Rationale</span>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-mono text-xs leading-relaxed">
                  {selectedLog.details}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-500 font-semibold">Raw JSON Payload</span>
                  <button
                    onClick={() => handleCopy(JSON.stringify(selectedLog, null, 2), selectedLog.id)}
                    className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold"
                  >
                    {copiedId === selectedLog.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48">
                  {JSON.stringify(selectedLog, null, 2)}
                </pre>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
