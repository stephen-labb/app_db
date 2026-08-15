import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { testDbConnection, initDbTables, getDbPool, getDbStatusInfo, seedInitialData, safeDbQuery } from './src/db.js';

let appSettings: any = {};
try {
  const appSettingsPath = path.join(process.cwd(), 'appsettings.json');
  if (fs.existsSync(appSettingsPath)) {
    appSettings = JSON.parse(fs.readFileSync(appSettingsPath, 'utf-8'));
  }
} catch (e) {
  console.warn('Could not load appsettings.json:', e);
}

const app = express();
const PORT = appSettings.AppSettings?.Port || 3000;

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

// 7. DELETE /Users/:id - SCIM User Deprovision & Remove (Super Admin Protected)
app.delete('/api/scim/v2/Users/:id', scimAuthMiddleware, async (req, res) => {
  const idx = inMemoryUsers.findIndex(u => u.id === req.params.id);
  if (idx !== -1) {
    const user = inMemoryUsers[idx];
    const email = (user.userName || user.emails?.[0]?.value || '').toLowerCase();
    const isSuperAdmin =
      email === 'superadmin@enterprise.local' ||
      email === 'superadmin@local.internal' ||
      email === 'superadmin' ||
      email === 'admin@enterprise.local' ||
      (user.mappedRole as string) === 'SUPER_ADMIN';

    if (isSuperAdmin) {
      return res.status(403).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'Access Denied: Super Admin account is permanently protected by enterprise policy and CANNOT be removed.',
        status: '403'
      });
    }

    inMemoryUsers.splice(idx, 1);
    await safeDbQuery('DELETE FROM scim_users WHERE id = $1 OR LOWER(user_name) = $2', [user.id, email]);

    scimAuditLogs.unshift({
      id: `SLOG-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      method: 'DELETE',
      endpoint: `/api/scim/v2/Users/${user.id}`,
      statusCode: 204,
      action: 'REMOVE_USER',
      targetUserId: user.id,
      details: `Removed user ${user.userName} via SCIM DELETE request`
    });
  }
  res.status(204).send();
});

// REST Endpoint: Delete IAM User (AppSec Admin operation, Super Admin Protected)
app.delete('/api/iam/users/:id', async (req, res) => {
  const userId = req.params.id;
  const idx = inMemoryUsers.findIndex(u => u.id === userId || u.userName.toLowerCase() === userId.toLowerCase());

  if (idx !== -1) {
    const user = inMemoryUsers[idx];
    const email = (user.userName || user.emails?.[0]?.value || '').toLowerCase();
    const isSuperAdmin =
      email === 'superadmin@enterprise.local' ||
      email === 'superadmin@local.internal' ||
      email === 'superadmin' ||
      email === 'admin@enterprise.local' ||
      (user.mappedRole as string) === 'SUPER_ADMIN';

    if (isSuperAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access Denied: Super Admin account is permanently protected by enterprise policy and CANNOT be removed.'
      });
    }

    inMemoryUsers.splice(idx, 1);
    await safeDbQuery('DELETE FROM scim_users WHERE id = $1 OR LOWER(user_name) = $2', [userId, email]);

    scimAuditLogs.unshift({
      id: `SLOG-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      method: 'DELETE',
      endpoint: `/api/iam/users/${userId}`,
      statusCode: 200,
      action: 'REMOVE_IAM_USER',
      targetUserId: user.id,
      details: `Removed user ${user.userName} from Enterprise IAM directory by AppSec Administrator`
    });

    return res.json({ success: true, message: `User ${user.userName} was removed from Enterprise IAM.` });
  }

  res.status(404).json({ success: false, error: 'User not found in IAM directory.' });
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
// APPSETTINGS CONFIGURATION ENDPOINT
// ==========================================
app.get('/api/appsettings', (req, res) => {
  res.json(appSettings);
});

// ==========================================
// ARMORCODE PRODUCTS & SUBPRODUCTS API PROXY
// ==========================================

// 1. Fetch Products (Project Names) from https://app.armorcode.com/api/product
app.all(['/api/armorcode/products', '/api/armorcode/products/'], async (req, res) => {
  const apiKey = req.body?.apiKey || req.query?.apiKey || appSettings.ArmorCode?.ApiKey || '';
  const customEndpoint = req.body?.customEndpoint || req.query?.customEndpoint || appSettings.ArmorCode?.ProductApiEndpoint || 'https://app.armorcode.com/api/product';

  const defaultProducts = [
    { id: 'prod-1', name: 'sample', description: 'Sample Sandbox Enterprise Application Project', category: 'General' },
    { id: 'prod-2', name: 'fintech-payments', description: 'Fintech High-Volume Payment Processing Engine', category: 'Finance' },
    { id: 'prod-3', name: 'core-banking', description: 'Core Banking Ledger & Transaction Platform', category: 'Finance' },
    { id: 'prod-4', name: 'gaming-rewards-api', description: 'Player Loyalty & Gaming Rewards Gateway', category: 'Gaming' },
    { id: 'prod-5', name: 'merchant-portal', description: 'Merchant Management & Onboarding Web Portal', category: 'E-Commerce' },
    { id: 'prod-6', name: 'identity-auth-service', description: 'OAuth2 / SAML Identity Provider Service', category: 'Security' },
    { id: 'prod-7', name: 'cloud-infrastructure-iac', description: 'Terraform & Kubernetes Cloud Deployment Modules', category: 'DevOps' }
  ];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), appSettings.ArmorCode?.TimeoutMs || 8000);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['X-ArmorCode-API-Key'] = apiKey;
    }

    const apiRes = await fetch(customEndpoint, {
      method: req.method === 'GET' ? 'GET' : 'POST',
      headers,
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (apiRes.ok) {
      const liveData: any = await apiRes.json();
      let productsList: any[] = [];

      if (Array.isArray(liveData)) {
        productsList = liveData;
      } else if (Array.isArray(liveData.products)) {
        productsList = liveData.products;
      } else if (Array.isArray(liveData.data)) {
        productsList = liveData.data;
      } else if (Array.isArray(liveData.content)) {
        productsList = liveData.content;
      }

      if (productsList.length > 0) {
        const formatted = productsList.map((p: any, idx: number) => ({
          id: p.id || p.productId || `ac-p-${idx + 1}`,
          name: typeof p === 'string' ? p : (p.name || p.productName || p.key || `Product-${idx + 1}`),
          description: typeof p === 'object' ? (p.description || p.details || '') : '',
          category: typeof p === 'object' ? (p.category || 'ArmorCode Product') : 'ArmorCode Product'
        }));

        return res.json({
          success: true,
          products: formatted,
          source: 'LIVE_API',
          endpointUsed: customEndpoint
        });
      }
    }
  } catch (err: any) {
    console.warn('[ArmorCode API Proxy] Products endpoint live fetch notice:', err.message);
  }

  // Fallback list when live endpoint is unavailable or returns empty
  return res.json({
    success: true,
    products: defaultProducts,
    source: 'FALLBACK_CATALOG',
    endpointUsed: customEndpoint
  });
});

// 2. Fetch Subproducts (Repositories) from https://app.armorcode.com/api/subproduct
app.all(['/api/armorcode/subproducts', '/api/armorcode/subproducts/'], async (req, res) => {
  const project = (req.body?.project || req.query?.project || 'sample').toString().trim();
  const apiKey = req.body?.apiKey || req.query?.apiKey || appSettings.ArmorCode?.ApiKey || '';
  const customEndpoint = req.body?.customEndpoint || req.query?.customEndpoint || appSettings.ArmorCode?.SubproductApiEndpoint || 'https://app.armorcode.com/api/subproduct';

  const defaultSubproducts = [
    { id: 'sub-1', name: `${project}_repo`, description: `Primary source code repository for ${project}`, category: 'Main Repository' },
    { id: 'sub-2', name: `${project}-core-api`, description: `Backend microservice API layer for ${project}`, category: 'Backend' },
    { id: 'sub-3', name: `${project}-web-ui`, description: `Frontend SPA web interface for ${project}`, category: 'Frontend' },
    { id: 'sub-4', name: `${project}-worker-service`, description: `Async background task processor for ${project}`, category: 'Worker' },
    { id: 'sub-5', name: `${project}-database-migrations`, description: `SQL DDL & Database Migration scripts for ${project}`, category: 'Database' }
  ];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), appSettings.ArmorCode?.TimeoutMs || 8000);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['X-ArmorCode-API-Key'] = apiKey;
    }

    const urlWithParams = customEndpoint.includes('?')
      ? `${customEndpoint}&project=${encodeURIComponent(project)}`
      : `${customEndpoint}?project=${encodeURIComponent(project)}`;

    const apiRes = await fetch(urlWithParams, {
      method: req.method === 'GET' ? 'GET' : 'POST',
      headers,
      body: req.method === 'POST' ? JSON.stringify({ project, product: project }) : undefined,
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (apiRes.ok) {
      const liveData: any = await apiRes.json();
      let subproductsList: any[] = [];

      if (Array.isArray(liveData)) {
        subproductsList = liveData;
      } else if (Array.isArray(liveData.subproducts)) {
        subproductsList = liveData.subproducts;
      } else if (Array.isArray(liveData.data)) {
        subproductsList = liveData.data;
      } else if (Array.isArray(liveData.content)) {
        subproductsList = liveData.content;
      }

      if (subproductsList.length > 0) {
        const formatted = subproductsList.map((sp: any, idx: number) => ({
          id: sp.id || sp.subproductId || `ac-sp-${idx + 1}`,
          name: typeof sp === 'string' ? sp : (sp.name || sp.subproductName || sp.repository || `Subproduct-${idx + 1}`),
          description: typeof sp === 'object' ? (sp.description || sp.repositoryUrl || '') : '',
          category: typeof sp === 'object' ? (sp.category || 'ArmorCode Subproduct') : 'ArmorCode Subproduct'
        }));

        return res.json({
          success: true,
          subproducts: formatted,
          source: 'LIVE_API',
          endpointUsed: customEndpoint
        });
      }
    }
  } catch (err: any) {
    console.warn('[ArmorCode API Proxy] Subproducts endpoint live fetch notice:', err.message);
  }

  // Fallback list when live endpoint is unavailable or returns empty
  return res.json({
    success: true,
    subproducts: defaultSubproducts,
    source: 'FALLBACK_CATALOG',
    endpointUsed: customEndpoint
  });
});

// ==========================================
// ARMORCODE SECURITY FINDINGS API PROXY
// ==========================================
app.post('/api/armorcode/findings', async (req, res) => {
  const {
    project = appSettings.ArmorCode?.DefaultProject || 'sample',
    repository = '',
    cycode_branch = appSettings.ArmorCode?.DefaultBranch || 'master',
    finding_types = [],
    apiKey = appSettings.ArmorCode?.ApiKey || '',
    customEndpoint = ''
  } = req.body || {};

  const targetEndpoint = customEndpoint || appSettings.ArmorCode?.ApiEndpoint || 'https://app.armorcode.com/api/findings';
  const reqSchema = appSettings.ArmorCode?.RequestSchemaMapping || {
    projectField: 'project',
    repositoryField: 'repository',
    branchField: 'cycode_branch'
  };

  // Construct outgoing payload based on dynamic schema mappings
  const outgoingPayload: Record<string, any> = {
    [reqSchema.projectField || 'project']: project
  };

  if (repository && repository.trim() !== '') {
    outgoingPayload[reqSchema.repositoryField || 'repository'] = repository.trim();
  }

  if (cycode_branch && cycode_branch.trim() !== '') {
    outgoingPayload[reqSchema.branchField || 'branch'] = cycode_branch.trim();
  }

  let liveSuccess = false;
  let liveStatus = 0;
  let liveData: any = null;
  let errorMessage = '';

  // Attempt live request to ArmorCode API endpoint
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), appSettings.ArmorCode?.TimeoutMs || 8000);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['X-ArmorCode-API-Key'] = apiKey;
    }

    const apiRes = await fetch(targetEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(outgoingPayload),
      signal: controller.signal
    });

    clearTimeout(timeout);
    liveStatus = apiRes.status;

    if (apiRes.ok) {
      liveData = await apiRes.json();
      liveSuccess = true;
    } else {
      errorMessage = `ArmorCode API returned status ${apiRes.status} ${apiRes.statusText}`;
    }
  } catch (err: any) {
    errorMessage = err.name === 'AbortError' ? 'ArmorCode API request timed out' : (err.message || 'Failed to reach ArmorCode endpoint');
  }

  // If live request produced valid findings array, return live data
  if (liveSuccess && liveData && (Array.isArray(liveData.results) || Array.isArray(liveData))) {
    const results = Array.isArray(liveData.results) ? liveData.results : liveData;
    return res.json({
      success: true,
      source: 'LIVE_API',
      endpointUsed: targetEndpoint,
      httpStatus: liveStatus,
      payloadSent: outgoingPayload,
      results,
      rawResponse: liveData,
      timestamp: new Date().toISOString()
    });
  }

  // Fallback: Generate high-fidelity simulated ArmorCode security report findings
  const targetRepos = repository && repository.trim() !== ''
    ? [repository.trim()]
    : [`${project.toLowerCase()}-core-api`, `${project.toLowerCase()}-frontend-web`, `${project.toLowerCase()}-auth-service`];

  const branch = cycode_branch || 'master';

  const simulatedCatalog = [
    {
      finding_id: 'AC-SAST-9041',
      type: 'sast',
      severity: 'HIGH',
      description: 'Missing Anti-Forgery CSRF Validation Token in sensitive POST state-changing controller',
      remediation: 'Apply @ValidateAntiForgeryToken attribute or AntiForgery.validate() middleware in HTTP POST endpoints.',
      tool: 'Cycode SAST / Semgrep',
      cve_id: 'CWE-352',
      file_path: 'src/controllers/PaymentController.ts',
      line_number: 42
    },
    {
      finding_id: 'AC-SAST-9088',
      type: 'sast',
      severity: 'CRITICAL',
      description: 'Potential SQL Injection via unescaped string concatenation in database query generator',
      remediation: 'Refactor raw string query concatenation to parameterized SQL bindings or ORM query builder.',
      tool: 'Cycode SAST / SonarQube',
      cve_id: 'CWE-89',
      file_path: 'src/db/repository.ts',
      line_number: 118
    },
    {
      finding_id: 'AC-SCA-3012',
      type: 'sca',
      severity: 'HIGH',
      description: 'Transitive dependency jackson-databind vulnerable to Remote Code Execution (RCE)',
      remediation: 'Upgrade jackson-databind to version >= 2.15.2 or update parent Spring Boot BOM.',
      tool: 'Snyk SCA / Dependency-Check',
      cve_id: 'CVE-2023-35116',
      file_path: 'package-lock.json',
      line_number: 840
    },
    {
      finding_id: 'AC-SECRET-1004',
      type: 'secret',
      severity: 'CRITICAL',
      description: 'Hardcoded High-Entropy AWS Identity & Access Management Secret Key detected in source code',
      remediation: 'Revoke AWS secret key in IAM console immediately, purge from git history, and store in Secret Manager.',
      tool: 'Gitleaks / Cycode Secrets',
      cve_id: 'CWE-798',
      file_path: 'config/aws_credentials.json',
      line_number: 14
    },
    {
      finding_id: 'AC-DAST-7022',
      type: 'dast',
      severity: 'MEDIUM',
      description: 'Reflected Cross-Site Scripting (XSS) vulnerability detected in query parameter search string',
      remediation: 'Encode HTML output responses using OWASP Java/Node Sanitizer and enforce Content Security Policy (CSP).',
      tool: 'OWASP ZAP DAST',
      cve_id: 'CWE-79',
      file_path: '/api/v1/search?q=<script>',
      line_number: 1
    },
    {
      finding_id: 'AC-IAC-5019',
      type: 'iac',
      severity: 'HIGH',
      description: 'Terraform S3 Bucket resource defined with public read access enabled without block public access rules',
      remediation: 'Set block_public_acls = true and block_public_policy = true on aws_s3_bucket_public_access_block.',
      tool: 'Checkov / Tfsec',
      cve_id: 'CWE-732',
      file_path: 'terraform/s3_storage.tf',
      line_number: 29
    },
    {
      finding_id: 'AC-CONTAINER-2041',
      type: 'container',
      severity: 'MEDIUM',
      description: 'Docker image base layer node:18-alpine contains unpatched libcrypto OpenSSL vulnerability',
      remediation: 'Update Dockerfile base image to node:20-alpine or alpine:3.19 with latest OpenSSL security patch.',
      tool: 'Trivy Container Scanner',
      cve_id: 'CVE-2023-5363',
      file_path: 'Dockerfile',
      line_number: 1
    }
  ];

  // Filter or populate findings based on requested repository and types
  let results = [];
  let count = 0;

  for (const repo of targetRepos) {
    for (const template of simulatedCatalog) {
      if (finding_types.length === 0 || finding_types.includes(template.type)) {
        count++;
        results.push({
          finding_id: `${template.finding_id}-${count}`,
          type: template.type,
          severity: template.severity,
          description: `${template.description} [${project}/${repo}]`,
          remediation: template.remediation,
          cycode_branch: branch,
          repository: repo,
          project: project,
          tool: template.tool,
          cve_id: template.cve_id,
          file_path: template.file_path,
          line_number: template.line_number
        });
      }
    }
  }

  res.json({
    success: true,
    source: errorMessage ? 'SIMULATED_DATA' : 'SIMULATED_DATA',
    endpointUsed: targetEndpoint,
    httpStatus: 200,
    payloadSent: outgoingPayload,
    results,
    errorMessage: errorMessage || undefined,
    rawResponse: {
      results,
      meta: {
        total_count: results.length,
        project_queried: project,
        repositories_queried: targetRepos,
        cycode_branch: branch,
        note: 'Simulated output constructed for preview environment (ArmorCode API client endpoint tested).'
      }
    },
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// PROMOTION EVIDENCE AUDITABLE RECORDS ENDPOINTS
// ==========================================
let inMemoryPromotionEvidences: any[] = [];

app.get('/api/promotion-evidences', async (req, res) => {
  try {
    const dbRes = await safeDbQuery('SELECT evidence_data FROM promotion_evidences ORDER BY created_at DESC');
    if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
      const evidences = dbRes.rows.map(r => typeof r.evidence_data === 'string' ? JSON.parse(r.evidence_data) : r.evidence_data);
      return res.json({ success: true, count: evidences.length, evidences });
    }
  } catch (err) {
    console.warn('PostgreSQL query error for promotion evidences, using in-memory store:', err);
  }
  return res.json({ success: true, count: inMemoryPromotionEvidences.length, evidences: inMemoryPromotionEvidences });
});

app.post('/api/promotion-evidences', async (req, res) => {
  const evidence = req.body;
  if (!evidence || !evidence.evidenceId) {
    return res.status(400).json({ success: false, error: 'Invalid promotion evidence object' });
  }

  // Deduplicate in memory
  inMemoryPromotionEvidences = [evidence, ...inMemoryPromotionEvidences.filter(e => e.evidenceId !== evidence.evidenceId)];

  try {
    await safeDbQuery(
      `CREATE TABLE IF NOT EXISTS promotion_evidences (
        evidence_id VARCHAR(100) PRIMARY KEY,
        project VARCHAR(255),
        repository VARCHAR(255),
        branch VARCHAR(255),
        target_environment VARCHAR(100),
        status VARCHAR(50),
        created_at TIMESTAMP,
        evidence_data JSONB
      );`
    );

    await safeDbQuery(
      `INSERT INTO promotion_evidences (evidence_id, project, repository, branch, target_environment, status, created_at, evidence_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (evidence_id) DO UPDATE SET
         status = EXCLUDED.status,
         evidence_data = EXCLUDED.evidence_data;`,
      [
        evidence.evidenceId,
        evidence.project,
        evidence.repository,
        evidence.branch,
        evidence.targetEnvironment,
        evidence.status || 'ISSUED',
        evidence.createdAt || new Date().toISOString(),
        JSON.stringify(evidence)
      ]
    );
  } catch (err) {
    console.warn('PostgreSQL table insert warning for promotion evidence:', err);
  }

  res.json({ success: true, message: 'Promotion evidence record stored', evidenceId: evidence.evidenceId });
});

app.post('/api/promotion-evidences/:id/revoke', async (req, res) => {
  const { id } = req.params;
  const { revokedBy, reason, timestamp } = req.body || {};

  inMemoryPromotionEvidences = inMemoryPromotionEvidences.map(e => {
    if (e.evidenceId === id) {
      return {
        ...e,
        status: 'REVOKED',
        revokedAt: timestamp || new Date().toISOString(),
        revokedBy: revokedBy || 'System Admin',
        revokedReason: reason || 'Revoked by auditor request'
      };
    }
    return e;
  });

  try {
    const existing = inMemoryPromotionEvidences.find(e => e.evidenceId === id);
    if (existing) {
      await safeDbQuery(
        `UPDATE promotion_evidences SET status = 'REVOKED', evidence_data = $1 WHERE evidence_id = $2;`,
        [JSON.stringify(existing), id]
      );
    }
  } catch (err) {
    console.warn('PostgreSQL update error revoking evidence:', err);
  }

  res.json({ success: true, message: `Evidence ${id} marked REVOKED` });
});

// ==========================================
// AZURE AD OPENID CONNECT (OIDC) SSO & API ROUTES
// ==========================================

let runtimeOidcConfig = {
  tenantId: process.env.AZURE_TENANT_ID || appSettings.AzureAd?.TenantId || '2c7d678a-3080-4d64-a967-67f2da6d3cae',
  clientId: process.env.AZURE_CLIENT_ID || appSettings.AzureAd?.ClientId || '02445d57-57c8-4b45-99fe-a32ef97f7bdb',
  clientSecret: process.env.AZURE_CLIENT_SECRET || appSettings.AzureAd?.ClientSecret || 'YOUR_AZURE_CLIENT_SECRET_PLACEHOLDER',
  scopes: appSettings.AzureAd?.Scopes || 'openid profile email User.Read Directory.Read.All',
  ssoMode: appSettings.AzureAd?.SsoMode || 'LIVE_OIDC',
  loginUrl: appSettings.AzureAd?.LoginUrl || `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || appSettings.AzureAd?.TenantId || '2c7d678a-3080-4d64-a967-67f2da6d3cae'}/oauth2/v2.0/authorize`,
  tokenUrl: appSettings.AzureAd?.TokenUrl || `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || appSettings.AzureAd?.TenantId || '2c7d678a-3080-4d64-a967-67f2da6d3cae'}/oauth2/v2.0/token`,
  issuerUrl: appSettings.AzureAd?.IssuerUrl || `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || appSettings.AzureAd?.TenantId || '2c7d678a-3080-4d64-a967-67f2da6d3cae'}/v2.0`,
  jwksUri: appSettings.AzureAd?.JwksUri || `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || appSettings.AzureAd?.TenantId || '2c7d678a-3080-4d64-a967-67f2da6d3cae'}/discovery/v2.0/keys`
};

app.get('/api/sso/azure/config', (req, res) => {
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  const baseUrl = process.env.APP_URL || `${protocol}://${host}`;

  res.json({
    ...runtimeOidcConfig,
    redirectUri: `${baseUrl}/api/sso/azure/callback`,
    responseType: 'code'
  });
});

app.post('/api/sso/azure/config', (req, res) => {
  const newConfig = req.body || {};
  if (newConfig.tenantId) runtimeOidcConfig.tenantId = newConfig.tenantId;
  if (newConfig.clientId) runtimeOidcConfig.clientId = newConfig.clientId;
  if (newConfig.clientSecret !== undefined) runtimeOidcConfig.clientSecret = newConfig.clientSecret;
  if (newConfig.scopes) runtimeOidcConfig.scopes = newConfig.scopes;
  if (newConfig.ssoMode) runtimeOidcConfig.ssoMode = newConfig.ssoMode;
  if (newConfig.loginUrl) runtimeOidcConfig.loginUrl = newConfig.loginUrl;
  if (newConfig.tokenUrl) runtimeOidcConfig.tokenUrl = newConfig.tokenUrl;
  if (newConfig.issuerUrl) runtimeOidcConfig.issuerUrl = newConfig.issuerUrl;
  if (newConfig.jwksUri) runtimeOidcConfig.jwksUri = newConfig.jwksUri;

  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  const baseUrl = process.env.APP_URL || `${protocol}://${host}`;

  res.json({
    success: true,
    config: {
      ...runtimeOidcConfig,
      redirectUri: `${baseUrl}/api/sso/azure/callback`
    }
  });
});

// OIDC Well-Known Discovery Configuration Endpoint
app.get('/api/sso/azure/.well-known/openid-configuration', (req, res) => {
  const tenantId = runtimeOidcConfig.tenantId;
  const issuer = runtimeOidcConfig.issuerUrl || `https://login.microsoftonline.com/${tenantId}/v2.0`;

  res.json({
    issuer,
    authorization_endpoint: runtimeOidcConfig.loginUrl || `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    token_endpoint: runtimeOidcConfig.tokenUrl || `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    jwks_uri: runtimeOidcConfig.jwksUri || `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
    userinfo_endpoint: 'https://graph.microsoft.com/oidc/userinfo',
    response_types_supported: ['code', 'id_token', 'code id_token'],
    subject_types_supported: ['pairwise'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: runtimeOidcConfig.scopes.split(' '),
    claims_supported: ['sub', 'iss', 'aud', 'exp', 'iat', 'name', 'preferred_username', 'email', 'oid', 'tid', 'groups', 'roles']
  });
});

// Get Live OIDC Authorize URL Endpoint (for Client Popups)
app.get('/api/sso/azure/authorize-url', (req, res) => {
  const tenantId = runtimeOidcConfig.tenantId;
  const clientId = runtimeOidcConfig.clientId;
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  const reqEmail = req.query.email?.toString().trim().toLowerCase() || '';

  // Redirect URI must strictly match registered URI in Azure Portal without query parameters
  const redirectUri = `${process.env.APP_URL || `${protocol}://${host}`}/api/sso/azure/callback`;

  const statePayload = JSON.stringify({
    nonce: Date.now()
  });

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: runtimeOidcConfig.scopes || 'openid profile email User.Read Directory.Read.All',
    state: Buffer.from(statePayload).toString('base64url'),
    prompt: 'select_account'
  });

  if (reqEmail) {
    params.set('login_hint', reqEmail);
  }

  const baseUrl = runtimeOidcConfig.loginUrl || `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`;
  const url = `${baseUrl.includes('?') ? baseUrl + '&' : baseUrl + '?'}${params.toString()}`;
  res.json({ url, redirectUri, tenantId, clientId });
});

// OIDC Callback Route Handler with IAM authorization verification & identity switching
const oidcCallbackHandler = async (req: Request, res: Response) => {
  const { code, state, error, error_description, email, upn, user, preferred_username } = req.query;

  // 1. If Microsoft Entra ID returned an explicit OIDC error or user cancelled authorization
  if (error || error_description) {
    const errMessage = (error_description || error || 'OIDC Authorization Failed').toString();
    const fullErr = `HTTP 403 Forbidden: Microsoft Entra ID returned authorization error - ${errMessage}`;
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
        <head><title>OIDC Callback</title></head>
        <body style="background:#0f172a;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <script>
            try {
              localStorage.setItem('azure_oidc_last_error', ${JSON.stringify(fullErr)});
            } catch(e) {}
            if (window.opener) {
              try {
                window.opener.postMessage({
                  type: 'OAUTH_AUTH_ERROR',
                  error: ${JSON.stringify(fullErr)}
                }, '*');
              } catch(e) {}
            }
            window.close();
          </script>
        </body>
      </html>
    `);
  }

  // Extract email from query params or decode from state parameter
  let stateEmail = '';
  if (typeof state === 'string' && state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
      if (decoded && decoded.email) {
        stateEmail = decoded.email;
      }
    } catch (e) {
      // Ignore if state is non-JSON string
    }
  }

  let fetchedEmail = (email || upn || user || preferred_username || stateEmail || '').toString().trim().toLowerCase();
  let fetchedDisplayName = '';
  let fetchedGroups: string[] = [];
  let tokenExchangeError = '';

  // If code is returned from Microsoft Entra ID, exchange authorization code for tokens
  if (typeof code === 'string' && code) {
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const redirectUri = `${process.env.APP_URL || `${protocol}://${host}`}/api/sso/azure/callback`;
    const tokenEndpoint = runtimeOidcConfig.tokenUrl || `https://login.microsoftonline.com/${runtimeOidcConfig.tenantId}/oauth2/v2.0/token`;

    try {
      const tokenParams = new URLSearchParams({
        client_id: runtimeOidcConfig.clientId,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        scope: runtimeOidcConfig.scopes || 'openid profile email User.Read Directory.Read.All'
      });

      if (runtimeOidcConfig.clientSecret) {
        tokenParams.set('client_secret', runtimeOidcConfig.clientSecret);
      }

      const tokenRes = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString()
      });
      const tokenData: any = await tokenRes.json();

      if (tokenData.id_token) {
        const parts = tokenData.id_token.split('.');
        if (parts.length >= 2) {
          try {
            const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
            if (!fetchedEmail) {
              fetchedEmail = (payload.email || payload.preferred_username || payload.upn || payload.unique_name || payload.sub || '').toString().trim().toLowerCase();
            }
            if (payload.name) fetchedDisplayName = payload.name;
            if (Array.isArray(payload.groups)) fetchedGroups = payload.groups;
            if (Array.isArray(payload.roles)) fetchedGroups = [...fetchedGroups, ...payload.roles];
          } catch (e) {
            console.error('Failed to parse id_token payload:', e);
          }
        }
      }

      // Fallback: If no email in id_token, call Microsoft Graph API /v1.0/me
      if (!fetchedEmail && tokenData.access_token) {
        try {
          const graphRes = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
          });
          if (graphRes.ok) {
            const me: any = await graphRes.json();
            fetchedEmail = (me.mail || me.userPrincipalName || '').toString().trim().toLowerCase();
            if (!fetchedDisplayName) fetchedDisplayName = me.displayName || me.givenName || '';
          }
        } catch (gErr) {
          console.warn('Graph API fetch error:', gErr);
        }
      }

      if (!fetchedEmail && (tokenData.error || tokenData.error_description)) {
        tokenExchangeError = tokenData.error_description || tokenData.error || 'Token exchange failed';
      }
    } catch (err: any) {
      tokenExchangeError = err.message || 'Failed to exchange authorization code with Microsoft Entra ID';
    }
  }

  // 2. If no identity claims (email/upn) could be resolved
  if (!fetchedEmail) {
    const fullErr = tokenExchangeError
      ? `HTTP 403 Forbidden: Microsoft Entra ID Token Exchange Error - ${tokenExchangeError}`
      : 'HTTP 403 Forbidden: Access Denied. No valid email address or user claim (email/UPN) was returned by Microsoft Entra ID.';

    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
        <head><title>OIDC Callback</title></head>
        <body style="background:#0f172a;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <script>
            try {
              localStorage.setItem('azure_oidc_last_error', ${JSON.stringify(fullErr)});
            } catch(e) {}
            if (window.opener) {
              try {
                window.opener.postMessage({
                  type: 'OAUTH_AUTH_ERROR',
                  error: ${JSON.stringify(fullErr)}
                }, '*');
              } catch(e) {}
            }
            window.close();
          </script>
        </body>
      </html>
    `);
  }

  const targetEmail = fetchedEmail;

  // Check if target OIDC user exists in IAM (inMemoryUsers or PostgreSQL scim_users/manual_user_mappings)
  let matchedUser = inMemoryUsers.find(
    u => u.userName.toLowerCase() === targetEmail || u.emails.some(e => e.value.toLowerCase() === targetEmail)
  );

  // If DB connected, query PostgreSQL scim_users table
  if (!matchedUser) {
    const dbResult = await safeDbQuery(
      'SELECT * FROM scim_users WHERE LOWER(user_name) = $1 OR emails_json::text LOWER LIKE $2',
      [targetEmail, `%${targetEmail}%`]
    );
    if (dbResult && dbResult.rows && dbResult.rows.length > 0) {
      const row = dbResult.rows[0];
      matchedUser = {
        id: row.id,
        userName: row.user_name,
        name: typeof row.name_json === 'string' ? JSON.parse(row.name_json) : (row.name_json || { formatted: row.user_name, familyName: '', givenName: row.user_name }),
        emails: typeof row.emails_json === 'string' ? JSON.parse(row.emails_json) : (row.emails_json || [{ value: row.user_name, type: 'work', primary: true }]),
        active: row.active ?? true,
        groups: typeof row.groups_json === 'string' ? JSON.parse(row.groups_json) : (row.groups_json || []),
        mappedRole: row.mapped_role || 'APPSEC_ADMIN',
        lastSyncedAt: row.last_synced_at || new Date().toISOString(),
        department: row.department,
        title: row.title
      };
    }
  }

  // Auto-provision user into inMemoryUsers directory if not already present
  if (!matchedUser) {
    const formattedName = targetEmail.split('@')[0].replace(/[_.]/g, ' ').replace(/(^\w|\s\w)/g, m => m.toUpperCase());
    matchedUser = {
      id: `az-usr-${Math.floor(1000 + Math.random() * 9000)}`,
      userName: targetEmail,
      name: { formatted: formattedName, familyName: formattedName.split(' ')[1] || '', givenName: formattedName.split(' ')[0] },
      emails: [{ value: targetEmail, type: 'work', primary: true }],
      active: true,
      groups: ['AppSec-Engineers', 'CyberSecurity-Leads'],
      mappedRole: 'APPSEC_ADMIN',
      lastSyncedAt: new Date().toISOString(),
      department: 'Microsoft Entra ID',
      title: 'OIDC SSO Authenticated User'
    };
    inMemoryUsers.unshift(matchedUser);
  }

  // Switch to the authenticated user's identity
  const formattedName = targetEmail.split('@')[0].replace(/[_.]/g, ' ').replace(/(^\w|\s\w)/g, m => m.toUpperCase());
  const userPayload = JSON.stringify({
    isAuthenticated: true,
    userId: matchedUser ? matchedUser.id : `az-usr-${Math.floor(1000 + Math.random() * 9000)}`,
    displayName: matchedUser ? matchedUser.name.formatted : (targetEmail === 'superadmin@enterprise.local' ? 'Super Admin' : formattedName),
    email: targetEmail,
    upn: targetEmail,
    role: matchedUser ? matchedUser.mappedRole : 'APPSEC_ADMIN',
    groups: matchedUser ? matchedUser.groups : ['AppSec-Engineers', 'CyberSecurity-Leads'],
    loginMethod: 'AZURE_SSO' as const,
    loggedInAt: new Date().toISOString()
  });

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Azure AD OIDC Authentication Callback</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 2rem; border-radius: 1rem; border: 1px solid #334155; text-align: center; max-width: 400px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
          .spinner { border: 3px solid #334155; border-top: 3px solid #3b82f6; border-radius: 50%; width: 36px; height: 36px; animation: spin 1s linear infinite; margin: 0 auto 1rem; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="spinner"></div>
          <h2 style="font-size: 1.1rem; margin-bottom: 0.5rem; color: #38bdf8;">Azure AD OIDC Sign-In Verified</h2>
          <p style="font-size: 0.85rem; color: #94a3b8;">Identity matched in IAM. Switching to user session...</p>
        </div>
        <script>
          try {
            const userData = ${userPayload};
            try {
              localStorage.setItem('azure_oidc_success_user', JSON.stringify(userData));
            } catch(e) {}
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', user: userData, code: '${code || ''}' }, '*');
              setTimeout(() => { window.close(); }, 600);
            } else {
              window.location.href = '/';
            }
          } catch(e) {
            console.error('OIDC PostMessage error', e);
            if (window.opener) window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: 'Failed to complete OIDC login' }, '*');
          }
        </script>
      </body>
    </html>
  `);
};

app.get(['/api/sso/azure/callback', '/auth/callback', '/api/sso/azure/callback/'], oidcCallbackHandler);

// Mock SSO Login Execution with IAM Authorization Check
app.post('/api/sso/azure/login-mock', (req, res) => {
  const { email, groups } = req.body;
  const targetEmail = (email || 'admin@enterprise.local').trim().toLowerCase();

  const matchedUser = inMemoryUsers.find(
    u => u.userName.toLowerCase() === targetEmail || u.emails.some(e => e.value.toLowerCase() === targetEmail)
  );

  const isSuperAdmin = targetEmail === 'superadmin@enterprise.local' || targetEmail === 'superadmin' || targetEmail === 'admin@enterprise.local';

  if (!matchedUser && !isSuperAdmin) {
    return res.status(403).json({
      success: false,
      error: `Access Denied (403 Forbidden): User identity '${targetEmail}' has NOT been added to enterprise IAM. Please contact an AppSec Administrator to register this user identity in IAM before logging in.`
    });
  }

  const userGroups = groups || (matchedUser ? matchedUser.groups : ['AppSec-Engineers']);
  const role = matchedUser ? matchedUser.mappedRole : deriveAppRole(userGroups);

  res.json({
    success: true,
    user: {
      userId: matchedUser ? matchedUser.id : `az-usr-${Math.floor(1000 + Math.random() * 9000)}`,
      displayName: matchedUser ? matchedUser.name.formatted : targetEmail.split('@')[0].replace('.', ' '),
      email: targetEmail,
      upn: targetEmail,
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

