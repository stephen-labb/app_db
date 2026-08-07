export type UserRole = 'SUPER_ADMIN' | 'APPSEC_ADMIN' | 'IT_VIEWER';

export const STANDARD_DEPARTMENTS = [
  'FinTech & Payments',
  'IT Security & Ops',
  'Customer Success & Sales',
  'Human Resources',
  'Data & Analytics',
  'Engineering & Product',
  'Facilities & Workplace IT',
  'Finance & Corporate Operations',
  'Legal, Risk & Compliance',
  'Marketing & Growth',
  'Supply Chain & Logistics'
] as const;

export type CriticalityRating = 'C' | 'H' | 'M' | 'L';
export type CriticalityTier = CriticalityRating; // Alias for backward compatibility

export type DataClassification = 'RESTRICTED' | 'CONFIDENTIAL' | 'INTERNAL' | 'PUBLIC';

export type AppStatus = 'ACTIVE' | 'IN_REVIEW' | 'DEPRECATED' | 'MAINTENANCE';

export interface CriticalityFactors {
  // New Appendix II Criteria
  sensitiveDataScore: number;     // 0 = Public, 4 = Internal, 8 = Restricted, 12 = Confidential (32.5%)
  exposureScore: number;          // 0 = Internal only, 6 = Public with controls, 12 = Fully public / Gaming-network (32.5%)
  stabilityScore: number;         // 0 = No feature update in recent 1 yr, 6 = Recently updated, 12 = Newly built (10%)
  attackHistoryScore: number;     // 0 = None, 6 = Attempted only, 12 = Compromised (15%)
  downtimeImpactScore: number;    // 0 = No impact, 6 = Minor disruption, 12 = Critical business impact (10%)
}

export interface Application {
  id: string;
  code: string;
  name: string;
  description: string;
  tier: CriticalityRating; // 'C' | 'H' | 'M' | 'L'
  rating: CriticalityRating;
  calculatedScore: number; // Weighted score calculated using formula (e.g., 0 - 12)
  department: string;
  ownerAppSec: string;
  ownerIT: string;
  hostingEnv: string;
  dataClassification: DataClassification;
  rto: string; // Recovery Time Objective e.g. "15 Mins", "1 Hour"
  rpo: string; // Recovery Point Objective e.g. "5 Mins", "1 Hour"
  internetExposed: boolean;
  isGamingNetwork?: boolean;
  thirdPartyIntegrations: string[];
  complianceRequirements: string[];
  status: AppStatus;
  factors: CriticalityFactors;
  lastAssessed: string;
  assessedBy: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
}

export interface SOPVersion {
  version: string;
  title: string;
  content: string;
  uploadedBy: string;
  uploadedAt: string;
  changeSummary: string;
  fileName?: string;
}

export interface SOPDocument {
  activeVersion: string;
  history: SOPVersion[];
}

export type ReviewStatus = 'PENDING_REVIEW' | 'IN_DISCUSSION' | 'APPROVED' | 'REJECTED';

export interface ReviewComment {
  id: string;
  author: string;
  role: UserRole;
  timestamp: string;
  text: string;
  isQuestion?: boolean;
}

export interface PendingAssessment {
  id: string;
  appId?: string; // If set, updates existing app; if empty, creates new app
  appCode: string;
  appName: string;
  description: string;
  department: string;
  ownerIT: string;
  ownerAppSec: string;
  submitterName: string;
  submitterEmail: string;
  submittedAt: string;
  updatedAt: string;
  dataClassification: DataClassification;
  hostingEnv: string;
  rto: string;
  rpo: string;
  internetExposed: boolean;
  isGamingNetwork?: boolean;
  factors: CriticalityFactors;
  calculatedScore: number;
  proposedTier: CriticalityRating;
  status: ReviewStatus;
  notes: string;
  comments: ReviewComment[];
  adminDecisionBy?: string;
  adminDecisionAt?: string;
  adminDecisionNotes?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  role: UserRole;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'SOP_UPLOAD' | 'RESTORE' | 'EXPORT' | 'SUBMIT_ASSESSMENT' | 'APPROVE_ASSESSMENT' | 'REJECT_ASSESSMENT' | 'REOPEN_ASSESSMENT';
  appId?: string;
  appName?: string;
  details: string;
}

export interface FilterState {
  searchQuery: string;
  tier: string; // 'ALL' | CriticalityTier
  department: string;
  dataClassification: string;
  status: string;
  internetExposedOnly: boolean;
  gamingNetworkOnly?: boolean;
}

// Azure Active Directory (Microsoft Entra ID) SSO & SCIM Configuration Types
export interface SsoConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
  ssoMode: 'LIVE_OIDC' | 'SIMULATED_AZURE_OIDC';
  enforceSso: boolean;
  loginUrl: string;
  issuerUrl: string;
}

export interface ScimConfig {
  baseUrl: string;
  secretToken: string;
  enabled: boolean;
  defaultRole: UserRole;
  requireBearerAuth: boolean;
}

export interface ScimGroupMapping {
  id: string;
  azureGroupOrRoleName: string; // e.g. "AppSec-Engineers", "AppSec.Admin", "IT-Operations"
  azureGroupId?: string;         // e.g. "b19e2e10-9112-4f3b-8280-9900223a1099"
  appRole: UserRole;             // 'APPSEC_ADMIN' | 'IT_VIEWER'
  description: string;
  createdAt: string;
}

export interface ProvisionedUser {
  id: string;                    // SCIM User ID / Azure Object ID
  userName: string;              // e.g. sjenkins@company.com / UPN
  displayName: string;
  givenName: string;
  familyName: string;
  email: string;
  active: boolean;
  groups: string[];              // Azure AD Groups or Group IDs
  mappedRole: UserRole;
  lastSyncedAt: string;
  syncedVia: 'SCIM_2.0' | 'AZURE_SSO' | 'MANUAL_TEST';
  title?: string;
  department?: string;
}

export interface ScimAuditLog {
  id: string;
  timestamp: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  endpoint: string;
  statusCode: number;
  action: string;
  targetUserId?: string;
  targetUserName?: string;
  details: string;
  payloadSummary?: string;
}

export interface ActiveSsoUser {
  isAuthenticated: boolean;
  userId: string;
  displayName: string;
  email: string;
  upn: string;
  role: UserRole;
  groups: string[];
  loginMethod: 'SUPER_ADMIN_BREAKGLASS' | 'AZURE_SSO' | 'SIMULATED_AZURE_OIDC' | 'LOCAL_DEVELOPER';
  idToken?: string;
  loggedInAt: string;
}

