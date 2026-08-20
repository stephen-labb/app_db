import React, { useState, useEffect } from 'react';
import { UserSessionRecord, AntiBolaSecurityLog, RedisCacheStats } from '../utils/securitySessionStore';
import { authFetch } from '../utils/apiClient';
import { ActiveSsoUser, UserRole } from '../types';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  KeyRound,
  Server,
  Database,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Clock,
  User,
  Globe,
  FileText,
  Activity,
  CheckCircle2,
  XCircle,
  Zap,
  HardDrive,
  Users,
  Layers,
  Key
} from 'lucide-react';

interface SecuritySessionViewProps {
  activeSsoUser: ActiveSsoUser;
  onRoleChange?: (role: UserRole) => void;
}

export const SecuritySessionView: React.FC<SecuritySessionViewProps> = ({ activeSsoUser }) => {
  const [sessions, setSessions] = useState<UserSessionRecord[]>([]);
  const [bolaLogs, setBolaLogs] = useState<AntiBolaSecurityLog[]>([]);
  const [redisStats, setRedisStats] = useState<RedisCacheStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<string>('ALL');

  const fetchSessionData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch active sessions from Redis cache
      const sessRes = await authFetch('/api/auth/sessions');
      if (sessRes.ok) {
        const sessData = await sessRes.json();
        setSessions(sessData.sessions || []);
      }

      // 2. Fetch Redis cache stats
      const statsRes = await authFetch('/api/auth/redis-stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setRedisStats(statsData.stats || null);
      }

      // 3. Fetch Anti-BOLA audit logs
      const bolaRes = await authFetch('/api/auth/bola-logs');
      if (bolaRes.ok) {
        const bolaData = await bolaRes.json();
        setBolaLogs(bolaData.logs || []);
      }
    } catch (err: any) {
      console.warn('Could not fetch security session data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionData();
    const timer = setInterval(fetchSessionData, 10000);
    return () => clearInterval(timer);
  }, []);

  // Revoke a single active session in Redis
  const handleRevokeSession = async (sessionId: string, userEmail: string) => {
    if (window.confirm(`Revoke session '${sessionId}' for user '${userEmail}'? User will be logged out instantly.`)) {
      try {
        const res = await authFetch(`/api/auth/sessions/${sessionId}`, { method: 'DELETE' });
        if (res.ok) {
          setActionSuccessMsg(`Successfully revoked session '${sessionId}' in Redis session store.`);
          setTimeout(() => setActionSuccessMsg(null), 4000);
          fetchSessionData();
        } else {
          const data = await res.json();
          setActionErrorMsg(data.error || 'Failed to revoke session');
          setTimeout(() => setActionErrorMsg(null), 4000);
        }
      } catch (err: any) {
        setActionErrorMsg(err.message || 'Error revoking session');
        setTimeout(() => setActionErrorMsg(null), 4000);
      }
    }
  };

  // Revoke all active sessions for a user ID (Kill Switch)
  const handleKillSwitchAllUserSessions = async (userId: string, userEmail: string) => {
    if (window.confirm(`KILL SWITCH: Revoke ALL active Redis sessions for user '${userEmail}' (${userId})?`)) {
      try {
        const res = await authFetch(`/api/auth/sessions/user/${userId}`, { method: 'DELETE' });
        if (res.ok) {
          setActionSuccessMsg(`KILL SWITCH EXECUTED: All active sessions for user '${userEmail}' were revoked.`);
          setTimeout(() => setActionSuccessMsg(null), 4000);
          fetchSessionData();
        } else {
          const data = await res.json();
          setActionErrorMsg(data.error || 'Failed to execute kill switch');
          setTimeout(() => setActionErrorMsg(null), 4000);
        }
      } catch (err: any) {
        setActionErrorMsg(err.message || 'Error executing kill switch');
        setTimeout(() => setActionErrorMsg(null), 4000);
      }
    }
  };

  // Flush Redis session cache
  const handleFlushRedisCache = async () => {
    if (window.confirm('DANGER: Flush all Redis session cache keys? This will invalidate all active user sessions!')) {
      try {
        const res = await authFetch('/api/auth/redis-flush', { method: 'POST' });
        if (res.ok) {
          setActionSuccessMsg('Redis Session Cache flushed completely. All sessions invalidated.');
          setTimeout(() => setActionSuccessMsg(null), 4000);
          fetchSessionData();
        }
      } catch (e) {}
    }
  };

  const filteredBolaLogs = bolaLogs.filter((log) => {
    const matchesSearch =
      log.callerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actionRequested.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.endpoint.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.targetResourceId.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesVerdict = verdictFilter === 'ALL' || log.verdict === verdictFilter;

    return matchesSearch && matchesVerdict;
  });

  const activeSessionsCount = sessions.filter((s) => s.status === 'ACTIVE').length;
  const blockedBolaCount = bolaLogs.filter((l) => l.verdict === 'BOLA_VIOLATION_BLOCKED').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 md:p-8 border border-slate-800 shadow-xl text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-md">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
                  <span>HTTPS Security & Redis Session Identity Engine</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    HTTPS & Anti-BOLA Enforced
                  </span>
                </h2>
                <p className="text-sm text-indigo-200/80">
                  JWT-bound user identity, anti-BOLA authorization safeguards, and Redis session cache control
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchSessionData}
              disabled={isLoading}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-indigo-400 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Telemetry</span>
            </button>

            <button
              onClick={handleFlushRedisCache}
              className="px-3.5 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-200 font-semibold text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Flush Redis Cache</span>
            </button>
          </div>
        </div>
      </div>

      {/* Action Banners */}
      {actionSuccessMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-3 animate-fadeIn shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-semibold">{actionSuccessMsg}</span>
        </div>
      )}

      {actionErrorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-2xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-3 animate-fadeIn shadow-sm">
          <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <span className="font-semibold">{actionErrorMsg}</span>
        </div>
      )}

      {/* Top Security & Redis Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* HTTPS Enforced Protocol */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              HTTPS Protocol Status
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
              HTTPS Enforced
            </span>
            <span className="text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
              TLS 1.3
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            HSTS max-age=31536000, secure JWT bearer tokens & anti-XSS protection
          </p>
        </div>

        {/* Anti-BOLA Shield */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Anti-BOLA Protection
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
              Identity Bound
            </span>
            <span className="text-[10px] font-mono font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
              {blockedBolaCount} Blocked IDOR
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            All API endpoints verify resource owner ID against JWT token payload
          </p>
        </div>

        {/* Redis Cache Engine */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Redis Session Store
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
              {redisStats?.connected ? 'Redis Active' : 'In-Memory Redis'}
            </span>
            <span className="text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
              {redisStats?.totalCachedKeys || activeSessionsCount} Keys
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            URL: <code className="font-mono text-indigo-600 dark:text-indigo-400">{redisStats?.redisUrl || 'redis://127.0.0.1:6379'}</code>
          </p>
        </div>

        {/* Active Sessions Count */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Active JWT Sessions
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {activeSessionsCount}
            </span>
            <span className="text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
              12h TTL
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Sessions cached with automatic TTL sliding expiration
          </p>
        </div>

      </div>

      {/* SECTION 1: ACTIVE REDIS CACHED USER SESSIONS TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              <span>Active Redis Cached User Sessions</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                {sessions.length} Registered Sessions
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Real-time Redis cache sessions, user identities, cryptographic JWT tokens, and one-click revocation controls
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-4">Session ID</th>
                <th className="py-3 px-4">User & Role</th>
                <th className="py-3 px-4">Auth Method</th>
                <th className="py-3 px-4">IP Address & Agent</th>
                <th className="py-3 px-4">Issued & TTL</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Revocation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 dark:text-slate-400 font-sans">
                    No active user sessions found in Redis cache. Log in to register a session.
                  </td>
                </tr>
              ) : (
                sessions.map((sess) => (
                  <tr key={sess.sessionId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                      {sess.sessionId}
                    </td>

                    <td className="py-3.5 px-4 font-sans">
                      <div className="font-bold text-slate-900 dark:text-slate-100">{sess.displayName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{sess.email}</div>
                      <span className={`inline-block mt-1 text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        sess.role === 'SUPER_ADMIN'
                          ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-500/30'
                          : sess.role === 'APPSEC_ADMIN'
                          ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-500/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        {sess.role}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-sans text-xs">
                      <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] border border-slate-300 dark:border-slate-700">
                        {sess.loginMethod}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-[11px] text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      <div className="font-bold text-slate-800 dark:text-slate-200">{sess.ipAddress}</div>
                      <div className="truncate text-slate-400" title={sess.userAgent}>{sess.userAgent}</div>
                    </td>

                    <td className="py-3.5 px-4 text-[11px]">
                      <div className="text-slate-700 dark:text-slate-300">{new Date(sess.issuedAt).toLocaleTimeString()}</div>
                      <div className="text-indigo-600 dark:text-indigo-400 font-bold">{Math.round(sess.ttlSeconds / 60)} min left</div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-sans ${
                        sess.status === 'ACTIVE'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-500/30'
                      }`}>
                        {sess.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right font-sans">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRevokeSession(sess.sessionId, sess.email)}
                          className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/80 hover:bg-rose-200 dark:hover:bg-rose-900 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Revoke</span>
                        </button>

                        <button
                          onClick={() => handleKillSwitchAllUserSessions(sess.userId, sess.email)}
                          className="px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-950/80 hover:bg-purple-200 dark:hover:bg-purple-900 border border-purple-300 dark:border-purple-800 text-purple-800 dark:text-purple-200 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Revoke ALL active sessions for this user ID across all devices"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Kill All</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: ANTI-BOLA (BROKEN OBJECT LEVEL AUTHORIZATION) SECURITY TELEMETRY */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-purple-500" />
              <span>Anti-BOLA Security Telemetry & Audit Trail</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                {blockedBolaCount} Blocked IDOR Attempts
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verifies that authenticated JWT tokens cannot access or manipulate object resources belonging to other users or tenants
            </p>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user, action, resource..."
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />

            <select
              value={verdictFilter}
              onChange={(e) => setVerdictFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="ALL">All Verdicts</option>
              <option value="BOLA_VIOLATION_BLOCKED">Blocked BOLA Attempts</option>
              <option value="GRANTED">Authorized Access</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Caller Identity</th>
                <th className="py-3 px-4">Requested Endpoint</th>
                <th className="py-3 px-4">Target Resource</th>
                <th className="py-3 px-4 text-center">Verdict</th>
                <th className="py-3 px-4">Security Reason / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
              {filteredBolaLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500 dark:text-slate-400 font-sans">
                    No anti-BOLA audit entries match the search criteria.
                  </td>
                </tr>
              ) : (
                filteredBolaLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>

                    <td className="py-3 px-4 font-sans">
                      <div className="font-bold text-slate-900 dark:text-slate-100">{log.callerEmail}</div>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono">
                        Role: {log.callerRole}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                      <div>{log.actionRequested}</div>
                      <div className="text-slate-500">{log.endpoint}</div>
                    </td>

                    <td className="py-3 px-4 text-[11px] font-mono text-slate-800 dark:text-slate-200">
                      <div>ID: {log.targetResourceId}</div>
                      {log.targetResourceOwnerId && (
                        <div className="text-slate-500 text-[10px]">Owner: {log.targetResourceOwnerId}</div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center font-sans">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                        log.verdict === 'BOLA_VIOLATION_BLOCKED'
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-500/40'
                          : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {log.verdict === 'BOLA_VIOLATION_BLOCKED' ? 'BLOCKED (BOLA)' : 'GRANTED'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-[11px] font-sans text-slate-600 dark:text-slate-300 max-w-sm">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
