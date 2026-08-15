import {
  SsoConfig,
  ScimConfig,
  ScimGroupMapping,
  ManualUserRoleMapping,
  ProvisionedUser,
  ScimAuditLog,
  ActiveSsoUser,
  UserRole,
  CustomRoleDefinition,
  PermissionKey,
  BearerJwtPayload,
  AccessApprovalRecord,
  AccessApprovalActionType
} from '../types';
import appSettings from '../../appsettings.json';

const STORAGE_KEYS = {
  SSO_CONFIG: 'appsec_azure_sso_config',
  SCIM_CONFIG: 'appsec_scim_config',
  GROUP_MAPPINGS: 'appsec_scim_group_mappings',
  MANUAL_USER_MAPPINGS: 'appsec_manual_user_mappings',
  PROVISIONED_USERS: 'appsec_scim_provisioned_users',
  SCIM_LOGS: 'appsec_scim_audit_logs',
  ACTIVE_SSO_USER: 'appsec_active_sso_user',
  CUSTOM_RBAC_ROLES: 'appsec_custom_rbac_roles',
  ACCESS_APPROVAL_RECORDS: 'appsec_access_approval_records'
};

export const DEFAULT_SSO_CONFIG: SsoConfig = {
  tenantId: appSettings.AzureAd?.TenantId || '2c7d678a-3080-4d64-a967-67f2da6d3cae',
  clientId: appSettings.AzureAd?.ClientId || '02445d57-57c8-4b45-99fe-a32ef97f7bdb',
  clientSecret: appSettings.AzureAd?.ClientSecret || 'YOUR_AZURE_CLIENT_SECRET_PLACEHOLDER',
  redirectUri: typeof window !== 'undefined' ? `${window.location.origin}/api/sso/azure/callback` : (appSettings.AzureAd?.RedirectUri || '/api/sso/azure/callback'),
  scopes: appSettings.AzureAd?.Scopes || 'openid profile email User.Read Directory.Read.All',
  ssoMode: (appSettings.AzureAd?.SsoMode as any) || 'LIVE_OIDC',
  enforceSso: appSettings.AzureAd?.EnforceSso ?? false,
  loginUrl: appSettings.AzureAd?.LoginUrl || `https://login.microsoftonline.com/${appSettings.AzureAd?.TenantId || '2c7d678a-3080-4d64-a967-67f2da6d3cae'}/oauth2/v2.0/authorize`,
  tokenUrl: appSettings.AzureAd?.TokenUrl || `https://login.microsoftonline.com/${appSettings.AzureAd?.TenantId || '2c7d678a-3080-4d64-a967-67f2da6d3cae'}/oauth2/v2.0/token`,
  issuerUrl: appSettings.AzureAd?.IssuerUrl || `https://login.microsoftonline.com/${appSettings.AzureAd?.TenantId || '2c7d678a-3080-4d64-a967-67f2da6d3cae'}/v2.0`,
  jwksUri: appSettings.AzureAd?.JwksUri || `https://login.microsoftonline.com/${appSettings.AzureAd?.TenantId || '2c7d678a-3080-4d64-a967-67f2da6d3cae'}/discovery/v2.0/keys`
};

export const DEFAULT_SCIM_CONFIG: ScimConfig = {
  baseUrl: typeof window !== 'undefined' ? `${window.location.origin}/api/scim/v2` : (appSettings.Scim?.BaseUrl || '/api/scim/v2'),
  secretToken: appSettings.Scim?.SecretToken || 'scim_sec_azure_entra_appsec_984123891723',
  enabled: appSettings.Scim?.Enabled ?? false,
  defaultRole: (appSettings.Scim?.DefaultRole as any) || 'APPSEC_ADMIN',
  requireBearerAuth: appSettings.Scim?.RequireBearerAuth ?? true,
  requireAdminApproval: true
};

export const DEFAULT_MANUAL_USER_MAPPINGS: ManualUserRoleMapping[] = [
  {
    id: 'MAN-1001',
    emailOrUpn: 'admin@enterprise.local',
    assignedRole: 'APPSEC_ADMIN',
    notes: 'Default AppSec Administrator override for primary enterprise admin account',
    createdAt: new Date().toISOString(),
    updatedBy: 'System Default',
    updatedAt: new Date().toISOString()
  }
];

export const DEFAULT_GROUP_MAPPINGS: ScimGroupMapping[] = [
  {
    id: 'MAP-1001',
    azureGroupOrRoleName: 'AppSec-Engineers',
    azureGroupId: 'b19e2e10-9112-4f3b-8280-9900223a1099',
    appRole: 'APPSEC_ADMIN',
    description: 'Grants full CRUD AppSec Admin permissions to members of Azure AD Security Group AppSec-Engineers',
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
  },
  {
    id: 'MAP-1002',
    azureGroupOrRoleName: 'CyberSecurity-Leads',
    azureGroupId: 'c44e9912-8821-4c12-9122-1100223a4411',
    appRole: 'APPSEC_ADMIN',
    description: 'Grants full CRUD AppSec Admin permissions to CyberSecurity Lead Role in Azure Entra ID',
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString()
  },
  {
    id: 'MAP-1003',
    azureGroupOrRoleName: 'IT-Operations-Viewers',
    azureGroupId: 'd88f1122-3344-5566-7788-9900aabbccdd',
    appRole: 'IT_VIEWER',
    description: 'Grants Read-Only Viewer permissions to IT Operations staff',
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString()
  },
  {
    id: 'MAP-1004',
    azureGroupOrRoleName: 'SOC-Analyst-Auditor',
    azureGroupId: 'e99a0011-2233-4455-6677-889900aabbcc',
    appRole: 'IT_VIEWER',
    description: 'Grants Read-Only Viewer permissions to SOC Security Analysts',
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString()
  }
];

export const INITIAL_PROVISIONED_USERS: ProvisionedUser[] = [
  {
    id: 'az-usr-1001',
    userName: 'sjenkins@contoso.com',
    displayName: 'Sarah Jenkins',
    givenName: 'Sarah',
    familyName: 'Jenkins',
    email: 'sjenkins@contoso.com',
    active: true,
    groups: ['AppSec-Engineers', 'CyberSecurity-Leads'],
    mappedRole: 'APPSEC_ADMIN',
    lastSyncedAt: new Date().toISOString(),
    syncedVia: 'IAM_DIRECTORY',
    department: 'InfoSec',
    title: 'Lead Application Security Engineer',
    iamStatus: 'ACTIVE',
    addedToIamAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    addedByIamAdmin: 'AppSec Governance Admin',
    approvalStatus: 'APPROVED',
    approvedBy: 'AppSec Governance Admin',
    approvedAt: new Date(Date.now() - 30 * 86400000).toISOString()
  },
  {
    id: 'az-usr-1002',
    userName: 'admin@enterprise.local',
    displayName: 'Primary Enterprise Admin',
    givenName: 'AppSec',
    familyName: 'Admin',
    email: 'admin@enterprise.local',
    active: true,
    groups: ['AppSec-Engineers', 'Global-Security-Admins'],
    mappedRole: 'APPSEC_ADMIN',
    lastSyncedAt: new Date().toISOString(),
    syncedVia: 'IAM_DIRECTORY',
    department: 'Cybersecurity',
    title: 'Enterprise Security Director',
    iamStatus: 'ACTIVE',
    addedToIamAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    addedByIamAdmin: 'System Provisioning Engine',
    approvalStatus: 'APPROVED',
    approvedBy: 'System Provisioning Engine',
    approvedAt: new Date(Date.now() - 60 * 86400000).toISOString()
  },
  {
    id: 'az-usr-1003',
    userName: 'dchen@contoso.com',
    displayName: 'David Chen',
    givenName: 'David',
    familyName: 'Chen',
    email: 'dchen@contoso.com',
    active: true,
    groups: ['IT-Operations-Viewers'],
    mappedRole: 'IT_VIEWER',
    lastSyncedAt: new Date().toISOString(),
    syncedVia: 'IAM_DIRECTORY',
    department: 'IT Infrastructure',
    title: 'Senior IT Specialist',
    iamStatus: 'ACTIVE',
    addedToIamAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    addedByIamAdmin: 'AppSec Governance Admin',
    approvalStatus: 'APPROVED',
    approvedBy: 'AppSec Governance Admin',
    approvedAt: new Date(Date.now() - 20 * 86400000).toISOString()
  },
  {
    id: 'az-usr-1004',
    userName: 'arivera@contoso.com',
    displayName: 'Alex Rivera',
    givenName: 'Alex',
    familyName: 'Rivera',
    email: 'arivera@contoso.com',
    active: true,
    groups: ['SOC-Analyst-Auditor'],
    mappedRole: 'IT_VIEWER',
    lastSyncedAt: new Date().toISOString(),
    syncedVia: 'IAM_DIRECTORY',
    department: 'Compliance & Audit',
    title: 'SOC Auditor',
    iamStatus: 'ACTIVE',
    addedToIamAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    addedByIamAdmin: 'AppSec Governance Admin',
    approvalStatus: 'APPROVED',
    approvedBy: 'AppSec Governance Admin',
    approvedAt: new Date(Date.now() - 15 * 86400000).toISOString()
  },
  {
    id: 'az-usr-1005',
    userName: 'mross@contoso.com',
    displayName: 'Mark Ross',
    givenName: 'Mark',
    familyName: 'Ross',
    email: 'mross@contoso.com',
    active: false,
    groups: ['AppSec-Engineers'],
    mappedRole: 'APPSEC_ADMIN',
    lastSyncedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    syncedVia: 'AZURE_SSO',
    department: 'DevSecOps',
    title: 'Cloud Security Systems Engineer',
    iamStatus: 'SUSPENDED',
    approvalStatus: 'PENDING_APPROVAL'
  },
  {
    id: 'az-usr-1006',
    userName: 'mvance@contoso.com',
    displayName: 'Marcus Vance',
    givenName: 'Marcus',
    familyName: 'Vance',
    email: 'mvance@contoso.com',
    active: false,
    groups: ['IT-Operations-Viewers'],
    mappedRole: 'IT_VIEWER',
    lastSyncedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    syncedVia: 'SCIM_2.0',
    department: 'Network Operations',
    title: 'NOC Lead Analyst',
    iamStatus: 'SUSPENDED',
    approvalStatus: 'PENDING_APPROVAL'
  }
];

export const INITIAL_SCIM_LOGS: ScimAuditLog[] = [];

export interface IamVerificationResult {
  isAddedInIam: boolean;
  userEmail: string;
  matchedSource?: 'PROVISIONED_DIRECTORY' | 'MANUAL_OVERRIDE' | 'SUPER_ADMIN';
  assignedRole: UserRole;
  displayName?: string;
  department?: string;
  title?: string;
  groups?: string[];
  matchedUser?: ProvisionedUser | ManualUserRoleMapping;
  denyReason?: string;
}

// Verify if an OIDC authenticated user identity has been added to IAM or auto-provisioned via OIDC
export function verifyIamMembership(
  emailOrUpn: string,
  manualMappings: ManualUserRoleMapping[] = DEFAULT_MANUAL_USER_MAPPINGS,
  provisionedUsers: ProvisionedUser[] = INITIAL_PROVISIONED_USERS,
  scimConfig?: ScimConfig,
  groupMappings: ScimGroupMapping[] = DEFAULT_GROUP_MAPPINGS,
  oidcGroups: string[] = [],
  oidcDisplayName?: string
): IamVerificationResult {
  if (!emailOrUpn || !emailOrUpn.trim()) {
    return {
      isAddedInIam: false,
      userEmail: '',
      assignedRole: 'IT_VIEWER',
      denyReason: 'Access Denied: Missing user email identity claim in OIDC token.'
    };
  }

  const cleanEmail = emailOrUpn.trim().toLowerCase();

  // 1. Super Admin / Emergency Break-Glass Exemption
  if (
    cleanEmail === 'superadmin@enterprise.local' ||
    cleanEmail === 'superadmin@local.internal' ||
    cleanEmail === 'superadmin'
  ) {
    return {
      isAddedInIam: true,
      userEmail: cleanEmail,
      matchedSource: 'SUPER_ADMIN',
      assignedRole: 'SUPER_ADMIN',
      displayName: 'Emergency Super Admin',
      groups: ['Global-Administrators', 'AppSec-Admins']
    };
  }

  // 2. Check Manual Role Mapping Overrides in IAM
  const manualMatch = manualMappings.find(
    (m) => m.emailOrUpn.trim().toLowerCase() === cleanEmail
  );
  if (manualMatch) {
    if (manualMatch.iamStatus === 'SUSPENDED') {
      return {
        isAddedInIam: false,
        userEmail: cleanEmail,
        assignedRole: 'IT_VIEWER',
        denyReason: `Access Denied: User account '${cleanEmail}' exists in IAM manual overrides but is set to SUSPENDED status.`
      };
    }
    return {
      isAddedInIam: true,
      userEmail: cleanEmail,
      matchedSource: 'MANUAL_OVERRIDE',
      assignedRole: manualMatch.assignedRole,
      displayName: oidcDisplayName || cleanEmail.split('@')[0].replace('.', ' '),
      groups: oidcGroups.length > 0 ? oidcGroups : ['AppSec-Engineers'],
      matchedUser: manualMatch
    };
  }

  // 3. Check SCIM Provisioned Directory / IAM Users
  const effectiveUsers = (provisionedUsers && provisionedUsers.length > 0)
    ? provisionedUsers
    : INITIAL_PROVISIONED_USERS;

  const provisionedMatch = effectiveUsers.find(
    (u) =>
      (u.email && u.email.trim().toLowerCase() === cleanEmail) ||
      (u.userName && u.userName.trim().toLowerCase() === cleanEmail)
  );

  if (provisionedMatch) {
    if (provisionedMatch.approvalStatus === 'PENDING_APPROVAL') {
      return {
        isAddedInIam: false,
        userEmail: cleanEmail,
        assignedRole: 'IT_VIEWER',
        denyReason: `Access Denied: Account '${cleanEmail}' provisioned from Azure AD is PENDING_APPROVAL by an AppSec Administrator.`
      };
    }

    if (provisionedMatch.approvalStatus === 'REJECTED') {
      return {
        isAddedInIam: false,
        userEmail: cleanEmail,
        assignedRole: 'IT_VIEWER',
        denyReason: `Access Denied: Provisioned access request for '${cleanEmail}' was REJECTED by an AppSec Administrator.`
      };
    }

    if (!provisionedMatch.active || provisionedMatch.iamStatus === 'SUSPENDED') {
      return {
        isAddedInIam: false,
        userEmail: cleanEmail,
        assignedRole: 'IT_VIEWER',
        denyReason: `Access Denied: User account '${cleanEmail}' exists in IAM but is currently SUSPENDED / DEACTIVATED.`
      };
    }

    // Determine final role based on SCIM group mappings or user record
    const effectiveGroups = oidcGroups.length > 0 ? oidcGroups : provisionedMatch.groups;
    const role = calculateRoleForSsoUser(
      cleanEmail,
      effectiveGroups,
      scimConfig?.enabled ?? false,
      manualMappings,
      groupMappings,
      provisionedMatch.mappedRole || scimConfig?.defaultRole || 'APPSEC_ADMIN'
    );

    return {
      isAddedInIam: true,
      userEmail: cleanEmail,
      matchedSource: 'PROVISIONED_DIRECTORY',
      assignedRole: role,
      displayName: oidcDisplayName || provisionedMatch.displayName,
      department: provisionedMatch.department || 'Microsoft Entra ID Unit',
      title: provisionedMatch.title || 'OIDC Authenticated Specialist',
      groups: effectiveGroups,
      matchedUser: provisionedMatch
    };
  }

  // 4. OIDC SSO Auto-Provisioning & Authorization (Data originates from OIDC)
  const effectiveGroups = oidcGroups.length > 0 ? oidcGroups : ['AppSec-Engineers'];
  const role = calculateRoleForSsoUser(
    cleanEmail,
    effectiveGroups,
    scimConfig?.enabled ?? false,
    manualMappings,
    groupMappings,
    scimConfig?.defaultRole ?? 'APPSEC_ADMIN'
  );

  const formattedName = oidcDisplayName || cleanEmail.split('@')[0].replace('.', ' ').replace(/(^\w|\s\w)/g, m => m.toUpperCase());

  const requiresApproval = scimConfig?.requireAdminApproval ?? true;

  const autoProvisionedUser: ProvisionedUser = {
    id: `az-usr-${Math.floor(1000 + Math.random() * 9000)}`,
    userName: cleanEmail,
    displayName: formattedName,
    givenName: formattedName.split(' ')[0] || formattedName,
    familyName: formattedName.split(' ')[1] || '',
    email: cleanEmail,
    active: !requiresApproval,
    groups: effectiveGroups,
    mappedRole: role,
    lastSyncedAt: new Date().toISOString(),
    syncedVia: 'OIDC_IDP_PROVISIONED',
    department: 'Microsoft Entra ID',
    title: 'OIDC SSO Authenticated User',
    iamStatus: requiresApproval ? 'SUSPENDED' : 'ACTIVE',
    addedToIamAt: new Date().toISOString(),
    addedByIamAdmin: 'Microsoft Entra ID OIDC Provider',
    approvalStatus: requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED',
    approvedBy: requiresApproval ? undefined : 'Auto-Approved Policy'
  };

  if (requiresApproval) {
    return {
      isAddedInIam: false,
      userEmail: cleanEmail,
      assignedRole: role,
      displayName: formattedName,
      department: 'Microsoft Entra ID',
      title: 'OIDC SSO Authenticated User',
      groups: effectiveGroups,
      matchedUser: autoProvisionedUser,
      denyReason: `Access Denied: Azure AD identity '${cleanEmail}' has been provisioned as a Pending Access Request. Administrator approval is required before logging into User Management.`
    };
  }

  return {
    isAddedInIam: true,
    userEmail: cleanEmail,
    matchedSource: 'PROVISIONED_DIRECTORY',
    assignedRole: role,
    displayName: formattedName,
    department: 'Microsoft Entra ID',
    title: 'OIDC SSO Authenticated User',
    groups: effectiveGroups,
    matchedUser: autoProvisionedUser
  };
}

export const DEFAULT_ACTIVE_SSO_USER: ActiveSsoUser = {
  isAuthenticated: false,
  displayName: 'Guest User',
  email: '',
  role: 'IT_VIEWER'
};

// Calculate effective role based on Manual User Mappings -> SCIM Group Mapping -> Default Fallback
export function calculateRoleForSsoUser(
  emailOrUpn: string,
  groups: string[] = [],
  scimEnabled: boolean = false,
  manualMappings: ManualUserRoleMapping[] = DEFAULT_MANUAL_USER_MAPPINGS,
  groupMappings: ScimGroupMapping[] = DEFAULT_GROUP_MAPPINGS,
  defaultRole: UserRole = 'APPSEC_ADMIN'
): UserRole {
  // 1. Check Manual Role Mapping Overrides
  if (emailOrUpn) {
    const targetEmail = emailOrUpn.trim().toLowerCase();
    const manualMatch = manualMappings.find(
      (m) => m.emailOrUpn.trim().toLowerCase() === targetEmail
    );
    if (manualMatch) {
      return manualMatch.assignedRole;
    }
  }

  // 2. Check SCIM Group Rules if SCIM is enabled
  if (scimEnabled && groups && groups.length > 0) {
    return calculateRoleFromAzureGroups(groups, groupMappings, defaultRole);
  }

  // 3. Basic Default Fallback Role
  return defaultRole;
}

// Calculate effective role based on group mapping rules
export function calculateRoleFromAzureGroups(
  groups: string[] = [],
  mappings: ScimGroupMapping[] = DEFAULT_GROUP_MAPPINGS,
  defaultRole: UserRole = 'IT_VIEWER'
): UserRole {
  if (!groups || groups.length === 0) return defaultRole;

  // Check if any group matches a SUPER_ADMIN rule
  const isSuperAdmin = groups.some((grp) => {
    return (
      grp.toLowerCase().includes('super-admin') ||
      grp.toLowerCase().includes('breakglass') ||
      mappings.some(
        (m) =>
          m.appRole === 'SUPER_ADMIN' &&
          (m.azureGroupOrRoleName.toLowerCase() === grp.toLowerCase() ||
            (m.azureGroupId && m.azureGroupId.toLowerCase() === grp.toLowerCase()))
      )
    );
  });

  if (isSuperAdmin) return 'SUPER_ADMIN';

  // Check if any group matches an APPSEC_ADMIN rule
  const isAppSecAdmin = groups.some((grp) => {
    return mappings.some(
      (m) =>
        m.appRole === 'APPSEC_ADMIN' &&
        (m.azureGroupOrRoleName.toLowerCase() === grp.toLowerCase() ||
          (m.azureGroupId && m.azureGroupId.toLowerCase() === grp.toLowerCase()))
    );
  });

  if (isAppSecAdmin) return 'APPSEC_ADMIN';

  // Check if any group matches an IT_VIEWER rule
  const isItViewer = groups.some((grp) => {
    return mappings.some(
      (m) =>
        m.appRole === 'IT_VIEWER' &&
        (m.azureGroupOrRoleName.toLowerCase() === grp.toLowerCase() ||
          (m.azureGroupId && m.azureGroupId.toLowerCase() === grp.toLowerCase()))
    );
  });

  if (isItViewer) return 'IT_VIEWER';

  return defaultRole;
}

// Storage Load & Save Functions
export function loadSsoConfig(): SsoConfig {
  const data = localStorage.getItem(STORAGE_KEYS.SSO_CONFIG);
  if (!data) return DEFAULT_SSO_CONFIG;
  try {
    return { ...DEFAULT_SSO_CONFIG, ...JSON.parse(data) };
  } catch {
    return DEFAULT_SSO_CONFIG;
  }
}

export function saveSsoConfig(config: SsoConfig): void {
  localStorage.setItem(STORAGE_KEYS.SSO_CONFIG, JSON.stringify(config));
}

export function loadScimConfig(): ScimConfig {
  const data = localStorage.getItem(STORAGE_KEYS.SCIM_CONFIG);
  if (!data) return DEFAULT_SCIM_CONFIG;
  try {
    return { ...DEFAULT_SCIM_CONFIG, ...JSON.parse(data) };
  } catch {
    return DEFAULT_SCIM_CONFIG;
  }
}

export function saveScimConfig(config: ScimConfig): void {
  localStorage.setItem(STORAGE_KEYS.SCIM_CONFIG, JSON.stringify(config));
}

export function loadGroupMappings(): ScimGroupMapping[] {
  const data = localStorage.getItem(STORAGE_KEYS.GROUP_MAPPINGS);
  if (!data) return DEFAULT_GROUP_MAPPINGS;
  try {
    return JSON.parse(data);
  } catch {
    return DEFAULT_GROUP_MAPPINGS;
  }
}

export function saveGroupMappings(mappings: ScimGroupMapping[]): void {
  localStorage.setItem(STORAGE_KEYS.GROUP_MAPPINGS, JSON.stringify(mappings));
}

export function loadManualUserMappings(): ManualUserRoleMapping[] {
  const data = localStorage.getItem(STORAGE_KEYS.MANUAL_USER_MAPPINGS);
  if (!data) return DEFAULT_MANUAL_USER_MAPPINGS;
  try {
    return JSON.parse(data);
  } catch {
    return DEFAULT_MANUAL_USER_MAPPINGS;
  }
}

export function saveManualUserMappings(mappings: ManualUserRoleMapping[]): void {
  localStorage.setItem(STORAGE_KEYS.MANUAL_USER_MAPPINGS, JSON.stringify(mappings));
}

export function loadProvisionedUsers(): ProvisionedUser[] {
  const data = localStorage.getItem(STORAGE_KEYS.PROVISIONED_USERS);
  if (!data) return INITIAL_PROVISIONED_USERS;
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_PROVISIONED_USERS;
  }
}

export function saveProvisionedUsers(users: ProvisionedUser[]): void {
  localStorage.setItem(STORAGE_KEYS.PROVISIONED_USERS, JSON.stringify(users));
}

export function loadScimAuditLogs(): ScimAuditLog[] {
  const data = localStorage.getItem(STORAGE_KEYS.SCIM_LOGS);
  if (!data) return INITIAL_SCIM_LOGS;
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_SCIM_LOGS;
  }
}

export function saveScimAuditLogs(logs: ScimAuditLog[]): void {
  localStorage.setItem(STORAGE_KEYS.SCIM_LOGS, JSON.stringify(logs));
}

export function addScimAuditLog(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  endpoint: string,
  statusCode: number,
  action: string,
  details: string,
  targetUserId?: string,
  targetUserName?: string,
  payloadSummary?: string
): ScimAuditLog {
  const currentLogs = loadScimAuditLogs();
  const newLog: ScimAuditLog = {
    id: `SLOG-${Math.floor(1000 + Math.random() * 9000)}`,
    timestamp: new Date().toISOString(),
    method,
    endpoint,
    statusCode,
    action,
    targetUserId,
    targetUserName,
    details,
    payloadSummary
  };
  const updated = [newLog, ...currentLogs].slice(0, 100);
  saveScimAuditLogs(updated);
  return newLog;
}

export const INITIAL_ACCESS_APPROVAL_RECORDS: AccessApprovalRecord[] = [
  {
    id: 'APR-2026-8812',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    targetUserId: 'az-usr-1001',
    targetUserName: 'Sarah Jenkins',
    targetUserEmail: 'sjenkins@contoso.com',
    actionType: 'APPROVE',
    assignedRole: 'APPSEC_ADMIN',
    approvedBy: 'AppSec Governance Admin',
    approverRole: 'SUPER_ADMIN',
    requestSource: 'AZURE_AD_SCIM',
    rationaleNotes: 'Verified Entra ID Security Group claim (AppSec-Engineers) and background clearance. Approved for AppSec Admin access.',
    complianceTag: 'SOC2-CC6.1-ACCESS-AUTHORIZATION',
    verificationHash: 'sig_a9f81e33b00c9921e4d882190',
    status: 'APPROVED'
  },
  {
    id: 'APR-2026-8790',
    timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
    targetUserId: 'az-usr-1004',
    targetUserName: 'Alex Rivera',
    targetUserEmail: 'arivera@contoso.com',
    actionType: 'APPROVE',
    assignedRole: 'IT_VIEWER',
    approvedBy: 'AppSec Governance Admin',
    approverRole: 'APPSEC_ADMIN',
    requestSource: 'OIDC_SSO',
    rationaleNotes: 'Compliance auditor role granted for Q3 SOC2 audit cycle. Read-only application inventory access enabled.',
    complianceTag: 'ISO27001-A.9.2.2-USER-PROVISIONING',
    verificationHash: 'sig_7721b002c91833e4f901233',
    status: 'APPROVED'
  },
  {
    id: 'APR-2026-8650',
    timestamp: new Date(Date.now() - 3600000 * 42).toISOString(),
    targetUserId: 'az-usr-1005',
    targetUserName: 'Mark Ross',
    targetUserEmail: 'mross@contoso.com',
    actionType: 'REJECT',
    assignedRole: 'APPSEC_ADMIN',
    approvedBy: 'AppSec Governance Admin',
    approverRole: 'SUPER_ADMIN',
    requestSource: 'AZURE_AD_SCIM',
    rationaleNotes: 'Access request rejected due to missing 2FA enrollment on Azure AD tenant and unverified manager approval.',
    complianceTag: 'NIST-800-53-AC-2',
    verificationHash: 'sig_338e9104b92110c7a109844',
    status: 'REJECTED'
  },
  {
    id: 'APR-2026-8510',
    timestamp: new Date(Date.now() - 3600000 * 96).toISOString(),
    targetUserId: 'az-usr-1002',
    targetUserName: 'David Chen',
    targetUserEmail: 'dchen@contoso.com',
    actionType: 'ROLE_CHANGE',
    previousRole: 'IT_VIEWER',
    assignedRole: 'APPSEC_ADMIN',
    approvedBy: 'AppSec Governance Admin',
    approverRole: 'SUPER_ADMIN',
    requestSource: 'DIRECTORY_ADMIN',
    rationaleNotes: 'Promoted from IT Viewer to AppSec Admin following transition to Lead Cloud Security Engineer position.',
    complianceTag: 'SOC2-CC6.2-ROLE-ELEVATION',
    verificationHash: 'sig_b882e901a5e3012ff871029',
    status: 'MODIFIED'
  },
  {
    id: 'APR-2026-8420',
    timestamp: new Date(Date.now() - 3600000 * 120).toISOString(),
    targetUserId: 'az-usr-1006',
    targetUserName: 'Marcus Vance',
    targetUserEmail: 'mvance@contoso.com',
    actionType: 'SUSPEND',
    assignedRole: 'IT_VIEWER',
    approvedBy: 'System Security Engine',
    approverRole: 'SYSTEM_BOT',
    requestSource: 'AZURE_AD_SCIM',
    rationaleNotes: 'Account access automatically suspended following SCIM 2.0 active=false assertion from Entra ID identity provider.',
    complianceTag: 'HIPAA-164.312-TERMINATION',
    verificationHash: 'sig_f221e900a3120bc8e912445',
    status: 'SUSPENDED'
  }
];

export function loadAccessApprovalRecords(): AccessApprovalRecord[] {
  if (typeof window === 'undefined') return INITIAL_ACCESS_APPROVAL_RECORDS;
  const data = localStorage.getItem(STORAGE_KEYS.ACCESS_APPROVAL_RECORDS);
  if (!data) return INITIAL_ACCESS_APPROVAL_RECORDS;
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_ACCESS_APPROVAL_RECORDS;
  }
}

export function saveAccessApprovalRecords(records: AccessApprovalRecord[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.ACCESS_APPROVAL_RECORDS, JSON.stringify(records));
}

export function addAccessApprovalRecord(
  targetUser: { id?: string; name: string; email: string },
  actionType: AccessApprovalActionType,
  assignedRole: string,
  approvedBy: string,
  rationaleNotes: string,
  options?: {
    approverRole?: string;
    previousRole?: string;
    requestSource?: 'AZURE_AD_SCIM' | 'OIDC_SSO' | 'MANUAL_PROVISION' | 'DIRECTORY_ADMIN' | 'ACCESS_REQUEST_GATE';
    complianceTag?: string;
    status?: 'APPROVED' | 'REJECTED' | 'MODIFIED' | 'SUSPENDED';
  }
): AccessApprovalRecord {
  const currentRecords = loadAccessApprovalRecords();
  const randId = Math.floor(1000 + Math.random() * 9000);
  const timestamp = new Date().toISOString();

  let recordStatus: 'APPROVED' | 'REJECTED' | 'MODIFIED' | 'SUSPENDED' = options?.status || 'APPROVED';
  if (actionType === 'REJECT') recordStatus = 'REJECTED';
  else if (actionType === 'SUSPEND' || actionType === 'REMOVE') recordStatus = 'SUSPENDED';
  else if (actionType === 'ROLE_CHANGE') recordStatus = 'MODIFIED';

  const complianceTag = options?.complianceTag || (
    actionType === 'APPROVE' ? 'SOC2-CC6.1-ACCESS-AUTHORIZATION' :
    actionType === 'REJECT' ? 'SOC2-CC6.1-REJECTION-POLICY' :
    actionType === 'ROLE_CHANGE' ? 'ISO27001-A.9.2.3-ROLE-MODIFICATION' :
    actionType === 'SUSPEND' ? 'HIPAA-164.312-TERMINATION-CONTROL' : 'SOC2-CC6.1-IAM-POLICY'
  );

  const hashSeed = `${randId}_${targetUser.email}_${actionType}_${timestamp}`;
  const verificationHash = `sig_${btoa(hashSeed).replace(/=/g, '').slice(-16)}_${Date.now()}`;

  const newRecord: AccessApprovalRecord = {
    id: `APR-2026-${randId}`,
    timestamp,
    targetUserId: targetUser.id || `usr-${targetUser.email.split('@')[0]}`,
    targetUserName: targetUser.name,
    targetUserEmail: targetUser.email,
    actionType,
    previousRole: options?.previousRole,
    assignedRole,
    approvedBy: approvedBy || 'AppSec Governance Admin',
    approverRole: options?.approverRole || 'SUPER_ADMIN',
    requestSource: options?.requestSource || 'DIRECTORY_ADMIN',
    rationaleNotes: rationaleNotes || 'Access review decision logged in Enterprise User Management.',
    complianceTag,
    verificationHash,
    status: recordStatus
  };

  const updated = [newRecord, ...currentRecords].slice(0, 200);
  saveAccessApprovalRecords(updated);
  return newRecord;
}

export function exportAccessApprovalRecordsCSV(records: AccessApprovalRecord[]): void {
  if (typeof window === 'undefined' || !records || records.length === 0) return;
  const headers = ['Record ID', 'Timestamp', 'Target Name', 'Target Email', 'Action Type', 'Assigned Role', 'Approver', 'Approver Role', 'Status', 'Compliance Tag', 'Verification Hash', 'Rationale Notes'];
  const rows = records.map((r) => [
    r.id,
    r.timestamp,
    `"${r.targetUserName}"`,
    `"${r.targetUserEmail}"`,
    r.actionType,
    r.assignedRole,
    `"${r.approvedBy}"`,
    r.approverRole || 'SUPER_ADMIN',
    r.status,
    r.complianceTag,
    r.verificationHash,
    `"${(r.rationaleNotes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Access_Management_Approval_Records_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export const ALL_PERMISSIONS: { key: PermissionKey; label: string; description: string; category: string }[] = [
  { key: 'APP_VIEW', label: 'View Applications', description: 'Access and view application inventory and details', category: 'Applications' },
  { key: 'APP_CREATE', label: 'Create Applications', description: 'Register new applications in inventory', category: 'Applications' },
  { key: 'APP_EDIT', label: 'Edit Applications', description: 'Update application details and criticality factors', category: 'Applications' },
  { key: 'APP_DELETE', label: 'Delete Applications', description: 'Decommission or remove applications', category: 'Applications' },
  { key: 'ASSESSMENT_SUBMIT', label: 'Submit Assessments', description: 'Submit self-assessments and criticality reviews', category: 'Governance & SOP' },
  { key: 'ASSESSMENT_APPROVE', label: 'Approve Assessments', description: 'Approve or reject pending criticality reviews', category: 'Governance & SOP' },
  { key: 'SOP_UPLOAD', label: 'Upload SOP Documents', description: 'Upload and revise SOP policy versions', category: 'Governance & SOP' },
  { key: 'EVIDENCE_GENERATE', label: 'Generate Promotion Evidence', description: 'Generate digital evidence and security certificates', category: 'Security & Compliance' },
  { key: 'PROMOTION_GATE_OVERRIDE', label: 'Override Gate Controls', description: 'Bypass or override automated security promotion gates', category: 'Security & Compliance' },
  { key: 'USER_MANAGE', label: 'User Directory Management', description: 'Approve, activate, edit, and suspend users', category: 'Identity & Access' },
  { key: 'RBAC_MANAGE', label: 'Manage RBAC Roles & Mappings', description: 'Create and modify custom roles, permissions, and group mappings', category: 'Identity & Access' },
  { key: 'SSO_SCIM_MANAGE', label: 'SSO & SCIM Configuration', description: 'Modify Azure AD, OIDC, and SCIM endpoint settings', category: 'Identity & Access' },
  { key: 'AUDIT_LOG_VIEW', label: 'Inspect Audit Logs', description: 'View system audit trails and SCIM API logs', category: 'Compliance Audit' }
];

export const DEFAULT_CUSTOM_ROLES: CustomRoleDefinition[] = [
  {
    id: 'ROLE-SUPER-ADMIN',
    roleKey: 'SUPER_ADMIN',
    name: 'Super Administrator',
    description: 'Unrestricted enterprise control across all modules, emergency overrides, and IAM policies.',
    isSystemRole: true,
    permissions: [
      'APP_VIEW', 'APP_CREATE', 'APP_EDIT', 'APP_DELETE',
      'ASSESSMENT_SUBMIT', 'ASSESSMENT_APPROVE', 'SOP_UPLOAD',
      'EVIDENCE_GENERATE', 'PROMOTION_GATE_OVERRIDE',
      'USER_MANAGE', 'RBAC_MANAGE', 'SSO_SCIM_MANAGE', 'AUDIT_LOG_VIEW'
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'System Governance Engine'
  },
  {
    id: 'ROLE-APPSEC-ADMIN',
    roleKey: 'APPSEC_ADMIN',
    name: 'AppSec Administrator',
    description: 'Full application security management, assessment approvals, evidence generation, and user onboarding.',
    isSystemRole: true,
    permissions: [
      'APP_VIEW', 'APP_CREATE', 'APP_EDIT', 'APP_DELETE',
      'ASSESSMENT_SUBMIT', 'ASSESSMENT_APPROVE', 'SOP_UPLOAD',
      'EVIDENCE_GENERATE', 'PROMOTION_GATE_OVERRIDE',
      'USER_MANAGE', 'RBAC_MANAGE', 'SSO_SCIM_MANAGE', 'AUDIT_LOG_VIEW'
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'System Governance Engine'
  },
  {
    id: 'ROLE-IT-VIEWER',
    roleKey: 'IT_VIEWER',
    name: 'IT Read-Only Viewer',
    description: 'Read-only access to application inventory, assessment metrics, and SOP documentation.',
    isSystemRole: true,
    permissions: ['APP_VIEW', 'ASSESSMENT_SUBMIT', 'AUDIT_LOG_VIEW'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'System Governance Engine'
  },
  {
    id: 'ROLE-COMPLIANCE-AUDITOR',
    roleKey: 'COMPLIANCE_AUDITOR',
    name: 'Security & Compliance Auditor',
    description: 'Dedicated auditor role with access to evidence reports, SOP documents, and compliance logs.',
    isSystemRole: false,
    permissions: ['APP_VIEW', 'EVIDENCE_GENERATE', 'AUDIT_LOG_VIEW'],
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    createdBy: 'AppSec Governance Admin'
  }
];

export function loadCustomRoles(): CustomRoleDefinition[] {
  if (typeof window === 'undefined') return DEFAULT_CUSTOM_ROLES;
  const stored = localStorage.getItem(STORAGE_KEYS.CUSTOM_RBAC_ROLES);
  if (!stored) {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_RBAC_ROLES, JSON.stringify(DEFAULT_CUSTOM_ROLES));
    return DEFAULT_CUSTOM_ROLES;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return DEFAULT_CUSTOM_ROLES;
  }
}

export function saveCustomRoles(roles: CustomRoleDefinition[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.CUSTOM_RBAC_ROLES, JSON.stringify(roles));
}

export function getEffectivePermissionsForRole(
  roleKey: string,
  rolesList?: CustomRoleDefinition[]
): PermissionKey[] {
  const roles = rolesList || loadCustomRoles();
  const matched = roles.find((r) => r.roleKey === roleKey || r.id === roleKey || r.name.toLowerCase() === roleKey.toLowerCase());
  if (matched) return matched.permissions;

  if (roleKey === 'SUPER_ADMIN' || roleKey === 'APPSEC_ADMIN') {
    return [
      'APP_VIEW', 'APP_CREATE', 'APP_EDIT', 'APP_DELETE',
      'ASSESSMENT_SUBMIT', 'ASSESSMENT_APPROVE', 'SOP_UPLOAD',
      'EVIDENCE_GENERATE', 'PROMOTION_GATE_OVERRIDE',
      'USER_MANAGE', 'RBAC_MANAGE', 'SSO_SCIM_MANAGE', 'AUDIT_LOG_VIEW'
    ];
  }
  return ['APP_VIEW', 'ASSESSMENT_SUBMIT', 'AUDIT_LOG_VIEW'];
}

function base64UrlEncode(str: string): string {
  try {
    return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  } catch {
    return encodeURIComponent(str);
  }
}

function base64UrlDecode(str: string): string {
  try {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return atob(base64);
  } catch {
    return decodeURIComponent(str);
  }
}

export function generateBearerJwtToken(
  user: { email: string; displayName?: string; role: string; userId?: string; loginMethod?: string },
  customRoles?: CustomRoleDefinition[]
): { token: string; payload: BearerJwtPayload } {
  const roles = customRoles || loadCustomRoles();
  const permissions = getEffectivePermissionsForRole(user.role, roles);

  const header = { alg: 'HS256', typ: 'JWT' };
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 86400 * 7; // 7 days expiration

  const emailClean = (user.email || 'admin@enterprise.local').toLowerCase();

  const payload: BearerJwtPayload = {
    sub: emailClean,
    userId: user.userId || `usr-${emailClean.split('@')[0]}`,
    displayName: user.displayName || emailClean.split('@')[0],
    email: emailClean,
    role: user.role || 'APPSEC_ADMIN',
    permissions,
    iss: 'enterprise-appsec-iam',
    iat,
    exp,
    jti: `jwt-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`,
    loginMethod: user.loginMethod || 'BEARER_AUTH'
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const mockSig = base64UrlEncode(`sig_${emailClean}_${payload.jti}_secret_appsec_token_98231`);

  const token = `${encodedHeader}.${encodedPayload}.${mockSig}`;
  return { token, payload };
}

export function verifyAndDecodeBearerJwt(token: string): { valid: boolean; payload?: BearerJwtPayload; error?: string } {
  try {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Authorization header or token is missing.' };
    }
    const cleanToken = token.replace('Bearer ', '').trim();
    const parts = cleanToken.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid JWT structure. Expected 3 base64url segments.' };
    }
    const payloadJson = base64UrlDecode(parts[1]);
    const payload: BearerJwtPayload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, payload, error: 'Token has expired.' };
    }

    if (payload.iss !== 'enterprise-appsec-iam' && !payload.iss.includes('microsoft')) {
      return { valid: false, payload, error: 'Untrusted token issuer.' };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'Failed to decode or verify Bearer JWT token.' };
  }
}

export function attachJwtToActiveUser(user: ActiveSsoUser): ActiveSsoUser {
  if (!user || !user.isAuthenticated) return user;
  const roles = loadCustomRoles();
  const perms = getEffectivePermissionsForRole(user.role, roles);
  const { token } = generateBearerJwtToken({
    email: user.email || 'admin@enterprise.local',
    displayName: user.displayName || 'AppSec Administrator',
    role: user.role || 'APPSEC_ADMIN',
    userId: user.userId,
    loginMethod: user.loginMethod
  }, roles);

  return {
    ...user,
    bearerJwtToken: token,
    permissions: perms
  };
}

export function loadActiveSsoUser(): ActiveSsoUser {
  if (typeof window === 'undefined') return DEFAULT_ACTIVE_SSO_USER;
  try {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SSO_USER);
  } catch (e) {}

  const data = sessionStorage.getItem(STORAGE_KEYS.ACTIVE_SSO_USER);
  if (!data) return DEFAULT_ACTIVE_SSO_USER;
  try {
    const parsed = JSON.parse(data);
    if (parsed && parsed.isAuthenticated) {
      return attachJwtToActiveUser(parsed);
    }
    return DEFAULT_ACTIVE_SSO_USER;
  } catch {
    return DEFAULT_ACTIVE_SSO_USER;
  }
}

export function saveActiveSsoUser(user: ActiveSsoUser): void {
  if (typeof window === 'undefined') return;
  if (!user || !user.isAuthenticated) {
    sessionStorage.removeItem(STORAGE_KEYS.ACTIVE_SSO_USER);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SSO_USER);
  } else {
    const enriched = attachJwtToActiveUser(user);
    sessionStorage.setItem(STORAGE_KEYS.ACTIVE_SSO_USER, JSON.stringify(enriched));
  }
}

// Full SSO & SCIM Local Export / Backup
export function exportSsoScimJSON(): void {
  const data = {
    exportedAt: new Date().toISOString(),
    backupType: 'SSO_SCIM_FULL_BACKUP',
    version: '2.5-azure-sso',
    ssoConfig: loadSsoConfig(),
    scimConfig: loadScimConfig(),
    groupMappings: loadGroupMappings(),
    manualMappings: loadManualUserMappings(),
    provisionedUsers: loadProvisionedUsers(),
    scimAuditLogs: loadScimAuditLogs(),
    activeSsoUser: loadActiveSsoUser()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Azure_SSO_SCIM_Backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Export Provisioned SCIM Directory Users to CSV
export function exportProvisionedUsersCSV(usersList?: ProvisionedUser[]): void {
  const users = usersList || loadProvisionedUsers();
  const headers = [
    'User ID',
    'User Name (UPN)',
    'Display Name',
    'Email',
    'Active',
    'Mapped Role',
    'Azure Groups',
    'Synced Via',
    'Title',
    'Department',
    'Last Synced At'
  ];

  const rows = users.map((u) => [
    u.id,
    `"${u.userName.replace(/"/g, '""')}"`,
    `"${u.displayName.replace(/"/g, '""')}"`,
    `"${u.email.replace(/"/g, '""')}"`,
    u.active ? 'Active' : 'Disabled',
    u.mappedRole,
    `"${(u.groups || []).join('; ').replace(/"/g, '""')}"`,
    u.syncedVia,
    `"${(u.title || '').replace(/"/g, '""')}"`,
    `"${(u.department || '').replace(/"/g, '""')}"`,
    u.lastSyncedAt
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Azure_SCIM_Provisioned_Users_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Restore / Import SSO & SCIM Configuration and Users from JSON
export function importSsoScimJSON(jsonData: string): {
  ssoConfig: SsoConfig;
  scimConfig: ScimConfig;
  groupMappings: ScimGroupMapping[];
  manualMappings: ManualUserRoleMapping[];
  provisionedUsers: ProvisionedUser[];
  scimAuditLogs: ScimAuditLog[];
  activeSsoUser: ActiveSsoUser;
} {
  try {
    const parsed = JSON.parse(jsonData);

    const ssoConfig = parsed.ssoConfig || DEFAULT_SSO_CONFIG;
    const scimConfig = parsed.scimConfig || DEFAULT_SCIM_CONFIG;
    const groupMappings = parsed.groupMappings || DEFAULT_GROUP_MAPPINGS;
    const manualMappings = parsed.manualMappings || DEFAULT_MANUAL_USER_MAPPINGS;
    const provisionedUsers = parsed.provisionedUsers || INITIAL_PROVISIONED_USERS;
    const scimAuditLogs = parsed.scimAuditLogs || parsed.scimLogs || INITIAL_SCIM_LOGS;
    const activeSsoUser = parsed.activeSsoUser || DEFAULT_ACTIVE_SSO_USER;

    saveSsoConfig(ssoConfig);
    saveScimConfig(scimConfig);
    saveGroupMappings(groupMappings);
    saveManualUserMappings(manualMappings);
    saveProvisionedUsers(provisionedUsers);
    saveScimAuditLogs(scimAuditLogs);
    saveActiveSsoUser(activeSsoUser);

    return {
      ssoConfig,
      scimConfig,
      groupMappings,
      manualMappings,
      provisionedUsers,
      scimAuditLogs,
      activeSsoUser
    };
  } catch (err) {
    throw new Error('Invalid JSON format for SSO & SCIM backup file.');
  }
}

// Reset SSO & SCIM Data to Factory Defaults
export function resetSsoScimToDefaults(): {
  ssoConfig: SsoConfig;
  scimConfig: ScimConfig;
  groupMappings: ScimGroupMapping[];
  manualMappings: ManualUserRoleMapping[];
  provisionedUsers: ProvisionedUser[];
  scimAuditLogs: ScimAuditLog[];
  activeSsoUser: ActiveSsoUser;
} {
  saveSsoConfig(DEFAULT_SSO_CONFIG);
  saveScimConfig(DEFAULT_SCIM_CONFIG);
  saveGroupMappings(DEFAULT_GROUP_MAPPINGS);
  saveManualUserMappings(DEFAULT_MANUAL_USER_MAPPINGS);
  saveProvisionedUsers(INITIAL_PROVISIONED_USERS);
  saveScimAuditLogs(INITIAL_SCIM_LOGS);
  saveActiveSsoUser(DEFAULT_ACTIVE_SSO_USER);

  return {
    ssoConfig: DEFAULT_SSO_CONFIG,
    scimConfig: DEFAULT_SCIM_CONFIG,
    groupMappings: DEFAULT_GROUP_MAPPINGS,
    manualMappings: DEFAULT_MANUAL_USER_MAPPINGS,
    provisionedUsers: INITIAL_PROVISIONED_USERS,
    scimAuditLogs: INITIAL_SCIM_LOGS,
    activeSsoUser: DEFAULT_ACTIVE_SSO_USER
  };
}

