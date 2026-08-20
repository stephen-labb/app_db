import React, { useState, useEffect, useRef } from 'react';
import {
  SsoConfig,
  ScimConfig,
  ScimGroupMapping,
  ManualUserRoleMapping,
  ProvisionedUser,
  ScimAuditLog,
  UserRole,
  ActiveSsoUser
} from '../types';
import {
  saveSsoConfig,
  saveScimConfig,
  saveGroupMappings,
  saveManualUserMappings,
  saveProvisionedUsers,
  calculateRoleForSsoUser,
  calculateRoleFromAzureGroups,
  addScimAuditLog,
  exportSsoScimJSON,
  exportProvisionedUsersCSV,
  importSsoScimJSON,
  resetSsoScimToDefaults,
  DEFAULT_GROUP_MAPPINGS,
  DEFAULT_MANUAL_USER_MAPPINGS
} from '../utils/ssoScimStorage';
import {
  ShieldCheck,
  KeyRound,
  Users,
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
  FileText,
  UserCheck,
  Search,
  Filter,
  Download,
  Upload,
  RotateCcw,
  FileSpreadsheet,
  FileJson,
  HardDrive,
  UserPlus
} from 'lucide-react';

interface SsoScimViewProps {
  ssoConfig: SsoConfig;
  onUpdateSsoConfig: (config: SsoConfig) => void;
  scimConfig: ScimConfig;
  onUpdateScimConfig: (config: ScimConfig) => void;
  groupMappings: ScimGroupMapping[];
  onUpdateGroupMappings: (mappings: ScimGroupMapping[]) => void;
  manualMappings: ManualUserRoleMapping[];
  onUpdateManualMappings: (mappings: ManualUserRoleMapping[]) => void;
  provisionedUsers: ProvisionedUser[];
  onUpdateUsers: (users: ProvisionedUser[]) => void;
  scimLogs: ScimAuditLog[];
  onRefreshLogs: () => void;
  activeSsoUser: ActiveSsoUser;
  onOpenAzureLogin: () => void;
  onRoleChange: (role: UserRole) => void;
  initialSubTab?: 'azure-config' | 'mappings' | 'users' | 'logs';
  hideTabsBar?: boolean;
  hideHeaderBanner?: boolean;
}

export const SsoScimView: React.FC<SsoScimViewProps> = ({
  ssoConfig,
  onUpdateSsoConfig,
  scimConfig,
  onUpdateScimConfig,
  groupMappings,
  onUpdateGroupMappings,
  manualMappings = [],
  onUpdateManualMappings,
  provisionedUsers,
  onUpdateUsers,
  scimLogs,
  onRefreshLogs,
  activeSsoUser,
  onOpenAzureLogin,
  onRoleChange,
  initialSubTab,
  hideTabsBar = false,
  hideHeaderBanner = false
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'azure-config' | 'mappings' | 'users' | 'logs'
  >(initialSubTab || 'azure-config');

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Copy state helpers
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form states for Azure Config
  const [localSso, setLocalSso] = useState<SsoConfig>(ssoConfig);
  const [localScim, setLocalScim] = useState<ScimConfig>(scimConfig);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Manual User Role Mapping Form State
  const [isAddManualOpen, setIsAddManualOpen] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const [manualRole, setManualRole] = useState<UserRole>('APPSEC_ADMIN');
  const [manualNotes, setManualNotes] = useState('');

  // Mapping Rule Modal / Form State
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
  const [newGroupOrRole, setNewGroupOrRole] = useState('');
  const [newTargetRole, setNewTargetRole] = useState<UserRole>('APPSEC_ADMIN');
  const [newRuleDesc, setNewRuleDesc] = useState('');

  // Add User to IAM Modal State
  const [isAddIamUserOpen, setIsAddIamUserOpen] = useState(false);
  const [newIamEmail, setNewIamEmail] = useState('');
  const [newIamDisplayName, setNewIamDisplayName] = useState('');
  const [newIamRole, setNewIamRole] = useState<UserRole>('APPSEC_ADMIN');
  const [newIamGroups, setNewIamGroups] = useState('AppSec-Engineers');
  const [newIamDepartment, setNewIamDepartment] = useState('InfoSec');
  const [newIamTitle, setNewIamTitle] = useState('Security Engineer');

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
        if (restored.manualMappings) {
          onUpdateManualMappings(restored.manualMappings);
        }
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
        'Reset Azure SSO parameters, SCIM tokens, Group Mappings, Manual User Overrides, and User Directory to factory defaults?'
      )
    ) {
      const defaults = resetSsoScimToDefaults();
      onUpdateSsoConfig(defaults.ssoConfig);
      onUpdateScimConfig(defaults.scimConfig);
      onUpdateGroupMappings(defaults.groupMappings);
      onUpdateManualMappings(defaults.manualMappings);
      onUpdateUsers(defaults.provisionedUsers);
      onRefreshLogs();

      setRestoreSuccessMsg('Reset all SSO & SCIM configuration and user directory to factory defaults.');
      setTimeout(() => setRestoreSuccessMsg(null), 4000);
    }
  };

  const handleAddManualMapping = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEmail.trim()) return;

    const newMapping: ManualUserRoleMapping = {
      id: `MAN-${Math.floor(1000 + Math.random() * 9000)}`,
      emailOrUpn: manualEmail.trim().toLowerCase(),
      assignedRole: manualRole,
      notes: manualNotes.trim() || `Manual override for ${manualEmail}`,
      createdAt: new Date().toISOString(),
      updatedBy: activeSsoUser?.displayName || 'Super Admin',
      updatedAt: new Date().toISOString()
    };

    const updated = [newMapping, ...manualMappings];
    onUpdateManualMappings(updated);
    saveManualUserMappings(updated);

    setManualEmail('');
    setManualNotes('');
    setIsAddManualOpen(false);
    setSaveSuccessMsg(`Saved manual user role override for ${newMapping.emailOrUpn}`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const handleDeleteManualMapping = (id: string) => {
    const mapping = manualMappings.find((m) => m.id === id);
    if (mapping) {
      const email = mapping.emailOrUpn.toLowerCase();
      if (
        email === 'superadmin@enterprise.local' ||
        email === 'superadmin@local.internal' ||
        email === 'superadmin' ||
        (mapping.assignedRole as string) === 'SUPER_ADMIN'
      ) {
        alert('Access Denied: Super Admin override is permanently protected by security policy and CANNOT be removed.');
        return;
      }
    }
    const updated = manualMappings.filter((m) => m.id !== id);
    onUpdateManualMappings(updated);
    saveManualUserMappings(updated);
  };

  const handleRevertGroupMappingsToDefaults = () => {
    if (window.confirm('Revert all SCIM group mapping rules to factory default settings?')) {
      onUpdateGroupMappings(DEFAULT_GROUP_MAPPINGS);
      saveGroupMappings(DEFAULT_GROUP_MAPPINGS);
      setSaveSuccessMsg('Reverted SCIM Group Mappings to factory defaults.');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
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

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSsoConfig(localSso);
    onUpdateScimConfig(localScim);

    try {
      await fetch('/api/sso/azure/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localSso)
      });
    } catch (err) {
      console.warn('Could not post OIDC config to server:', err);
    }

    setSaveSuccessMsg('Azure AD OIDC SSO & SCIM parameters updated and synchronized.');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const handleGenerateSecret = () => {
    const newToken = `scim_sec_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;
    setLocalScim({ ...localScim, secretToken: newToken });
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

  // Re-Evaluate All Users against Access Control Rules (Manual Overrides & SCIM)
  const handleReSyncAllUserRoles = () => {
    const updatedUsers = provisionedUsers.map((u) => {
      const newRole = calculateRoleForSsoUser(
        u.email || u.userName,
        u.groups,
        scimConfig.enabled,
        manualMappings,
        groupMappings,
        scimConfig.defaultRole
      );
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
      const activeRole = calculateRoleForSsoUser(
        activeSsoUser.email,
        activeSsoUser.groups,
        scimConfig.enabled,
        manualMappings,
        groupMappings,
        scimConfig.defaultRole
      );
      onRoleChange(activeRole);
    }

    setSaveSuccessMsg('Re-evaluated and updated roles for all users based on manual overrides and SCIM configuration.');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // User Active Toggle
  const handleToggleUserActive = (user: ProvisionedUser) => {
    const nextActive = !user.active;
    const updatedUsers = provisionedUsers.map((u) => {
      if (u.id === user.id) {
        return {
          ...u,
          active: nextActive,
          iamStatus: nextActive ? ('ACTIVE' as const) : ('SUSPENDED' as const),
          approvalStatus: nextActive ? ('APPROVED' as const) : u.approvalStatus,
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
      `Toggled active state to ${nextActive} for user ${user.userName}`,
      user.id,
      user.userName
    );
    onRefreshLogs();
  };

  const handleAddIamUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIamEmail.trim()) return;

    const email = newIamEmail.trim().toLowerCase();
    const displayName = newIamDisplayName.trim() || email.split('@')[0].replace('.', ' ');
    const groups = newIamGroups.split(',').map(g => g.trim()).filter(Boolean);

    const newUser: ProvisionedUser = {
      id: `az-usr-${Math.floor(1000 + Math.random() * 9000)}`,
      userName: email,
      displayName,
      givenName: displayName.split(' ')[0] || displayName,
      familyName: displayName.split(' ')[1] || '',
      email,
      active: true,
      groups: groups.length > 0 ? groups : ['AppSec-Engineers'],
      mappedRole: newIamRole,
      lastSyncedAt: new Date().toISOString(),
      syncedVia: 'IAM_DIRECTORY',
      department: newIamDepartment.trim() || 'InfoSec',
      title: newIamTitle.trim() || 'Security Specialist',
      iamStatus: 'ACTIVE',
      addedToIamAt: new Date().toISOString(),
      addedByIamAdmin: activeSsoUser?.displayName || 'AppSec Administrator'
    };

    const updated = [newUser, ...provisionedUsers];
    onUpdateUsers(updated);
    saveProvisionedUsers(updated);

    addScimAuditLog(
      'POST',
      '/api/scim/v2/Users',
      201,
      'REGISTER_IAM_USER',
      `Registered new user ${email} in Enterprise IAM user directory`,
      newUser.id,
      newUser.userName
    );
    onRefreshLogs();

    // Reset Form
    setNewIamEmail('');
    setNewIamDisplayName('');
    setIsAddIamUserOpen(false);
  };

  const handleApproveProvisionedUser = (user: ProvisionedUser) => {
    const updated = provisionedUsers.map((u) => {
      if (u.id === user.id) {
        return {
          ...u,
          active: true,
          iamStatus: 'ACTIVE' as const,
          approvalStatus: 'APPROVED' as const,
          approvedBy: activeSsoUser?.displayName || 'AppSec Governance Admin',
          approvedAt: new Date().toISOString(),
          addedToIamAt: new Date().toISOString(),
          lastSyncedAt: new Date().toISOString()
        };
      }
      return u;
    });
    onUpdateUsers(updated);
    saveProvisionedUsers(updated);

    addScimAuditLog(
      'PATCH',
      `/api/scim/v2/Users/${user.id}/Approve`,
      200,
      'APPROVE_ACCESS_REQUEST',
      `Approved access request for ${user.displayName} (${user.email}). User added & activated in User Management.`,
      user.id,
      user.userName
    );
    onRefreshLogs();
    setSaveSuccessMsg(`Approved access request for '${user.displayName}'. Added to User Management.`);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  const handleRejectProvisionedUser = (user: ProvisionedUser) => {
    const updated = provisionedUsers.map((u) => {
      if (u.id === user.id) {
        return {
          ...u,
          active: false,
          iamStatus: 'SUSPENDED' as const,
          approvalStatus: 'REJECTED' as const,
          lastSyncedAt: new Date().toISOString()
        };
      }
      return u;
    });
    onUpdateUsers(updated);
    saveProvisionedUsers(updated);

    addScimAuditLog(
      'PATCH',
      `/api/scim/v2/Users/${user.id}/Reject`,
      200,
      'REJECT_ACCESS_REQUEST',
      `Rejected provisioned access request for ${user.displayName} (${user.email}).`,
      user.id,
      user.userName
    );
    onRefreshLogs();
    setSaveSuccessMsg(`Rejected access request for '${user.displayName}'.`);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  // Remove User from IAM Directory (Super Admin Protected)
  const handleRemoveUser = async (user: ProvisionedUser) => {
    const email = (user.email || user.userName || '').toLowerCase();
    const isSuperAdmin =
      email === 'superadmin@enterprise.local' ||
      email === 'superadmin@local.internal' ||
      email === 'superadmin' ||
      email === 'admin@enterprise.local' ||
      (user.mappedRole as string) === 'SUPER_ADMIN';

    if (isSuperAdmin) {
      alert('Access Denied: Super Admin account is permanently protected by enterprise security policy and CANNOT be removed.');
      return;
    }

    if (
      window.confirm(
        `Are you sure you want to remove user '${user.displayName}' (${user.email || user.userName}) from Enterprise IAM?`
      )
    ) {
      const updatedUsers = provisionedUsers.filter((u) => u.id !== user.id);
      onUpdateUsers(updatedUsers);
      saveProvisionedUsers(updatedUsers);

      try {
        await fetch(`/api/iam/users/${user.id}`, { method: 'DELETE' });
      } catch (e) {
        // Fallback already saved locally
      }

      addScimAuditLog(
        'DELETE',
        `/api/scim/v2/Users/${user.id}`,
        200,
        'REMOVE_IAM_USER',
        `Removed user ${user.userName} (${user.email}) from Enterprise IAM directory by AppSec Administrator`,
        user.id,
        user.userName
      );
      onRefreshLogs();

      setSaveSuccessMsg(`User '${user.displayName}' (${user.email || user.userName}) was removed from Enterprise IAM.`);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    }
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
      {!hideHeaderBanner && (
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
                    Azure AD OpenID Connect (OIDC) SSO & SCIM 2.0 Engine
                  </h2>
                  <p className="text-sm text-indigo-200/80">
                    Microsoft Entra ID OIDC v2.0 Authentication & Automated Group-Based Role Provisioning
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={onOpenAzureLogin}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/20 flex items-center gap-2 transition-all cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>Test Azure OIDC SSO Login</span>
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
      )}

      {/* Hidden File Input for Restore */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        onChange={handleFileRestore}
        className="hidden"
      />

      {/* SSO & SCIM Local Data Backup & Recovery Operations Bar */}
      {!hideHeaderBanner && (
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
      )}

      {/* Sub Navigation Tabs */}
      {!hideTabsBar && (
        <div className="border-b border-slate-200 dark:border-slate-800">
          <nav className="flex space-x-2 overflow-x-auto pb-2 scrollbar-none" aria-label="SSO Subtabs">
            
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
              onClick={() => setActiveSubTab('mappings')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs whitespace-nowrap transition-all ${
                activeSubTab === 'mappings'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Shield className="w-4 h-4 text-purple-500" />
              <span>Mappings</span>
              <span className="ml-1 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] px-2 py-0.5 rounded-full font-mono">
                {groupMappings.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab('azure-config')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs whitespace-nowrap transition-all ${
                activeSubTab === 'azure-config'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Settings className="w-4 h-4 text-blue-500" />
              <span>Single Sign On (SSO)</span>
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
      )}

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
                
                {/* Credentials Row 1: Tenant ID & Client ID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span>Directory (Tenant) ID *</span>
                      <span className="text-[10px] text-slate-400 font-normal">Azure Tenant Identifier</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={localSso.tenantId}
                      onChange={(e) => {
                        const tid = e.target.value.trim();
                        setLocalSso({
                          ...localSso,
                          tenantId: tid,
                          loginUrl: tid ? `https://login.microsoftonline.com/${tid}/oauth2/v2.0/authorize` : localSso.loginUrl,
                          tokenUrl: tid ? `https://login.microsoftonline.com/${tid}/oauth2/v2.0/token` : localSso.tokenUrl,
                          issuerUrl: tid ? `https://login.microsoftonline.com/${tid}/v2.0` : localSso.issuerUrl,
                          jwksUri: tid ? `https://login.microsoftonline.com/${tid}/discovery/v2.0/keys` : localSso.jwksUri
                        });
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                      placeholder="e.g. 2c7d678a-3080-4d64-a967-67f2da6d3cae"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span>Application (Client) Identifier *</span>
                      <span className="text-[10px] text-slate-400 font-normal">App Registration ID</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={localSso.clientId}
                      onChange={(e) => setLocalSso({ ...localSso, clientId: e.target.value.trim() })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                      placeholder="e.g. 02445d57-57c8-4b45-99fe-a32ef97f7bdb"
                    />
                  </div>
                </div>

                {/* Credentials Row 2: Client Secret & Scopes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span>Client Secret *</span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">Copy 'Value', NOT 'Secret ID'</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={localSso.clientSecret}
                      onChange={(e) => setLocalSso({ ...localSso, clientSecret: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                      placeholder="eER8Q~••••••••••••••••"
                    />
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      💡 <strong>Important</strong>: Copy the string from the <strong>Value</strong> column in Azure Portal (e.g. <code className="text-indigo-600 dark:text-indigo-400">eER8Q~...</code> or <code className="text-indigo-600 dark:text-indigo-400">~3x...</code>), NOT the <strong>Secret ID</strong> GUID.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span>OAuth / OIDC Scopes *</span>
                      <span className="text-[10px] text-slate-400 font-normal">Requested Permissions</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={localSso.scopes}
                      onChange={(e) => setLocalSso({ ...localSso, scopes: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                      placeholder="openid profile email User.Read Directory.Read.All"
                    />
                  </div>
                </div>

                {/* OIDC Endpoints Row 3: Token Endpoint & Authorize Endpoint */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span>OAuth Token Endpoint *</span>
                      <span className="text-[10px] text-slate-400 font-normal">token_endpoint</span>
                    </label>
                    <input
                      type="url"
                      required
                      value={localSso.tokenUrl}
                      onChange={(e) => setLocalSso({ ...localSso, tokenUrl: e.target.value.trim() })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                      placeholder="https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span>OIDC Authorization Endpoint *</span>
                      <span className="text-[10px] text-slate-400 font-normal">authorization_endpoint</span>
                    </label>
                    <input
                      type="url"
                      required
                      value={localSso.loginUrl}
                      onChange={(e) => setLocalSso({ ...localSso, loginUrl: e.target.value.trim() })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                      placeholder="https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/authorize"
                    />
                  </div>
                </div>

                {/* OIDC Issuer URL & Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span>OIDC Issuer Base URL *</span>
                      <span className="text-[10px] text-slate-400 font-normal">issuer_url</span>
                    </label>
                    <input
                      type="url"
                      required
                      value={localSso.issuerUrl}
                      onChange={(e) => setLocalSso({ ...localSso, issuerUrl: e.target.value.trim() })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                      placeholder="https://login.microsoftonline.com/{tenantId}/v2.0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      SSO Auth Mode
                    </label>
                    <select
                      value={localSso.ssoMode}
                      onChange={(e) => setLocalSso({ ...localSso, ssoMode: e.target.value as any })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium"
                    >
                      <option value="LIVE_OIDC">Live Azure AD OIDC v2.0 Redirect & Popup</option>
                    </select>
                  </div>
                </div>

                {/* SCIM Master Switch & Default Fallback Role */}
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-500" />
                        <span>SCIM 2.0 Automatic Group Provisioning Engine</span>
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        When disabled, users sign in via OIDC SSO with manual role mappings or default role fallback.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setLocalScim({ ...localScim, enabled: !localScim.enabled })}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        localScim.enabled
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {localScim.enabled ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>SCIM Enabled</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-slate-400" />
                          <span>SCIM Disabled (Off)</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Default Fallback Role for Unmapped SSO Users
                      </label>
                      <select
                        value={localScim.defaultRole}
                        onChange={(e) => setLocalScim({ ...localScim, defaultRole: e.target.value as UserRole })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium"
                      >
                        <option value="APPSEC_ADMIN">AppSec Admin (Full CRUD Access)</option>
                        <option value="IT_VIEWER">IT Team (Read-Only Viewer Access)</option>
                      </select>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Assigned when user has no manual role override and SCIM group mapping produces no match.
                      </p>
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
                          className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-indigo-300"
                        />
                        <button
                          type="button"
                          onClick={handleGenerateSecret}
                          className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-medium whitespace-nowrap cursor-pointer"
                        >
                          New Secret
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Approval Gate Toggle Section */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-amber-500" />
                        <span>Azure AD Provisioning Approval Gate</span>
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        When enabled, newly provisioned accounts remain in <code className="text-amber-500 font-mono font-bold">PENDING_APPROVAL</code> status until an administrator approves them in User Management.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setLocalScim({ ...localScim, requireAdminApproval: !(localScim.requireAdminApproval ?? true) })}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                        (localScim.requireAdminApproval ?? true)
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {(localScim.requireAdminApproval ?? true) ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approval Gate Enabled</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-slate-400" />
                          <span>Auto-Approve (Gate Off)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500">
                    Changes take effect immediately across all OIDC SSO login flows and server endpoints.
                  </span>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 cursor-pointer"
                  >
                    Save Azure AD OIDC Credentials
                  </button>
                </div>

              </form>
            </div>

            {/* Azure Portal Copy Pastes Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Code className="w-4 h-4 text-indigo-500" />
                <span>Azure Portal Enterprise App OIDC & SCIM Parameters</span>
              </h3>

              <div className="space-y-3 text-xs font-mono">
                
                {/* Redirect URI */}
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">
                      OIDC Redirect URI (Web App)
                    </span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{localSso.redirectUri}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(localSso.redirectUri, 'redir')}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:text-indigo-500 text-slate-500 cursor-pointer"
                  >
                    {copiedField === 'redir' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* OIDC Authorize Endpoint */}
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">
                      OIDC Authorization Endpoint (v2.0)
                    </span>
                    <span className="text-blue-600 dark:text-blue-400 font-semibold truncate block max-w-sm">
                      {localSso.loginUrl}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(localSso.loginUrl, 'auth_ep')}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:text-blue-500 text-slate-500 cursor-pointer"
                  >
                    {copiedField === 'auth_ep' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* OIDC Discovery Endpoint */}
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">
                      OIDC Well-Known Discovery Endpoint
                    </span>
                    <span className="text-purple-600 dark:text-purple-400 font-semibold truncate block max-w-sm">
                      {`${localSso.issuerUrl}/.well-known/openid-configuration`}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(`${localSso.issuerUrl}/.well-known/openid-configuration`, 'disc_ep')}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:text-purple-500 text-slate-500 cursor-pointer"
                  >
                    {copiedField === 'disc_ep' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
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
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:text-emerald-500 text-slate-500 cursor-pointer"
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
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:text-indigo-500 text-slate-500 cursor-pointer"
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

      {/* SUBTAB 2: Access Control, Manual User Overrides & SCIM Group Mappings */}
      {activeSubTab === 'mappings' && (
        <div className="space-y-6">
          
          {/* Card 1: Manual User Role Mapping Overrides (Tier 2 - Highest SSO Priority) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-indigo-500" />
                  <span>Manual User Role Overrides (Direct SSO Mappings)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Explicitly map specific SSO user emails or UPNs to application roles. Overrides SCIM group logic.
                </p>
              </div>

              <button
                onClick={() => setIsAddManualOpen(!isAddManualOpen)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add User Override</span>
              </button>
            </div>

            {/* Add Manual Mapping Form */}
            {isAddManualOpen && (
              <form onSubmit={handleAddManualMapping} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 space-y-4 animate-fadeIn">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  New Direct User Role Override
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      User Email / UPN Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      placeholder="e.g. lead.security@enterprise.local"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Assigned Application Role *
                    </label>
                    <select
                      value={manualRole}
                      onChange={(e) => setManualRole(e.target.value as UserRole)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="APPSEC_ADMIN">AppSec Admin (Full CRUD Access)</option>
                      <option value="IT_VIEWER">IT Team (Read-Only Viewer Access)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Notes / Justification
                  </label>
                  <input
                    type="text"
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    placeholder="e.g. Lead AppSec auditor given admin rights via manual override"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddManualOpen(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    Save User Override
                  </button>
                </div>
              </form>
            )}

            {/* Manual Mappings Table */}
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">User Email / UPN</th>
                    <th className="py-3 px-4">Assigned Role</th>
                    <th className="py-3 px-4">Notes / Justification</th>
                    <th className="py-3 px-4">Updated By</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {manualMappings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400 text-xs italic">
                        No manual user role overrides configured. Users will inherit roles via SCIM group mapping or default fallback.
                      </td>
                    </tr>
                  ) : (
                    manualMappings.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-indigo-600 dark:text-indigo-300">
                          {m.emailOrUpn}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                            m.assignedRole === 'APPSEC_ADMIN'
                              ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                              : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                          }`}>
                            {m.assignedRole === 'APPSEC_ADMIN' ? 'AppSec Admin' : 'IT Viewer'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {m.notes || 'Manual override'}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                          {m.updatedBy || 'Super Admin'} ({(m.updatedAt || m.createdAt || new Date().toISOString()).slice(0, 10)})
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeleteManualMapping(m.id)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                            title="Delete manual role override"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 2: SCIM 2.0 Group-to-Role Mapping Rules (Tier 3) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-500" />
                  <span>Azure AD Group to App Role Mapping Rules (SCIM Mappings)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Automatically map Azure AD Security Groups or Entra App Roles to AppSec Admin or IT Viewer permissions
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleRevertGroupMappingsToDefaults}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Revert SCIM Group Mappings to default rules"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Revert SCIM Mappings to Defaults</span>
                </button>
                <button
                  onClick={handleReSyncAllUserRoles}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-Evaluate All Users</span>
                </button>
                <button
                  onClick={() => setIsAddRuleOpen(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
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
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs cursor-pointer"
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

      {/* SUBTAB 4: Provisioned Users Directory & IAM */}
      {activeSubTab === 'users' && (
        <div className="space-y-6">
          
          {/* IAM Security Notice Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-4 text-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-white">IAM Security Authorization Enforcement</h4>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono font-bold">
                    ACTIVE GATE
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  After OIDC authentication, the app checks if the user exists in this IAM directory. If matched, access is granted and the session switches to their identity. Unregistered users are denied with HTTP 403.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAddIamUserOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add User to IAM</span>
            </button>
          </div>

          {/* Add User to IAM Modal / Form */}
          {isAddIamUserOpen && (
            <form onSubmit={handleAddIamUser} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 shadow-lg space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-indigo-500" />
                  <span>Register New Identity in Enterprise IAM</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAddIamUserOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    User Email / UPN <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={newIamEmail}
                    onChange={(e) => setNewIamEmail(e.target.value)}
                    placeholder="e.g. user@enterprise.local or user@contoso.com"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={newIamDisplayName}
                    onChange={(e) => setNewIamDisplayName(e.target.value)}
                    placeholder="e.g. John Smith"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Assigned App Role
                  </label>
                  <select
                    value={newIamRole}
                    onChange={(e) => setNewIamRole(e.target.value as UserRole)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="APPSEC_ADMIN">AppSec Admin (Full CRUD Access)</option>
                    <option value="IT_VIEWER">IT Team (Read-Only Viewer Access)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Azure AD Security Groups
                  </label>
                  <input
                    type="text"
                    value={newIamGroups}
                    onChange={(e) => setNewIamGroups(e.target.value)}
                    placeholder="e.g. AppSec-Engineers, CyberSecurity-Leads"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={newIamDepartment}
                    onChange={(e) => setNewIamDepartment(e.target.value)}
                    placeholder="e.g. InfoSec / Cyber Security"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={newIamTitle}
                    onChange={(e) => setNewIamTitle(e.target.value)}
                    placeholder="e.g. Senior Security Auditor"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddIamUserOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md"
                >
                  Register Identity in IAM
                </button>
              </div>
            </form>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-500" />
                  <span>Enterprise IAM & SCIM Users Directory ({filteredUsers.length})</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Registered user identities authorized for OIDC SSO authentication and role mapping
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
                    <th className="py-3 px-4">IAM Authorization</th>
                    <th className="py-3 px-4">Azure AD Groups</th>
                    <th className="py-3 px-4">Effective Role</th>
                    <th className="py-3 px-4">Account Status</th>
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
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/80">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>REGISTERED IN IAM</span>
                        </span>
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
                        {user.approvalStatus === 'PENDING_APPROVAL' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 dark:bg-amber-950/90 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 animate-pulse">
                            <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>Pending Approval</span>
                          </span>
                        ) : user.approvalStatus === 'REJECTED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-900 dark:bg-rose-950/90 dark:text-rose-300 border border-rose-300 dark:border-rose-700/60">
                            <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                            <span>Rejected</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleUserActive(user)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                              user.active
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                                : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
                            }`}
                          >
                            {user.active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            <span>{user.active ? 'Active' : 'Suspended'}</span>
                          </button>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {user.approvalStatus === 'PENDING_APPROVAL' ? (
                            <>
                              <button
                                onClick={() => handleApproveProvisionedUser(user)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow flex items-center gap-1 cursor-pointer transition-all"
                                title="Approve provisioned user & add to User Management"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approve Access</span>
                              </button>
                              <button
                                onClick={() => handleRejectProvisionedUser(user)}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow flex items-center gap-1 cursor-pointer transition-all"
                                title="Reject access request"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setInspectingUser(user)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs border border-slate-200 dark:border-slate-700 cursor-pointer"
                              >
                                View JSON
                              </button>

                              {(() => {
                                const email = (user.email || user.userName || '').toLowerCase();
                                const isSuperAdminUser =
                                  email === 'superadmin@enterprise.local' ||
                                  email === 'superadmin@local.internal' ||
                                  email === 'superadmin' ||
                                  email === 'admin@enterprise.local' ||
                                  (user.mappedRole as string) === 'SUPER_ADMIN';

                                if (isSuperAdminUser) {
                                  return (
                                    <span
                                      title="Super Admin account is protected by security policy and cannot be removed."
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold text-[11px]"
                                    >
                                      <Lock className="w-3 h-3 text-amber-500" />
                                      <span>Protected Super Admin</span>
                                    </span>
                                  );
                                }

                                return (
                                  <button
                                    onClick={() => handleRemoveUser(user)}
                                    title={`Remove ${user.displayName} from Enterprise IAM`}
                                    className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 font-semibold text-xs border border-rose-200 dark:border-rose-800 flex items-center gap-1 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                    <span>Remove User</span>
                                  </button>
                                );
                              })()}
                            </>
                          )}
                        </div>
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
