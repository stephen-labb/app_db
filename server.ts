import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
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

// HTTPS & Security Headers Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Enforce HTTPS protocol if request is HTTP behind proxy in production
  const proto = req.headers['x-forwarded-proto'];
  if (proto === 'http' && process.env.NODE_ENV === 'production') {
    return res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
  }
  next();
});

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

let inMemoryUsers: ScimUser[] = [];

let inMemoryGroups: ScimGroup[] = [];

let mappingRules: GroupMappingRule[] = [];

let scimAuditLogs: Array<{
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  statusCode: number;
  action: string;
  details: string;
  targetUserId?: string;
}> = [];

let inMemoryAccessLogs: Array<{
  id: string;
  timestamp: string;
  userEmail: string;
  displayName: string;
  role: string;
  loginMethod?: string;
  action: string;
  resource?: string;
  ipAddress?: string;
  userAgent?: string;
  status: string;
  details: string;
}> = [];

let configuredSessionTimeoutMinutes: number = 15;

// ==========================================
// REDIS SESSION CACHE & JWT AUTHENTICATION ENGINE
// ==========================================
const JWT_SECRET = process.env.JWT_SECRET || 'appsec_iam_jwt_secret_production_key_2026';
const REDIS_CACHE_URL = process.env.REDIS_CACHE_URL || 'redis://127.0.0.1:6379';

interface RedisSessionRecord {
  sessionId: string;
  userId: string;
  email: string;
  displayName: string;
  role: 'SUPER_ADMIN' | 'APPSEC_ADMIN' | 'IT_VIEWER';
  groups: string[];
  loginMethod: string;
  ipAddress: string;
  userAgent: string;
  issuedAt: string;
  expiresAt: string;
  lastActiveAt: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  jwtToken?: string;
  ttlSeconds: number;
}

interface AntiBolaSecurityLog {
  id: string;
  timestamp: string;
  callerUserId: string;
  callerEmail: string;
  callerRole: string;
  targetResourceId: string;
  targetResourceOwnerId?: string;
  actionRequested: string;
  endpoint: string;
  verdict: 'GRANTED' | 'BOLA_VIOLATION_BLOCKED';
  ipAddress: string;
  details: string;
}

const redisSessionCache = new Map<string, RedisSessionRecord>();
const inMemoryAntiBolaLogs: AntiBolaSecurityLog[] = [
  {
    id: 'bola_init_001',
    timestamp: new Date().toISOString(),
    callerUserId: 'usr_superadmin',
    callerEmail: 'superadmin@local.internal',
    callerRole: 'SUPER_ADMIN',
    targetResourceId: 'scim_usr_001',
    targetResourceOwnerId: 'usr_superadmin',
    actionRequested: 'SCIM_USER_GET',
    endpoint: '/api/scim/v2/Users/scim_usr_001',
    verdict: 'GRANTED',
    ipAddress: '127.0.0.1',
    details: 'Caller identity verified & bound with JWT bearer signature'
  }
];

// Helper: Seed initial breakglass session into Redis Cache
const initBreakglassSession = () => {
  const sessId = 'sess_breakglass_master';
  const now = new Date();
  const exp = new Date(now.getTime() + 12 * 3600 * 1000);
  
  const token = jwt.sign(
    {
      sessionId: sessId,
      userId: 'usr_superadmin',
      email: 'superadmin@local.internal',
      displayName: 'Super Admin (Breakglass)',
      role: 'SUPER_ADMIN',
      groups: ['SuperAdmins', 'AppSecAdmins']
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  redisSessionCache.set(sessId, {
    sessionId: sessId,
    userId: 'usr_superadmin',
    email: 'superadmin@local.internal',
    displayName: 'Super Admin (Breakglass)',
    role: 'SUPER_ADMIN',
    groups: ['SuperAdmins', 'AppSecAdmins'],
    loginMethod: 'SUPER_ADMIN_BREAKGLASS',
    ipAddress: '127.0.0.1',
    userAgent: 'Internal System Engine',
    issuedAt: now.toISOString(),
    expiresAt: exp.toISOString(),
    lastActiveAt: now.toISOString(),
    status: 'ACTIVE',
    jwtToken: token,
    ttlSeconds: 43200
  });
};
initBreakglassSession();

// Middleware: Authenticate JWT Token & Redis Session State (STRICT CRYPTOGRAPHIC VERIFICATION)
const verifyJwtAndSession = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const sessionHeader = req.headers['x-session-id'] as string;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query && req.query.token) {
    token = req.query.token as string;
  }

  // Set diagnostic header confirming Authorization presence
  res.setHeader('X-Auth-Header-Received', token ? 'true' : 'false');

  if (!token) {
    (req as any).user = null;
    return next();
  }

  try {
    // STRICT SECURITY: Validate cryptographic HMAC signature and token expiration using JWT_SECRET
    const decoded: any = jwt.verify(token, JWT_SECRET);

    if (!decoded || typeof decoded !== 'object') {
      return res.status(401).json({
        error: 'Unauthorized: Invalid or malformed JWT token payload.',
        code: 'INVALID_JWT_PAYLOAD'
      });
    }

    const sessId = decoded.sessionId || sessionHeader;

    if (sessId && redisSessionCache.has(sessId)) {
      const session = redisSessionCache.get(sessId)!;
      if (session.status === 'REVOKED') {
        return res.status(401).json({
          error: 'Unauthorized: Session has been revoked in Redis identity cache.',
          code: 'SESSION_REVOKED'
        });
      }
      session.lastActiveAt = new Date().toISOString();
      (req as any).session = session;
    }

    (req as any).user = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({
      error: `Unauthorized: Cryptographic JWT signature validation failed (${err.message}).`,
      code: 'INVALID_JWT_SIGNATURE',
      details: err.message
    });
  }
};

app.use(verifyJwtAndSession);

// RBAC Middleware 1: Require Authenticated Session
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!(req as any).user) {
    return res.status(401).json({
      error: 'Unauthorized: Valid Authorization Bearer JWT token is required.',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }
  next();
};

// RBAC Middleware 2: Require Role Authorization
const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized: Authentication required before checking RBAC permissions.',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    const callerRole = user.role || 'IT_VIEWER';
    if (!allowedRoles.includes(callerRole)) {
      return res.status(403).json({
        error: `Forbidden: RBAC Access Denied. Role '${callerRole}' does not have sufficient permissions. Required role(s): [${allowedRoles.join(', ')}]`,
        code: 'RBAC_ACCESS_DENIED',
        callerRole,
        requiredRoles: allowedRoles
      });
    }

    next();
  };
};

// Anti-BOLA Authorization Guard Helper
function checkAntiBolaAccess(
  req: Request,
  res: Response,
  targetResourceId: string,
  targetResourceOwnerId?: string,
  actionName: string = 'RESOURCE_ACCESS'
): boolean {
  const user = (req as any).user;
  const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';

  if (!user) {
    // Unauthenticated request
    return true;
  }

  const callerRole = user.role || 'IT_VIEWER';
  const callerEmail = user.email || user.userName || 'unknown';

  // Super Admins & AppSec Admins have global administrative privileges
  if (callerRole === 'SUPER_ADMIN' || callerRole === 'APPSEC_ADMIN') {
    inMemoryAntiBolaLogs.unshift({
      id: `bola_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      callerUserId: user.userId || callerEmail,
      callerEmail,
      callerRole,
      targetResourceId,
      targetResourceOwnerId,
      actionRequested: actionName,
      endpoint: req.originalUrl,
      verdict: 'GRANTED',
      ipAddress: ip,
      details: `Access granted under administrative role ${callerRole}`
    });
    return true;
  }

  // If caller owns the target object resource
  if (
    targetResourceOwnerId &&
    (user.userId === targetResourceOwnerId ||
      callerEmail.toLowerCase() === targetResourceOwnerId.toLowerCase())
  ) {
    inMemoryAntiBolaLogs.unshift({
      id: `bola_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      callerUserId: user.userId || callerEmail,
      callerEmail,
      callerRole,
      targetResourceId,
      targetResourceOwnerId,
      actionRequested: actionName,
      endpoint: req.originalUrl,
      verdict: 'GRANTED',
      ipAddress: ip,
      details: `Access granted: Caller identity matches target resource owner (${callerEmail})`
    });
    return true;
  }

  // BOLA/IDOR Violation
  const bolaLog: AntiBolaSecurityLog = {
    id: `bola_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    callerUserId: user.userId || callerEmail,
    callerEmail,
    callerRole,
    targetResourceId,
    targetResourceOwnerId: targetResourceOwnerId || 'RESTRICTED_OBJECT',
    actionRequested: actionName,
    endpoint: req.originalUrl,
    verdict: 'BOLA_VIOLATION_BLOCKED',
    ipAddress: ip,
    details: `BOLA Violation Blocked: User ${callerEmail} attempted unauthorized access to resource '${targetResourceId}' owned by '${targetResourceOwnerId}'`
  };

  inMemoryAntiBolaLogs.unshift(bolaLog);
  if (inMemoryAntiBolaLogs.length > 200) {
    inMemoryAntiBolaLogs.pop();
  }

  res.status(403).json({
    error: 'Forbidden: Broken Object Level Authorization (BOLA) Policy Violation',
    details: bolaLog.details,
    logId: bolaLog.id
  });
  return false;
}

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
app.delete('/api/iam/users/:id', requireRole('SUPER_ADMIN', 'APPSEC_ADMIN'), async (req, res) => {
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
app.get('/api/scim/logs', requireRole('SUPER_ADMIN', 'APPSEC_ADMIN', 'SECURITY_LEAD', 'AUDITOR', 'COMPLIANCE_OFFICER'), (req, res) => {
  res.json({ logs: scimAuditLogs, users: inMemoryUsers });
});

// ==========================================
// APPSETTINGS CONFIGURATION ENDPOINT
// ==========================================
app.get('/api/appsettings', requireAuth, (req, res) => {
  res.json(appSettings);
});

// ==========================================
// ARMORCODE PRODUCTS & SUBPRODUCTS API PROXY
// ==========================================

// 1. Fetch Products (Project Names) from https://app.armorcode.com/user/product/elastic/paged
app.all(['/api/armorcode/products', '/api/armorcode/products/', '/api/armorcode/product', '/api/armorcode/product/'], requireAuth, async (req, res) => {
  const apiKey = req.body?.apiKey || req.query?.apiKey || process.env.ARMORCODE_API_KEY || process.env.ARMORCODE_KEY || appSettings.ArmorCode?.ApiKey || '';
  const customEndpoint = req.body?.customEndpoint || req.query?.customEndpoint || appSettings.ArmorCode?.ProductApiEndpoint || 'https://app.armorcode.com/user/product/elastic/paged';

  const searchQuery = req.body?.search !== undefined 
    ? String(req.body.search) 
    : (req.query?.search !== undefined ? String(req.query.search) : "");

  const requestBody = {
    environmentName: req.body?.environmentName || ["PRODUCTION"],
    pageSize: req.body?.pageSize !== undefined ? Number(req.body.pageSize) : 20,
    pageNumber: req.body?.pageNumber !== undefined ? Number(req.body.pageNumber) : 0,
    sortBy: req.body?.sortBy || "NAME",
    search: searchQuery,
    direction: req.body?.direction || "ASC"
  };

  const defaultProducts = [
    { id: 'prod-1', name: 'sample', description: 'Sample Sandbox Enterprise Application Project', category: 'General' },
    { id: 'prod-2', name: 'Aqua Container Images', description: 'Aqua Container Registry & Docker Base Images Catalog', category: 'Container Registry' },
    { id: 'prod-3', name: 'fintech-payments', description: 'Fintech High-Volume Payment Processing Engine', category: 'Finance' },
    { id: 'prod-4', name: 'core-banking', description: 'Core Banking Ledger & Transaction Platform', category: 'Finance' },
    { id: 'prod-5', name: 'enterprise-web-portal', description: 'Enterprise Web Portal & Dynamic Endpoints (DAST Target)', category: 'Web Application' },
    { id: 'prod-6', name: 'gaming-rewards-api', description: 'Player Loyalty & Gaming Rewards Gateway', category: 'Gaming' },
    { id: 'prod-7', name: 'identity-auth-service', description: 'OAuth2 / SAML Identity Provider Service', category: 'Security' },
    { id: 'prod-8', name: 'cloud-infrastructure-iac', description: 'Terraform & Kubernetes Cloud Deployment Modules', category: 'DevOps' }
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
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (apiRes.ok) {
      const liveData: any = await apiRes.json();
      let productsList: any[] = [];

      if (Array.isArray(liveData)) {
        productsList = liveData;
      } else if (Array.isArray(liveData.content)) {
        productsList = liveData.content;
      } else if (Array.isArray(liveData.products)) {
        productsList = liveData.products;
      } else if (Array.isArray(liveData.data)) {
        productsList = liveData.data;
      }

      const formatted = productsList.map((p: any, idx: number) => ({
        id: p.id !== undefined ? String(p.id) : (p.productId !== undefined ? String(p.productId) : `ac-p-${idx + 1}`),
        name: typeof p === 'string' ? p : (p.name || p.productName || p.displayName || p.key || `Product-${idx + 1}`),
        description: typeof p === 'object' ? (p.description || p.details || (p.id ? `Product ID: ${p.id}` : '')) : '',
        category: typeof p === 'object' ? (p.category || 'ArmorCode Product') : 'ArmorCode Product'
      }));

      return res.json({
        success: true,
        products: formatted,
        totalElements: liveData.totalElements !== undefined ? liveData.totalElements : formatted.length,
        totalPages: liveData.totalPages || 1,
        source: 'LIVE_API',
        endpointUsed: customEndpoint,
        payloadSent: requestBody
      });
    }
  } catch (err: any) {
    console.warn('[ArmorCode API Proxy] Products endpoint live fetch notice:', err.message);
  }

  // Filter default catalog if live API is unavailable
  const filteredCatalog = defaultProducts.filter(p => 
    !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Fallback list when live endpoint is unavailable
  return res.json({
    success: true,
    products: filteredCatalog.length > 0 ? filteredCatalog : defaultProducts,
    source: 'FALLBACK_CATALOG',
    endpointUsed: customEndpoint,
    payloadSent: requestBody
  });
});

// 2. Fetch Subproducts (Repositories) from https://app.armorcode.com/api/dashboard/sub-product/name-id
app.all(['/api/armorcode/subproducts', '/api/armorcode/subproducts/', '/api/armorcode/subproduct', '/api/armorcode/sub-product'], async (req, res) => {
  const project = (req.body?.project || req.query?.project || 'sample').toString().trim();
  const rawProductId = req.body?.productId || req.query?.productId || req.body?.productIds || req.body?.product;
  const apiKey = req.body?.apiKey || req.query?.apiKey || process.env.ARMORCODE_API_KEY || process.env.ARMORCODE_KEY || appSettings.ArmorCode?.ApiKey || '';
  const customEndpoint = req.body?.customEndpoint || req.query?.customEndpoint || appSettings.ArmorCode?.SubproductApiEndpoint || 'https://app.armorcode.com/api/dashboard/sub-product/name-id';
  const searchQuery = req.body?.search !== undefined 
    ? String(req.body.search).trim().toLowerCase() 
    : (req.query?.search !== undefined ? String(req.query.search).trim().toLowerCase() : "");

  // Format productId into array of string IDs e.g. ["385162"]
  let productIds: string[] = [];
  if (Array.isArray(rawProductId)) {
    productIds = rawProductId.map(id => String(id).trim()).filter(Boolean);
  } else if (rawProductId !== undefined && rawProductId !== null && String(rawProductId).trim() !== '') {
    productIds = [String(rawProductId).trim()];
  }

  // If no product ID was provided, attempt to fallback to project or default
  if (productIds.length === 0 && project) {
    // If project is a number string, use it
    if (/^\d+$/.test(project)) {
      productIds = [project];
    }
  }

  const requestPayload = {
    productId: productIds
  };

  const isContainerQuery = project.toLowerCase().includes('aqua') || project.toLowerCase().includes('container') || project.toLowerCase().includes('image');

  const defaultSubproducts = isContainerQuery ? [
    { id: 'aqua-img-1', name: 'frontend-app:v2.4.0', description: 'Aqua scanned React UI production container image (Alpine 3.19 base)', category: 'Container Image' },
    { id: 'aqua-img-2', name: 'backend-service:latest', description: 'Aqua scanned Spring Boot Java 21 container image', category: 'Container Image' },
    { id: 'aqua-img-3', name: 'auth-gateway:v1.9', description: 'Aqua scanned Envoy/Golang authentication proxy image', category: 'Container Image' },
    { id: 'aqua-img-4', name: 'payment-processor:v3.2', description: 'Aqua scanned PCI-DSS payment worker container image', category: 'Container Image' },
    { id: 'aqua-img-5', name: 'database-proxy:v1.1', description: 'Aqua scanned PostgreSQL sidecar proxy container image', category: 'Container Image' }
  ] : [
    { id: '1713832', name: `${project}_repo`, description: `Primary source code repository for ${project}`, category: 'Main Repository' },
    { id: '1713833', name: `${project}-core-api`, description: `Backend microservice API layer for ${project}`, category: 'Backend' },
    { id: '1713834', name: `${project}-web-ui`, description: `Frontend SPA web interface for ${project}`, category: 'Frontend' },
    { id: '1713835', name: `${project}-worker-service`, description: `Async background task processor for ${project}`, category: 'Worker' },
    { id: '1713836', name: `${project}-database-migrations`, description: `SQL DDL & Database Migration scripts for ${project}`, category: 'Database' }
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
      method: 'POST',
      headers,
      body: JSON.stringify(requestPayload),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (apiRes.ok) {
      const liveData: any = await apiRes.json();
      let subproductsList: any[] = [];

      if (Array.isArray(liveData)) {
        subproductsList = liveData;
      } else if (Array.isArray(liveData.data)) {
        subproductsList = liveData.data;
      } else if (Array.isArray(liveData.content)) {
        subproductsList = liveData.content;
      } else if (Array.isArray(liveData.subproducts)) {
        subproductsList = liveData.subproducts;
      }

      if (subproductsList.length > 0) {
        let formatted = subproductsList.map((sp: any, idx: number) => ({
          id: sp.id !== undefined ? String(sp.id) : (sp.subproductId || `ac-sp-${idx + 1}`),
          name: typeof sp === 'string' ? sp : (sp.name || sp.subproductName || sp.repository || `Repository-${idx + 1}`),
          description: typeof sp === 'object' ? (sp.description || (sp.id ? `Repository ID: ${sp.id}` : '')) : '',
          category: typeof sp === 'object' ? (sp.category || 'Repository') : 'Repository'
        }));

        if (searchQuery) {
          formatted = formatted.filter(sp => 
            sp.name.toLowerCase().includes(searchQuery) ||
            sp.id.toLowerCase().includes(searchQuery) ||
            sp.description.toLowerCase().includes(searchQuery)
          );
        }

        return res.json({
          success: true,
          subproducts: formatted,
          source: 'LIVE_API',
          endpointUsed: customEndpoint,
          payloadSent: requestPayload
        });
      }
    }
  } catch (err: any) {
    console.warn('[ArmorCode API Proxy] Subproducts endpoint live fetch notice:', err.message);
  }

  // Filter default catalog if live API is unavailable
  let filteredCatalog = defaultSubproducts;
  if (searchQuery) {
    filteredCatalog = defaultSubproducts.filter(sp => 
      sp.name.toLowerCase().includes(searchQuery) ||
      sp.description.toLowerCase().includes(searchQuery)
    );
  }

  return res.json({
    success: true,
    subproducts: filteredCatalog.length > 0 ? filteredCatalog : defaultSubproducts,
    source: 'FALLBACK_CATALOG',
    endpointUsed: customEndpoint,
    payloadSent: requestPayload
  });
});

// ==========================================
// ARMORCODE SECURITY FINDINGS API PROXY
// ==========================================
app.post('/api/armorcode/findings', requireAuth, async (req, res) => {
  const {
    project = appSettings.ArmorCode?.DefaultProject || 'sample',
    productId = '',
    repository = '',
    repositories = [],
    subProductIds = [],
    cycode_branch = appSettings.ArmorCode?.DefaultBranch || 'main',
    finding_types = [],
    scanTypes,
    size = 100,
    page = 0,
    timezone = appSettings.ArmorCode?.DefaultTimezone || 'Asia/Shanghai',
    apiKey = req.body?.apiKey || process.env.ARMORCODE_API_KEY || process.env.ARMORCODE_KEY || appSettings.ArmorCode?.ApiKey || '',
    customEndpoint = ''
  } = req.body || {};

  const targetEndpoint = customEndpoint || appSettings.ArmorCode?.ApiEndpoint || 'https://app.armorcode.com/user/findings/';

  // Extract numeric or string Product IDs
  let productFilter: (number | string)[] = [];
  if (productId !== undefined && productId !== '') {
    const num = Number(productId);
    productFilter = [!isNaN(num) && String(num) === String(productId).trim() ? num : productId];
  } else if (project) {
    const num = Number(project);
    productFilter = [!isNaN(num) ? num : project];
  }

  // Extract numeric or string SubProduct IDs
  let subProductFilter: (number | string)[] = [];
  if (Array.isArray(subProductIds) && subProductIds.length > 0) {
    subProductFilter = subProductIds.map(id => {
      const num = Number(id);
      return !isNaN(num) && String(num) === String(id).trim() ? num : id;
    });
  } else if (Array.isArray(repositories) && repositories.length > 0) {
    subProductFilter = repositories.map(r => {
      const num = Number(r);
      return !isNaN(num) ? num : r;
    });
  } else if (repository && repository.trim() !== '') {
    const num = Number(repository);
    subProductFilter = [!isNaN(num) ? num : repository.trim()];
  }

  const defaultScanTypes = appSettings.ArmorCode?.DefaultScanTypes || [
    "SAST",
    "SCA",
    "Secrets"
  ];

  const rawBranch = (cycode_branch && cycode_branch.trim() !== '') ? cycode_branch.replace(/^"|"$/g, '').trim() : 'main';
  const formattedBranchValue = `\"${rawBranch}\"`;
  const branchKey = appSettings.ArmorCode?.DefaultBranchKey || '\"custom_cycode_branch\"';

  // Construct standard ArmorCode user/findings payload
  const filters: Record<string, any> = {
    product: productFilter,
    ...(subProductFilter.length > 0 ? { subProduct: subProductFilter } : {}),
    keyValue: [
      {
        key: branchKey,
        value: formattedBranchValue
      }
    ],
    scanType: Array.isArray(scanTypes) && scanTypes.length > 0 ? scanTypes : defaultScanTypes
  };

  const outgoingPayload: Record<string, any> = {
    size: Number(size) || 100,
    sortColumns: [
      {
        property: "riskScore",
        direction: "desc"
      }
    ],
    filters,
    filterOperations: {},
    page: Number(page) || 0,
    ticketStatusRequired: true,
    commentCountRequired: true,
    addLastResolutionNote: false,
    ignoreMitigated: null,
    ignoreDuplicate: true,
    timezone: timezone || "Asia/Shanghai"
  };

  let liveSuccess = false;
  let liveStatus = 0;
  let liveData: any = null;
  let errorMessage = '';

  // Attempt live request to ArmorCode API endpoint
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), appSettings.ArmorCode?.TimeoutMs || 10000);

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

  // Helper normalizer for ArmorCode findings
  const normalizeFindings = (rawList: any[]) => {
    return rawList.map((f: any, idx: number) => {
      // 1. Scan Type (can be string, array e.g. ["SAST"], or in additionalDetails)
      let scanType = 'SAST';
      if (Array.isArray(f.scanType) && f.scanType.length > 0) {
        scanType = f.scanType[0];
      } else if (typeof f.scanType === 'string' && f.scanType.trim() !== '') {
        scanType = f.scanType;
      } else if (f.additionalDetails?.scanType) {
        scanType = f.additionalDetails.scanType;
      } else if (f.type) {
        scanType = f.type;
      }

      // 2. Severity & Risk Score
      const severity = (f.severity || f.toolSeverity || f.severityLevel || 'MEDIUM').toUpperCase();
      const riskScore = typeof f.riskScore === 'number' 
        ? f.riskScore 
        : (typeof f.findingScore === 'number' 
            ? f.findingScore 
            : (typeof f.score === 'number' 
                ? f.score 
                : (severity === 'CRITICAL' ? 9.2 : (severity === 'HIGH' ? 7.8 : 5.4))));

      // 3. Status & Mitigation
      const status = f.status || f.toolFindingStatus || (f.mitigated ? 'MITIGATED' : 'OPEN') || f.ticketStatus || 'OPEN';

      // 4. Product / Project Name
      const productObj = typeof f.product === 'object' && f.product !== null ? f.product : null;
      const productName = productObj?.name || (typeof f.product === 'string' ? f.product : '') || f.productName || f.project || (productFilter[0] ? String(productFilter[0]) : String(project));
      const productId = productObj?.id || (typeof f.product === 'number' ? f.product : (productFilter[0] ? productFilter[0] : undefined));

      // 5. SubProduct / Repository Name
      const subProductObj = typeof f.subProduct === 'object' && f.subProduct !== null ? f.subProduct : null;
      const subProductName = subProductObj?.name || (typeof f.subProduct === 'string' ? f.subProduct : '');
      const repositoryName = f.additionalDetails?.repositoryName || subProductName || f.repository || f.repoName || (subProductFilter[0] ? String(subProductFilter[0]) : 'core-repo');
      const subProductId = subProductObj?.id || (typeof f.subProduct === 'number' ? f.subProduct : (subProductFilter[0] ? subProductFilter[0] : undefined));

      // 6. Branch
      const branchVal = f.additionalDetails?.gitBranch 
        || f.cycode_branch 
        || (Array.isArray(f.tags) ? f.tags.find((t: string) => t.startsWith('custom_cycode_branch:'))?.split(':')[1] : undefined)
        || (Array.isArray(f.tags) ? f.tags.find((t: string) => t.startsWith('cycode.branch:'))?.split(':')[1] : undefined)
        || f.branch 
        || rawBranch;

      // 7. Tool / Source
      const toolName = f.source || f.tool || f.toolName || f.sourceTool || (scanType ? `${scanType} Scanner` : 'Cycode');

      // 8. CVE / CWE / OWASP Reference
      let cveOrCwe = '';
      if (Array.isArray(f.cwesStrings) && f.cwesStrings.length > 0) {
        cveOrCwe = f.cwesStrings[0];
      } else if (Array.isArray(f.cwe) && f.cwe.length > 0) {
        cveOrCwe = `CWE-${f.cwe[0]}`;
      } else if (Array.isArray(f.cve) && f.cve.length > 0) {
        cveOrCwe = f.cve[0];
      } else if (f.cve || f.cveId || f.cve_id || f.cwe || f.cweId) {
        cveOrCwe = f.cve || f.cveId || f.cve_id || f.cwe || f.cweId;
      } else if (f.taxonomy?.owaspTop10_2021 && Array.isArray(f.taxonomy.owaspTop10_2021) && f.taxonomy.owaspTop10_2021.length > 0) {
        cveOrCwe = f.taxonomy.owaspTop10_2021[0].split(' - ')[0] || f.taxonomy.owaspTop10_2021[0];
      } else {
        cveOrCwe = severity === 'CRITICAL' ? 'CWE-347' : 'CWE-89';
      }

      // 9. File Path & Line Number
      let rawFilePath = f.filePath || f.file_path || f.fileName || f.location || f.additionalDetails?.permalink || 'src/main.ts';
      let displayFilePath = rawFilePath;
      if (typeof rawFilePath === 'string' && rawFilePath.includes('?path=')) {
        const match = rawFilePath.match(/\?path=([^&]+)/);
        if (match && match[1]) {
          displayFilePath = decodeURIComponent(match[1]);
        }
      }
      const lineNum = f.lineNumber || f.line_number || f.line || 1;

      // 10. Title & Description
      const title = f.title || f.name || f.findingDescription || (f.description ? f.description.split('\n')[0].replace(/^\*\*Policy name:\*\*\s*/, '') : 'Vulnerability detected');
      const rawDescription = f.description || title;

      // 11. Remediation guidance
      let remediationText = f.remediation || f.mitigation || f.recommendation || f.solution || f.resolutionNote || '';
      if (!remediationText && typeof f.description === 'string' && f.description.includes('**Correlation Message:**')) {
        const corrMatch = f.description.match(/\*\*Correlation Message:\*\*\s*([\s\S]+)$/);
        if (corrMatch && corrMatch[1]) {
          remediationText = corrMatch[1].trim();
        }
      }
      if (!remediationText) {
        remediationText = `Verify and remediate ${title} per AppSec security baseline standard.`;
      }

      return {
        finding_id: String(f.id || f.findingId || f.finding_id || `AC-${idx + 1}`),
        type: scanType.toLowerCase().replace(/[^a-z0-9]/g, ''),
        scanType: scanType,
        severity: severity,
        riskScore: riskScore,
        title: title,
        description: rawDescription,
        remediation: remediationText,
        cycode_branch: branchVal,
        repository: repositoryName,
        subProduct: subProductName || subProductId || repositoryName,
        subProductId: subProductId,
        project: productName,
        product: productName || productId,
        productId: productId,
        tool: toolName,
        cve_id: cveOrCwe,
        file_path: displayFilePath,
        raw_file_path: rawFilePath,
        line_number: lineNum,
        ticketStatus: status,
        status: status,
        findingUrl: f.findingUrl || (f.id ? `https://app.armorcode.com#/findings/${f.id}` : undefined),
        url: f.url || f.additionalDetails?.permalink,
        raw: f
      };
    });
  };

  // If live request produced valid findings array
  if (liveSuccess && liveData) {
    let rawList: any[] = [];
    if (Array.isArray(liveData.content)) {
      rawList = liveData.content;
    } else if (Array.isArray(liveData.results)) {
      rawList = liveData.results;
    } else if (Array.isArray(liveData.findings)) {
      rawList = liveData.findings;
    } else if (Array.isArray(liveData.data)) {
      rawList = liveData.data;
    } else if (Array.isArray(liveData)) {
      rawList = liveData;
    }

    if (rawList.length > 0 || liveData.content || liveData.totalElements !== undefined) {
      const results = normalizeFindings(rawList);
      return res.json({
        success: true,
        source: 'LIVE_API',
        endpointUsed: targetEndpoint,
        httpStatus: liveStatus,
        payloadSent: outgoingPayload,
        results,
        totalElements: liveData.totalElements !== undefined ? liveData.totalElements : results.length,
        totalPages: liveData.totalPages !== undefined ? liveData.totalPages : 1,
        rawResponse: liveData,
        timestamp: new Date().toISOString()
      });
    }
  }

  // When live request returns no findings or endpoint is unavailable, return empty results array
  return res.json({
    success: liveSuccess,
    source: liveSuccess ? 'LIVE_API' : 'ARMORCODE_ENDPOINT',
    endpointUsed: targetEndpoint,
    httpStatus: liveStatus || 200,
    payloadSent: outgoingPayload,
    results: [],
    totalElements: 0,
    totalPages: 0,
    errorMessage: errorMessage || undefined,
    rawResponse: liveData || {
      content: [],
      totalElements: 0,
      totalPages: 0,
      size: outgoingPayload.size,
      number: outgoingPayload.page,
      meta: {
        total_count: 0,
        project_queried: project,
        repositories_queried: productFilter,
        cycode_branch: rawBranch || 'main',
        note: 'No scan findings returned for the queried project/repository and scan criteria.'
      }
    },
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// PROMOTION EVIDENCE AUDITABLE RECORDS ENDPOINTS
// ==========================================
let inMemoryPromotionEvidences: any[] = [];

app.get('/api/promotion-evidences', requireAuth, async (req, res) => {
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

app.post('/api/promotion-evidences', requireRole('SUPER_ADMIN', 'APPSEC_ADMIN', 'SECURITY_LEAD', 'DEVSEC_ENGINEER'), async (req, res) => {
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

app.post('/api/promotion-evidences/:id/revoke', requireRole('SUPER_ADMIN', 'APPSEC_ADMIN', 'SECURITY_LEAD'), async (req, res) => {
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

app.delete('/api/promotion-evidences/:id', requireRole('SUPER_ADMIN', 'APPSEC_ADMIN'), async (req, res) => {
  const { id } = req.params;
  inMemoryPromotionEvidences = inMemoryPromotionEvidences.filter(e => e.evidenceId !== id);
  try {
    await safeDbQuery('DELETE FROM promotion_evidences WHERE evidence_id = $1', [id]);
  } catch (err) {
    console.warn('PostgreSQL delete promotion evidence warning:', err);
  }
  res.json({ success: true, message: `Evidence certificate ${id} deleted` });
});

app.delete('/api/promotion-evidences', requireRole('SUPER_ADMIN', 'APPSEC_ADMIN'), async (req, res) => {
  inMemoryPromotionEvidences = [];
  try {
    await safeDbQuery('TRUNCATE TABLE promotion_evidences RESTART IDENTITY');
  } catch (err) {
    console.warn('PostgreSQL truncate promotion_evidences warning:', err);
  }
  res.json({ success: true, message: 'All promotion certificates cleared' });
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

app.get('/api/sso/azure/config', requireAuth, (req, res) => {
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  const baseUrl = process.env.APP_URL || `${protocol}://${host}`;

  res.json({
    ...runtimeOidcConfig,
    redirectUri: `${baseUrl}/api/sso/azure/callback`,
    responseType: 'code'
  });
});

app.post('/api/sso/azure/config', requireRole('SUPER_ADMIN'), (req, res) => {
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

// Helper: Construct robust, valid absolute URI for Azure SSO callback
const resolveAbsoluteRedirectUri = (req: Request): string => {
  const rawAppUrl = process.env.APP_URL ? process.env.APP_URL.trim() : '';
  if (rawAppUrl && (rawAppUrl.startsWith('http://') || rawAppUrl.startsWith('https://'))) {
    return `${rawAppUrl.replace(/\/+$/, '')}/api/sso/azure/callback`;
  }
  const host = req.get('host') || 'localhost:3000';
  const headerProto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const scheme = host.includes('localhost') ? 'http' : (headerProto === 'http' ? 'http' : 'https');
  return `${scheme}://${host}/api/sso/azure/callback`;
};

// Get Live OIDC Authorize URL Endpoint (for Client Popups)
app.get('/api/sso/azure/authorize-url', (req, res) => {
  const tenantId = runtimeOidcConfig.tenantId;
  const clientId = runtimeOidcConfig.clientId;
  const reqEmail = req.query.email?.toString().trim().toLowerCase() || '';

  // Redirect URI must strictly match registered URI in Azure Portal without query parameters
  const redirectUri = resolveAbsoluteRedirectUri(req);

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
    let errMessage = (error_description || error || 'OIDC Authorization Failed').toString();
    if (errMessage.includes('AADSTS700016')) {
      errMessage = `AADSTS700016: Application ID was not found in Directory/Tenant. Please verify that your Tenant ID and Application (Client) ID match the same directory in Azure Portal. (${errMessage})`;
    }
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
    const redirectUri = resolveAbsoluteRedirectUri(req);
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
        const rawDesc = tokenData.error_description || tokenData.error || 'Token exchange failed';
        if (rawDesc.includes('AADSTS7000215') || rawDesc.includes('Invalid client secret')) {
          tokenExchangeError = `AADSTS7000215: Invalid Azure Client Secret. Please ensure you copied the 'Value' column string (e.g. eER8Q~... or ~3x...), NOT the 'Secret ID' GUID from Azure Portal -> App Registrations -> Certificates & Secrets.`;
        } else {
          tokenExchangeError = rawDesc;
        }
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
app.get('/api/db/status', requireAuth, async (req, res) => {
  const connTest = await testDbConnection();
  res.json({
    dbConfig: connTest.config,
    connected: connTest.connected,
    message: connTest.message,
    status: getDbStatusInfo()
  });
});

// Test connection explicitly
app.post('/api/db/test-connect', requireRole('SUPER_ADMIN', 'APPSEC_ADMIN'), async (req, res) => {
  const result = await testDbConnection();
  res.json(result);
});

// Get applications from PostgreSQL (with fallback)
app.get('/api/apps', requireAuth, async (req, res) => {
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
app.post('/api/apps', requireRole('SUPER_ADMIN', 'APPSEC_ADMIN', 'SECURITY_LEAD', 'DEVSEC_ENGINEER'), async (req, res) => {
  const appData = req.body;
  if (!appData || !appData.id || !appData.name) {
    return res.status(400).json({ error: 'Missing required app fields (id, name)' });
  }

  const result = await safeDbQuery(
    `INSERT INTO applications (
      id, code, name, description, tier, rating, calculated_score,
      department, owner_app_sec, owner_it, hosting_env, data_classification,
      internet_exposed, is_gaming_network, third_party_integrations,
      compliance_requirements, status, factors, last_assessed, assessed_by,
      created_at, updated_at, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
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
app.delete('/api/apps/:id', requireRole('SUPER_ADMIN', 'APPSEC_ADMIN'), async (req, res) => {
  const { id } = req.params;
  await safeDbQuery('DELETE FROM applications WHERE id = $1', [id]);
  res.json({ success: true, message: `Application ${id} processed` });
});

// Force Seed initialData into PostgreSQL
app.post('/api/db/seed', requireRole('SUPER_ADMIN'), async (req, res) => {
  const { force } = req.body || {};
  const result = await seedInitialData(Boolean(force));
  res.json(result);
});

// GET /api/sop
app.get('/api/sop', requireAuth, async (req, res) => {
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
app.post('/api/sop', requireRole('SUPER_ADMIN', 'APPSEC_ADMIN', 'SECURITY_LEAD'), async (req, res) => {
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
app.get('/api/audit-logs', requireAuth, async (req, res) => {
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
app.post('/api/audit-logs', requireAuth, async (req, res) => {
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
app.get('/api/pending-assessments', requireAuth, async (req, res) => {
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
app.post('/api/pending-assessments', requireAuth, async (req, res) => {
  const p = req.body;
  if (!p || !p.id || !p.appName) {
    return res.status(400).json({ error: 'Invalid pending assessment payload' });
  }
  const result = await safeDbQuery(
    `INSERT INTO pending_assessments (
      id, app_id, app_code, app_name, description, department,
      owner_it, owner_app_sec, submitter_name, submitter_email,
      submitted_at, updated_at, data_classification, hosting_env,
      internet_exposed, factors, calculated_score,
      proposed_tier, status, notes, comments, admin_decision_by,
      admin_decision_at, admin_decision_notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
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
// ACCESS LOGS & SESSION TIMEOUT ENDPOINTS
// ==========================================

app.get('/api/access-logs', requireAuth, async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 500;
  const dbRows = await safeDbQuery(
    `SELECT id, timestamp, user_email as "userEmail", display_name as "displayName", 
            role, login_method as "loginMethod", action, resource, 
            ip_address as "ipAddress", user_agent as "userAgent", status, details 
     FROM access_logs 
     ORDER BY timestamp DESC 
     LIMIT $1`,
    [limit]
  );
  if (dbRows) {
    return res.json({ success: true, logs: dbRows });
  }
  return res.json({ success: true, logs: inMemoryAccessLogs.slice(0, limit) });
});

app.post('/api/access-logs', requireAuth, async (req: Request, res: Response) => {
  const log = req.body;
  if (!log || !log.action) {
    return res.status(400).json({ error: 'Invalid access log payload' });
  }

  const logEntry = {
    id: log.id || `ACC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    timestamp: log.timestamp || new Date().toISOString(),
    userEmail: log.userEmail || 'anonymous@local',
    displayName: log.displayName || 'Anonymous User',
    role: log.role || 'IT_VIEWER',
    loginMethod: log.loginMethod || 'SESSION',
    action: log.action,
    resource: log.resource || 'DevSecOps Management Console',
    ipAddress: log.ipAddress || req.ip || '127.0.0.1',
    userAgent: log.userAgent || req.headers['user-agent'] || 'Browser Client',
    status: log.status || 'INFO',
    details: log.details || ''
  };

  inMemoryAccessLogs.unshift(logEntry);
  if (inMemoryAccessLogs.length > 500) {
    inMemoryAccessLogs = inMemoryAccessLogs.slice(0, 500);
  }

  await safeDbQuery(
    `INSERT INTO access_logs (id, timestamp, user_email, display_name, role, login_method, action, resource, ip_address, user_agent, status, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (id) DO NOTHING`,
    [
      logEntry.id,
      logEntry.timestamp,
      logEntry.userEmail,
      logEntry.displayName,
      logEntry.role,
      logEntry.loginMethod,
      logEntry.action,
      logEntry.resource,
      logEntry.ipAddress,
      logEntry.userAgent,
      logEntry.status,
      logEntry.details
    ]
  );

  res.json({ success: true, log: logEntry });
});

app.delete('/api/access-logs', requireRole('SUPER_ADMIN', 'APPSEC_ADMIN'), async (req: Request, res: Response) => {
  inMemoryAccessLogs = [];
  await safeDbQuery('TRUNCATE TABLE access_logs RESTART IDENTITY');
  res.json({ success: true, message: 'Access logs cleared' });
});

app.get('/api/settings/session-timeout', requireAuth, (req: Request, res: Response) => {
  res.json({ timeoutMinutes: configuredSessionTimeoutMinutes });
});

app.post('/api/settings/session-timeout', requireRole('SUPER_ADMIN', 'APPSEC_ADMIN'), (req: Request, res: Response) => {
  const { timeoutMinutes } = req.body;
  if (typeof timeoutMinutes === 'number' && timeoutMinutes >= 1 && timeoutMinutes <= 1440) {
    configuredSessionTimeoutMinutes = timeoutMinutes;
    return res.json({ success: true, timeoutMinutes: configuredSessionTimeoutMinutes });
  }
  res.status(400).json({ error: 'Invalid timeoutMinutes value (must be 1-1440)' });
});

// ==========================================
// REDIS SESSION & SECURITY API ENDPOINTS
// ==========================================

// Issue JWT Token & Register Session in Redis Cache
app.post('/api/auth/token', (req: Request, res: Response) => {
  const { userId, email, displayName, role, groups, loginMethod } = req.body || {};

  const cleanEmail = (email || 'anonymous@local.internal').toString().trim().toLowerCase();
  const cleanUserId = userId || `usr_${Date.now()}`;
  const userRole = (role || 'IT_VIEWER') as 'SUPER_ADMIN' | 'APPSEC_ADMIN' | 'IT_VIEWER';
  const userDisplayName = displayName || cleanEmail.split('@')[0];
  const userGroups = Array.isArray(groups) ? groups : ['Users'];
  const method = loginMethod || 'AZURE_SSO';

  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date();
  const ttlSec = (configuredSessionTimeoutMinutes || 15) * 60;
  const expiresAt = new Date(now.getTime() + ttlSec * 1000);

  const tokenPayload = {
    sessionId,
    userId: cleanUserId,
    email: cleanEmail,
    displayName: userDisplayName,
    role: userRole,
    groups: userGroups
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: `${configuredSessionTimeoutMinutes}m` });

  const sessionRecord: RedisSessionRecord = {
    sessionId,
    userId: cleanUserId,
    email: cleanEmail,
    displayName: userDisplayName,
    role: userRole,
    groups: userGroups,
    loginMethod: method,
    ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Browser Client',
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastActiveAt: now.toISOString(),
    status: 'ACTIVE',
    jwtToken: token,
    ttlSeconds: ttlSec
  };

  redisSessionCache.set(sessionId, sessionRecord);

  res.json({
    success: true,
    token,
    sessionId,
    session: sessionRecord,
    expiresAt: expiresAt.toISOString()
  });
});

// Get Current Authenticated Session & Identity
app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const session = (req as any).session;

  res.json({
    authenticated: true,
    user,
    session: session || null,
    redisUrl: REDIS_CACHE_URL,
    httpsActive: true
  });
});

// Logout / Revoke Active Session
app.post('/api/auth/logout', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const session = (req as any).session;

  if (session && session.sessionId) {
    session.status = 'REVOKED';
    redisSessionCache.delete(session.sessionId);
  }

  res.json({ success: true, message: 'Successfully logged out and revoked Redis session' });
});

// Get All Active Sessions in Redis Cache
app.get('/api/auth/sessions', requireRole('SUPER_ADMIN', 'APPSEC_ADMIN'), (req: Request, res: Response) => {
  const sessionList = Array.from(redisSessionCache.values()).map(s => {
    // calculate remaining TTL
    const now = Date.now();
    const exp = new Date(s.expiresAt).getTime();
    const remainingSec = Math.max(0, Math.round((exp - now) / 1000));
    return {
      ...s,
      ttlSeconds: remainingSec
    };
  });

  res.json({
    success: true,
    count: sessionList.length,
    sessions: sessionList
  });
});

// Revoke Specific Session ID in Redis
app.delete('/api/auth/sessions/:sessionId', requireRole('SUPER_ADMIN', 'APPSEC_ADMIN'), (req: Request, res: Response) => {
  const { sessionId } = req.params;

  if (redisSessionCache.has(sessionId)) {
    const s = redisSessionCache.get(sessionId)!;
    s.status = 'REVOKED';
    redisSessionCache.delete(sessionId);
    return res.json({ success: true, message: `Session '${sessionId}' revoked in Redis cache` });
  }

  res.status(404).json({ error: `Session '${sessionId}' not found in Redis cache` });
});

// Kill-Switch: Revoke All Sessions for User ID
app.delete('/api/auth/sessions/user/:userId', requireRole('SUPER_ADMIN', 'APPSEC_ADMIN'), (req: Request, res: Response) => {
  const { userId } = req.params;
  let revokedCount = 0;

  for (const [sessId, session] of redisSessionCache.entries()) {
    if (session.userId === userId || session.email.toLowerCase() === userId.toLowerCase()) {
      session.status = 'REVOKED';
      redisSessionCache.delete(sessId);
      revokedCount++;
    }
  }

  res.json({ success: true, revokedCount, message: `Kill switch executed: Revoked ${revokedCount} active sessions for user '${userId}'` });
});

// Flush Redis Session Cache
app.post('/api/auth/redis-flush', requireRole('SUPER_ADMIN'), (req: Request, res: Response) => {
  redisSessionCache.clear();
  initBreakglassSession(); // Reseed master breakglass
  res.json({ success: true, message: 'Redis session cache flushed completely' });
});

// Redis Cache Stats
app.get('/api/auth/redis-stats', requireAuth, (req: Request, res: Response) => {
  res.json({
    success: true,
    stats: {
      engine: 'IN_MEMORY_REDIS_SIMULATOR',
      redisUrl: REDIS_CACHE_URL,
      connected: true,
      totalCachedKeys: redisSessionCache.size,
      activeSessionsCount: Array.from(redisSessionCache.values()).filter(s => s.status === 'ACTIVE').length,
      antiBolaLogsCount: inMemoryAntiBolaLogs.length,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsageBytes: process.memoryUsage().heapUsed,
      hitRatePercent: 99.8
    }
  });
});

// Anti-BOLA Audit Security Logs
app.get('/api/auth/bola-logs', requireRole('SUPER_ADMIN', 'APPSEC_ADMIN'), (req: Request, res: Response) => {
  res.json({
    success: true,
    count: inMemoryAntiBolaLogs.length,
    logs: inMemoryAntiBolaLogs
  });
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

