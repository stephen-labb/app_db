import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  UserPlus,
  Trash2,
  Edit2,
  Shield,
  UserCheck,
  UserX,
  Code,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  XCircle,
  FileSpreadsheet,
  FileJson,
  Building,
  Key,
  ShieldCheck,
  RefreshCw,
  ClipboardList,
  Fingerprint,
  Plus,
  Lock,
  FileCheck,
  Sparkles,
  Info,
  Clock,
  ShieldAlert,
  KeyRound,
  RotateCcw,
  Settings,
  FileText
} from 'lucide-react';
import {
  ProvisionedUser,
  UserRole,
  ActiveSsoUser,
  AccessApprovalRecord,
  AccessApprovalActionType,
  CustomRoleDefinition,
  SsoConfig,
  ScimConfig,
  ScimGroupMapping,
  ManualUserRoleMapping,
  ScimAuditLog
} from '../types';
import {
  saveProvisionedUsers,
  addScimAuditLog,
  exportProvisionedUsersCSV,
  loadAccessApprovalRecords,
  saveAccessApprovalRecords,
  addAccessApprovalRecord,
  exportAccessApprovalRecordsCSV,
  loadCustomRoles,
  getEffectivePermissionsForRole,
  loadManualUserMappings,
  saveManualUserMappings,
  loadSsoConfig,
  saveSsoConfig,
  loadScimConfig,
  saveScimConfig,
  loadGroupMappings,
  saveGroupMappings,
  loadScimAuditLogs
} from '../utils/ssoScimStorage';
import { SsoScimView } from './SsoScimView';

export type UserManagementSubTab =
  | 'USER_DIRECTORY'
  | 'AZURE_SSO'
  | 'GROUP_MAPPINGS'
  | 'AUDIT_LOGS'
  | 'APPROVAL_AUDITS'
  | 'SCIM_LOGS';

interface UserManagementViewProps {
  provisionedUsers: ProvisionedUser[];
  onUpdateUsers: (users: ProvisionedUser[]) => void;
  onRefreshLogs: () => void;
  currentRole: UserRole;
  activeSsoUser?: ActiveSsoUser;
  initialSubTab?: UserManagementSubTab;
  ssoConfig?: SsoConfig;
  onUpdateSsoConfig?: (config: SsoConfig) => void;
  scimConfig?: ScimConfig;
  onUpdateScimConfig?: (config: ScimConfig) => void;
  groupMappings?: ScimGroupMapping[];
  onUpdateGroupMappings?: (mappings: ScimGroupMapping[]) => void;
  manualMappings?: ManualUserRoleMapping[];
  onUpdateManualMappings?: (mappings: ManualUserRoleMapping[]) => void;
  scimLogs?: ScimAuditLog[];
  onOpenAzureLogin?: () => void;
  onRoleChange?: (role: UserRole) => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  provisionedUsers,
  onUpdateUsers,
  onRefreshLogs,
  currentRole,
  activeSsoUser,
  initialSubTab,
  ssoConfig,
  onUpdateSsoConfig,
  scimConfig,
  onUpdateScimConfig,
  groupMappings,
  onUpdateGroupMappings,
  manualMappings,
  onUpdateManualMappings,
  scimLogs,
  onOpenAzureLogin,
  onRoleChange
}) => {
  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<UserManagementSubTab>(() => {
    if (initialSubTab === 'SCIM_LOGS' || initialSubTab === 'APPROVAL_AUDITS') {
      return 'AUDIT_LOGS';
    }
    return initialSubTab || 'USER_DIRECTORY';
  });

  const [logsViewMode, setLogsViewMode] = useState<'APPROVAL_RECORDS' | 'SCIM_PROVISIONING'>(() => {
    if (initialSubTab === 'SCIM_LOGS') return 'SCIM_PROVISIONING';
    return 'APPROVAL_RECORDS';
  });

  const [scimSearchTerm, setScimSearchTerm] = useState('');
  const [scimMethodFilter, setScimMethodFilter] = useState<string>('ALL');
  const [inspectingScimLog, setInspectingScimLog] = useState<ScimAuditLog | null>(null);

  useEffect(() => {
    if (initialSubTab) {
      if (initialSubTab === 'SCIM_LOGS') {
        setActiveTab('AUDIT_LOGS');
        setLogsViewMode('SCIM_PROVISIONING');
      } else if (initialSubTab === 'APPROVAL_AUDITS') {
        setActiveTab('AUDIT_LOGS');
        setLogsViewMode('APPROVAL_RECORDS');
      } else {
        setActiveTab(initialSubTab);
      }
    }
  }, [initialSubTab]);

  // Fallback state for SSO/SCIM items if not directly provided
  const [internalSsoConfig, setInternalSsoConfig] = useState<SsoConfig>(() => ssoConfig || loadSsoConfig());
  const [internalScimConfig, setInternalScimConfig] = useState<ScimConfig>(() => scimConfig || loadScimConfig());
  const [internalGroupMappings, setInternalGroupMappings] = useState<ScimGroupMapping[]>(() => groupMappings || loadGroupMappings());
  const [internalManualMappings, setInternalManualMappings] = useState<ManualUserRoleMapping[]>(() => manualMappings || loadManualUserMappings());
  const [internalScimLogs, setInternalScimLogs] = useState<ScimAuditLog[]>(() => scimLogs || loadScimAuditLogs());

  // Keep internal state updated if props change
  useEffect(() => {
    if (ssoConfig) setInternalSsoConfig(ssoConfig);
  }, [ssoConfig]);

  useEffect(() => {
    if (scimConfig) setInternalScimConfig(scimConfig);
  }, [scimConfig]);

  useEffect(() => {
    if (groupMappings) setInternalGroupMappings(groupMappings);
  }, [groupMappings]);

  useEffect(() => {
    if (manualMappings) setInternalManualMappings(manualMappings);
  }, [manualMappings]);

  useEffect(() => {
    if (scimLogs) setInternalScimLogs(scimLogs);
  }, [scimLogs]);

  // User Directory State & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  
  // User Directory Modals
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ProvisionedUser | null>(null);
  const [inspectingUser, setInspectingUser] = useState<ProvisionedUser | null>(null);
  
  // Toast Notification
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New / Edit User Form State
  const [formEmail, setFormEmail] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('APPSEC_ADMIN');
  const [formDepartment, setFormDepartment] = useState('InfoSec');
  const [formTitle, setFormTitle] = useState('Security Engineer');
  const [formGroups, setFormGroups] = useState('AppSec-Engineers');
  const [formActive, setFormActive] = useState(true);

  // Auditable Access Approval Records State
  const [approvalRecords, setApprovalRecords] = useState<AccessApprovalRecord[]>(() => loadAccessApprovalRecords());
  const [approvalSearchTerm, setApprovalSearchTerm] = useState('');
  const [approvalStatusFilter, setApprovalStatusFilter] = useState<string>('ALL');
  const [inspectingApprovalRecord, setInspectingApprovalRecord] = useState<AccessApprovalRecord | null>(null);
  
  // Manual Access Approval Entry Modal State
  const [isAddApprovalModalOpen, setIsAddApprovalModalOpen] = useState(false);
  const [newTargetName, setNewTargetName] = useState('');
  const [newTargetEmail, setNewTargetEmail] = useState('');
  const [newActionType, setNewActionType] = useState<AccessApprovalActionType>('APPROVE');
  const [newAssignedRole, setNewAssignedRole] = useState<UserRole>('APPSEC_ADMIN');
  const [newRationale, setNewRationale] = useState('');
  const [newComplianceTag, setNewComplianceTag] = useState('SOC2-CC6.1-ACCESS-AUTHORIZATION');

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Pre-fill edit modal
  const handleOpenEdit = (user: ProvisionedUser) => {
    setEditingUser(user);
    setFormEmail(user.email || user.userName);
    setFormDisplayName(user.displayName);
    setFormRole(user.mappedRole);
    setFormDepartment(user.department || 'InfoSec');
    setFormTitle(user.title || 'Engineer');
    setFormGroups(user.groups ? user.groups.join(', ') : '');
    setFormActive(user.active !== false && user.iamStatus !== 'SUSPENDED');
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormEmail('');
    setFormDisplayName('');
    setFormRole('APPSEC_ADMIN');
    setFormDepartment('InfoSec');
    setFormTitle('Security Engineer');
    setFormGroups('AppSec-Engineers');
    setFormActive(true);
    setIsAddUserOpen(true);
  };

  // Save User (Create or Update)
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailLower = formEmail.trim().toLowerCase();
    
    if (!emailLower || !formDisplayName.trim()) {
      showToast('Please provide a valid display name and email address.', 'error');
      return;
    }

    const groupList = formGroups
      .split(',')
      .map((g) => g.trim())
      .filter((g) => g.length > 0);

    const names = formDisplayName.trim().split(' ');
    const givenName = names[0] || 'User';
    const familyName = names.slice(1).join(' ') || 'Account';

    const adminName = activeSsoUser?.displayName || activeSsoUser?.email || 'AppSec Governance Admin';

    if (editingUser) {
      // Update existing user
      const updatedUsers = provisionedUsers.map((u) => {
        if (u.id === editingUser.id) {
          return {
            ...u,
            displayName: formDisplayName.trim(),
            givenName,
            familyName,
            email: emailLower,
            userName: emailLower,
            mappedRole: formRole,
            department: formDepartment.trim(),
            title: formTitle.trim(),
            groups: groupList,
            active: formActive,
            iamStatus: formActive ? ('ACTIVE' as const) : ('SUSPENDED' as const),
            lastSyncedAt: new Date().toISOString()
          };
        }
        return u;
      });

      onUpdateUsers(updatedUsers);
      saveProvisionedUsers(updatedUsers);

      // Sync RBAC Manual User Mapping Override
      const currentManuals = loadManualUserMappings();
      const existingIdx = currentManuals.findIndex((m) => m.emailOrUpn.toLowerCase() === emailLower);
      let updatedManuals = [...currentManuals];
      if (existingIdx >= 0) {
        updatedManuals[existingIdx] = {
          ...updatedManuals[existingIdx],
          assignedRole: formRole,
          updatedBy: adminName,
          updatedAt: new Date().toISOString()
        };
      } else {
        updatedManuals.push({
          id: `MAN-${Date.now().toString(36)}`,
          emailOrUpn: emailLower,
          assignedRole: formRole,
          notes: `Associated via User Directory Edit (${adminName})`,
          createdAt: new Date().toISOString(),
          updatedBy: adminName,
          updatedAt: new Date().toISOString()
        });
      }
      saveManualUserMappings(updatedManuals);

      addScimAuditLog(
        'PATCH',
        `/api/scim/v2/Users/${editingUser.id}`,
        200,
        'UPDATE_IAM_USER',
        `Updated IAM user '${formDisplayName}' (${emailLower}) - Role: ${formRole}, Status: ${formActive ? 'Active' : 'Suspended'}`,
        editingUser.id,
        emailLower
      );

      // Record Auditable Access Management Approval Entry
      addAccessApprovalRecord(
        { id: editingUser.id, name: formDisplayName.trim(), email: emailLower },
        'ROLE_CHANGE',
        formRole,
        adminName,
        `Updated IAM user identity profile. Role set to ${formRole}. Status: ${formActive ? 'Active' : 'Suspended'}. Groups: ${groupList.join(', ')}.`,
        {
          previousRole: editingUser.mappedRole,
          approverRole: activeSsoUser?.role || 'SUPER_ADMIN',
          requestSource: 'DIRECTORY_ADMIN',
          status: 'MODIFIED',
          complianceTag: 'ISO27001-A.9.2.3-ROLE-MODIFICATION'
        }
      );
      setApprovalRecords(loadAccessApprovalRecords());

      onRefreshLogs();
      setEditingUser(null);
      showToast(`User '${formDisplayName}' updated successfully.`);
    } else {
      // Create new user
      const userId = `iam-usr-${Date.now().toString(36)}`;
      const newUser: ProvisionedUser = {
        id: userId,
        userName: emailLower,
        displayName: formDisplayName.trim(),
        givenName,
        familyName,
        email: emailLower,
        active: formActive,
        groups: groupList.length > 0 ? groupList : ['AppSec-Engineers'],
        mappedRole: formRole,
        lastSyncedAt: new Date().toISOString(),
        syncedVia: 'IAM_DIRECTORY',
        department: formDepartment.trim(),
        title: formTitle.trim(),
        iamStatus: formActive ? 'ACTIVE' : 'SUSPENDED',
        addedToIamAt: new Date().toISOString(),
        addedByIamAdmin: adminName,
        approvalStatus: 'APPROVED',
        approvedBy: adminName,
        approvedAt: new Date().toISOString()
      };

      const updatedUsers = [newUser, ...provisionedUsers];
      onUpdateUsers(updatedUsers);
      saveProvisionedUsers(updatedUsers);

      // Sync RBAC Manual User Mapping Override for New Provisioned User
      const currentManuals = loadManualUserMappings();
      const existingIdx = currentManuals.findIndex((m) => m.emailOrUpn.toLowerCase() === emailLower);
      let updatedManuals = [...currentManuals];
      if (existingIdx >= 0) {
        updatedManuals[existingIdx] = {
          ...updatedManuals[existingIdx],
          assignedRole: formRole,
          updatedBy: adminName,
          updatedAt: new Date().toISOString()
        };
      } else {
        updatedManuals.push({
          id: `MAN-${Date.now().toString(36)}`,
          emailOrUpn: emailLower,
          assignedRole: formRole,
          notes: `Associated via Provision New User (${adminName})`,
          createdAt: new Date().toISOString(),
          updatedBy: adminName,
          updatedAt: new Date().toISOString()
        });
      }
      saveManualUserMappings(updatedManuals);

      try {
        await fetch('/api/iam/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newUser)
        });
      } catch (err) {
        // Local fallback handled
      }

      addScimAuditLog(
        'POST',
        '/api/scim/v2/Users',
        201,
        'REGISTER_IAM_USER',
        `Registered new user '${formDisplayName}' (${emailLower}) in Enterprise IAM directory with role ${formRole}`,
        newUser.id,
        newUser.userName
      );

      // Record Auditable Access Management Approval Entry
      addAccessApprovalRecord(
        { id: newUser.id, name: newUser.displayName, email: newUser.email },
        'PROVISION',
        formRole,
        adminName,
        `Manually provisioned & authorized user '${formDisplayName}' (${emailLower}) in Enterprise Directory. Department: ${newUser.department}.`,
        {
          approverRole: activeSsoUser?.role || 'SUPER_ADMIN',
          requestSource: 'MANUAL_PROVISION',
          status: 'APPROVED',
          complianceTag: 'SOC2-CC6.1-MANUAL-PROVISIONING'
        }
      );
      setApprovalRecords(loadAccessApprovalRecords());

      onRefreshLogs();
      setIsAddUserOpen(false);
      showToast(`User '${formDisplayName}' provisioned successfully.`);
    }
  };

  // Trigger Mandatory Password Reset for IAM Directory Enrolled Users
  const handleTriggerPasswordReset = (user: ProvisionedUser) => {
    if (!window.confirm(`Are you sure you want to trigger a mandatory password reset for '${user.displayName}' (${user.email})?\n\nThe user will be required to change their password on next login with password rules (8+ chars, upper, lower, special character).`)) {
      return;
    }

    const adminName = activeSsoUser?.displayName || activeSsoUser?.email || 'AppSec Governance Admin';

    const updatedUsers = provisionedUsers.map((u) => {
      if (u.id === user.id) {
        return {
          ...u,
          mustResetPassword: true,
          passwordResetRequestedAt: new Date().toISOString()
        };
      }
      return u;
    });

    onUpdateUsers(updatedUsers);
    saveProvisionedUsers(updatedUsers);

    addScimAuditLog(
      'POST',
      `/api/iam/users/${user.id}/reset-password`,
      200,
      'TRIGGER_PASSWORD_RESET',
      `Administrator '${adminName}' triggered mandatory password reset for user '${user.displayName}' (${user.email})`,
      user.id,
      user.userName
    );

    addAccessApprovalRecord(
      { id: user.id, name: user.displayName, email: user.email },
      'ROLE_CHANGE',
      user.mappedRole,
      adminName,
      `Flagged mandatory password reset for local IAM user. User must re-authenticate and establish a compliant password (8+ chars, upper, lower, special character) during next login.`,
      {
        approverRole: activeSsoUser?.role || 'SUPER_ADMIN',
        requestSource: 'DIRECTORY_ADMIN',
        status: 'MODIFIED',
        complianceTag: 'NIST-800-63B-PASSWORD-RESET'
      }
    );
    setApprovalRecords(loadAccessApprovalRecords());

    onRefreshLogs();
    showToast(`Password reset flagged for '${user.displayName}'. User must change password upon next login.`);
  };

  // Toggle user active status
  const handleToggleStatus = (user: ProvisionedUser) => {
    const isSuperAdmin =
      user.email === 'superadmin@enterprise.local' ||
      user.email === 'admin@enterprise.local' ||
      user.mappedRole === 'SUPER_ADMIN';

    if (isSuperAdmin && user.active) {
      showToast('Super Admin account cannot be suspended.', 'error');
      return;
    }

    const newActiveState = !user.active;
    const adminName = activeSsoUser?.displayName || activeSsoUser?.email || 'AppSec Governance Admin';

    const updatedUsers = provisionedUsers.map((u) => {
      if (u.id === user.id) {
        return {
          ...u,
          active: newActiveState,
          iamStatus: newActiveState ? ('ACTIVE' as const) : ('SUSPENDED' as const),
          approvalStatus: newActiveState ? ('APPROVED' as const) : u.approvalStatus,
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
      'TOGGLE_USER_STATUS',
      `Toggled status for user ${user.displayName} to ${newActiveState ? 'ACTIVE' : 'SUSPENDED'}`,
      user.id,
      user.userName
    );

    // Record Auditable Access Approval Entry
    addAccessApprovalRecord(
      { id: user.id, name: user.displayName, email: user.email },
      newActiveState ? 'ACTIVATE' : 'SUSPEND',
      user.mappedRole,
      adminName,
      `Administrator toggled user active status to ${newActiveState ? 'ACTIVE (Enabled)' : 'SUSPENDED (Disabled)'}.`,
      {
        approverRole: activeSsoUser?.role || 'SUPER_ADMIN',
        requestSource: 'DIRECTORY_ADMIN',
        status: newActiveState ? 'APPROVED' : 'SUSPENDED',
        complianceTag: newActiveState ? 'SOC2-CC6.1-ACCESS-RESTORED' : 'HIPAA-164.312-ACCOUNT-SUSPENSION'
      }
    );
    setApprovalRecords(loadAccessApprovalRecords());

    onRefreshLogs();
    showToast(`User '${user.displayName}' status changed to ${newActiveState ? 'Active' : 'Suspended'}.`);
  };

  // Approve Access Request
  const handleApproveUser = (user: ProvisionedUser) => {
    const adminName = activeSsoUser?.displayName || activeSsoUser?.email || 'AppSec Governance Admin';

    const updatedUsers = provisionedUsers.map((u) => {
      if (u.id === user.id) {
        return {
          ...u,
          active: true,
          iamStatus: 'ACTIVE' as const,
          approvalStatus: 'APPROVED' as const,
          approvedBy: adminName,
          approvedAt: new Date().toISOString(),
          addedToIamAt: new Date().toISOString(),
          lastSyncedAt: new Date().toISOString()
        };
      }
      return u;
    });

    onUpdateUsers(updatedUsers);
    saveProvisionedUsers(updatedUsers);

    addScimAuditLog(
      'PATCH',
      `/api/scim/v2/Users/${user.id}/Approve`,
      200,
      'APPROVE_ACCESS_REQUEST',
      `Approved access request for user ${user.displayName} (${user.email}). User added & activated in User Management.`,
      user.id,
      user.userName
    );

    // Record Auditable Access Approval Entry
    addAccessApprovalRecord(
      { id: user.id, name: user.displayName, email: user.email },
      'APPROVE',
      user.mappedRole,
      adminName,
      `Approved Azure AD SCIM provisioned access request. Account activated and assigned role ${user.mappedRole}.`,
      {
        approverRole: activeSsoUser?.role || 'SUPER_ADMIN',
        requestSource: 'ACCESS_REQUEST_GATE',
        status: 'APPROVED',
        complianceTag: 'SOC2-CC6.1-ACCESS-AUTHORIZATION'
      }
    );
    setApprovalRecords(loadAccessApprovalRecords());

    onRefreshLogs();
    showToast(`Access approved for '${user.displayName}'. Account is now ACTIVE in User Management.`);
  };

  // Reject Access Request
  const handleRejectUser = (user: ProvisionedUser) => {
    const adminName = activeSsoUser?.displayName || activeSsoUser?.email || 'AppSec Governance Admin';

    const updatedUsers = provisionedUsers.map((u) => {
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

    onUpdateUsers(updatedUsers);
    saveProvisionedUsers(updatedUsers);

    addScimAuditLog(
      'PATCH',
      `/api/scim/v2/Users/${user.id}/Reject`,
      200,
      'REJECT_ACCESS_REQUEST',
      `Rejected provisioned access request for user ${user.displayName} (${user.email}).`,
      user.id,
      user.userName
    );

    // Record Auditable Access Approval Entry
    addAccessApprovalRecord(
      { id: user.id, name: user.displayName, email: user.email },
      'REJECT',
      user.mappedRole,
      adminName,
      `Rejected Azure AD SCIM access request. Account marked as REJECTED and prevented from acquiring application session tokens.`,
      {
        approverRole: activeSsoUser?.role || 'SUPER_ADMIN',
        requestSource: 'ACCESS_REQUEST_GATE',
        status: 'REJECTED',
        complianceTag: 'SOC2-CC6.1-REJECTION-POLICY'
      }
    );
    setApprovalRecords(loadAccessApprovalRecords());

    onRefreshLogs();
    showToast(`Access request for '${user.displayName}' was rejected.`, 'error');
  };

  // Delete User
  const handleDeleteUser = async (user: ProvisionedUser) => {
    const isSuperAdmin =
      user.email === 'superadmin@enterprise.local' ||
      user.email === 'admin@enterprise.local' ||
      user.mappedRole === 'SUPER_ADMIN';

    if (isSuperAdmin) {
      showToast('Super Admin account is permanently protected and cannot be deleted.', 'error');
      return;
    }

    if (!window.confirm(`Are you sure you want to remove user '${user.displayName}' (${user.email}) from Enterprise IAM?`)) {
      return;
    }

    const adminName = activeSsoUser?.displayName || activeSsoUser?.email || 'AppSec Governance Admin';

    const updatedUsers = provisionedUsers.filter((u) => u.id !== user.id);
    onUpdateUsers(updatedUsers);
    saveProvisionedUsers(updatedUsers);

    try {
      await fetch(`/api/iam/users/${user.id}`, { method: 'DELETE' });
    } catch (e) {
      // Local fallback handled
    }

    addScimAuditLog(
      'DELETE',
      `/api/scim/v2/Users/${user.id}`,
      200,
      'REMOVE_IAM_USER',
      `Removed user ${user.displayName} (${user.email}) from Enterprise IAM directory`,
      user.id,
      user.userName
    );

    // Record Auditable Access Approval Entry
    addAccessApprovalRecord(
      { id: user.id, name: user.displayName, email: user.email },
      'REMOVE',
      user.mappedRole,
      adminName,
      `Decommissioned and deleted user identity '${user.displayName}' (${user.email}) from IAM Directory.`,
      {
        approverRole: activeSsoUser?.role || 'SUPER_ADMIN',
        requestSource: 'DIRECTORY_ADMIN',
        status: 'SUSPENDED',
        complianceTag: 'HIPAA-164.312-USER-DECOMMISSION'
      }
    );
    setApprovalRecords(loadAccessApprovalRecords());

    onRefreshLogs();
    showToast(`User '${user.displayName}' was removed from the system.`);
  };

  // Handle Manual Approval Entry Submission
  const handleCreateManualApprovalRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTargetName.trim() || !newTargetEmail.trim()) {
      showToast('Please provide target user name and email address.', 'error');
      return;
    }

    const adminName = activeSsoUser?.displayName || activeSsoUser?.email || 'AppSec Governance Admin';

    addAccessApprovalRecord(
      { name: newTargetName.trim(), email: newTargetEmail.trim().toLowerCase() },
      newActionType,
      newAssignedRole,
      adminName,
      newRationale.trim() || 'Access review decision logged by Administrator in User Management.',
      {
        approverRole: activeSsoUser?.role || 'SUPER_ADMIN',
        requestSource: 'DIRECTORY_ADMIN',
        complianceTag: newComplianceTag
      }
    );

    setApprovalRecords(loadAccessApprovalRecords());
    setIsAddApprovalModalOpen(false);
    setNewTargetName('');
    setNewTargetEmail('');
    setNewRationale('');
    showToast('New auditable access management approval record generated successfully.');
  };

  // Filter users
  const filteredUsers = provisionedUsers.filter((u) => {
    const matchesSearch =
      u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.title && u.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.department && u.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.groups && u.groups.some((g) => g.toLowerCase().includes(searchTerm.toLowerCase())));

    const matchesRole = roleFilter === 'ALL' || u.mappedRole === roleFilter;

    const isActive = u.active !== false && u.iamStatus !== 'SUSPENDED';
    const isPending = u.approvalStatus === 'PENDING_APPROVAL';
    const isRejected = u.approvalStatus === 'REJECTED';

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && isActive && !isPending && !isRejected) ||
      (statusFilter === 'SUSPENDED' && !isActive && !isPending && !isRejected) ||
      (statusFilter === 'PENDING_APPROVAL' && isPending) ||
      (statusFilter === 'REJECTED' && isRejected);

    return matchesSearch && matchesRole && matchesStatus;
  });

  // KPI Metrics for Users Directory
  const totalUsers = provisionedUsers.length;
  const activeCount = provisionedUsers.filter((u) => u.active !== false && u.iamStatus !== 'SUSPENDED' && u.approvalStatus !== 'PENDING_APPROVAL' && u.approvalStatus !== 'REJECTED').length;
  const pendingCount = provisionedUsers.filter((u) => u.approvalStatus === 'PENDING_APPROVAL').length;
  const adminCount = provisionedUsers.filter((u) => u.mappedRole === 'SUPER_ADMIN' || u.mappedRole === 'APPSEC_ADMIN').length;
  const pendingUsersList = provisionedUsers.filter((u) => u.approvalStatus === 'PENDING_APPROVAL');

  // Filter Access Approval Records
  const filteredApprovalRecords = approvalRecords.filter((rec) => {
    const matchesSearch =
      rec.id.toLowerCase().includes(approvalSearchTerm.toLowerCase()) ||
      rec.targetUserName.toLowerCase().includes(approvalSearchTerm.toLowerCase()) ||
      rec.targetUserEmail.toLowerCase().includes(approvalSearchTerm.toLowerCase()) ||
      rec.approvedBy.toLowerCase().includes(approvalSearchTerm.toLowerCase()) ||
      rec.complianceTag.toLowerCase().includes(approvalSearchTerm.toLowerCase()) ||
      rec.rationaleNotes.toLowerCase().includes(approvalSearchTerm.toLowerCase());

    const matchesStatus =
      approvalStatusFilter === 'ALL' || rec.status === approvalStatusFilter;

    return matchesSearch && matchesStatus;
  });

  // Filter SCIM 2.0 Audit Logs for Unified Logs View
  const allScimLogs = scimLogs || internalScimLogs;
  const filteredScimLogs = allScimLogs.filter((log) => {
    const term = scimSearchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      log.endpoint.toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term) ||
      log.details.toLowerCase().includes(term) ||
      String(log.statusCode).includes(term) ||
      (log.targetUser && log.targetUser.toLowerCase().includes(term));

    const matchesMethod =
      scimMethodFilter === 'ALL' || log.method.toUpperCase() === scimMethodFilter.toUpperCase();

    return matchesSearch && matchesMethod;
  });

  // KPI Metrics for Access Approval Records & SCIM Logs
  const totalApprovalCount = approvalRecords.length;
  const approvedCount = approvalRecords.filter((r) => r.status === 'APPROVED').length;
  const rejectedCount = approvalRecords.filter((r) => r.status === 'REJECTED').length;
  const modifiedCount = approvalRecords.filter((r) => r.status === 'MODIFIED' || r.status === 'SUSPENDED').length;

  const totalScimCount = allScimLogs.length;
  const scimSuccessCount = allScimLogs.filter((l) => l.statusCode >= 200 && l.statusCode < 300).length;

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

      {/* Navigation Sub-Tab Selector */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('USER_DIRECTORY')}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'USER_DIRECTORY'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>User Directory</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === 'USER_DIRECTORY' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}>
              {totalUsers}
            </span>
            {pendingCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping ml-0.5" title="Pending approval requests" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('GROUP_MAPPINGS')}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'GROUP_MAPPINGS'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Shield className="w-4 h-4 shrink-0 text-purple-500" />
            <span>Mappings</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === 'GROUP_MAPPINGS' ? 'bg-white/20 text-white' : 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-500/30'
            }`}>
              {(groupMappings || internalGroupMappings).length} Rules
            </span>
          </button>

          <button
            onClick={() => setActiveTab('AZURE_SSO')}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'AZURE_SSO'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Settings className="w-4 h-4 shrink-0 text-blue-500" />
            <span>Single Sign On (SSO)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === 'AZURE_SSO' ? 'bg-white/20 text-white' : 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-500/30'
            }`}>
              OIDC
            </span>
          </button>

          <button
            onClick={() => setActiveTab('AUDIT_LOGS')}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'AUDIT_LOGS' || activeTab === 'APPROVAL_AUDITS' || activeTab === 'SCIM_LOGS'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <ClipboardList className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>Approval Records & SCIM Logs</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === 'AUDIT_LOGS' || activeTab === 'APPROVAL_AUDITS' || activeTab === 'SCIM_LOGS'
                ? 'bg-white/20 text-white'
                : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
            }`}>
              {totalApprovalCount + totalScimCount} Logs
            </span>
          </button>
        </div>
      </div>

      {/* VIEW TAB 1: USER DIRECTORY */}
      {activeTab === 'USER_DIRECTORY' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Header Banner */}
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 md:p-8 border border-slate-800 shadow-xl text-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-100">
                      Enterprise User Management Directory
                    </h2>
                    <p className="text-sm text-indigo-200/80">
                      Manage provisioned accounts, SCIM identities, active access status, and Azure AD approval gate requests
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleOpenAdd}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg flex items-center gap-2 transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Provision New User</span>
                </button>

                <button
                  onClick={() => exportProvisionedUsersCSV(provisionedUsers)}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Export Users CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pending Access Requests Approval Gate Banner */}
          {pendingCount > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 font-bold">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                      <span>Azure AD Provisioning Approval Gate ({pendingCount} Pending Request{pendingCount > 1 ? 's' : ''})</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 text-[10px] font-extrabold uppercase animate-pulse">
                        Action Required
                      </span>
                    </h3>
                    <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                      New users provisioned via Azure AD / SCIM 2.0 require Administrator sign-off before being granted platform access.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingUsersList.map((user) => (
                  <div key={user.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 flex items-center justify-between gap-4 shadow-sm">
                    <div>
                      <p className="font-bold text-xs text-slate-900 dark:text-slate-100">{user.displayName}</p>
                      <p className="text-[11px] font-mono text-slate-500">{user.email}</p>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                        Target Role: <span className="font-bold">{user.mappedRole}</span> • Dept: {user.department || 'N/A'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleApproveUser(user)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleRejectUser(user)}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Users</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalUsers}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">SCIM & IAM Provisioned</p>
              </div>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-indigo-600 dark:text-indigo-400">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Status</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{activeCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Approved & Enabled Accounts</p>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl text-emerald-600 dark:text-emerald-400">
                <UserCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Approvals</p>
                <p className="text-2xl font-bold text-amber-500 mt-1">{pendingCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Awaiting Admin Sign-off</p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/60 rounded-xl text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">AppSec Administrators</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{adminCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Full CRUD & Gate Overrides</p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-950/60 rounded-xl text-purple-600 dark:text-purple-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Main Table Panel */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            
            {/* Controls Bar */}
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, email, department or title..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs text-slate-500 font-medium">Role:</span>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="ALL">All Roles</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                    <option value="APPSEC_ADMIN">AppSec Admin</option>
                    <option value="IT_VIEWER">IT Viewer</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500 font-medium">Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active Only</option>
                    <option value="PENDING_APPROVAL">Pending Approval ({pendingCount})</option>
                    <option value="SUSPENDED">Suspended Only</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
              </div>
            </div>

            {/* User List Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">User Identity</th>
                    <th className="py-3.5 px-4">Department & Title</th>
                    <th className="py-3.5 px-4">Group Claims</th>
                    <th className="py-3.5 px-4">Assigned Role</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Sync Source</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <Users className="w-10 h-10 mx-auto text-slate-400 mb-2 opacity-50" />
                        <p className="font-semibold">No users match your filter criteria.</p>
                        <p className="text-xs text-slate-400 mt-1">Try clearing your search query or role filter.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const isActive = user.active !== false && user.iamStatus !== 'SUSPENDED';
                      const isSuperAdmin = user.mappedRole === 'SUPER_ADMIN';
                      const isDirectlyEnrolled = !user.syncedVia || user.syncedVia === 'IAM_DIRECTORY' || user.syncedVia === 'MANUAL_TEST' || user.syncedVia === 'MANUAL_PROVISION';

                      return (
                        <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          {/* Name & Email */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-sm ${
                                isSuperAdmin
                                  ? 'bg-amber-500 text-slate-950'
                                  : user.mappedRole === 'APPSEC_ADMIN'
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-indigo-600 text-white'
                              }`}>
                                {user.givenName?.[0] || user.displayName?.[0] || 'U'}
                                {user.familyName?.[0] || ''}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                                  <span>{user.displayName}</span>
                                  {isSuperAdmin && (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 text-[10px] font-extrabold uppercase">
                                      Super Admin
                                    </span>
                                  )}
                                  {user.mustResetPassword && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 text-[9px] font-bold border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                                      <RotateCcw className="w-2.5 h-2.5 text-amber-600" />
                                      <span>Reset Required</span>
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                  {user.email || user.userName}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Department & Title */}
                          <td className="py-3.5 px-4">
                            <p className="font-medium text-slate-800 dark:text-slate-200">
                              {user.title || 'Security Engineer'}
                            </p>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Building className="w-3 h-3" />
                              <span>{user.department || 'InfoSec'}</span>
                            </p>
                          </td>

                          {/* Group Claims */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {user.groups && user.groups.length > 0 ? (
                                user.groups.map((group, gIdx) => (
                                  <span
                                    key={gIdx}
                                    className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-mono border border-slate-200 dark:border-slate-700"
                                  >
                                    {group}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">No groups</span>
                              )}
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                              user.mappedRole === 'SUPER_ADMIN'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-700'
                                : user.mappedRole === 'APPSEC_ADMIN'
                                ? 'bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-700'
                                : 'bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-700'
                            }`}>
                              <Shield className="w-3 h-3" />
                              <span>{user.mappedRole}</span>
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {user.approvalStatus === 'PENDING_APPROVAL' ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 dark:bg-amber-950/90 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 inline-flex items-center gap-1 animate-pulse">
                                <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                <span>Pending Approval</span>
                              </span>
                            ) : user.approvalStatus === 'REJECTED' ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-900 dark:bg-rose-950/90 dark:text-rose-300 border border-rose-300 dark:border-rose-700/60 inline-flex items-center gap-1">
                                <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                <span>Rejected</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(user)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1 ${
                                  isActive
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 hover:bg-emerald-200'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 hover:bg-rose-200'
                                }`}
                                title="Click to toggle active status"
                              >
                                {isActive ? (
                                  <>
                                    <UserCheck className="w-3 h-3" />
                                    <span>Active</span>
                                  </>
                                ) : (
                                  <>
                                    <UserX className="w-3 h-3" />
                                    <span>Suspended</span>
                                  </>
                                )}
                              </button>
                            )}
                          </td>

                          {/* Sync Source */}
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono text-[10px]">
                              {user.syncedVia || 'IAM_DIRECTORY'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {user.approvalStatus === 'PENDING_APPROVAL' ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleApproveUser(user)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-sm flex items-center gap-1 transition-all cursor-pointer"
                                    title="Approve access request & add user to User Directory"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRejectUser(user)}
                                    className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold shadow-sm flex items-center gap-1 transition-all cursor-pointer"
                                    title="Reject access request"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>Reject</span>
                                  </button>
                                </>
                              ) : (
                                <>
                                  {isDirectlyEnrolled ? (
                                    <button
                                      type="button"
                                      onClick={() => handleTriggerPasswordReset(user)}
                                      className={`p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                                        user.mustResetPassword ? 'text-amber-500 animate-pulse bg-amber-50 dark:bg-amber-950/40' : ''
                                      }`}
                                      title={user.mustResetPassword ? "Mandatory password reset pending on next login" : "Trigger mandatory password reset on next login"}
                                    >
                                      <KeyRound className="w-4 h-4" />
                                    </button>
                                  ) : (
                                    <span
                                      className="p-1.5 rounded-lg text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-50"
                                      title="Password reset unavailable for federated Azure AD / SCIM 2.0 identities"
                                    >
                                      <KeyRound className="w-4 h-4" />
                                    </span>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleOpenEdit(user)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors"
                                    title="Edit User Details & Role"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setInspectingUser(user)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors"
                                    title="Inspect Raw SCIM JSON Schema"
                                  >
                                    <Code className="w-4 h-4" />
                                  </button>

                                  {!isSuperAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteUser(user)}
                                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors"
                                      title="Delete User"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW TAB 2 & 6 MERGED: GOVERNANCE AUDIT LEDGER & SCIM PROVISIONING LOGS */}
      {(activeTab === 'AUDIT_LOGS' || activeTab === 'APPROVAL_AUDITS' || activeTab === 'SCIM_LOGS') && (
        <div className="space-y-8 animate-fadeIn">
          {/* Header Banner */}
          <div className="bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 rounded-2xl p-6 md:p-8 border border-slate-800 shadow-xl text-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-md">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2 flex-wrap">
                      <span>Governance Audit Ledger & SCIM Provisioning Logs</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-extrabold uppercase">
                        SOC2, ISO27001 & RFC 7644
                      </span>
                    </h2>
                    <p className="text-sm text-purple-200/80">
                      Tamper-evident audit ledger tracking administrator access sign-offs, role modifications, and Azure Entra ID SCIM 2.0 provisioning events
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {logsViewMode === 'APPROVAL_RECORDS' ? (
                  <>
                    <button
                      onClick={() => setIsAddApprovalModalOpen(true)}
                      className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-lg flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Record Approval Entry</span>
                    </button>

                    <button
                      onClick={() => exportAccessApprovalRecordsCSV(filteredApprovalRecords)}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span>Export Auditable CSV</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      onRefreshLogs();
                      setInternalScimLogs(loadScimAuditLogs());
                      showToast('SCIM Provisioning Logs refreshed successfully.');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Refresh SCIM Logs</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sub-View Switcher Pill Bar */}
          <div className="flex items-center gap-2 p-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs w-fit">
            <button
              type="button"
              onClick={() => setLogsViewMode('APPROVAL_RECORDS')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                logsViewMode === 'APPROVAL_RECORDS'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Fingerprint className="w-4 h-4" />
              <span>Approval Records (SOC2 / ISO27001)</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                logsViewMode === 'APPROVAL_RECORDS' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {totalApprovalCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setLogsViewMode('SCIM_PROVISIONING')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                logsViewMode === 'SCIM_PROVISIONING'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>SCIM Provisioning Logs (Azure Entra ID)</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                logsViewMode === 'SCIM_PROVISIONING' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {totalScimCount}
              </span>
            </button>
          </div>

          {/* VIEW MODE 1: AUDITABLE APPROVAL RECORDS */}
          {logsViewMode === 'APPROVAL_RECORDS' && (
            <div className="space-y-8 animate-fadeIn">

          {/* KPI Cards for Approval Audit Ledger */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Audit Records</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalApprovalCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Signed Governance Events</p>
              </div>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-indigo-600 dark:text-indigo-400">
                <Fingerprint className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approved Grants</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{approvedCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Access Authorized</p>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rejected Requests</p>
                <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{rejectedCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Access Blocked / Denied</p>
              </div>
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 rounded-xl text-rose-600 dark:text-rose-400">
                <XCircle className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Role Changes / Suspends</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{modifiedCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Elevations & Toggles</p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-950/60 rounded-xl text-purple-600 dark:text-purple-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Audit Ledger Table Container */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            
            {/* Search and Filter Controls */}
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              
              <div className="relative w-full sm:w-96">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={approvalSearchTerm}
                  onChange={(e) => setApprovalSearchTerm(e.target.value)}
                  placeholder="Search by ID, user, approver, compliance tag or notes..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs text-slate-500 font-medium">Status Filter:</span>
                  <select
                    value={approvalStatusFilter}
                    onChange={(e) => setApprovalStatusFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="ALL">All Decision Statuses</option>
                    <option value="APPROVED">APPROVED Only</option>
                    <option value="REJECTED">REJECTED Only</option>
                    <option value="MODIFIED">MODIFIED (Role Elevation)</option>
                    <option value="SUSPENDED">SUSPENDED Only</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Approval Audit Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Record ID & Timestamp</th>
                    <th className="py-3.5 px-4">Target User Identity</th>
                    <th className="py-3.5 px-4">Action & Role</th>
                    <th className="py-3.5 px-4">Authorized Approver</th>
                    <th className="py-3.5 px-4">Compliance Control</th>
                    <th className="py-3.5 px-4">Rationale & Policy Notes</th>
                    <th className="py-3.5 px-4 text-right">Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {filteredApprovalRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <ClipboardList className="w-10 h-10 mx-auto text-slate-400 mb-2 opacity-50" />
                        <p className="font-semibold">No approval audit logs match your search.</p>
                        <p className="text-xs text-slate-400 mt-1">Try adjusting your search criteria or decision filter.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredApprovalRecords.map((rec) => {
                      const dateStr = new Date(rec.timestamp).toLocaleString();

                      return (
                        <tr key={rec.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          
                          {/* ID & Timestamp */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <p className="font-mono font-bold text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                                <Fingerprint className="w-3.5 h-3.5 text-emerald-500" />
                                <span>{rec.id}</span>
                              </p>
                              <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{dateStr}</span>
                              </p>
                            </div>
                          </td>

                          {/* Target User */}
                          <td className="py-3.5 px-4">
                            <div>
                              <p className="font-bold text-slate-900 dark:text-slate-100">{rec.targetUserName}</p>
                              <p className="text-[11px] font-mono text-slate-500">{rec.targetUserEmail}</p>
                            </div>
                          </td>

                          {/* Action & Role */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase inline-flex items-center gap-1 ${
                                rec.status === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                                  : rec.status === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300'
                                  : rec.status === 'MODIFIED'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300'
                              }`}>
                                {rec.actionType === 'APPROVE' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                                {rec.actionType === 'REJECT' && <XCircle className="w-3 h-3 text-rose-500" />}
                                {rec.actionType === 'ROLE_CHANGE' && <Shield className="w-3 h-3 text-purple-500" />}
                                <span>{rec.actionType}</span>
                              </span>

                              <p className="text-[10px] text-slate-500 font-mono">
                                Role: <span className="font-bold text-slate-800 dark:text-slate-200">{rec.assignedRole}</span>
                              </p>
                            </div>
                          </td>

                          {/* Authorized Approver */}
                          <td className="py-3.5 px-4">
                            <div>
                              <p className="font-semibold text-slate-800 dark:text-slate-200">{rec.approvedBy}</p>
                              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono uppercase">
                                {rec.approverRole || 'SUPER_ADMIN'}
                              </p>
                            </div>
                          </td>

                          {/* Compliance Control */}
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[10px]">
                              {rec.complianceTag}
                            </span>
                          </td>

                          {/* Rationale & Policy Notes */}
                          <td className="py-3.5 px-4 max-w-xs">
                            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                              {rec.rationaleNotes}
                            </p>
                          </td>

                          {/* Evidence Button */}
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => setInspectingApprovalRecord(rec)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold text-[11px] border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1 ml-auto cursor-pointer"
                              title="Inspect full cryptographic audit evidence & verification hash"
                            >
                              <Fingerprint className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Evidence</span>
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
        </div>
      )}

          {/* VIEW MODE 2: SCIM 2.0 PROVISIONING LOGS */}
          {logsViewMode === 'SCIM_PROVISIONING' && (
            <div className="space-y-8 animate-fadeIn">
              {/* KPI Cards for SCIM Provisioning Logs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total SCIM Events</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalScimCount}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Azure Entra ID Sync Calls</p>
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl text-emerald-600 dark:text-emerald-400">
                    <FileText className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Success Rate</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {totalScimCount > 0 ? `${Math.round((scimSuccessCount / totalScimCount) * 100)}%` : '100%'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">HTTP 200 / 201 Responses</p>
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Standard Protocol</p>
                    <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">RFC 7644</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">SCIM 2.0 REST Ingress</p>
                  </div>
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <Code className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Synced Directory</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{provisionedUsers.length}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Active Provisioned Identities</p>
                  </div>
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/60 rounded-xl text-purple-600 dark:text-purple-400">
                    <Users className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* SCIM Filter and Search Bar */}
              <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative w-full sm:w-96">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={scimSearchTerm}
                    onChange={(e) => setScimSearchTerm(e.target.value)}
                    placeholder="Search SCIM logs by action, endpoint, user, details..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {scimSearchTerm && (
                    <button
                      onClick={() => setScimSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs text-slate-500 font-medium">Method Filter:</span>
                    <select
                      value={scimMethodFilter}
                      onChange={(e) => setScimMethodFilter(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                    >
                      <option value="ALL">All HTTP Methods</option>
                      <option value="GET">GET Requests</option>
                      <option value="POST">POST (Create / Provision)</option>
                      <option value="PATCH">PATCH (Update / Role Sync)</option>
                      <option value="PUT">PUT (Replace)</option>
                      <option value="DELETE">DELETE (Deprovision)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SCIM Logs Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3.5 px-4">Timestamp & Protocol</th>
                        <th className="py-3.5 px-4">HTTP Method & Path</th>
                        <th className="py-3.5 px-4">Status Code</th>
                        <th className="py-3.5 px-4">SCIM Action Category</th>
                        <th className="py-3.5 px-4">Target Identity & Details</th>
                        <th className="py-3.5 px-4 text-right">Inspect Payload</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                      {filteredScimLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <FileText className="w-8 h-8 opacity-40" />
                              <p className="text-sm font-semibold">No SCIM provisioning logs match criteria.</p>
                              <p className="text-xs text-slate-500">
                                SCIM events from Azure AD synchronization are recorded here automatically.
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredScimLogs.map((log) => {
                          const methodColor =
                            log.method === 'POST'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : log.method === 'PATCH'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                              : log.method === 'DELETE'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                              : log.method === 'PUT'
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';

                          const statusBadgeColor =
                            log.statusCode >= 200 && log.statusCode < 300
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : log.statusCode >= 400 && log.statusCode < 500
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';

                          return (
                            <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                              {/* Timestamp */}
                              <td className="py-3.5 px-4">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 font-mono font-bold">
                                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-mono">
                                    {new Date(log.timestamp).toLocaleDateString()}
                                  </p>
                                </div>
                              </td>

                              {/* HTTP Method & Path */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold border uppercase ${methodColor}`}>
                                    {log.method}
                                  </span>
                                  <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                                    {log.endpoint}
                                  </span>
                                </div>
                              </td>

                              {/* Status Code */}
                              <td className="py-3.5 px-4">
                                <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${statusBadgeColor}`}>
                                  {log.statusCode}
                                </span>
                              </td>

                              {/* Action */}
                              <td className="py-3.5 px-4">
                                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[11px] font-semibold">
                                  {log.action}
                                </span>
                              </td>

                              {/* Details & Target */}
                              <td className="py-3.5 px-4 max-w-sm">
                                <div className="space-y-0.5">
                                  {log.targetUser && (
                                    <p className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1">
                                      <Users className="w-3 h-3 text-indigo-400 shrink-0" />
                                      <span>{log.targetUser}</span>
                                    </p>
                                  )}
                                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                                    {log.details}
                                  </p>
                                </div>
                              </td>

                              {/* Inspect Payload Button */}
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => setInspectingScimLog(log)}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1 ml-auto cursor-pointer"
                                  title="Inspect full SCIM event payload and schema breakdown"
                                >
                                  <Code className="w-3.5 h-3.5 text-emerald-500" />
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
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Provision / Edit User */}
      {(isAddUserOpen || editingUser) && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 animate-scaleIn">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/60 rounded-xl text-emerald-600 dark:text-emerald-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    {editingUser ? 'Edit User Account' : 'Provision New Enterprise IAM User'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingUser ? 'Update display details, roles and department claims' : 'Create a new user entry in the IAM Directory'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddUserOpen(false);
                  setEditingUser(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formDisplayName}
                    onChange={(e) => setFormDisplayName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email / UPN Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="e.g. alex.morgan@enterprise.local"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Assigned Application Role (RBAC) *
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium"
                  >
                    {loadCustomRoles().map((rDef) => (
                      <option key={rDef.id} value={rDef.roleKey}>
                        {rDef.name} ({rDef.roleKey}) - {rDef.permissions.length} RBAC Permissions
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    placeholder="e.g. CyberSecurity / DevOps"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* RBAC Permissions Live Preview Card */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-purple-500" />
                    <span>Associated RBAC Permissions</span>
                  </span>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono font-bold bg-purple-50 dark:bg-purple-950/80 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                    {getEffectivePermissionsForRole(formRole).length} Active Permissions
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {loadCustomRoles().find((r) => r.roleKey === formRole)?.description || 'Configured RBAC role permissions matrix.'}
                </p>
                <div className="flex flex-wrap gap-1 pt-1 max-h-24 overflow-y-auto">
                  {getEffectivePermissionsForRole(formRole).map((perm) => (
                    <span key={perm} className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-[10px] font-mono">
                      {perm}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Lead AppSec Auditor"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Group Claims (Comma Separated)
                  </label>
                  <input
                    type="text"
                    value={formGroups}
                    onChange={(e) => setFormGroups(e.target.value)}
                    placeholder="e.g. AppSec-Engineers, CyberSecurity-Leads"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Account Active (Enable access permissions)</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddUserOpen(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md"
                >
                  {editingUser ? 'Save Changes' : 'Provision Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Raw SCIM JSON Inspector */}
      {inspectingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 font-mono text-xs animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Code className="w-4 h-4" />
                <span>SCIM v2.0 Enterprise User Schema JSON - {inspectingUser.displayName}</span>
              </div>
              <button
                type="button"
                onClick={() => setInspectingUser(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <pre className="bg-slate-950 p-4 rounded-xl text-slate-200 max-h-96 overflow-y-auto border border-slate-800 text-[11px] leading-relaxed">
              {JSON.stringify(
                {
                  schemas: [
                    'urn:ietf:params:scim:schemas:core:2.0:User',
                    'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'
                  ],
                  id: inspectingUser.id,
                  userName: inspectingUser.userName,
                  displayName: inspectingUser.displayName,
                  name: {
                    givenName: inspectingUser.givenName,
                    familyName: inspectingUser.familyName
                  },
                  emails: [{ value: inspectingUser.email, primary: true }],
                  active: inspectingUser.active !== false && inspectingUser.iamStatus !== 'SUSPENDED',
                  groups: inspectingUser.groups || [],
                  'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User': {
                    department: inspectingUser.department || 'InfoSec',
                    title: inspectingUser.title || 'Engineer',
                    mappedRole: inspectingUser.mappedRole
                  },
                  meta: {
                    resourceType: 'User',
                    created: inspectingUser.addedToIamAt || inspectingUser.lastSyncedAt,
                    lastModified: inspectingUser.lastSyncedAt,
                    location: `/api/scim/v2/Users/${inspectingUser.id}`
                  }
                },
                null,
                2
              )}
            </pre>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setInspectingUser(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Record New Access Approval Review Entry */}
      {isAddApprovalModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 animate-scaleIn">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-100 dark:bg-purple-950/60 rounded-xl text-purple-600 dark:text-purple-400">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    Record Access Approval Audit Entry
                  </h3>
                  <p className="text-xs text-slate-500">
                    Log an out-of-band access sign-off or manual governance review
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddApprovalModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualApprovalRecord} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Target User Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTargetName}
                    onChange={(e) => setNewTargetName(e.target.value)}
                    placeholder="e.g. Jordan Vance"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Target Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={newTargetEmail}
                    onChange={(e) => setNewTargetEmail(e.target.value)}
                    placeholder="e.g. jvance@contoso.com"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Action Type *
                  </label>
                  <select
                    value={newActionType}
                    onChange={(e) => setNewActionType(e.target.value as AccessApprovalActionType)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="APPROVE">APPROVE (Grant Access)</option>
                    <option value="REJECT">REJECT (Deny Request)</option>
                    <option value="ROLE_CHANGE">ROLE_CHANGE (Role Elevation)</option>
                    <option value="SUSPEND">SUSPEND (Revoke Access)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Assigned Role *
                  </label>
                  <select
                    value={newAssignedRole}
                    onChange={(e) => setNewAssignedRole(e.target.value as UserRole)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="APPSEC_ADMIN">AppSec Admin</option>
                    <option value="IT_VIEWER">IT Viewer</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Compliance Control Tag
                </label>
                <select
                  value={newComplianceTag}
                  onChange={(e) => setNewComplianceTag(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                >
                  <option value="SOC2-CC6.1-ACCESS-AUTHORIZATION">SOC2 CC6.1 - Access Authorization</option>
                  <option value="ISO27001-A.9.2.2-USER-PROVISIONING">ISO 27001 A.9.2.2 - User Provisioning</option>
                  <option value="NIST-800-53-AC-2">NIST SP 800-53 AC-2 - Account Management</option>
                  <option value="HIPAA-164.312-TERMINATION">HIPAA 164.312 - Termination & Access Control</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Rationale & Policy Notes *
                </label>
                <textarea
                  required
                  rows={3}
                  value={newRationale}
                  onChange={(e) => setNewRationale(e.target.value)}
                  placeholder="Provide approval reason, background check verification, or security ticket reference..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddApprovalModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md flex items-center gap-2"
                >
                  <Fingerprint className="w-4 h-4" />
                  <span>Generate Auditable Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Evidence & Cryptographic Verification Fingerprint Inspector */}
      {inspectingApprovalRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 animate-scaleIn text-white">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-950 text-emerald-400 border border-emerald-500/30 rounded-xl">
                  <Fingerprint className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                    <span>Cryptographic Audit Evidence Certificate</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/40">
                      VERIFIED
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Record ID: {inspectingApprovalRecord.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingApprovalRecord(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Target User Identity</span>
                <p className="font-bold text-slate-200">{inspectingApprovalRecord.targetUserName}</p>
                <p className="font-mono text-slate-400 text-[11px]">{inspectingApprovalRecord.targetUserEmail}</p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Authorizing Approver</span>
                <p className="font-bold text-slate-200">{inspectingApprovalRecord.approvedBy}</p>
                <p className="font-mono text-indigo-400 text-[11px] uppercase">{inspectingApprovalRecord.approverRole || 'SUPER_ADMIN'}</p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Action & Decision</span>
                <p className="font-bold text-slate-200 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 font-extrabold text-[10px]">
                    {inspectingApprovalRecord.actionType}
                  </span>
                  <span>• Role: {inspectingApprovalRecord.assignedRole}</span>
                </p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Compliance Tag</span>
                <p className="font-mono text-emerald-400 text-[11px]">{inspectingApprovalRecord.complianceTag}</p>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Justification & Policy Rationale</span>
              <p className="text-xs text-slate-200 italic leading-relaxed">
                "{inspectingApprovalRecord.rationaleNotes}"
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 font-mono text-[11px]">
              <div className="flex items-center justify-between text-slate-400">
                <span>Tamper-Evident HMAC Verification Fingerprint</span>
                <span className="text-emerald-400 text-[10px]">SHA-256 HMAC</span>
              </div>
              <div className="p-2.5 bg-slate-900 rounded-lg text-emerald-300 font-bold break-all border border-slate-800">
                {inspectingApprovalRecord.verificationHash}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-slate-500 font-mono">
                Timestamp: {new Date(inspectingApprovalRecord.timestamp).toISOString()}
              </span>
              <button
                type="button"
                onClick={() => setInspectingApprovalRecord(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-xs cursor-pointer"
              >
                Close Certificate
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 5: Inspect SCIM Provisioning Log Payload */}
      {inspectingScimLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 text-white animate-scaleIn max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-950 text-emerald-400 border border-emerald-500/30 rounded-xl">
                  <Code className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                    <span>SCIM 2.0 Ingress Event Payload</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/40">
                      RFC 7644
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Log ID: {inspectingScimLog.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingScimLog(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Action & Endpoint</span>
                <p className="font-bold text-slate-200">{inspectingScimLog.action}</p>
                <p className="font-mono text-emerald-400 text-[11px]">{inspectingScimLog.method} {inspectingScimLog.endpoint}</p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Status & Timestamp</span>
                <p className="font-bold text-slate-200">HTTP {inspectingScimLog.statusCode}</p>
                <p className="font-mono text-slate-400 text-[11px]">{new Date(inspectingScimLog.timestamp).toLocaleString()}</p>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Event Details</span>
              <p className="text-xs text-slate-200 leading-relaxed font-mono">
                {inspectingScimLog.details}
              </p>
            </div>

            {inspectingScimLog.payload && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Parsed SCIM Request / Response Payload</span>
                <pre className="text-[11px] font-mono text-emerald-300 bg-slate-900 p-3 rounded-lg overflow-x-auto max-h-60">
                  {typeof inspectingScimLog.payload === 'object'
                    ? JSON.stringify(inspectingScimLog.payload, null, 2)
                    : inspectingScimLog.payload}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setInspectingScimLog(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-xs cursor-pointer"
              >
                Close Payload Inspector
              </button>
            </div>

          </div>
        </div>
      )}

      {/* VIEW TAB 3: AZURE AD SSO CONFIGURATION & GUIDE */}
      {activeTab === 'AZURE_SSO' && (
        <div className="animate-fadeIn">
          <SsoScimView
            initialSubTab="azure-config"
            hideTabsBar={true}
            hideHeaderBanner={false}
            ssoConfig={ssoConfig || internalSsoConfig}
            onUpdateSsoConfig={(cfg) => {
              setInternalSsoConfig(cfg);
              saveSsoConfig(cfg);
              onUpdateSsoConfig?.(cfg);
            }}
            scimConfig={scimConfig || internalScimConfig}
            onUpdateScimConfig={(cfg) => {
              setInternalScimConfig(cfg);
              saveScimConfig(cfg);
              onUpdateScimConfig?.(cfg);
            }}
            groupMappings={groupMappings || internalGroupMappings}
            onUpdateGroupMappings={(mappings) => {
              setInternalGroupMappings(mappings);
              saveGroupMappings(mappings);
              onUpdateGroupMappings?.(mappings);
            }}
            manualMappings={manualMappings || internalManualMappings}
            onUpdateManualMappings={(mappings) => {
              setInternalManualMappings(mappings);
              saveManualUserMappings(mappings);
              onUpdateManualMappings?.(mappings);
            }}
            provisionedUsers={provisionedUsers}
            onUpdateUsers={onUpdateUsers}
            scimLogs={scimLogs || internalScimLogs}
            onRefreshLogs={() => {
              onRefreshLogs();
              setInternalScimLogs(loadScimAuditLogs());
            }}
            activeSsoUser={activeSsoUser}
            onOpenAzureLogin={onOpenAzureLogin}
            onRoleChange={onRoleChange}
          />
        </div>
      )}

      {/* VIEW TAB 4: GROUP-TO-ROLE MAPPINGS */}
      {activeTab === 'GROUP_MAPPINGS' && (
        <div className="animate-fadeIn">
          <SsoScimView
            initialSubTab="mappings"
            hideTabsBar={true}
            hideHeaderBanner={false}
            ssoConfig={ssoConfig || internalSsoConfig}
            onUpdateSsoConfig={(cfg) => {
              setInternalSsoConfig(cfg);
              saveSsoConfig(cfg);
              onUpdateSsoConfig?.(cfg);
            }}
            scimConfig={scimConfig || internalScimConfig}
            onUpdateScimConfig={(cfg) => {
              setInternalScimConfig(cfg);
              saveScimConfig(cfg);
              onUpdateScimConfig?.(cfg);
            }}
            groupMappings={groupMappings || internalGroupMappings}
            onUpdateGroupMappings={(mappings) => {
              setInternalGroupMappings(mappings);
              saveGroupMappings(mappings);
              onUpdateGroupMappings?.(mappings);
            }}
            manualMappings={manualMappings || internalManualMappings}
            onUpdateManualMappings={(mappings) => {
              setInternalManualMappings(mappings);
              saveManualUserMappings(mappings);
              onUpdateManualMappings?.(mappings);
            }}
            provisionedUsers={provisionedUsers}
            onUpdateUsers={onUpdateUsers}
            scimLogs={scimLogs || internalScimLogs}
            onRefreshLogs={() => {
              onRefreshLogs();
              setInternalScimLogs(loadScimAuditLogs());
            }}
            activeSsoUser={activeSsoUser}
            onOpenAzureLogin={onOpenAzureLogin}
            onRoleChange={onRoleChange}
          />
        </div>
      )}

    </div>
  );
};
