import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  Lock,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  KeyRound,
  FileText,
  RotateCcw,
  Check,
  Search,
  Sliders,
  Play,
  HelpCircle,
  UserCheck,
  ChevronRight,
  Layers,
  Sparkles,
  Info,
  Copy,
  Code,
  Terminal,
  Fingerprint,
  CheckSquare,
  Square,
  Zap,
  RefreshCw
} from 'lucide-react';
import {
  ScimGroupMapping,
  ManualUserRoleMapping,
  UserRole,
  ProvisionedUser,
  CustomRoleDefinition,
  PermissionKey,
  ActiveSsoUser,
  BearerJwtPayload
} from '../types';
import {
  DEFAULT_GROUP_MAPPINGS,
  DEFAULT_MANUAL_USER_MAPPINGS,
  DEFAULT_CUSTOM_ROLES,
  saveGroupMappings,
  saveManualUserMappings,
  loadCustomRoles,
  saveCustomRoles,
  ALL_PERMISSIONS,
  getEffectivePermissionsForRole,
  generateBearerJwtToken,
  verifyAndDecodeBearerJwt,
  loadActiveSsoUser,
  addScimAuditLog
} from '../utils/ssoScimStorage';

interface RbacControlViewProps {
  groupMappings: ScimGroupMapping[];
  onUpdateGroupMappings: (mappings: ScimGroupMapping[]) => void;
  manualMappings: ManualUserRoleMapping[];
  onUpdateManualMappings: (mappings: ManualUserRoleMapping[]) => void;
  provisionedUsers: ProvisionedUser[];
  onRefreshLogs: () => void;
  currentRole: UserRole;
  activeSsoUser?: ActiveSsoUser;
}

export const RbacControlView: React.FC<RbacControlViewProps> = ({
  groupMappings,
  onUpdateGroupMappings,
  manualMappings,
  onUpdateManualMappings,
  provisionedUsers,
  onRefreshLogs,
  currentRole,
  activeSsoUser
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'matrix' | 'roles' | 'groups' | 'overrides' | 'jwt'>('matrix');

  // Custom Roles & Permission Matrix State
  const [customRoles, setCustomRoles] = useState<CustomRoleDefinition[]>(loadCustomRoles());
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleKey, setNewRoleKey] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRolePermissions, setNewRolePermissions] = useState<PermissionKey[]>([
    'APP_VIEW',
    'ASSESSMENT_SUBMIT',
    'AUDIT_LOG_VIEW'
  ]);

  // Group Mapping Form State
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupId, setGroupId] = useState('');
  const [targetRole, setTargetRole] = useState<UserRole>('APPSEC_ADMIN');
  const [groupDesc, setGroupDesc] = useState('');

  // Manual Override Form State
  const [isAddManualOpen, setIsAddManualOpen] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const [manualRole, setManualRole] = useState<UserRole>('APPSEC_ADMIN');
  const [manualNotes, setManualNotes] = useState('');

  // Toast State
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // JWT Token & Simulator State
  const activeUser = activeSsoUser || loadActiveSsoUser();
  const [activeJwtToken, setActiveJwtToken] = useState<string>('');
  const [activeJwtPayload, setActiveJwtPayload] = useState<BearerJwtPayload | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Simulator Form State
  const [simulatedEmail, setSimulatedEmail] = useState<string>(
    provisionedUsers[0]?.email || 'admin@enterprise.local'
  );
  const [simulatedPermission, setSimulatedPermission] = useState<PermissionKey>('PROMOTION_GATE_OVERRIDE');
  const [simulatedEndpoint, setSimulatedEndpoint] = useState<string>('/api/security/promotion-override');
  const [simulationRun, setSimulationRun] = useState<any | null>(null);

  useEffect(() => {
    // Generate active session JWT token
    const { token, payload } = generateBearerJwtToken(
      {
        email: activeUser.email || 'admin@enterprise.local',
        displayName: activeUser.displayName || 'AppSec Administrator',
        role: activeUser.role || 'APPSEC_ADMIN',
        userId: activeUser.userId,
        loginMethod: activeUser.loginMethod
      },
      customRoles
    );
    setActiveJwtToken(token);
    setActiveJwtPayload(payload);
  }, [activeUser.email, activeUser.role, customRoles]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Create New Custom Role
  const handleCreateCustomRole = (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrim = newRoleName.trim();
    if (!nameTrim) {
      showToast('Please specify a role name.', 'error');
      return;
    }

    const roleKeyClean = (newRoleKey.trim() || nameTrim.toUpperCase().replace(/[^A-Z0-9]/g, '_')).toUpperCase();

    if (customRoles.some((r) => r.roleKey === roleKeyClean)) {
      showToast(`Role key '${roleKeyClean}' already exists. Please choose a unique key.`, 'error');
      return;
    }

    const newRole: CustomRoleDefinition = {
      id: `ROLE-${Date.now().toString().slice(-4)}`,
      roleKey: roleKeyClean,
      name: nameTrim,
      description: newRoleDesc.trim() || `Custom RBAC role for ${nameTrim}`,
      isSystemRole: false,
      permissions: newRolePermissions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: activeUser.displayName || 'AppSec Admin'
    };

    const updated = [...customRoles, newRole];
    setCustomRoles(updated);
    saveCustomRoles(updated);

    addScimAuditLog(
      'POST',
      `/api/rbac/roles/${roleKeyClean}`,
      201,
      'CREATE_CUSTOM_ROLE',
      `Created new RBAC Role '${nameTrim}' (${roleKeyClean}) with ${newRolePermissions.length} permissions bound to JWT claims.`
    );
    onRefreshLogs();

    setNewRoleName('');
    setNewRoleKey('');
    setNewRoleDesc('');
    setIsCreateRoleOpen(false);
    showToast(`Successfully created custom role '${nameTrim}'.`);
  };

  // Toggle Permission for a Role in Permission Matrix
  const handleTogglePermission = (roleKey: string, permKey: PermissionKey) => {
    const updated = customRoles.map((role) => {
      if (role.roleKey === roleKey || role.id === roleKey) {
        const hasPerm = role.permissions.includes(permKey);
        const nextPerms = hasPerm
          ? role.permissions.filter((p) => p !== permKey)
          : [...role.permissions, permKey];

        return {
          ...role,
          permissions: nextPerms,
          updatedAt: new Date().toISOString()
        };
      }
      return role;
    });

    setCustomRoles(updated);
    saveCustomRoles(updated);

    const roleObj = customRoles.find((r) => r.roleKey === roleKey || r.id === roleKey);
    const roleName = roleObj ? roleObj.name : roleKey;
    const actionType = roleObj?.permissions.includes(permKey) ? 'REVOKE_PERMISSION' : 'GRANT_PERMISSION';

    addScimAuditLog(
      'PATCH',
      `/api/rbac/roles/${roleKey}/permissions`,
      200,
      actionType,
      `Updated RBAC matrix for role '${roleName}' (${roleKey}): ${actionType} '${permKey}'.`
    );
    onRefreshLogs();
    showToast(`Updated permission '${permKey}' for role '${roleName}'.`);
  };

  // Delete Custom Role
  const handleDeleteCustomRole = (role: CustomRoleDefinition) => {
    if (role.isSystemRole) {
      showToast('System default roles are protected and cannot be deleted.', 'error');
      return;
    }

    if (window.confirm(`Are you sure you want to delete custom role '${role.name}'?`)) {
      const updated = customRoles.filter((r) => r.id !== role.id && r.roleKey !== role.roleKey);
      setCustomRoles(updated);
      saveCustomRoles(updated);

      addScimAuditLog(
        'DELETE',
        `/api/rbac/roles/${role.roleKey}`,
        200,
        'DELETE_CUSTOM_ROLE',
        `Deleted custom RBAC role '${role.name}' (${role.roleKey}).`
      );
      onRefreshLogs();
      showToast(`Role '${role.name}' was removed.`);
    }
  };

  // Add Azure AD Group Mapping
  const handleAddGroupMapping = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      showToast('Please specify an Azure AD Group Name.', 'error');
      return;
    }

    const newRule: ScimGroupMapping = {
      id: `MAP-${Date.now().toString().slice(-4)}`,
      azureGroupOrRoleName: groupName.trim(),
      azureGroupId: groupId.trim() || undefined,
      appRole: targetRole,
      description: groupDesc.trim() || `Maps Azure AD Group '${groupName.trim()}' to ${targetRole}`,
      createdAt: new Date().toISOString()
    };

    const updated = [newRule, ...groupMappings];
    onUpdateGroupMappings(updated);
    saveGroupMappings(updated);

    addScimAuditLog(
      'POST',
      '/api/scim/v2/GroupMappings',
      201,
      'ADD_GROUP_MAPPING',
      `Created RBAC Group Mapping Rule for Azure Group '${groupName}' -> ${targetRole}`
    );
    onRefreshLogs();

    setGroupName('');
    setGroupId('');
    setGroupDesc('');
    setIsAddGroupOpen(false);
    showToast(`Group mapping rule created for '${groupName}'.`);
  };

  // Delete Group Mapping
  const handleDeleteGroupMapping = (id: string, name: string) => {
    if (groupMappings.length <= 1) {
      showToast('Cannot delete the last remaining group mapping rule.', 'error');
      return;
    }

    const updated = groupMappings.filter((m) => m.id !== id);
    onUpdateGroupMappings(updated);
    saveGroupMappings(updated);

    addScimAuditLog(
      'DELETE',
      `/api/scim/v2/GroupMappings/${id}`,
      200,
      'DELETE_GROUP_MAPPING',
      `Removed Group Mapping Rule '${name}'`
    );
    onRefreshLogs();

    showToast(`Mapping rule for '${name}' was deleted.`);
  };

  // Add Direct Manual User Override
  const handleAddManualOverride = (e: React.FormEvent) => {
    e.preventDefault();
    const emailLower = manualEmail.trim().toLowerCase();
    if (!emailLower) {
      showToast('Please provide a valid user email address.', 'error');
      return;
    }

    const newOverride: ManualUserRoleMapping = {
      id: `MAN-${Date.now().toString().slice(-4)}`,
      emailOrUpn: emailLower,
      assignedRole: manualRole,
      notes: manualNotes.trim() || 'Manual user role override rule',
      createdAt: new Date().toISOString(),
      updatedBy: activeUser.displayName || 'AppSec Admin',
      updatedAt: new Date().toISOString()
    };

    const updated = [newOverride, ...manualMappings];
    onUpdateManualMappings(updated);
    saveManualUserMappings(updated);

    addScimAuditLog(
      'POST',
      '/api/scim/v2/UserMappings',
      201,
      'ADD_USER_OVERRIDE',
      `Created direct user override for '${emailLower}' -> ${manualRole}`
    );
    onRefreshLogs();

    setManualEmail('');
    setManualNotes('');
    setIsAddManualOpen(false);
    showToast(`Direct user role override created for '${emailLower}'.`);
  };

  // Delete Manual User Override
  const handleDeleteManualOverride = (id: string, email: string) => {
    const updated = manualMappings.filter((m) => m.id !== id);
    onUpdateManualMappings(updated);
    saveManualUserMappings(updated);

    addScimAuditLog(
      'DELETE',
      `/api/scim/v2/UserMappings/${id}`,
      200,
      'DELETE_USER_OVERRIDE',
      `Removed Direct User Override Rule for '${email}'`
    );
    onRefreshLogs();

    showToast(`Override for '${email}' was deleted.`);
  };

  // Reset to System Policy Defaults
  const handleResetDefaults = () => {
    if (window.confirm('Reset RBAC custom roles, matrix permissions, group mappings, and user overrides to system factory defaults?')) {
      setCustomRoles(DEFAULT_CUSTOM_ROLES);
      saveCustomRoles(DEFAULT_CUSTOM_ROLES);

      onUpdateGroupMappings(DEFAULT_GROUP_MAPPINGS);
      saveGroupMappings(DEFAULT_GROUP_MAPPINGS);

      onUpdateManualMappings(DEFAULT_MANUAL_USER_MAPPINGS);
      saveManualUserMappings(DEFAULT_MANUAL_USER_MAPPINGS);

      addScimAuditLog(
        'POST',
        '/api/rbac/reset',
        200,
        'RESET_RBAC_DEFAULTS',
        'Reset RBAC roles, permission matrix, and group mapping policies to default system state.'
      );
      onRefreshLogs();

      showToast('RBAC policies and permission matrix reset to default system rules.');
    }
  };

  // Run Bearer JWT Authorization Gate Simulator
  const handleRunSimulator = () => {
    const emailTarget = simulatedEmail.trim().toLowerCase();
    const userMatch = provisionedUsers.find(
      (u) => (u.email && u.email.toLowerCase() === emailTarget) || (u.userName && u.userName.toLowerCase() === emailTarget)
    );
    const manualMatch = manualMappings.find((m) => m.emailOrUpn.toLowerCase() === emailTarget);

    let effectiveRole: string = 'IT_VIEWER';
    let rationale = 'Default IT_VIEWER fallback assigned.';

    if (emailTarget === 'superadmin@enterprise.local' || emailTarget === 'superadmin') {
      effectiveRole = 'SUPER_ADMIN';
      rationale = 'Emergency Break-Glass Super Admin Exemption rule matched.';
    } else if (manualMatch) {
      effectiveRole = manualMatch.assignedRole;
      rationale = `Matched Tier 1 Direct User Override rule for '${manualMatch.emailOrUpn}' -> ${manualMatch.assignedRole}`;
    } else if (userMatch) {
      effectiveRole = userMatch.mappedRole;
      rationale = `Resolved via SCIM Provisioned User Directory & Azure AD Claims -> ${userMatch.mappedRole}`;
    }

    // Get effective permissions
    const effectivePermissions = getEffectivePermissionsForRole(effectiveRole, customRoles);

    // Generate Bearer JWT token for simulated user
    const { token, payload } = generateBearerJwtToken({
      email: emailTarget,
      displayName: userMatch ? userMatch.displayName : emailTarget.split('@')[0],
      role: effectiveRole,
      userId: userMatch ? userMatch.id : `usr-${emailTarget.split('@')[0]}`,
      loginMethod: 'BEARER_JWT_SIMULATED'
    }, customRoles);

    // Verify token validity
    const jwtVerification = verifyAndDecodeBearerJwt(token);

    // Check if permission required exists in JWT permissions array
    const isAuthorized = effectivePermissions.includes(simulatedPermission);

    setSimulationRun({
      email: emailTarget,
      effectiveRole,
      rationale,
      requiredPermission: simulatedPermission,
      endpoint: simulatedEndpoint,
      token,
      payload,
      jwtVerification,
      effectivePermissions,
      isAuthorized,
      statusCode: isAuthorized ? 200 : 403,
      statusMessage: isAuthorized ? '200 OK - AUTHORIZED' : '403 FORBIDDEN - INSUFFICIENT_PERMISSIONS',
      timestamp: new Date().toISOString()
    });

    addScimAuditLog(
      'POST',
      '/api/rbac/simulate-jwt-auth',
      isAuthorized ? 200 : 403,
      'SIMULATE_JWT_AUTHORIZATION',
      `Simulated Bearer JWT authorization for '${emailTarget}' on endpoint '${simulatedEndpoint}' for action '${simulatedPermission}': ${isAuthorized ? 'GRANTED' : 'DENIED'}`
    );
    onRefreshLogs();
  };

  const categories = Array.from(new Set(ALL_PERMISSIONS.map((p) => p.category)));

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

      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 rounded-2xl p-6 md:p-8 border border-slate-800 shadow-xl text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-md">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-3">
                  <span>Editable Role-Based Access Control (RBAC)</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Bearer JWT Token Bound
                  </span>
                </h2>
                <p className="text-sm text-purple-200/80">
                  Create custom RBAC roles, edit permission matrices, map Azure AD group claims, and verify session JWT authorization
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsCreateRoleOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Custom Role</span>
            </button>

            <button
              onClick={handleResetDefaults}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-purple-400" />
              <span>Reset Policy Defaults</span>
            </button>
          </div>
        </div>
      </div>

      {/* Subtab Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveSubTab('matrix')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'matrix'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Permission Matrix Editor ({customRoles.length} Roles)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('groups')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'groups'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Azure AD Group Rules ({groupMappings.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('overrides')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'overrides'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Manual User Overrides ({manualMappings.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('jwt')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'jwt'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Bearer JWT Token & Auth Simulator</span>
        </button>
      </div>

      {/* CREATE CUSTOM ROLE MODAL */}
      {isCreateRoleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 space-y-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5 text-slate-900 dark:text-slate-100 font-bold text-lg">
                <Sparkles className="w-5 h-5 text-purple-500" />
                <h3>Create New Custom RBAC Role</h3>
              </div>
              <button
                onClick={() => setIsCreateRoleOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomRole} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Role Display Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={(e) => {
                      setNewRoleName(e.target.value);
                      if (!newRoleKey) {
                        setNewRoleKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '_'));
                      }
                    }}
                    placeholder="e.g. Security Compliance Specialist"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Role Key Identifier <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newRoleKey}
                    onChange={(e) => setNewRoleKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                    placeholder="e.g. COMPLIANCE_SPECIALIST"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Role Description</label>
                <input
                  type="text"
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  placeholder="e.g. Grants access to evidence generation and compliance reports"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Assign Initial Permissions ({newRolePermissions.length} selected)
                </label>

                <div className="max-h-60 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  {categories.map((cat) => (
                    <div key={cat} className="space-y-1.5">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                        {cat}
                      </h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {ALL_PERMISSIONS.filter((p) => p.category === cat).map((p) => {
                          const isChecked = newRolePermissions.includes(p.key);
                          return (
                            <label
                              key={p.key}
                              className="flex items-start gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-800 cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewRolePermissions([...newRolePermissions, p.key]);
                                  } else {
                                    setNewRolePermissions(newRolePermissions.filter((k) => k !== p.key));
                                  }
                                }}
                                className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                              />
                              <div>
                                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
                                  {p.label}
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                                  {p.description}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateRoleOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md cursor-pointer transition-all"
                >
                  Create & Publish Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBTAB 1: PERMISSION MATRIX EDITOR */}
      {activeSubTab === 'matrix' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-purple-500" />
                  <span>Interactive Permission Matrix Editor</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Click any checkbox cell to grant or revoke specific permissions for any role in real time. Changes update bound Bearer JWT tokens.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">
                  Active Roles: <strong className="text-purple-600 dark:text-purple-400 font-mono">{customRoles.length}</strong>
                </span>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4 min-w-[280px]">Permission Key & Description</th>
                    {customRoles.map((role) => (
                      <th key={role.id} className="py-3.5 px-3 text-center min-w-[140px]">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                            {role.name}
                          </span>
                          <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                            {role.roleKey}
                          </span>

                          {!role.isSystemRole && (
                            <button
                              onClick={() => handleDeleteCustomRole(role)}
                              title={`Delete custom role '${role.name}'`}
                              className="mt-1 text-rose-500 hover:text-rose-600 text-[10px] font-semibold flex items-center gap-0.5 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-xs">
                  {categories.map((cat) => (
                    <React.Fragment key={cat}>
                      {/* Category Header Row */}
                      <tr className="bg-purple-950/20 dark:bg-purple-950/40 border-y border-purple-200/50 dark:border-purple-900/50">
                        <td
                          colSpan={customRoles.length + 1}
                          className="py-2.5 px-4 font-bold text-xs uppercase tracking-wider text-purple-700 dark:text-purple-300"
                        >
                          {cat}
                        </td>
                      </tr>

                      {ALL_PERMISSIONS.filter((p) => p.category === cat).map((p) => (
                        <tr key={p.key} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                              <span>{p.label}</span>
                              <code className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                {p.key}
                              </code>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {p.description}
                            </p>
                          </td>

                          {customRoles.map((role) => {
                            const isGranted = role.permissions.includes(p.key);
                            return (
                              <td key={role.id} className="py-3 px-3 text-center align-middle">
                                <button
                                  type="button"
                                  onClick={() => handleTogglePermission(role.roleKey, p.key)}
                                  className={`inline-flex items-center justify-center p-1.5 rounded-lg border transition-all cursor-pointer ${
                                    isGranted
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 shadow-xs'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                                  }`}
                                  title={`Click to ${isGranted ? 'revoke' : 'grant'} '${p.label}' for ${role.name}`}
                                >
                                  {isGranted ? (
                                    <Check className="w-4 h-4 text-emerald-500" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                                  )}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: AZURE AD GROUP RULES */}
      {activeSubTab === 'groups' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-500" />
                  <span>Azure AD Security Group & Claims Mapping Rules</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Map Entra ID Security Groups and roles to RBAC application permissions
                </p>
              </div>

              <button
                onClick={() => setIsAddGroupOpen(true)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Group Mapping</span>
              </button>
            </div>

            {/* Add Group Mapping Form Modal */}
            {isAddGroupOpen && (
              <form onSubmit={handleAddGroupMapping} className="p-4 bg-slate-50 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  New Group Mapping Policy
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Azure Group or Role Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="e.g. AppSec-Engineers"
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Azure Group Object ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={groupId}
                      onChange={(e) => setGroupId(e.target.value)}
                      placeholder="e.g. b19e2e10-9112-4f3b..."
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Mapped Target Application Role <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-100"
                    >
                      {customRoles.map((r) => (
                        <option key={r.roleKey} value={r.roleKey}>
                          {r.name} ({r.roleKey})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Policy Rationale / Description</label>
                  <input
                    type="text"
                    value={groupDesc}
                    onChange={(e) => setGroupDesc(e.target.value)}
                    placeholder="e.g. Grants AppSec Admin rights to primary security team group"
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddGroupOpen(false)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow"
                  >
                    Save Mapping Rule
                  </button>
                </div>
              </form>
            )}

            {/* Group Mappings List */}
            <div className="space-y-3">
              {groupMappings.map((rule) => (
                <div
                  key={rule.id}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {rule.azureGroupOrRoleName}
                      </span>
                      {rule.azureGroupId && (
                        <code className="text-[10px] font-mono bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded">
                          {rule.azureGroupId}
                        </code>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {rule.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                      {rule.appRole}
                    </span>
                    <button
                      onClick={() => handleDeleteGroupMapping(rule.id, rule.azureGroupOrRoleName)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer transition-colors"
                      title="Delete Group Mapping Rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: MANUAL USER OVERRIDES */}
      {activeSubTab === 'overrides' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-purple-500" />
                  <span>Tier 1 Direct User Role Overrides</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Directly override role assignments for specific user email / UPN addresses
                </p>
              </div>

              <button
                onClick={() => setIsAddManualOpen(true)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add User Override</span>
              </button>
            </div>

            {/* Add User Override Form Modal */}
            {isAddManualOpen && (
              <form onSubmit={handleAddManualOverride} className="p-4 bg-slate-50 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  New Direct User Role Override
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      User Email or UPN <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      placeholder="e.g. sjenkins@company.com"
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Assigned RBAC Role <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={manualRole}
                      onChange={(e) => setManualRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-100"
                    >
                      {customRoles.map((r) => (
                        <option key={r.roleKey} value={r.roleKey}>
                          {r.name} ({r.roleKey})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Notes & Justification</label>
                  <input
                    type="text"
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    placeholder="e.g. Granted temporary AppSec Admin override for security audit"
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddManualOpen(false)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow"
                  >
                    Save Override Rule
                  </button>
                </div>
              </form>
            )}

            {/* Overrides List */}
            <div className="space-y-3">
              {manualMappings.map((m) => (
                <div
                  key={m.id}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {m.emailOrUpn}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Added: {new Date(m.createdAt || Date.now()).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {m.notes}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                      {m.assignedRole}
                    </span>
                    <button
                      onClick={() => handleDeleteManualOverride(m.id, m.emailOrUpn)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer transition-colors"
                      title="Delete User Override Rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: BEARER JWT TOKEN INSPECTOR & SIMULATOR */}
      {activeSubTab === 'jwt' && (
        <div className="space-y-8">
          
          {/* Active Session JWT Token Box */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 text-slate-100 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">Active Session Bearer JWT Authorization Token</h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`Authorization: Bearer ${activeJwtToken}`);
                    setCopiedToken(true);
                    setTimeout(() => setCopiedToken(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  {copiedToken ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedToken ? 'Copied Header!' : 'Copy Bearer Header'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 block">
                Signed Token Payload (<code className="text-purple-400">Authorization: Bearer ...</code>)
              </label>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-purple-300 break-all select-all max-h-24 overflow-y-auto">
                {activeJwtToken}
              </div>
            </div>

            {/* Decoded Claims */}
            {activeJwtPayload && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                  <Fingerprint className="w-4 h-4" />
                  <span>Decoded Token Claims Bound to Identity</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Subject (sub)</span>
                    <span className="font-semibold text-white font-mono">{activeJwtPayload.sub}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Assigned Role</span>
                    <span className="font-bold text-purple-400 font-mono">{activeJwtPayload.role}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Issuer (iss)</span>
                    <span className="font-semibold text-emerald-400 font-mono">{activeJwtPayload.iss}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Expiration (exp)</span>
                    <span className="font-semibold text-slate-300 font-mono">
                      {new Date(activeJwtPayload.exp * 1000).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Granted Permissions Array ({activeJwtPayload.permissions?.length || 0} keys)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeJwtPayload.permissions?.map((p) => (
                      <span
                        key={p}
                        className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Authorization Simulator Form */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 shadow-sm">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-500" />
                <span>Live Bearer JWT Authorization Gate Simulator</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Simulate an incoming API request with Bearer JWT token authentication to test identity role resolution and permission verification.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Select User Email / Identity
                </label>
                <select
                  value={simulatedEmail}
                  onChange={(e) => setSimulatedEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-100"
                >
                  <option value="admin@enterprise.local">admin@enterprise.local (Super Admin)</option>
                  {provisionedUsers.map((u) => (
                    <option key={u.id} value={u.email || u.userName}>
                      {u.email || u.userName} ({u.displayName} - {u.mappedRole})
                    </option>
                  ))}
                  {manualMappings.map((m) => (
                    <option key={m.id} value={m.emailOrUpn}>
                      {m.emailOrUpn} (Manual Override: {m.assignedRole})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Required Action / Permission Key
                </label>
                <select
                  value={simulatedPermission}
                  onChange={(e) => setSimulatedPermission(e.target.value as PermissionKey)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-100"
                >
                  {ALL_PERMISSIONS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label} ({p.key})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Simulated API Endpoint Path
                </label>
                <input
                  type="text"
                  value={simulatedEndpoint}
                  onChange={(e) => setSimulatedEndpoint(e.target.value)}
                  placeholder="/api/security/promotion-override"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleRunSimulator}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all"
              >
                <Play className="w-4 h-4" />
                <span>Simulate Authorization & Verify JWT</span>
              </button>
            </div>

            {/* Simulation Results Display */}
            {simulationRun && (
              <div
                className={`p-5 rounded-xl border space-y-4 animate-fadeIn ${
                  simulationRun.isAuthorized
                    ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-100'
                    : 'bg-rose-950/20 border-rose-500/40 text-rose-100'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    {simulationRun.isAuthorized ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400" />
                    )}
                    <span className="font-bold text-sm">
                      {simulationRun.statusMessage}
                    </span>
                  </div>

                  <span className="text-xs font-mono text-slate-400">
                    Tested at: {new Date(simulationRun.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <p>
                    <strong className="text-slate-300">Identity Resolution Rationale:</strong>{' '}
                    <span className="text-slate-100">{simulationRun.rationale}</span>
                  </p>
                  <p>
                    <strong className="text-slate-300">Resolved Role & Required Key:</strong>{' '}
                    <span className="font-mono text-purple-300 font-bold">{simulationRun.effectiveRole}</span> needs permission{' '}
                    <span className="font-mono text-amber-300 font-bold">{simulationRun.requiredPermission}</span>
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Simulated Bearer Token Header Verification
                  </span>
                  <div className="font-mono text-[11px] text-purple-300 break-all select-all">
                    Authorization: Bearer {simulationRun.token}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
