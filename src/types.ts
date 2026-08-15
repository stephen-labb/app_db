export type UserRole = 'SUPER_ADMIN' | 'APPSEC_ADMIN' | 'IT_VIEWER' | string;

export type PermissionKey =
  | 'APP_VIEW'
  | 'APP_CREATE'
  | 'APP_EDIT'
  | 'APP_DELETE'
  | 'ASSESSMENT_SUBMIT'
  | 'ASSESSMENT_APPROVE'
  | 'SOP_UPLOAD'
  | 'EVIDENCE_GENERATE'
  | 'PROMOTION_GATE_OVERRIDE'
  | 'USER_MANAGE'
  | 'RBAC_MANAGE'
  | 'SSO_SCIM_MANAGE'
  | 'AUDIT_LOG_VIEW';

export interface CustomRoleDefinition {
  id: string;
  roleKey: string;
  name: string;
  description: string;
  isSystemRole?: boolean;
  permissions: PermissionKey[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface BearerJwtPayload {
  sub: string;
  userId?: string;
  displayName: string;
  email: string;
  role: UserRole;
  permissions: PermissionKey[];
  iss: string;
  iat: number;
  exp: number;
  jti: string;
  loginMethod?: string;
}

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
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'SOP_UPLOAD' | 'RESTORE' | 'EXPORT' | 'SUBMIT_ASSESSMENT' | 'APPROVE_ASSESSMENT' | 'REJECT_ASSESSMENT' | 'REOPEN_ASSESSMENT' | 'PROMOTION_EVIDENCE_GENERATED' | 'PROMOTION_EVIDENCE_REVOKED' | string;
  component?: string;
  appId?: string;
  appName?: string;
  details: string;
  severity?: 'INFO' | 'WARN' | 'CRITICAL' | 'SUCCESS';
  complianceTag?: string;
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

export interface ManualUserRoleMapping {
  id: string;
  emailOrUpn: string;
  assignedRole: UserRole;
  notes?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
  iamStatus?: 'ACTIVE' | 'SUSPENDED';
  addedToIamAt?: string;
  addedByIamAdmin?: string;
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
  tokenUrl?: string;
  issuerUrl: string;
  jwksUri?: string;
}

export type ProvisioningApprovalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface ScimConfig {
  baseUrl: string;
  secretToken: string;
  enabled: boolean;
  defaultRole: UserRole;
  requireBearerAuth: boolean;
  requireAdminApproval?: boolean;
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
  syncedVia: 'SCIM_2.0' | 'AZURE_SSO' | 'MANUAL_TEST' | 'IAM_DIRECTORY' | 'OIDC_IDP_PROVISIONED' | 'MANUAL_PROVISION';
  title?: string;
  department?: string;
  iamStatus?: 'ACTIVE' | 'SUSPENDED';
  addedToIamAt?: string;
  addedByIamAdmin?: string;
  approvalStatus?: ProvisioningApprovalStatus;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  mustResetPassword?: boolean;
  passwordResetRequestedAt?: string;
  passwordResetAt?: string;
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

export type AccessApprovalActionType =
  | 'APPROVE'
  | 'REJECT'
  | 'ROLE_CHANGE'
  | 'PROVISION'
  | 'SUSPEND'
  | 'ACTIVATE'
  | 'REMOVE';

export interface AccessApprovalRecord {
  id: string;
  timestamp: string;
  targetUserId: string;
  targetUserName: string;
  targetUserEmail: string;
  actionType: AccessApprovalActionType;
  previousRole?: string;
  assignedRole: string;
  approvedBy: string;
  approverRole: string;
  requestSource: 'AZURE_AD_SCIM' | 'OIDC_SSO' | 'MANUAL_PROVISION' | 'DIRECTORY_ADMIN' | 'ACCESS_REQUEST_GATE';
  rationaleNotes: string;
  complianceTag: string;
  verificationHash: string;
  status: 'APPROVED' | 'REJECTED' | 'MODIFIED' | 'SUSPENDED';
}

export interface ActiveSsoUser {
  isAuthenticated: boolean;
  userId?: string;
  displayName: string;
  email: string;
  upn?: string;
  role: UserRole;
  groups?: string[];
  loginMethod?: 'SUPER_ADMIN_BREAKGLASS' | 'AZURE_SSO' | 'SIMULATED_AZURE_OIDC' | 'LOCAL_DEVELOPER' | 'PASSWORD_AUTHENTICATED';
  idToken?: string;
  bearerJwtToken?: string;
  permissions?: PermissionKey[];
  loggedInAt?: string;
  iamVerified?: boolean;
  iamMatchedSource?: 'PROVISIONED_DIRECTORY' | 'MANUAL_OVERRIDE' | 'SUPER_ADMIN';
  iamVerifiedAt?: string;
}

export interface ArmorCodeFinding {
  finding_id: string;
  type: string; // 'sast' | 'sca' | 'secret' | 'dast' | 'iac' | 'container'
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' | string;
  description: string;
  remediation: string;
  cycode_branch?: string;
  repository?: string;
  project?: string;
  tool?: string;
  cve_id?: string;
  file_path?: string;
  line_number?: number;
}

export interface ArmorCodeProduct {
  id?: string | number;
  name: string;
  description?: string;
  productKey?: string;
  code?: string;
  createdDate?: string;
  [key: string]: any;
}

export interface ArmorCodeSubproduct {
  id?: string | number;
  name: string;
  productId?: string | number;
  productName?: string;
  description?: string;
  repositoryUrl?: string;
  [key: string]: any;
}

export interface ArmorCodeProductsResponse {
  success: boolean;
  products: ArmorCodeProduct[];
  source?: string;
  errorMessage?: string;
  endpointUsed?: string;
}

export interface ArmorCodeSubproductsResponse {
  success: boolean;
  subproducts: ArmorCodeSubproduct[];
  source?: string;
  errorMessage?: string;
  endpointUsed?: string;
}

export interface ArmorCodeQueryRequest {
  project: string;
  repository?: string;
  cycode_branch?: string;
  finding_types?: string[];
  apiKey?: string;
  customEndpoint?: string;
}

export interface ArmorCodeQueryResponse {
  success: boolean;
  source: 'LIVE_API' | 'SIMULATED_DATA' | 'FALLBACK_DEMO';
  endpointUsed: string;
  httpStatus: number;
  payloadSent: Record<string, any>;
  results: ArmorCodeFinding[];
  rawResponse?: any;
  errorMessage?: string;
  timestamp: string;
}

export interface ComplianceEvaluationResult {
  isCompliant: boolean;
  gatePolicyName: string;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  maxCriticalAllowed: number;
  maxHighAllowed: number;
  maxMediumAllowed: number;
  reasons: string[];
  rulesEvaluated: string[];
  passedChecks: string[];
}

export interface PromotionEvidence {
  evidenceId: string; // e.g. "PROMO-EVID-2026-98124"
  createdAt: string; // ISO string
  createdBy: string; // user email / display name
  createdRole: string; // UserRole
  project: string;
  repository: string;
  branch: string;
  targetEnvironment: string; // e.g. "Staging -> Production"
  releaseVersion: string; // e.g. "v2.4.0-rc1"
  approvalNotes: string;
  complianceStatus: 'PASSED' | 'ADMIN_OVERRIDE' | 'FAILED';
  complianceEvaluation: ComplianceEvaluationResult;
  findingCounts: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  snapshotFindings: ArmorCodeFinding[];
  snapshotPayload: Record<string, any>;
  apiEndpointUsed: string;
  verificationHash: string; // HMAC / SHA256 style fingerprint
  signatureBadge: string; // e.g. "DIGITALLY_SIGNED_ARMORCODE_GATE_CERTIFICATE"
  status: 'ISSUED' | 'REVOKED' | 'SUPERSEDED';
  revokedAt?: string;
  revokedBy?: string;
  revokedReason?: string;
  applicationId?: string; // Optional reference to registered Application ID in database
  applicationName?: string; // Optional reference to registered Application Name in database
}

