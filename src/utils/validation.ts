import { Application, PendingAssessment } from '../types';

export interface DuplicateCheckResult {
  hasDuplicate: boolean;
  hasDuplicateName: boolean;
  hasDuplicateCode: boolean;
  hasDuplicateId: boolean;
  duplicateNameSource?: 'APPLICATION' | 'PENDING_ASSESSMENT';
  duplicateCodeSource?: 'APPLICATION' | 'PENDING_ASSESSMENT';
  duplicateIdSource?: 'APPLICATION' | 'PENDING_ASSESSMENT';
  matchedAppName?: string;
  matchedAppCode?: string;
  matchedAppId?: string;
  errorMessage?: string;
}

/**
 * Checks for duplicate application_name, code, or id across both
 * existing Applications in the database and active Pending Assessments in the review queue.
 */
export function checkDuplicateAppDetails(
  params: {
    name?: string;
    code?: string;
    id?: string;
    applications: Application[];
    pendingAssessments: PendingAssessment[];
    currentAppId?: string;
    currentPendingId?: string;
  }
): DuplicateCheckResult {
  const {
    name = '',
    code = '',
    id = '',
    applications,
    pendingAssessments,
    currentAppId,
    currentPendingId
  } = params;

  const targetName = name.trim().toLowerCase();
  const targetCode = code.trim().toLowerCase();
  const targetId = id.trim().toLowerCase();

  let hasDuplicateName = false;
  let hasDuplicateCode = false;
  let hasDuplicateId = false;

  let duplicateNameSource: 'APPLICATION' | 'PENDING_ASSESSMENT' | undefined;
  let duplicateCodeSource: 'APPLICATION' | 'PENDING_ASSESSMENT' | undefined;
  let duplicateIdSource: 'APPLICATION' | 'PENDING_ASSESSMENT' | undefined;

  let matchedAppName: string | undefined;
  let matchedAppCode: string | undefined;
  let matchedAppId: string | undefined;

  // 1. Check against active Applications
  for (const app of applications) {
    if (currentAppId && app.id.toLowerCase() === currentAppId.toLowerCase()) {
      continue; // Skip comparing against itself when editing an application
    }

    if (targetName && app.name.trim().toLowerCase() === targetName) {
      hasDuplicateName = true;
      duplicateNameSource = 'APPLICATION';
      matchedAppName = app.name;
    }

    if (targetCode && app.code.trim().toLowerCase() === targetCode) {
      hasDuplicateCode = true;
      duplicateCodeSource = 'APPLICATION';
      matchedAppCode = app.code;
    }

    if (targetId && app.id.trim().toLowerCase() === targetId) {
      hasDuplicateId = true;
      duplicateIdSource = 'APPLICATION';
      matchedAppId = app.id;
    }
  }

  // 2. Check against active Pending Assessments (exclude REJECTED or APPROVED)
  const activePending = pendingAssessments.filter(
    (p) => p.status !== 'REJECTED' && p.status !== 'APPROVED'
  );

  for (const pending of activePending) {
    if (currentPendingId && pending.id.toLowerCase() === currentPendingId.toLowerCase()) {
      continue; // Skip comparing against itself when editing a pending ticket
    }

    if (targetName && pending.appName.trim().toLowerCase() === targetName) {
      hasDuplicateName = true;
      duplicateNameSource = duplicateNameSource || 'PENDING_ASSESSMENT';
      matchedAppName = matchedAppName || pending.appName;
    }

    if (targetCode && pending.appCode.trim().toLowerCase() === targetCode) {
      hasDuplicateCode = true;
      duplicateCodeSource = duplicateCodeSource || 'PENDING_ASSESSMENT';
      matchedAppCode = matchedAppCode || pending.appCode;
    }

    if (targetId) {
      if (
        (pending.appId && pending.appId.trim().toLowerCase() === targetId) ||
        pending.id.trim().toLowerCase() === targetId
      ) {
        hasDuplicateId = true;
        duplicateIdSource = duplicateIdSource || 'PENDING_ASSESSMENT';
        matchedAppId = matchedAppId || pending.appId || pending.id;
      }
    }
  }

  const hasDuplicate = hasDuplicateName || hasDuplicateCode || hasDuplicateId;

  const errorParts: string[] = [];
  if (hasDuplicateName) {
    errorParts.push(`Application Name "${matchedAppName || name}" is already in use (${duplicateNameSource === 'APPLICATION' ? 'Existing Database App' : 'Pending Review Ticket'})`);
  }
  if (hasDuplicateCode) {
    errorParts.push(`Application Code "${matchedAppCode || code}" is already in use (${duplicateCodeSource === 'APPLICATION' ? 'Existing Database App' : 'Pending Review Ticket'})`);
  }
  if (hasDuplicateId) {
    errorParts.push(`Application ID "${matchedAppId || id}" is already assigned (${duplicateIdSource === 'APPLICATION' ? 'Existing Database App' : 'Pending Review Ticket'})`);
  }

  const errorMessage = errorParts.length > 0 ? errorParts.join('. ') + '.' : undefined;

  return {
    hasDuplicate,
    hasDuplicateName,
    hasDuplicateCode,
    hasDuplicateId,
    duplicateNameSource,
    duplicateCodeSource,
    duplicateIdSource,
    matchedAppName,
    matchedAppCode,
    matchedAppId,
    errorMessage
  };
}

/**
 * Generates a unique Application Code by appending an incremental suffix if a duplicate exists.
 */
export function generateUniqueAppCode(
  baseCode: string,
  applications: Application[],
  pendingAssessments: PendingAssessment[]
): string {
  const cleanBase = (baseCode.trim() || `APP-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase();
  let candidate = cleanBase;
  let counter = 1;

  while (
    checkDuplicateAppDetails({
      code: candidate,
      applications,
      pendingAssessments
    }).hasDuplicateCode
  ) {
    counter++;
    candidate = `${cleanBase}-${counter}`;
  }

  return candidate;
}

/**
 * Generates a unique Application ID ensuring no collisions in database or pending queue.
 */
export function generateUniqueAppId(
  applications: Application[],
  pendingAssessments: PendingAssessment[]
): string {
  let candidate = `APP-${Math.floor(1000 + Math.random() * 9000)}`;

  while (
    checkDuplicateAppDetails({
      id: candidate,
      applications,
      pendingAssessments
    }).hasDuplicateId
  ) {
    candidate = `APP-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  return candidate;
}
