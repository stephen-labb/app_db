import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { testDbConnection, initDbTables, getDbPool, getDbStatusInfo, seedInitialData, safeDbQuery } from './src/db.js';

const app = express();
const PORT = 3000;

app.use(express.json({ type: ['application/json', 'application/scim+json'] }));
app.use(express.urlencoded({ extended: true }));

// In-Memory SCIM & SSO State for Backend (initialized with Enterprise Contoso data)
interface ScimUser {
  id: string;
  externalId?: string;
  userName: string;
  name: {
    formatted: string;
    familyName: string;
    givenName: string;
  };
  emails: Array<{ value: string; type: string; primary: boolean }>;
  active: boolean;
  groups: string[];
  mappedRole: 'APPSEC_ADMIN' | 'IT_VIEWER';
  lastSyncedAt: string;
  department?: string;
  title?: string;
}

interface ScimGroup {
  id: string;
  displayName: string;
  members: Array<{ value: string; display: string }>;
}

interface GroupMappingRule {
  id: string;
  azureGroupOrRoleName: string;
  appRole: 'APPSEC_ADMIN' | 'IT_VIEWER';
}

let inMemoryUsers: ScimUser[] = [
  {
    id: 'az-usr-1001',
    externalId: 'ext-az-1001',
    userName: 'sjenkins@contoso.com',
    name: {
      formatted: 'Sarah Jenkins',
      givenName: 'Sarah',
      familyName: 'Jenkins'
    },
    emails: [{ value: 'sjenkins@contoso.com', type: 'work', primary: true }],
    active: true,
    groups: ['AppSec-Engineers', 'CyberSecurity-Leads'],
    mappedRole: 'APPSEC_ADMIN',
    lastSyncedAt: new Date().toISOString(),
    department: 'InfoSec',
    title: 'Lead Application Security Engineer'
  },
  {
    id: 'az-usr-1002',
    externalId: 'ext-az-1002',
    userName: 'dchen@contoso.com',
    name: {
      formatted: 'David Chen',
      givenName: 'David',
      familyName: 'Chen'
    },
    emails: [{ value: 'dchen@contoso.com', type: 'work', primary: true }],
    active: true,
    groups: ['IT-Operations-Viewers'],
    mappedRole: 'IT_VIEWER',
    lastSyncedAt: new Date().toISOString(),
    department: 'IT Infrastructure',
    title: 'Senior IT Specialist'
  },
  {
    id: 'az-usr-1003',
    externalId: 'ext-az-1003',
    userName: 'arivera@contoso.com',
    name: {
      formatted: 'Alex Rivera',
      givenName: 'Alex',
      familyName: 'Rivera'
    },
    emails: [{ value: 'arivera@contoso.com', type: 'work', primary: true }],
    active: true,
    groups: ['SOC-Analyst-Auditor'],
    mappedRole: 'IT_VIEWER',
    lastSyncedAt: new Date().toISOString(),
    department: 'Compliance',
    title: 'SOC Auditor'
  }
];

let inMemoryGroups: ScimGroup[] = [
  {
    id: 'b19e2e10-9112-4f3b-8280-9900223a1099',
    displayName: 'AppSec-Engineers',
    members: [{ value: 'az-usr-1001', display: 'Sarah Jenkins' }]
  },
  {
    id: 'd88f1122-3344-5566-7788-9900aabbccdd',
    displayName: 'IT-Operations-Viewers',
    members: [{ value: 'az-usr-1002', display: 'David Chen' }]
  }
];

let mappingRules: GroupMappingRule[] = [
  { id: 'MAP-1001', azureGroupOrRoleName: 'AppSec-Engineers', appRole: 'APPSEC_ADMIN' },
  { id: 'MAP-1002', azureGroupOrRoleName: 'CyberSecurity-Leads', appRole: 'APPSEC_ADMIN' },
  { id: 'MAP-1003', azureGroupOrRoleName: 'IT-Operations-Viewers', appRole: 'IT_VIEWER' },
  { id: 'MAP-1004', azureGroupOrRoleName: 'SOC-Analyst-Auditor', appRole: 'IT_VIEWER' }
];

let scimAuditLogs: Array<{
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  statusCode: number;
  action: string;
  details: string;
  targetUserId?: string;
}> = [
  {
    id: 'SLOG-101',
    timestamp: new Date().toISOString(),
    method: 'GET',
    endpoint: '/api/scim/v2/ServiceProviderConfig',
    statusCode: 200,
    action: 'DISCOVERY',
    details: 'Azure Entra ID query for SCIM Service Provider Capabilities'
  }
];

// Calculate Role based on groups and mapping rules
function deriveAppRole(userGroups: string[]): 'APPSEC_ADMIN' | 'IT_VIEWER' {
  if (!userGroups || userGroups.length === 0) return 'IT_VIEWER';
  const isAdmin = userGroups.some(grp =>
    mappingRules.some(
      r => r.appRole === 'APPSEC_ADMIN' && r.azureGroupOrRoleName.toLowerCase() === grp.toLowerCase()
    )
  );
  return isAdmin ? 'APPSEC_ADMIN' : 'IT_VIEWER';
}

// Convert user object to standard RFC 7643 SCIM User schema
function toScimUserResource(u: ScimUser) {
  return {
    schemas: [
      'urn:ietf:params:scim:schemas:core:2.0:User',
      'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'
    ],
    id: u.id,
    externalId: u.externalId || u.id,
    userName: u.userName,
    name: u.name,
    displayName: u.name.formatted,
    emails: u.emails,
    active: u.active,
    groups: u.groups.map(g => ({ value: g, display: g })),
    'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User': {
      department: u.department || 'General',
      employeeNumber: u.id,
      mappedRole: u.mappedRole
    },
    meta: {
      resourceType: 'User',
      created: u.lastSyncedAt,
      lastModified: u.lastSyncedAt,
      location: `/api/scim/v2/Users/${u.id}`
    }
  };
}

// Optional Auth Middleware for SCIM Endpoints
const scimAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  // Accept standard Bearer auth, or allow open access during dev sandbox testing
  if (req.headers['x-scim-test-client'] === 'sandbox' || !authHeader) {
    return next();
  }
  if (authHeader.startsWith('Bearer ')) {
    return next();
  }
  res.status(401).json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
    detail: 'Unauthorized: Invalid or missing SCIM Bearer Token',
    status: '401'
  });
};

// ==========================================
// SCIM 2.0 ROUTER
// ==========================================

// 1. Service Provider Config (RFC 7644 Section 3.2)
app.get('/api/scim/v2/ServiceProviderConfig', (req, res) => {
  scimAuditLogs.unshift({
    id: `SLOG-${Math.floor(1000 + Math.random() * 9000)}`,
    timestamp: new Date().toISOString(),
    method: 'GET',
    endpoint: '/api/scim/v2/ServiceProviderConfig',
    statusCode: 200,
    action: 'SERVICE_PROVIDER_CONFIG',
    details: 'Queried SCIM Service Provider Capabilities'
  });

  res.setHeader('Content-Type', 'application/scim+json');
  res.json({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
    documentationUri: 'https://docs.microsoft.com/en-us/azure/active-directory/app-provisioning/use-scim-to-provision-users-and-groups',
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 100 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [
      {
        name: 'OAuth Bearer Token',
        description: 'Authentication scheme using OAuth Bearer Token for Azure Entra ID Provisioning',
        specUri: 'https://www.rfc-editor.org/rfc/rfc6750',
        type: 'oauthbearertoken',
        primary: true
      }
    ]
  });
});

// 2. Resource Schemas
app.get('/api/scim/v2/Schemas', (req, res) => {
  res.setHeader('Content-Type', 'application/scim+json');
  res.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: 2,
    Resources: [
      {
        id: 'urn:ietf:params:scim:schemas:core:2.0:User',
        name: 'User',
        description: 'User Account Schema for Azure AD SCIM Provisioning'
      },
      {
        id: 'urn:ietf:params:scim:schemas:core:2.0:Group',
        name: 'Group',
        description: 'Group Schema for Azure AD Role Mapping'
      }
    ]
  });
});

// 3. GET /Users - Query Users with optional filtering
app.get('/api/scim/v2/Users', scimAuthMiddleware, (req, res) => {
  const filter = req.query.filter as string;
  let results = [...inMemoryUsers];

  if (filter) {
    // Basic filter matching e.g. userName eq "sjenkins@contoso.com"
    const match = filter.match(/userName eq "([^"]+)"/i);
    if (match && match[1]) {
      results = results.filter(u => u.userName.toLowerCase() === match[1].toLowerCase());
    }
  }

  scimAuditLogs.unshift({
    id: `SLOG-${Math.floor(1000 + Math.random() * 9000)}`,
    timestamp: new Date().toISOString(),
    method: 'GET',
    endpoint: '/api/scim/v2/Users',
    statusCode: 200,
    action: 'QUERY_USERS',
    details: `Fetched ${results.length} provisioned users. Filter: ${filter || 'None'}`
  });

  res.setHeader('Content-Type', 'application/scim+json');
  res.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: results.length,
    startIndex: 1,
    itemsPerPage: results.length,
    Resources: results.map(toScimUserResource)
  });
});

// 4. POST /Users - Provision New User
app.post('/api/scim/v2/Users', scimAuthMiddleware, (req, res) => {
  const body = req.body || {};
  const userName = body.userName || body.emails?.[0]?.value || `user_${Date.now()}@contoso.com`;
  const givenName = body.name?.givenName || 'Provisioned';
  const familyName = body.name?.familyName || 'User';
  const formattedName = body.displayName || `${givenName} ${familyName}`;
  
  // Extract group names or group objects
  const rawGroups = body.groups || [];
  const groups: string[] = rawGroups.map((g: any) => typeof g === 'string' ? g : g.display || g.value);

  const newUser: ScimUser = {
    id: `az-usr-${Math.floor(1000 + Math.random() * 9000)}`,
    externalId: body.externalId || body.id || `ext-${Date.now()}`,
    userName,
    name: {
      formatted: formattedName,
      givenName,
      familyName
    },
    emails: body.emails || [{ value: userName, type: 'work', primary: true }],
    active: body.active !== undefined ? body.active : true,
    groups: groups.length > 0 ? groups : ['IT-Operations-Viewers'],
    mappedRole: deriveAppRole(groups),
    lastSyncedAt: new Date().toISOString(),
    department: body['urn:ietf:params:scim:schemas:extension:enterprise:2.0:User']?.department || 'IT Operations',
    title: body.title || 'Azure AD User'
  };

  inMemoryUsers.unshift(newUser);

  scimAuditLogs.unshift({
    id: `SLOG-${Math.floor(1000 + Math.random() * 9000)}`,
    timestamp: new Date().toISOString(),
    method: 'POST',
    endpoint: '/api/scim/v2/Users',
    statusCode: 201,
    action: 'PROVISION_USER',
    targetUserId: newUser.id,
    details: `Provisioned user ${newUser.userName} via SCIM 2.0. Mapped Role: ${newUser.mappedRole}`
  });

  res.status(201).setHeader('Content-Type', 'application/scim+json').json(toScimUserResource(newUser));
});

// 5. GET /Users/:id
app.get('/api/scim/v2/Users/:id', scimAuthMiddleware, (req, res) => {
  const user = inMemoryUsers.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Resource not found',
      status: '404'
    });
  }
  res.setHeader('Content-Type', 'application/scim+json').json(toScimUserResource(user));
});

// 6. PATCH /Users/:id - Update User / Groups / Deprovision
app.patch('/api/scim/v2/Users/:id', scimAuthMiddleware, (req, res) => {
  const idx = inMemoryUsers.findIndex(u => u.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Resource not found',
      status: '404'
    });
  }

  const user = inMemoryUsers[idx];
  const ops = req.body?.Operations || [];

  for (const op of ops) {
    if (op.path === 'active' || op.value?.active !== undefined) {
      user.active = op.value?.active ?? (op.value === 'false' ? false : true);
    }
    if (op.path === 'groups' || op.value?.groups) {
      const newGrps = op.value?.groups || op.value;
      if (Array.isArray(newGrps)) {
        user.groups = newGrps.map((g: any) => typeof g === 'string' ? g : g.display || g.value);
        user.mappedRole = deriveAppRole(user.groups);
      }
    }
  }

  user.lastSyncedAt = new Date().toISOString();
  inMemoryUsers[idx] = user;

  scimAuditLogs.unshift({
    id: `SLOG-${Math.floor(1000 + Math.random() * 9000)}`,
    timestamp: new Date().toISOString(),
    method: 'PATCH',
    endpoint: `/api/scim/v2/Users/${user.id}`,
    statusCode: 200,
    action: 'UPDATE_USER_SCIM',
    targetUserId: user.id,
    details: `Updated user ${user.userName}. Active: ${user.active}, Role: ${user.mappedRole}`
  });

  res.setHeader('Content-Type', 'application/scim+json').json(toScimUserResource(user));
});

// 7. DELETE /Users/:id - Soft Deprovision
app.delete('/api/scim/v2/Users/:id', scimAuthMiddleware, (req, res) => {
  const idx = inMemoryUsers.findIndex(u => u.id === req.params.id);
  if (idx !== -1) {
    const user = inMemoryUsers[idx];
    user.active = false;
    user.lastSyncedAt = new Date().toISOString();

    scimAuditLogs.unshift({
      id: `SLOG-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      method: 'DELETE',
      endpoint: `/api/scim/v2/Users/${user.id}`,
      statusCode: 204,
      action: 'DEPROVISION_USER',
      targetUserId: user.id,
      details: `Deprovisioned user ${user.userName} via SCIM DELETE request`
    });
  }
  res.status(204).send();
});

// 8. GET /Groups
app.get('/api/scim/v2/Groups', scimAuthMiddleware, (req, res) => {
  res.setHeader('Content-Type', 'application/scim+json');
  res.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: inMemoryGroups.length,
    startIndex: 1,
    itemsPerPage: inMemoryGroups.length,
    Resources: inMemoryGroups.map(g => ({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
      id: g.id,
      displayName: g.displayName,
      members: g.members,
      meta: { resourceType: 'Group', location: `/api/scim/v2/Groups/${g.id}` }
    }))
  });
});

// 9. SCIM Logs Endpoint for Frontend
app.get('/api/scim/logs', (req, res) => {
  res.json({ logs: scimAuditLogs, users: inMemoryUsers });
});

// ==========================================
// AZURE AD SSO SIMULATION & API ROUTES
// ==========================================

app.get('/api/sso/azure/config', (req, res) => {
  res.json({
    tenantId: process.env.AZURE_TENANT_ID || '8f88e1a3-8321-4d3e-953e-5231a49931ef',
    clientId: process.env.AZURE_CLIENT_ID || '3a8f43c1-7782-41f2-901e-c19a951d8d21',
    redirectUri: `${req.protocol}://${req.get('host')}/api/sso/azure/callback`,
    scopes: 'openid profile email User.Read Directory.Read.All',
    loginUrl: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || '8f88e1a3-8321-4d3e-953e-5231a49931ef'}/oauth2/v2.0/authorize`
  });
});

// Mock SSO Login Execution
app.post('/api/sso/azure/login-mock', (req, res) => {
  const { email, groups } = req.body;
  const userGroups = groups || ['AppSec-Engineers'];
  const role = deriveAppRole(userGroups);

  res.json({
    success: true,
    user: {
      userId: `az-usr-${Math.floor(1000 + Math.random() * 9000)}`,
      displayName: email ? email.split('@')[0].replace('.', ' ') : 'Azure Entra User',
      email: email || 'sjenkins@contoso.com',
      upn: email || 'sjenkins@contoso.com',
      role,
      groups: userGroups,
      loginMethod: 'SIMULATED_AZURE_OIDC',
      loggedInAt: new Date().toISOString()
    }
  });
});

// Health check API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'AppSec Criticality Manager',
    ssoEnabled: true,
    scimEnabled: true,
    db: getDbStatusInfo()
  });
});

// ==========================================
// ON-PREMISES POSTGRESQL DATABASE API ROUTES
// ==========================================

// Get database status and configuration
app.get('/api/db/status', async (req, res) => {
  const connTest = await testDbConnection();
  res.json({
    dbConfig: connTest.config,
    connected: connTest.connected,
    message: connTest.message,
    status: getDbStatusInfo()
  });
});

// Test connection explicitly
app.post('/api/db/test-connect', async (req, res) => {
  const result = await testDbConnection();
  res.json(result);
});

// Get applications from PostgreSQL (with fallback)
app.get('/api/apps', async (req, res) => {
  const dbRes = await safeDbQuery('SELECT * FROM applications ORDER BY created_at DESC');
  if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
    const apps = dbRes.rows.map(r => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      tier: r.tier,
      rating: r.rating,
      calculatedScore: parseFloat(r.calculated_score),
      department: r.department,
      ownerAppSec: r.owner_app_sec,
      ownerIT: r.owner_it,
      hostingEnv: r.hosting_env,
      dataClassification: r.data_classification,
      rto: r.rto,
      rpo: r.rpo,
      internetExposed: r.internet_exposed,
      isGamingNetwork: r.is_gaming_network,
      thirdPartyIntegrations: r.third_party_integrations || [],
      complianceRequirements: r.compliance_requirements || [],
      status: r.status,
      factors: r.factors || {},
      lastAssessed: r.last_assessed,
      assessedBy: r.assessed_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      notes: r.notes
    }));
    return res.json({ source: 'postgresql', apps });
  }
  res.json({ source: 'local_storage_buffer', apps: [] });
});

// Save/Sync application to PostgreSQL
app.post('/api/apps', async (req, res) => {
  const appData = req.body;
  if (!appData || !appData.id || !appData.name) {
    return res.status(400).json({ error: 'Missing required app fields (id, name)' });
  }

  const result = await safeDbQuery(
    `INSERT INTO applications (
      id, code, name, description, tier, rating, calculated_score,
      department, owner_app_sec, owner_it, hosting_env, data_classification,
      rto, rpo, internet_exposed, is_gaming_network, third_party_integrations,
      compliance_requirements, status, factors, last_assessed, assessed_by,
      created_at, updated_at, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
    ON CONFLICT (id) DO UPDATE SET
      code = EXCLUDED.code,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      tier = EXCLUDED.tier,
      rating = EXCLUDED.rating,
      calculated_score = EXCLUDED.calculated_score,
      department = EXCLUDED.department,
      owner_app_sec = EXCLUDED.owner_app_sec,
      owner_it = EXCLUDED.owner_it,
      hosting_env = EXCLUDED.hosting_env,
      data_classification = EXCLUDED.data_classification,
      rto = EXCLUDED.rto,
      rpo = EXCLUDED.rpo,
      internet_exposed = EXCLUDED.internet_exposed,
      is_gaming_network = EXCLUDED.is_gaming_network,
      third_party_integrations = EXCLUDED.third_party_integrations,
      compliance_requirements = EXCLUDED.compliance_requirements,
      status = EXCLUDED.status,
      factors = EXCLUDED.factors,
      last_assessed = EXCLUDED.last_assessed,
      assessed_by = EXCLUDED.assessed_by,
      updated_at = NOW(),
      notes = EXCLUDED.notes`,
    [
      appData.id,
      appData.code || '',
      appData.name,
      appData.description || '',
      appData.tier || 'M',
      appData.rating || 'M',
      appData.calculatedScore || 0,
      appData.department || 'Engineering',
      appData.ownerAppSec || '',
      appData.ownerIT || '',
      appData.hostingEnv || '',
      appData.dataClassification || 'INTERNAL',
      appData.rto || '1 Hour',
      appData.rpo || '15 Minutes',
      Boolean(appData.internetExposed),
      Boolean(appData.isGamingNetwork),
      JSON.stringify(appData.thirdPartyIntegrations || []),
      JSON.stringify(appData.complianceRequirements || []),
      appData.status || 'ACTIVE',
      JSON.stringify(appData.factors || {}),
      appData.lastAssessed || new Date().toISOString(),
      appData.assessedBy || 'Admin',
      appData.createdAt || new Date().toISOString(),
      appData.updatedAt || new Date().toISOString(),
      appData.notes || ''
    ]
  );

  if (result) {
    res.json({ success: true, message: `Application ${appData.id} saved to PostgreSQL (127.0.0.1:5432/app_db)` });
  } else {
    res.json({ success: false, bufferedLocally: true, message: 'DB offline, changes buffered in browser local storage' });
  }
});

// Delete application from PostgreSQL
app.delete('/api/apps/:id', async (req, res) => {
  const { id } = req.params;
  await safeDbQuery('DELETE FROM applications WHERE id = $1', [id]);
  res.json({ success: true, message: `Application ${id} processed` });
});

// Force Seed initialData into PostgreSQL
app.post('/api/db/seed', async (req, res) => {
  const { force } = req.body || {};
  const result = await seedInitialData(Boolean(force));
  res.json(result);
});

// GET /api/sop
app.get('/api/sop', async (req, res) => {
  const dbRes = await safeDbQuery('SELECT * FROM sop_documents WHERE id = $1', ['MAIN_SOP']);
  if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
    return res.json({
      source: 'postgresql',
      sop: {
        activeVersion: dbRes.rows[0].active_version,
        history: dbRes.rows[0].history || []
      }
    });
  }
  res.json({ source: 'local_storage_buffer', sop: null });
});

// POST /api/sop
app.post('/api/sop', async (req, res) => {
  const sopData = req.body;
  if (!sopData || !sopData.activeVersion) {
    return res.status(400).json({ error: 'Invalid SOP document payload' });
  }
  const result = await safeDbQuery(
    `INSERT INTO sop_documents (id, active_version, history, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (id) DO UPDATE SET
      active_version = EXCLUDED.active_version,
      history = EXCLUDED.history,
      updated_at = NOW()`,
    ['MAIN_SOP', sopData.activeVersion, JSON.stringify(sopData.history || [])]
  );
  if (result) {
    res.json({ success: true, message: 'SOP document updated in PostgreSQL' });
  } else {
    res.json({ success: false, bufferedLocally: true });
  }
});

// GET /api/audit-logs
app.get('/api/audit-logs', async (req, res) => {
  const dbRes = await safeDbQuery('SELECT * FROM audit_logs ORDER BY timestamp DESC');
  if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
    const logs = dbRes.rows.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      user: r.user_name,
      role: r.role,
      action: r.action,
      details: r.details,
      appId: r.app_id,
      appName: r.app_name
    }));
    return res.json({ source: 'postgresql', logs });
  }
  res.json({ source: 'local_storage_buffer', logs: [] });
});

// POST /api/audit-logs
app.post('/api/audit-logs', async (req, res) => {
  const log = req.body;
  if (!log || !log.id || !log.action) {
    return res.status(400).json({ error: 'Invalid audit log payload' });
  }
  const result = await safeDbQuery(
    `INSERT INTO audit_logs (id, timestamp, user_name, role, action, details, app_id, app_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING`,
    [
      log.id,
      log.timestamp || new Date().toISOString(),
      log.user || 'Admin',
      log.role || 'APPSEC_ADMIN',
      log.action,
      log.details || '',
      log.appId || null,
      log.appName || null
    ]
  );
  if (result) {
    res.json({ success: true, message: 'Audit log saved to PostgreSQL' });
  } else {
    res.json({ success: false, bufferedLocally: true });
  }
});

// GET /api/pending-assessments
app.get('/api/pending-assessments', async (req, res) => {
  const dbRes = await safeDbQuery('SELECT * FROM pending_assessments ORDER BY submitted_at DESC');
  if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
    const assessments = dbRes.rows.map(r => ({
      id: r.id,
      appId: r.app_id,
      appCode: r.app_code,
      appName: r.app_name,
      description: r.description,
      department: r.department,
      ownerIT: r.owner_it,
      ownerAppSec: r.owner_app_sec,
      submitterName: r.submitter_name,
      submitterEmail: r.submitter_email,
      submittedAt: r.submitted_at,
      updatedAt: r.updated_at,
      dataClassification: r.data_classification,
      hostingEnv: r.hosting_env,
      rto: r.rto,
      rpo: r.rpo,
      internetExposed: r.internet_exposed,
      factors: r.factors || {},
      calculatedScore: parseFloat(r.calculated_score),
      proposedTier: r.proposed_tier,
      status: r.status,
      notes: r.notes,
      comments: r.comments || [],
      adminDecisionBy: r.admin_decision_by,
      adminDecisionAt: r.admin_decision_at,
      adminDecisionNotes: r.admin_decision_notes
    }));
    return res.json({ source: 'postgresql', pending: assessments });
  }
  res.json({ source: 'local_storage_buffer', pending: [] });
});

// POST /api/pending-assessments
app.post('/api/pending-assessments', async (req, res) => {
  const p = req.body;
  if (!p || !p.id || !p.appName) {
    return res.status(400).json({ error: 'Invalid pending assessment payload' });
  }
  const result = await safeDbQuery(
    `INSERT INTO pending_assessments (
      id, app_id, app_code, app_name, description, department,
      owner_it, owner_app_sec, submitter_name, submitter_email,
      submitted_at, updated_at, data_classification, hosting_env,
      rto, rpo, internet_exposed, factors, calculated_score,
      proposed_tier, status, notes, comments, admin_decision_by,
      admin_decision_at, admin_decision_notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
    ON CONFLICT (id) DO UPDATE SET
      app_id = EXCLUDED.app_id,
      app_code = EXCLUDED.app_code,
      app_name = EXCLUDED.app_name,
      description = EXCLUDED.description,
      department = EXCLUDED.department,
      owner_it = EXCLUDED.owner_it,
      owner_app_sec = EXCLUDED.owner_app_sec,
      submitter_name = EXCLUDED.submitter_name,
      submitter_email = EXCLUDED.submitter_email,
      updated_at = NOW(),
      data_classification = EXCLUDED.data_classification,
      hosting_env = EXCLUDED.hosting_env,
      rto = EXCLUDED.rto,
      rpo = EXCLUDED.rpo,
      internet_exposed = EXCLUDED.internet_exposed,
      factors = EXCLUDED.factors,
      calculated_score = EXCLUDED.calculated_score,
      proposed_tier = EXCLUDED.proposed_tier,
      status = EXCLUDED.status,
      notes = EXCLUDED.notes,
      comments = EXCLUDED.comments,
      admin_decision_by = EXCLUDED.admin_decision_by,
      admin_decision_at = EXCLUDED.admin_decision_at,
      admin_decision_notes = EXCLUDED.admin_decision_notes`,
    [
      p.id,
      p.appId || null,
      p.appCode || '',
      p.appName,
      p.description || '',
      p.department || '',
      p.ownerIT || '',
      p.ownerAppSec || '',
      p.submitterName || '',
      p.submitterEmail || '',
      p.submittedAt || new Date().toISOString(),
      p.updatedAt || new Date().toISOString(),
      p.dataClassification || 'CONFIDENTIAL',
      p.hostingEnv || '',
      p.rto || '1 Hour',
      p.rpo || '15 Minutes',
      Boolean(p.internetExposed),
      JSON.stringify(p.factors || {}),
      p.calculatedScore || 0,
      p.proposedTier || 'M',
      p.status || 'PENDING_REVIEW',
      p.notes || '',
      JSON.stringify(p.comments || []),
      p.adminDecisionBy || null,
      p.adminDecisionAt || null,
      p.adminDecisionNotes || null
    ]
  );
  if (result) {
    res.json({ success: true, message: `Pending assessment ${p.id} saved to PostgreSQL` });
  } else {
    res.json({ success: false, bufferedLocally: true });
  }
});

// ==========================================
// VITE / STATIC MIDDLEWARE SETUP
// ==========================================

async function startServer() {
  // Test connection & initialize DB tables asynchronously
  testDbConnection().then(async (res) => {
    console.log(`[PostgreSQL DB Check] ${res.message}`);
    if (res.connected) {
      await initDbTables();
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

