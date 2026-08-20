import { ActiveSsoUser, UserRole } from '../types';

export interface UserSessionRecord {
  sessionId: string;
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
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

export interface AntiBolaSecurityLog {
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

export interface RedisCacheStats {
  engine: 'IN_MEMORY_REDIS_SIMULATOR' | 'DISTRIBUTED_REDIS_CLUSTER';
  redisUrl: string;
  connected: boolean;
  totalCachedKeys: number;
  activeSessionsCount: number;
  revokedSessionsCount: number;
  antiBolaLogsCount: number;
  uptimeSeconds: number;
  memoryUsageBytes: number;
  hitRatePercent: number;
}
