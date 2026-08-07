import React, { useState, useEffect, useRef } from 'react';
import {
  SsoConfig,
  ScimConfig,
  ScimGroupMapping,
  ProvisionedUser,
  ScimAuditLog,
  UserRole,
  ActiveSsoUser
} from '../types';
import {
  saveSsoConfig,
  saveScimConfig,
  saveGroupMappings,
  saveProvisionedUsers,
  calculateRoleFromAzureGroups,
  addScimAuditLog,
  exportSsoScimJSON,
  exportProvisionedUsersCSV,
  importSsoScimJSON,
  resetSsoScimToDefaults
} from '../utils/ssoScimStorage';
import {
  ShieldCheck,
  KeyRound,
  Users,
  Terminal,
  Settings,
  Copy,
  Check,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Code,
  Shield,
  Layers,
  Lock,
  Play,
  FileText,
  UserCheck,
  Search,
  Filter,
  Download,
  Upload,
  RotateCcw,
  FileSpreadsheet,
  FileJson,
  HardDrive
} from 'lucide-react';

interface SsoScimViewProps {
  ssoConfig: SsoConfig;
  onUpdateSsoConfig: (config: SsoConfig) => void;
  scimConfig: ScimConfig;
  onUpdateScimConfig: (config: ScimConfig) => void;
  groupMappings: ScimGroupMapping[];
  onUpdateGroupMappings: (mappings: ScimGroupMapping[]) => void;
  provisionedUsers: ProvisionedUser[];
  onUpdateUsers: (users: ProvisionedUser[]) => void;
  scimLogs: ScimAuditLog[];
  onRefreshLogs: () => void;
  activeSsoUser: ActiveSsoUser;
  onOpenAzureLogin: () => void;
  onRoleChange: (role: UserRole) => void;
}

export const SsoScimView: React.FC<SsoScimViewProps> = ({
  ssoConfig,
  onUpdateSsoConfig,
  scimConfig,
  onUpdateScimConfig,
  groupMappings,
  onUpdateGroupMappings,
  provisionedUsers,
  onUpdateUsers,
  scimLogs,
  onRefreshLogs,
  activeSsoUser,
  onOpenAzureLogin,
  onRoleChange
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'azure-config' | 'scim-sandbox' | 'mappings' | 'users' | 'logs'
  >('azure-config');

  // Copy state helpers
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form states for Azure Config
  const [localSso, setLocalSso] = useState<SsoConfig>(ssoConfig);
  const [localScim, setLocalScim] = useState<ScimConfig>(scimConfig);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // SCIM Sandbox State
  const [sandboxMethod, setSandboxMethod] = useState<'GET' | 'POST' | 'PATCH' | 'DELETE'>('GET');
  const [sandboxEndpoint, setSandboxEndpoint] = useState<string>('/api/scim/v2/Users');
  const [sandboxBody, setSandboxBody] = useState<string>(
    JSON.stringify(
      {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        userName: 'new.engineer@contoso.com',
        displayName: 'New SecOps Engineer',
        emails: [{ value: 'new.engineer@contoso.com', primary: true }],
        active: true,
        groups: ['AppSec-Engineers']
      },
      null,
      2
    )
  );
  const [sandboxResponse, setSandboxResponse] = useState<{
    status: number;
    headers: Record<string, string>;
    body: any;
    timeMs: number;
  } | null>(null);
  const [isSandboxLoading, setIsSandboxLoading] = useState(false);

  // Mapping Rule Modal / Form State
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
  const [newGroupOrRole, setNewGroupOrRole] = useState('');
  const [newTargetRole, setNewTargetRole] = useState<UserRole>('APPSEC_ADMIN');
  const [newRuleDesc, setNewRuleDesc] = useState('');

  // User Search & Filters
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');

  // Inspect User JSON modal
  const [inspectingUser, setInspectingUser] = useState<ProvisionedUser | null>(null);

  // Backup & Restore State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [restoreSuccessMsg, setRestoreSuccessMsg] = useState<string | null>(null);
  const [restoreErrorMsg, setRestoreErrorMsg] = useState<string | null>(null);

  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const restored = importSsoScimJSON(content);

        onUpdateSsoConfig(restored.ssoConfig);
        onUpdateScimConfig(restored.scimConfig);
        onUpdateGroupMappings(restored.groupMappings);
        onUpdateUsers(restored.provisionedUsers);
        onRefreshLogs();

        setRestoreSuccessMsg(
          `Successfully restored SSO & SCIM configuration, ${restored.groupMappings.length} group rules, and ${restored.provisionedUsers.length} provisioned users!`
        );
        setRestoreErrorMsg(null);
        setTimeout(() => setRestoreSuccessMsg(null), 5000);
      } catch (err: any) {
        setRestoreErrorMsg(err.message || 'Failed to import SSO & SCIM backup file.');
        setRestoreSuccessMsg(null);
        setTimeout(() => setRestoreErrorMsg(null), 5000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetDefaults = () => {
    if (
      window.confirm(
        'Reset Azure SSO parameters, SCIM tokens, Group Mappings, and User Directory to factory defaults?'
      )
    ) {
      const defaults = resetSsoScimToDefaults();
      onUpdateSsoConfig(defaults.ssoConfig);
      onUpdateScimConfig(defaults.scimConfig);
      onUpdateGroupMappings(defaults.groupMappings);
      onUpdateUsers(defaults.provisionedUsers);
      onRefreshLogs();

      setRestoreSuccessMsg('Reset all SSO & SCIM configuration and user directory to factory defaults.');
      setTimeout(() => setRestoreSuccessMsg(null), 4000);
    }
  };

  useEffect(() => {
    setLocalSso(ssoConfig);
    setLocalScim(scimConfig);
  }, [ssoConfig, scimConfig]);

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSsoConfig(localSso);
    onUpdateScimConfig(localScim);
    setSaveSuccessMsg('Azure AD SSO & SCIM parameters updated successfully.');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const handleGenerateSecret = () => {
    const newToken = `scim_sec_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;
    setLocalScim({ ...localScim, secretToken: newToken });
  };

  // SCIM API Sandbox Request Executor
  const handleRunSandbox = async () => {
    setIsSandboxLoading(true);
    const startTime = performance.now();
    try {
      const options: RequestInit = {
        method: sandboxMethod,
        headers: {
          'Content-Type': 'application/scim+json',
          'Authorization': `Bearer ${localScim.secretToken}`,
          'X-SCIM-Test-Client': 'sandbox'
        }
      };

      if (sandboxMethod !== 'GET' && sandboxBody) {
        options.body = sandboxBody;
      }

      const res = await fetch(sandboxEndpoint, options);
      const endTime = performance.now();
      const status = res.status;

      let resBody: any = null;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('json')) {
        resBody = await res.json();
      } else {
        resBody = await res.text();
      }

      const headersObj: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        headersObj[k] = v;
      });

      setSandboxResponse({
        status,
        headers: headersObj,
        body: resBody,
        timeMs: Math.round(endTime - startTime)
      });

      addScimAuditLog(
        sandboxMethod,
        sandboxEndpoint,
        status,
        'SANDBOX_TEST',
        `Executed SCIM Sandbox Request. Status: ${status}`,
        undefined,
        undefined,
        sandboxBody.substring(0, 100)
      );
      onRefreshLogs();
    } catch (err: any) {
      const endTime = performance.now();
      setSandboxResponse({
        status: 500,
        headers: {},
        body: { error: err.message || 'Network failure' },
        timeMs: Math.round(endTime - startTime)
      });
    } finally {
      setIsSandboxLoading(false);
    }
  };

  // Group Mapping Add Rule
  const handleAddGroupMapping = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupOrRole.trim()) return;

    const newRule: ScimGroupMapping = {
      id: `MAP-${Math.floor(1000 + Math.random() * 9000)}`,
      azureGroupOrRoleName: newGroupOrRole.trim(),
      appRole: newTargetRole,
      description: newRuleDesc.trim() || `Mapped from Azure group ${newGroupOrRole}`,
      createdAt: new Date().toISOString()
    };

    const updated = [newRule, ...groupMappings];
    onUpdateGroupMappings(updated);
    saveGroupMappings(updated);

    // Reset Form
    setNewGroupOrRole('');
    setNewRuleDesc('');
    setIsAddRuleOpen(false);
  };

  const handleDeleteRule = (id: string) => {
    const updated = groupMappings.filter((m) => m.id !== id);
    onUpdateGroupMappings(updated);
    saveGroupMappings(updated);
  };

  // Re-Evaluate All Users against Group Mappings
  const handleReSyncAllUserRoles = () => {
    const updatedUsers = provisionedUsers.map((u) => {
      const newRole = calculateRoleFromAzureGroups(u.groups, groupMappings, scimConfig.defaultRole);
      return {
        ...u,
        mappedRole: newRole,
        lastSyncedAt: new Date().toISOString()
      };
    });

    onUpdateUsers(updatedUsers);
    saveProvisionedUsers(updatedUsers);

    // Also update active SSO user if matching
    if (activeSsoUser && activeSsoUser.isAuthenticated) {
      const activeRole = calculateRoleFromAzureGroups(activeSsoUser.groups, groupMappings, scimConfig.defaultRole);
      onRoleChange(activeRole);
    }

    setSaveSuccessMsg('Re-evaluated and updated roles for all SCIM provisioned users.');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // User Active Toggle
  const handleToggleUserActive = (user: ProvisionedUser) => {
    const updatedUsers = provisionedUsers.map((u) => {
      if (u.id === user.id) {
        return {
          ...u,
          active: !u.active,
          lastSyncedAt: new Date().toISOString()
        };
      }
      return u;
    });

    onUpdateUsers(updatedUsers);
    saveProvisionedUsers(updatedUsers);

    addScimAuditLog(
      'PATCH',
      `/api/scim/v2/Users/${user.id}`,
      200,
      user.active ? 'DEPROVISION_USER' : 'ACTIVATE_USER',
      `Toggled active state to ${!user.active} for user ${user.userName}`,
      user.id,
      user.userName
    );
    onRefreshLogs();
  };

  const filteredUsers = provisionedUsers.filter((u) => {
    const matchesSearch =
      u.displayName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.groups.some((g) => g.toLowerCase().includes(userSearch.toLowerCase()));

    const matchesRole = userRoleFilter === 'ALL' || u.mappedRole === userRoleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      
      {/* View Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 md:p-8 border border-slate-800 shadow-xl text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-md">
                <svg className="w-7 h-7" viewBox="0 0 23 23" fill="currentColor">
                  <path fill="#f25022" d="M1 1h10v10H1z" />
                  <path fill="#7fba00" d="M12 1h10v10H12z" />
                  <path fill="#00a4ef" d="M1 12h10v10H1z" />
                  <path fill="#ffb900" d="M12 12h10v10H12z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-100">
                  Azure AD SSO & SCIM 2.0 Identity Engine
                </h2>
                <p className="text-sm text-indigo-200/80">
                  Microsoft Entra ID Authentication & Automated Group-Based Role Provisioning
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenAzureLogin}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/20 flex items-center gap-2 transition-all"
            >
              <UserCheck className="w-4 h-4" />
              <span>Test Azure SSO Login</span>
            </button>
            <div className="bg-slate-950/80 px-3.5 py-2 rounded-xl border border-slate-800 text-xs font-mono flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-300">SCIM 2.0 API Active</span>
            </div>
          </div>
        </div>

        {/* Current SSO User Banner */}
        {activeSsoUser && activeSsoUser.isAuthenticated && (
          <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs uppercase">
                {activeSsoUser.displayName.substring(0, 2)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-200">{activeSsoUser.displayName}</span>
                  <span className="text-[10px] bg-slate-800 text-indigo-300 border border-slate-700 px-2 py-0.5 rounded font-mono">
                    {activeSsoUser.email}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-[11px] mt-0.5">
                  <span>Groups: {activeSsoUser.groups.join(', ') || 'None'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Effective App Role:</span>
              <span className={`px-2.5 py-1 rounded-md font-bold uppercase tracking-wider ${
                activeSsoUser.role === 'SUPER_ADMIN'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : activeSsoUser.role === 'APPSEC_ADMIN'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}>
                {activeSsoUser.role === 'SUPER_ADMIN'
                  ? 'Super Admin (Break-Glass)'
                  : activeSsoUser.role === 'APPSEC_ADMIN'
                  ? 'AppSec Admin (CRUD)'
                  : 'IT Viewer (Read-Only)'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Hidden File Input for Restore */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        onChange={handleFileRestore}
        className="hidden"
      />

      {/* SSO & SCIM Local Data Backup & Recovery Operations Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                SSO & SCIM Local Data Backup & Recovery
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Export or restore Azure tenant settings, SCIM tokens, group rules, user directory ({provisionedUsers.length} users), and logs.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Export JSON */}
            <button
              onClick={exportSsoScimJSON}
              className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-slate-100 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              title="Download full SSO & SCIM configuration and user directory as JSON"
            >
              <FileJson className="w-4 h-4 text-indigo-400" />
              <span>Backup SSO/SCIM (JSON)</span>
            </button>

            {/* Export Directory CSV */}
            <button
              onClick={() => exportProvisionedUsersCSV(provisionedUsers)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Export provisioned users list and mapped roles to CSV spreadsheet"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              <span>Export Users (CSV)</span>
            </button>

            {/* Restore JSON */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Restore SSO & SCIM settings from a local JSON backup file"
            >
              <Upload className="w-4 h-4" />
              <span>Restore Backup</span>
            </button>

            {/* Reset Defaults */}
            <button
              onClick={handleResetDefaults}
              className="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-medium border border-rose-200 dark:border-rose-900/60 flex items-center gap-1 transition-colors cursor-pointer"
              title="Reset SSO and SCIM parameters to demo factory defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Reset Defaults</span>
            </button>
          </div>
        </div>

        {/* Restore Notification Banners */}
        {restoreSuccessMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium">{restoreSuccessMsg}</span>
          </div>
        )}

        {restoreErrorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="font-medium">{restoreErrorMsg}</span>
          </div>
        )}
      </div>

      {/* Sub Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-2 overflow-x-auto pb-2 scrollbar-none" aria-label="SSO Subtabs">
          
          <button
            onClick={() => setActiveSubTab('azure-config')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs whitespace-nowrap transition-all ${
              activeSubTab === 'azure-config'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Azure AD Settings & Guide</span>
          </button>

          <button
            onClick={() => setActiveSubTab('scim-sandbox')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs whitespace-nowrap transition-all ${
              activeSubTab === 'scim-sandbox'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>SCIM 2.0 API Sandbox</span>
          </button>

          <button
            onClick={() => setActiveSubTab('mappings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs whitespace-nowrap transition-all ${
              activeSubTab === 'mappings'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Group-to-Role Mappings</span>
            <span className="ml-1 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] px-2 py-0.5 rounded-full font-mono">
              {groupMappings.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('users')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs whitespace-nowrap transition-all ${
              activeSubTab === 'users'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Provisioned Users</span>
            <span className="ml-1 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-mono">
              {provisionedUsers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('logs')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs whitespace-nowrap transition-all ${
              activeSubTab === 'logs'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>SCIM Provisioning Logs</span>
            <span className="ml-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-mono">
              {scimLogs.length}
            </span>
          </button>

        </nav>
      </div>

      {/* SUBTAB 1: Azure AD Settings & Portal Integration Guide */}
      {activeSubTab === 'azure-config' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Form Settings */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100">
                    Microsoft Azure Entra ID Application Credentials
                  </h3>
                  <p className="text-xs text-slate-500">
                    Configure OIDC single sign-on parameters for your Azure tenant
                  </p>
                </div>
                {saveSuccessMsg && (
                  <span className="text-xs text-emerald-600 font-medium flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Saved</span>
                  </span>
                )}
              </div>

              <form onSubmit={handleSaveConfig} className="space-y-4">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Directory (Tenant) ID
                    </label>
                    <input
                      type="text"
                      value={localSso.tenantId}
                      onChange={(e) => setLocalSso({ ...localSso, tenantId: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                      placeholder="e.g. 8f88e1a3-8321-4d3e-953e-5231a49931ef"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Application (Client) ID
                    </label>
                    <input
                      type="text"
                      value={localSso.clientId}
                      onChange={(e) => setLocalSso({ ...localSso, clientId: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                      placeholder="e.g. 3a8f43c1-7782-41f2-901e-c19a951d8d21"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Client Secret Value
                  </label>
                  <input
                    type="password"
                    value={localSso.clientSecret}
                    onChange={(e) => setLocalSso({ ...localSso, clientSecret: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                    placeholder="az_sec_••••••••••••••••"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      SSO Auth Mode
                    </label>
                    <select
                      value={localSso.ssoMode}
                      onChange={(e) => setLocalSso({ ...localSso, ssoMode: e.target.value as any })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="SIMULATED_AZURE_OIDC">Azure Entra OIDC Simulator (Recommended for Dev)</option>
                      <option value="LIVE_OIDC">Live Azure AD OIDC Redirect</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      SCIM Bearer Token
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={localScim.secretToken}
                        className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-indigo-300"
                      />
                      <button
                        type="button"
                        onClick={handleGenerateSecret}
                        className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-medium whitespace-nowrap"
                      >
                        New Secret
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500">
                    Changes take effect immediately across all SSO login flows.
                  </span>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20"
                  >
                    Save Azure AD Credentials
                  </button>
                </div>

              </form>
            </div>

            {/* Azure Portal Copy Pastes Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Code className="w-4 h-4 text-indigo-500" />
                <span>Azure Portal Enterprise App Configuration Values</span>
              </h3>

              <div className="space-y-3 text-xs font-mono">
                
                {/* Redirect URI */}
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">
                      Redirect URI (Web)
                    </span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{localSso.redirectUri}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(localSso.redirectUri, 'redir')}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:text-indigo-500 text-slate-500"
                  >
                    {copiedField === 'redir' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* SCIM Base URL */}
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">
                      Tenant SCIM 2.0 Base URL
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{localScim.baseUrl}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(localScim.baseUrl, 'scim')}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:text-emerald-500 text-slate-500"
                  >
                    {copiedField === 'scim' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* SCIM Token */}
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">
                      SCIM Provisioning Secret Token
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">{localScim.secretToken}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(localScim.secretToken, 'tok')}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:text-indigo-500 text-slate-500"
                  >
                    {copiedField === 'tok' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

              </div>
            </div>
          </div>

          {/* Right Column: Step-by-Step Azure Setup Guide */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-500" />
              <span>Azure Entra Portal Integration Checklist</span>
            </h3>

            <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
              
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100">Register Enterprise Application</h4>
                  <p className="mt-0.5 text-slate-500">
                    In Azure Portal → Microsoft Entra ID → App registrations → New registration. Name it "AppSec Criticality Manager".
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100">Set Web Redirect URI & Token Claims</h4>
                  <p className="mt-0.5 text-slate-500">
                    Add Redirect URI above. Under Authentication, enable ID tokens & Access tokens. Include `groups` in optional claims.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100">Enable SCIM 2.0 Provisioning</h4>
                  <p className="mt-0.5 text-slate-500">
                    Go to Provisioning → Set Mode to Automatic. Enter SCIM Tenant URL and Secret Token above. Test connection!
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 font-bold flex items-center justify-center shrink-0">
                  4
                </span>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100">Assign Azure AD Groups</h4>
                  <p className="mt-0.5 text-slate-500">
                    Assign `AppSec-Engineers` and `IT-Operations` groups. SCIM will automatically sync user accounts & enforce role mappings.
                  </p>
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* SUBTAB 2: SCIM 2.0 API Sandbox */}
      {activeSubTab === 'scim-sandbox' && (
        <div className="space-y-6">
          
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-indigo-500" />
                  <span>SCIM 2.0 Interactive API Sandbox</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Execute live RFC 7644 SCIM requests directly against the server API endpoints
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSandboxMethod('GET');
                    setSandboxEndpoint('/api/scim/v2/ServiceProviderConfig');
                  }}
                  className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs text-slate-700 dark:text-slate-300 font-mono"
                >
                  GET Config
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSandboxMethod('GET');
                    setSandboxEndpoint('/api/scim/v2/Users');
                  }}
                  className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs text-slate-700 dark:text-slate-300 font-mono"
                >
                  GET Users
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSandboxMethod('POST');
                    setSandboxEndpoint('/api/scim/v2/Users');
                  }}
                  className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs text-slate-700 dark:text-slate-300 font-mono"
                >
                  POST User
                </button>
              </div>
            </div>

            {/* Sandbox Request Bar */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-2">
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">HTTP Method</label>
                <select
                  value={sandboxMethod}
                  onChange={(e) => setSandboxMethod(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>

              <div className="md:col-span-8">
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Endpoint Path</label>
                <input
                  type="text"
                  value={sandboxEndpoint}
                  onChange={(e) => setSandboxEndpoint(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-2 flex items-end">
                <button
                  type="button"
                  onClick={handleRunSandbox}
                  disabled={isSandboxLoading}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {isSandboxLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  <span>Send</span>
                </button>
              </div>
            </div>

            {/* JSON Payload Editor if POST/PATCH */}
            {(sandboxMethod === 'POST' || sandboxMethod === 'PATCH') && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Request JSON Body (RFC 7643 Format)
                </label>
                <textarea
                  rows={6}
                  value={sandboxBody}
                  onChange={(e) => setSandboxBody(e.target.value)}
                  className="w-full bg-slate-950 text-emerald-400 font-mono text-xs p-3 rounded-xl border border-slate-800"
                />
              </div>
            )}

            {/* Sandbox Response Output */}
            {sandboxResponse && (
              <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3 font-mono">
                <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded font-bold ${
                      sandboxResponse.status >= 200 && sandboxResponse.status < 300
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    }`}>
                      HTTP {sandboxResponse.status}
                    </span>
                    <span className="text-slate-400">{sandboxResponse.timeMs}ms</span>
                  </div>
                  <span className="text-slate-500 text-[11px]">Content-Type: application/scim+json</span>
                </div>

                <pre className="text-xs text-slate-200 overflow-x-auto max-h-80 scrollbar-thin p-2">
                  {typeof sandboxResponse.body === 'string'
                    ? sandboxResponse.body
                    : JSON.stringify(sandboxResponse.body, null, 2)}
                </pre>
              </div>
            )}

          </div>

        </div>
      )}

      {/* SUBTAB 3: SCIM Group-to-Role Mapping Rules */}
      {activeSubTab === 'mappings' && (
        <div className="space-y-6">
          
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-500" />
                  <span>Azure AD Group to App Role Mapping Rules</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Automatically map Azure AD Security Groups or App Roles to AppSec Admin or IT Viewer permissions
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleReSyncAllUserRoles}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-Evaluate All Users</span>
                </button>
                <button
                  onClick={() => setIsAddRuleOpen(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Group Rule</span>
                </button>
              </div>
            </div>

            {/* Add Rule Modal / Form Inline */}
            {isAddRuleOpen && (
              <form onSubmit={handleAddGroupMapping} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 space-y-4 animate-fadeIn">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  New Azure AD Security Group Mapping Rule
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Azure Group Name or Entra App Role
                    </label>
                    <input
                      type="text"
                      required
                      value={newGroupOrRole}
                      onChange={(e) => setNewGroupOrRole(e.target.value)}
                      placeholder="e.g. AppSec-Engineers or SecOps-Lead"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Target Application Role
                    </label>
                    <select
                      value={newTargetRole}
                      onChange={(e) => setNewTargetRole(e.target.value as UserRole)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="APPSEC_ADMIN">AppSec Admin (Full CRUD Access)</option>
                      <option value="IT_VIEWER">IT Team (Read-Only Viewer Access)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Rule Description
                  </label>
                  <input
                    type="text"
                    value={newRuleDesc}
                    onChange={(e) => setNewRuleDesc(e.target.value)}
                    placeholder="e.g. Assigns CRUD permissions to all cyber team members"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddRuleOpen(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm"
                  >
                    Save Mapping Rule
                  </button>
                </div>
              </form>
            )}

            {/* Rules Table */}
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Azure AD Group / Role</th>
                    <th className="py-3 px-4">Mapped Application Role</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Matched Users</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {groupMappings.map((rule) => {
                    const matchCount = provisionedUsers.filter((u) =>
                      u.groups.some((g) => g.toLowerCase() === rule.azureGroupOrRoleName.toLowerCase())
                    ).length;

                    return (
                      <tr key={rule.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-indigo-300">
                          {rule.azureGroupOrRoleName}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            rule.appRole === 'APPSEC_ADMIN'
                              ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                              : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                          }`}>
                            {rule.appRole === 'APPSEC_ADMIN' ? 'AppSec Admin (CRUD)' : 'IT Viewer (Read-Only)'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                          {rule.description}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs">
                            {matchCount} user{matchCount === 1 ? '' : 's'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="Delete Rule"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}

      {/* SUBTAB 4: Provisioned Users Directory */}
      {activeSubTab === 'users' && (
        <div className="space-y-6">
          
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-500" />
                  <span>SCIM Provisioned Azure AD Users Directory</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Manage active identities synced automatically via Microsoft Entra SCIM 2.0
                </p>
              </div>

              {/* Search & Role Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search name, email, group..."
                    className="pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                >
                  <option value="ALL">All Roles</option>
                  <option value="APPSEC_ADMIN">AppSec Admin</option>
                  <option value="IT_VIEWER">IT Viewer</option>
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">User Identity</th>
                    <th className="py-3 px-4">Azure AD Groups</th>
                    <th className="py-3 px-4">Effective Role</th>
                    <th className="py-3 px-4">SCIM Status</th>
                    <th className="py-3 px-4">Last Synced</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xs uppercase">
                            {user.displayName.substring(0, 2)}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                              {user.displayName}
                            </span>
                            <span className="text-slate-500 text-[11px] font-mono block">
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {user.groups.map((grp, i) => (
                            <span key={i} className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-[11px] font-mono border border-slate-200 dark:border-slate-700">
                              {grp}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          user.mappedRole === 'APPSEC_ADMIN'
                            ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                            : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        }`}>
                          {user.mappedRole === 'APPSEC_ADMIN' ? 'AppSec Admin' : 'IT Viewer'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleUserActive(user)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                            user.active
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                              : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
                          }`}
                        >
                          {user.active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          <span>{user.active ? 'Active' : 'Deprovisioned'}</span>
                        </button>
                      </td>

                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(user.lastSyncedAt).toLocaleString()}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setInspectingUser(user)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs border border-slate-200 dark:border-slate-700"
                        >
                          View JSON
                        </button>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>

          {/* Inspect User JSON Modal */}
          {inspectingUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 text-slate-100 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h4 className="font-semibold text-sm font-mono text-indigo-300">
                    SCIM User Resource: {inspectingUser.userName}
                  </h4>
                  <button onClick={() => setInspectingUser(null)} className="text-slate-400 hover:text-white">
                    ✕
                  </button>
                </div>

                <pre className="text-xs font-mono bg-slate-950 p-4 rounded-xl text-emerald-400 max-h-96 overflow-y-auto border border-slate-800">
                  {JSON.stringify(inspectingUser, null, 2)}
                </pre>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setInspectingUser(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* SUBTAB 5: SCIM Audit & Provisioning Logs */}
      {activeSubTab === 'logs' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-500" />
                  <span>Azure SCIM 2.0 Provisioning Audit Logs</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Immutable event records of account creation, role updates, and group syncs from Microsoft Entra ID
                </p>
              </div>

              <button
                onClick={onRefreshLogs}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Logs</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">HTTP Method & Path</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                  {scimLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-slate-900 dark:text-indigo-300 font-bold">
                        <span className="text-indigo-500 mr-2">{log.method}</span>
                        <span>{log.endpoint}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          log.statusCode >= 200 && log.statusCode < 300
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400'
                        }`}>
                          {log.statusCode}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-sans font-semibold">
                        {log.action}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-sans max-w-sm truncate">
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
