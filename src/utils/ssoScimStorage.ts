import {
  SsoConfig,
  ScimConfig,
  ScimGroupMapping,
  ProvisionedUser,
  ScimAuditLog,
  ActiveSsoUser,
  UserRole
} from '../types';

const STORAGE_KEYS = {
  SSO_CONFIG: 'appsec_azure_sso_config',
  SCIM_CONFIG: 'appsec_scim_config',
  GROUP_MAPPINGS: 'appsec_scim_group_mappings',
  PROVISIONED_USERS: 'appsec_scim_provisioned_users',
  SCIM_LOGS: 'appsec_scim_audit_logs',
  ACTIVE_SSO_USER: 'appsec_active_sso_user'
};

export const DEFAULT_SSO_CONFIG: SsoConfig = {
  tenantId: '8f88e1a3-8321-4d3e-953e-5231a49931ef',
  clientId: '3a8f43c1-7782-41f2-901e-c19a951d8d21',
  clientSecret: 'az_sec_demo_98412893719823719823',
  redirectUri: typeof window !== 'undefined' ? `${window.location.origin}/api/sso/azure/callback` : '/api/sso/azure/callback',
  scopes: 'openid profile email User.Read Directory.Read.All',
  ssoMode: 'SIMULATED_AZURE_OIDC',
  enforceSso: false,
  loginUrl: 'https://login.microsoftonline.com/8f88e1a3-8321-4d3e-953e-5231a49931ef/oauth2/v2.0/authorize',
  issuerUrl: 'https://login.microsoftonline.com/8f88e1a3-8321-4d3e-953e-5231a49931ef/v2.0'
};

export const DEFAULT_SCIM_CONFIG: ScimConfig = {
  baseUrl: typeof window !== 'undefined' ? `${window.location.origin}/api/scim/v2` : '/api/scim/v2',
  secretToken: 'scim_sec_azure_entra_appsec_984123891723',
  enabled: true,
  defaultRole: 'IT_VIEWER',
  requireBearerAuth: true
};

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
    lastSyncedAt: new Date(Date.now() - 3600000).toISOString(),
    syncedVia: 'SCIM_2.0',
    title: 'Lead Application Security Engineer',
    department: 'InfoSec'
  },
  {
    id: 'az-usr-1002',
    userName: 'dchen@contoso.com',
    displayName: 'David Chen',
    givenName: 'David',
    familyName: 'Chen',
    email: 'dchen@contoso.com',
    active: true,
    groups: ['IT-Operations-Viewers'],
    mappedRole: 'IT_VIEWER',
    lastSyncedAt: new Date(Date.now() - 7200000).toISOString(),
    syncedVia: 'SCIM_2.0',
    title: 'Senior IT Operations Specialist',
    department: 'IT Infrastructure'
  },
  {
    id: 'az-usr-1003',
    userName: 'arivera@contoso.com',
    displayName: 'Alex Rivera',
    givenName: 'Alex',
    familyName: 'Rivera',
    email: 'arivera@contoso.com',
    active: true,
    groups: ['SOC-Analyst-Auditor'],
    mappedRole: 'IT_VIEWER',
    lastSyncedAt: new Date(Date.now() - 14400000).toISOString(),
    syncedVia: 'SCIM_2.0',
    title: 'SOC Security Auditor',
    department: 'Compliance & Audit'
  },
  {
    id: 'az-usr-1004',
    userName: 'erostova@contoso.com',
    displayName: 'Elena Rostova',
    givenName: 'Elena',
    familyName: 'Rostova',
    email: 'erostova@contoso.com',
    active: true,
    groups: ['AppSec-Engineers'],
    mappedRole: 'APPSEC_ADMIN',
    lastSyncedAt: new Date(Date.now() - 1800000).toISOString(),
    syncedVia: 'AZURE_SSO',
    title: 'AppSec Engineer',
    department: 'Cybersecurity'
  }
];

export const INITIAL_SCIM_LOGS: ScimAuditLog[] = [
  {
    id: 'SLOG-9001',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    method: 'POST',
    endpoint: '/api/scim/v2/Users',
    statusCode: 201,
    action: 'PROVISION_USER',
    targetUserId: 'az-usr-1001',
    targetUserName: 'sjenkins@contoso.com',
    details: 'Provisioned new user via Azure Entra SCIM 2.0. Assigned APPSEC_ADMIN role based on group "AppSec-Engineers".',
    payloadSummary: '{"userName": "sjenkins@contoso.com", "active": true, "groups": ["AppSec-Engineers"]}'
  },
  {
    id: 'SLOG-9002',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    method: 'PATCH',
    endpoint: '/api/scim/v2/Users/az-usr-1002',
    statusCode: 200,
    action: 'UPDATE_GROUPS',
    targetUserId: 'az-usr-1002',
    targetUserName: 'dchen@contoso.com',
    details: 'Updated group memberships via Azure Entra SCIM 2.0. Effective role: IT_VIEWER.',
    payloadSummary: '{"Operations": [{"op": "replace", "path": "groups", "value": [{"display": "IT-Operations-Viewers"}]}]}'
  },
  {
    id: 'SLOG-9003',
    timestamp: new Date(Date.now() - 14400000).toISOString(),
    method: 'GET',
    endpoint: '/api/scim/v2/ServiceProviderConfig',
    statusCode: 200,
    action: 'HEALTH_CHECK',
    details: 'Azure Entra ID test query to verify SCIM 2.0 Service Provider Capabilities.',
    payloadSummary: '{}'
  }
];

export const DEFAULT_ACTIVE_SSO_USER: ActiveSsoUser = {
  isAuthenticated: true,
  userId: 'az-usr-1001',
  displayName: 'Sarah Jenkins',
  email: 'sjenkins@contoso.com',
  upn: 'sjenkins@contoso.com',
  role: 'APPSEC_ADMIN',
  groups: ['AppSec-Engineers', 'CyberSecurity-Leads'],
  loginMethod: 'SIMULATED_AZURE_OIDC',
  loggedInAt: new Date().toISOString()
};

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

export function loadActiveSsoUser(): ActiveSsoUser {
  const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_SSO_USER);
  if (!data) return DEFAULT_ACTIVE_SSO_USER;
  try {
    return JSON.parse(data);
  } catch {
    return DEFAULT_ACTIVE_SSO_USER;
  }
}

export function saveActiveSsoUser(user: ActiveSsoUser): void {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_SSO_USER, JSON.stringify(user));
}

// Full SSO & SCIM Local Export / Backup
export function exportSsoScimJSON(): void {
  const data = {
    exportedAt: new Date().toISOString(),
    backupType: 'SSO_SCIM_FULL_BACKUP',
    version: '2.4-azure-sso',
    ssoConfig: loadSsoConfig(),
    scimConfig: loadScimConfig(),
    groupMappings: loadGroupMappings(),
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
  provisionedUsers: ProvisionedUser[];
  scimAuditLogs: ScimAuditLog[];
  activeSsoUser: ActiveSsoUser;
} {
  try {
    const parsed = JSON.parse(jsonData);

    const ssoConfig = parsed.ssoConfig || DEFAULT_SSO_CONFIG;
    const scimConfig = parsed.scimConfig || DEFAULT_SCIM_CONFIG;
    const groupMappings = parsed.groupMappings || DEFAULT_GROUP_MAPPINGS;
    const provisionedUsers = parsed.provisionedUsers || INITIAL_PROVISIONED_USERS;
    const scimAuditLogs = parsed.scimAuditLogs || parsed.scimLogs || INITIAL_SCIM_LOGS;
    const activeSsoUser = parsed.activeSsoUser || DEFAULT_ACTIVE_SSO_USER;

    saveSsoConfig(ssoConfig);
    saveScimConfig(scimConfig);
    saveGroupMappings(groupMappings);
    saveProvisionedUsers(provisionedUsers);
    saveScimAuditLogs(scimAuditLogs);
    saveActiveSsoUser(activeSsoUser);

    return {
      ssoConfig,
      scimConfig,
      groupMappings,
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
  provisionedUsers: ProvisionedUser[];
  scimAuditLogs: ScimAuditLog[];
  activeSsoUser: ActiveSsoUser;
} {
  saveSsoConfig(DEFAULT_SSO_CONFIG);
  saveScimConfig(DEFAULT_SCIM_CONFIG);
  saveGroupMappings(DEFAULT_GROUP_MAPPINGS);
  saveProvisionedUsers(INITIAL_PROVISIONED_USERS);
  saveScimAuditLogs(INITIAL_SCIM_LOGS);
  saveActiveSsoUser(DEFAULT_ACTIVE_SSO_USER);

  return {
    ssoConfig: DEFAULT_SSO_CONFIG,
    scimConfig: DEFAULT_SCIM_CONFIG,
    groupMappings: DEFAULT_GROUP_MAPPINGS,
    provisionedUsers: INITIAL_PROVISIONED_USERS,
    scimAuditLogs: INITIAL_SCIM_LOGS,
    activeSsoUser: DEFAULT_ACTIVE_SSO_USER
  };
}

