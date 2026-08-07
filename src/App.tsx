import React, { useState, useEffect } from 'react';
import {
  Application,
  SOPDocument,
  SOPVersion,
  AuditLogEntry,
  UserRole,
  FilterState,
  PendingAssessment,
  CriticalityFactors,
  ReviewStatus,
  AppStatus,
  SsoConfig,
  ScimConfig,
  ScimGroupMapping,
  ProvisionedUser,
  ScimAuditLog,
  ActiveSsoUser
} from './types';
import {
  loadApplications,
  saveApplications,
  loadSOPDocument,
  saveSOPDocument,
  loadAuditLogs,
  saveAuditLogs,
  addAuditLog,
  loadUserRole,
  saveUserRole,
  loadPendingAssessments,
  savePendingAssessments,
  resetToDemoData,
  exportDatabaseJSON,
  exportApplicationsCSV,
  asyncFetchFromPostgreSQL,
  deleteApplicationFromDb
} from './utils/storage';
import {
  loadSsoConfig,
  saveSsoConfig,
  loadScimConfig,
  saveScimConfig,
  loadGroupMappings,
  saveGroupMappings,
  loadProvisionedUsers,
  saveProvisionedUsers,
  loadScimAuditLogs,
  loadActiveSsoUser,
  saveActiveSsoUser
} from './utils/ssoScimStorage';
import {
  checkDuplicateAppDetails,
  generateUniqueAppCode,
  generateUniqueAppId
} from './utils/validation';
import { calculateCriticalityScore, scoreToTier } from './utils/scoring';

import { Header } from './components/Header';
import { Sidebar, TabType } from './components/Sidebar';
import { StatsSummary } from './components/StatsSummary';
import { AppTable } from './components/AppTable';
import { AppDetailModal } from './components/AppDetailModal';
import { AppFormModal } from './components/AppFormModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { SopViewer } from './components/SopViewer';
import { SopUploadModal } from './components/SopUploadModal';
import { AssessmentMatrixView } from './components/AssessmentMatrixView';
import { AuditTrailView } from './components/AuditTrailView';
import { SelfRatingView } from './components/SelfRatingView';
import { ReviewQueueView } from './components/ReviewQueueView';
import { SsoScimView } from './components/SsoScimView';
import { AzureLoginModal } from './components/AzureLoginModal';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  // Database State
  const [applications, setApplications] = useState<Application[]>([]);
  const [sopDocument, setSopDocument] = useState<SOPDocument>({
    activeVersion: 'v2.4',
    history: []
  });
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [userRole, setUserRole] = useState<UserRole>('APPSEC_ADMIN');
  const [pendingAssessments, setPendingAssessments] = useState<PendingAssessment[]>([]);
  const [initialTicketId, setInitialTicketId] = useState<string | null>(null);

  // Azure AD SSO & SCIM State
  const [ssoConfig, setSsoConfig] = useState<SsoConfig>(loadSsoConfig());
  const [scimConfig, setScimConfig] = useState<ScimConfig>(loadScimConfig());
  const [groupMappings, setGroupMappings] = useState<ScimGroupMapping[]>([]);
  const [provisionedUsers, setProvisionedUsers] = useState<ProvisionedUser[]>([]);
  const [scimLogs, setScimLogs] = useState<ScimAuditLog[]>([]);
  const [activeSsoUser, setActiveSsoUser] = useState<ActiveSsoUser>(loadActiveSsoUser());
  const [isAzureLoginOpen, setIsAzureLoginOpen] = useState(false);

  // Navigation Tab & Mobile State
  const [activeTab, setActiveTab] = useState<TabType>('apps');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Modal Control States
  const [viewingApp, setViewingApp] = useState<Application | null>(null);
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [deletingApp, setDeletingApp] = useState<Application | null>(null);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isSopUploadOpen, setIsSopUploadOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Filter State for Applications Table
  const [filterState, setFilterState] = useState<FilterState>({
    searchQuery: '',
    tier: 'ALL',
    department: 'ALL',
    dataClassification: 'ALL',
    status: 'ALL',
    internetExposedOnly: false
  });

  // Load Initial Data from Storage & Sync from PostgreSQL on Mount
  useEffect(() => {
    const loadedApps = loadApplications();
    const loadedSop = loadSOPDocument();
    const loadedLogs = loadAuditLogs();
    const loadedRole = loadUserRole();
    const loadedPending = loadPendingAssessments();

    const loadedSso = loadSsoConfig();
    const loadedScim = loadScimConfig();
    const loadedMappings = loadGroupMappings();
    const loadedUsers = loadProvisionedUsers();
    const loadedScimLogs = loadScimAuditLogs();
    const loadedActiveSso = loadActiveSsoUser();

    setApplications(loadedApps);
    setSopDocument(loadedSop);
    setAuditLogs(loadedLogs);
    setPendingAssessments(loadedPending);

    setSsoConfig(loadedSso);
    setScimConfig(loadedScim);
    setGroupMappings(loadedMappings);
    setProvisionedUsers(loadedUsers);
    setScimLogs(loadedScimLogs);
    setActiveSsoUser(loadedActiveSso);

    if (loadedActiveSso && loadedActiveSso.isAuthenticated) {
      setUserRole(loadedActiveSso.role);
    } else {
      setUserRole(loadedRole);
    }

    // Async sync from PostgreSQL backend
    asyncFetchFromPostgreSQL().then((dbData) => {
      if (dbData.apps && dbData.apps.length > 0) setApplications(dbData.apps);
      if (dbData.sop) setSopDocument(dbData.sop);
      if (dbData.logs && dbData.logs.length > 0) setAuditLogs(dbData.logs);
      if (dbData.pending && dbData.pending.length > 0) setPendingAssessments(dbData.pending);
    });

    // Deep-linking: Check if a ticket ID was passed in URL query
    const params = new URLSearchParams(window.location.search);
    const ticketParam = params.get('ticket');
    if (ticketParam) {
      setActiveTab('review-queue');
      setInitialTicketId(ticketParam);
    }
  }, []);

  const handleLoginSuccess = (user: ActiveSsoUser) => {
    setActiveSsoUser(user);
    saveActiveSsoUser(user);
    setUserRole(user.role);
    saveUserRole(user.role);

    addAuditLog(
      user.displayName,
      user.role,
      'UPDATE',
      `Authenticated via Azure AD SSO (${user.email}). Effective Role: ${user.role} based on SCIM mapping.`
    );
    setAuditLogs(loadAuditLogs());
  };

  const handleRefreshScimLogs = () => {
    setScimLogs(loadScimAuditLogs());
    setProvisionedUsers(loadProvisionedUsers());
  };

  // Role Switching Handler
  const handleRoleChange = (newRole: UserRole) => {
    setUserRole(newRole);
    saveUserRole(newRole);
  };

  // CRUD Handlers for AppSec Admin
  const handleCreateApp = () => {
    setEditingApp(null);
    setIsFormOpen(true);
  };

  const handleEditApp = (app: Application) => {
    setEditingApp(app);
    setIsFormOpen(true);
  };

  const handleViewApp = (app: Application) => {
    setViewingApp(app);
  };

  const handleDeleteApp = (app: Application) => {
    setDeletingApp(app);
  };

  const handleConfirmDelete = (app: Application) => {
    const updated = applications.filter((a) => a.id !== app.id);
    setApplications(updated);
    saveApplications(updated);
    deleteApplicationFromDb(app.id);

    const newLog = addAuditLog(
      userRole === 'APPSEC_ADMIN' ? 'AppSec Lead' : 'IT Viewer',
      userRole,
      'DELETE',
      `Deleted application record: ${app.name} (${app.code})`,
      app.id,
      app.name
    );
    setAuditLogs(loadAuditLogs());
  };

  const handleSaveApp = (
    appData: Omit<Application, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => {
    const now = new Date().toISOString();

    if (existingId) {
      // Update
      const updated = applications.map((a) => {
        if (a.id === existingId) {
          return {
            ...appData,
            id: existingId,
            createdAt: a.createdAt,
            updatedAt: now
          };
        }
        return a;
      });

      setApplications(updated);
      saveApplications(updated);

      addAuditLog(
        appData.assessedBy || 'AppSec Engineer',
        userRole,
        'UPDATE',
        `Updated criticality factors and assigned Tier ${appData.tier} (Score: ${appData.calculatedScore}/100)`,
        existingId,
        appData.name
      );
    } else {
      // Create with guaranteed unique ID and Code
      const uniqueId = generateUniqueAppId(applications, pendingAssessments);
      const uniqueCode = generateUniqueAppCode(appData.code, applications, pendingAssessments);
      const newApp: Application = {
        ...appData,
        id: uniqueId,
        code: uniqueCode,
        createdAt: now,
        updatedAt: now
      };

      const updated = [newApp, ...applications];
      setApplications(updated);
      saveApplications(updated);

      addAuditLog(
        appData.assessedBy || 'AppSec Engineer',
        userRole,
        'CREATE',
        `Created new application profile: ${newApp.name} (${newApp.code}) - Tier ${newApp.tier}`,
        newApp.id,
        newApp.name
      );
    }

    setAuditLogs(loadAuditLogs());
  };

  const handleDuplicateApp = (app: Application) => {
    const now = new Date().toISOString();
    const newId = generateUniqueAppId(applications, pendingAssessments);
    const newCode = generateUniqueAppCode(`${app.code}-COPY`, applications, pendingAssessments);
    const duplicateApp: Application = {
      ...app,
      id: newId,
      code: newCode,
      name: `Copy of ${app.name}`,
      createdAt: now,
      updatedAt: now
    };

    const updated = [duplicateApp, ...applications];
    setApplications(updated);
    saveApplications(updated);

    addAuditLog(
      'AppSec Lead',
      userRole,
      'CREATE',
      `Duplicated application record from ${app.code}`,
      duplicateApp.id,
      duplicateApp.name
    );
    setAuditLogs(loadAuditLogs());
  };

  // Self-Assessment Submission & Review Workflow Handlers
  const handleSubmitSelfAssessment = (
    data: Omit<PendingAssessment, 'id' | 'submittedAt' | 'updatedAt' | 'status' | 'comments'>
  ) => {
    const now = new Date().toISOString();
    const newAssessment: PendingAssessment = {
      ...data,
      id: `SUB-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      submittedAt: now,
      updatedAt: now,
      status: 'PENDING_REVIEW',
      comments: [
        {
          id: `COMM-${Date.now()}`,
          author: data.submitterName,
          role: userRole,
          timestamp: now,
          text: `Submitted rating proposal for ${data.appName}. Score: ${data.calculatedScore.toFixed(1)}/12 (Proposed Tier ${data.proposedTier}).`
        }
      ]
    };

    const updatedList = [newAssessment, ...pendingAssessments];
    setPendingAssessments(updatedList);
    savePendingAssessments(updatedList);

    addAuditLog(
      data.submitterName,
      userRole,
      'SUBMIT_ASSESSMENT',
      `Submitted self-assessment rating for ${data.appName} (${data.appCode}): Proposed Tier ${data.proposedTier} (${data.calculatedScore.toFixed(1)} pts)`,
      data.appId,
      data.appName
    );
    setAuditLogs(loadAuditLogs());
  };

  const handleApproveAssessment = (
    assessment: PendingAssessment,
    updatedFactors?: CriticalityFactors
  ) => {
    const now = new Date().toISOString();
    const finalFactors = updatedFactors || assessment.factors;
    const finalScore = calculateCriticalityScore(finalFactors);
    const finalTier = scoreToTier(finalScore);

    let targetAppId = assessment.appId;
    // Check if an existing application matches targetAppId OR matching name or code
    const existingByAppId = targetAppId ? applications.find((a) => a.id === targetAppId) : undefined;
    const existingByNameOrCode = !existingByAppId
      ? applications.find(
          (a) =>
            a.name.trim().toLowerCase() === assessment.appName.trim().toLowerCase() ||
            a.code.trim().toLowerCase() === assessment.appCode.trim().toLowerCase()
        )
      : undefined;

    const matchedExistingApp = existingByAppId || existingByNameOrCode;
    let updatedAppsList: Application[];

    if (matchedExistingApp) {
      // Update existing application in database
      targetAppId = matchedExistingApp.id;
      updatedAppsList = applications.map((app) => {
        if (app.id === targetAppId) {
          return {
            ...app,
            tier: finalTier,
            rating: finalTier,
            calculatedScore: finalScore,
            factors: finalFactors,
            rto: assessment.rto,
            rpo: assessment.rpo,
            internetExposed: assessment.internetExposed,
            isGamingNetwork: assessment.isGamingNetwork,
            dataClassification: assessment.dataClassification,
            lastAssessed: now,
            assessedBy: `${assessment.submitterName} (Approved by AppSec Admin)`,
            status: 'ACTIVE' as AppStatus,
            updatedAt: now,
            notes: assessment.notes
              ? `${app.notes ? app.notes + '\n' : ''}[Approved Rating Note]: ${assessment.notes}`
              : app.notes
          };
        }
        return app;
      });
    } else {
      // Create brand new application in database with guaranteed unique ID and Code
      targetAppId = generateUniqueAppId(applications, pendingAssessments);
      const uniqueCode = generateUniqueAppCode(assessment.appCode, applications, pendingAssessments);

      const newApp: Application = {
        id: targetAppId,
        code: uniqueCode,
        name: assessment.appName,
        description: assessment.description,
        tier: finalTier,
        rating: finalTier,
        calculatedScore: finalScore,
        department: assessment.department,
        ownerAppSec: assessment.ownerAppSec || 'AppSec Lead',
        ownerIT: assessment.ownerIT,
        hostingEnv: assessment.hostingEnv,
        dataClassification: assessment.dataClassification,
        rto: assessment.rto,
        rpo: assessment.rpo,
        internetExposed: assessment.internetExposed,
        isGamingNetwork: assessment.isGamingNetwork,
        thirdPartyIntegrations: [],
        complianceRequirements: ['SOC 2 Type II'],
        status: 'ACTIVE',
        factors: finalFactors,
        lastAssessed: now,
        assessedBy: `${assessment.submitterName} (Approved by AppSec Admin)`,
        createdAt: now,
        updatedAt: now,
        notes: assessment.notes
      };
      updatedAppsList = [newApp, ...applications];
    }

    setApplications(updatedAppsList);
    saveApplications(updatedAppsList);

    // Update pending assessment status to APPROVED
    const updatedPendingList = pendingAssessments.map((item) => {
      if (item.id === assessment.id) {
        return {
          ...item,
          status: 'APPROVED' as ReviewStatus,
          adminDecisionBy: 'AppSec Lead (Admin)',
          adminDecisionAt: now,
          updatedAt: now,
          comments: [
            ...item.comments,
            {
              id: `COMM-${Date.now()}`,
              author: 'AppSec Lead (Admin)',
              role: userRole,
              timestamp: now,
              text: `Approved rating assessment and committed data into active database (Assigned Tier ${finalTier}, Score ${finalScore.toFixed(1)}).`
            }
          ]
        };
      }
      return item;
    });

    setPendingAssessments(updatedPendingList);
    savePendingAssessments(updatedPendingList);

    addAuditLog(
      'AppSec Lead',
      userRole,
      'APPROVE_ASSESSMENT',
      `Approved self-assessment rating for ${assessment.appName} (${assessment.appCode}). Committed Tier ${finalTier} into database.`,
      targetAppId,
      assessment.appName
    );
    setAuditLogs(loadAuditLogs());
  };

  const handleRejectAssessment = (assessmentId: string, reason: string) => {
    const now = new Date().toISOString();
    const updatedPendingList = pendingAssessments.map((item) => {
      if (item.id === assessmentId) {
        return {
          ...item,
          status: 'REJECTED' as ReviewStatus,
          adminDecisionBy: 'AppSec Lead (Admin)',
          adminDecisionAt: now,
          adminDecisionNotes: reason,
          updatedAt: now,
          comments: [
            ...item.comments,
            {
              id: `COMM-${Date.now()}`,
              author: 'AppSec Lead (Admin)',
              role: userRole,
              timestamp: now,
              text: `Assessment Rejected. Reason: ${reason}`
            }
          ]
        };
      }
      return item;
    });

    setPendingAssessments(updatedPendingList);
    savePendingAssessments(updatedPendingList);

    const item = pendingAssessments.find((a) => a.id === assessmentId);
    addAuditLog(
      'AppSec Lead',
      userRole,
      'REJECT_ASSESSMENT',
      `Rejected self-assessment submission for ${item?.appName || assessmentId}: ${reason}`,
      item?.appId,
      item?.appName
    );
    setAuditLogs(loadAuditLogs());
  };

  const handleAddCommentToAssessment = (assessmentId: string, text: string, isQuestion?: boolean) => {
    const now = new Date().toISOString();
    const updatedPendingList = pendingAssessments.map((item) => {
      if (item.id === assessmentId) {
        return {
          ...item,
          status: isQuestion ? ('IN_DISCUSSION' as ReviewStatus) : item.status,
          updatedAt: now,
          comments: [
            ...item.comments,
            {
              id: `COMM-${Date.now()}`,
              author: userRole === 'APPSEC_ADMIN' ? 'AppSec Lead (Admin)' : 'IT Submitter',
              role: userRole,
              timestamp: now,
              text,
              isQuestion
            }
          ]
        };
      }
      return item;
    });

    setPendingAssessments(updatedPendingList);
    savePendingAssessments(updatedPendingList);
  };

  const handleUpdatePendingFactors = (assessmentId: string, factors: CriticalityFactors) => {
    const now = new Date().toISOString();
    const score = calculateCriticalityScore(factors);
    const tier = scoreToTier(score);

    const updatedPendingList = pendingAssessments.map((item) => {
      if (item.id === assessmentId) {
        return {
          ...item,
          factors,
          calculatedScore: score,
          proposedTier: tier,
          updatedAt: now
        };
      }
      return item;
    });

    setPendingAssessments(updatedPendingList);
    savePendingAssessments(updatedPendingList);
  };

  const handleReopenAssessment = (assessmentId: string) => {
    const now = new Date().toISOString();
    const updatedPendingList = pendingAssessments.map((item) => {
      if (item.id === assessmentId) {
        return {
          ...item,
          status: 'IN_DISCUSSION' as ReviewStatus,
          updatedAt: now,
          comments: [
            ...item.comments,
            {
              id: `COMM-${Date.now()}`,
              author: 'AppSec Lead (Admin)',
              role: userRole,
              timestamp: now,
              text: 'Re-opened assessment ticket for further review and discussion.'
            }
          ]
        };
      }
      return item;
    });

    setPendingAssessments(updatedPendingList);
    savePendingAssessments(updatedPendingList);

    const item = pendingAssessments.find((a) => a.id === assessmentId);
    addAuditLog(
      'AppSec Lead',
      userRole,
      'REOPEN_ASSESSMENT',
      `Re-opened assessment ticket for ${item?.appName || assessmentId}`,
      item?.appId,
      item?.appName
    );
    setAuditLogs(loadAuditLogs());
  };

  // SOP Upload Handler
  const handleUploadSOP = (newVersion: SOPVersion) => {
    const updatedHistory = [newVersion, ...sopDocument.history];
    const updatedSopDocument: SOPDocument = {
      activeVersion: newVersion.version,
      history: updatedHistory
    };

    setSopDocument(updatedSopDocument);
    saveSOPDocument(updatedSopDocument);

    addAuditLog(
      newVersion.uploadedBy || 'AppSec Governance Lead',
      userRole,
      'SOP_UPLOAD',
      `Uploaded and published SOP ${newVersion.version}: ${newVersion.changeSummary}`
    );
    setAuditLogs(loadAuditLogs());
  };

  const handleSwitchSopVersion = (versionTag: string) => {
    // Optionally switch view
  };

  // Backup & Reset Handlers
  const handleExportJSON = () => {
    exportDatabaseJSON(applications, sopDocument, auditLogs, pendingAssessments);
    addAuditLog('System User', userRole, 'EXPORT', 'Exported JSON full backup file (including resolved/unresolved tickets)');
    setAuditLogs(loadAuditLogs());
  };

  const handleExportCSV = () => {
    exportApplicationsCSV(applications);
    addAuditLog('System User', userRole, 'EXPORT', 'Exported Applications CSV spreadsheet');
    setAuditLogs(loadAuditLogs());
  };

  const handleResetData = () => {
    if (confirm('Reset application database, pending review queue, and SOP documentation to initial demo state?')) {
      const reset = resetToDemoData();
      setApplications(reset.apps);
      setSopDocument(reset.sop);
      setAuditLogs(reset.logs);
      setPendingAssessments(reset.pending);
      fetch('/api/db/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true })
      }).catch((err) => console.warn('PostgreSQL reset re-seed error:', err));
    }
  };

  const pendingReviewCount = pendingAssessments.filter((a) => a.status === 'PENDING_REVIEW').length;

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans flex flex-col antialiased">
      
      {/* Top Header */}
      <Header
        currentRole={userRole}
        appCount={applications.length}
        activeSsoUser={activeSsoUser}
        onOpenAzureLogin={() => setIsAzureLoginOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
      />

      {/* Main Body with Side Navigation Menu */}
      <div className="flex-1 flex w-full relative min-h-0">
        {/* Side Navigation Menu */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          appCount={applications.length}
          activeSopVersion={sopDocument.activeVersion}
          auditCount={auditLogs.length}
          pendingCount={pendingReviewCount}
          scimUserCount={provisionedUsers.length}
          currentRole={userRole}
          activeSsoUser={activeSsoUser}
          onOpenAzureLogin={() => setIsAzureLoginOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isMobileOpen={isMobileMenuOpen}
          setIsMobileOpen={setIsMobileMenuOpen}
        />

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Tab 0: Azure AD SSO & SCIM Engine */}
        {activeTab === 'sso-scim' && (
          <SsoScimView
            ssoConfig={ssoConfig}
            onUpdateSsoConfig={(cfg) => {
              setSsoConfig(cfg);
              saveSsoConfig(cfg);
            }}
            scimConfig={scimConfig}
            onUpdateScimConfig={(cfg) => {
              setScimConfig(cfg);
              saveScimConfig(cfg);
            }}
            groupMappings={groupMappings}
            onUpdateGroupMappings={(mappings) => {
              setGroupMappings(mappings);
              saveGroupMappings(mappings);
            }}
            provisionedUsers={provisionedUsers}
            onUpdateUsers={(users) => {
              setProvisionedUsers(users);
              saveProvisionedUsers(users);
            }}
            scimLogs={scimLogs}
            onRefreshLogs={handleRefreshScimLogs}
            activeSsoUser={activeSsoUser}
            onOpenAzureLogin={() => setIsAzureLoginOpen(true)}
            onRoleChange={handleRoleChange}
          />
        )}

        {/* Tab 1: Applications Database */}
        {activeTab === 'apps' && (
          <div className="space-y-6">
            
            {/* Metric KPI Cards */}
            <StatsSummary
              applications={applications}
              onSelectTierFilter={(tier) =>
                setFilterState((prev) => ({ ...prev, tier }))
              }
              onSelectInternetFilter={() =>
                setFilterState((prev) => ({ ...prev, internetExposedOnly: true }))
              }
            />

            {/* Application Records Table */}
            <AppTable
              applications={applications}
              currentRole={userRole}
              onViewApp={handleViewApp}
              onEditApp={handleEditApp}
              onDeleteApp={handleDeleteApp}
              onDuplicateApp={handleDuplicateApp}
              onCreateApp={handleCreateApp}
              filterState={filterState}
              setFilterState={setFilterState}
            />

          </div>
        )}

        {/* Tab 2: Self-Service Rating Submission */}
        {activeTab === 'self-rating' && (
          <SelfRatingView
            applications={applications}
            pendingAssessments={pendingAssessments}
            onSubmitAssessment={handleSubmitSelfAssessment}
            onGoToReviewQueue={() => setActiveTab('review-queue')}
            currentRole={userRole}
            activeSsoUser={activeSsoUser}
          />
        )}

        {/* Tab 3: AppSec Review & Approval Queue */}
        {activeTab === 'review-queue' && (
          <ReviewQueueView
            pendingAssessments={pendingAssessments}
            applications={applications}
            currentRole={userRole}
            activeSsoUser={activeSsoUser}
            initialTicketId={initialTicketId}
            onApproveAssessment={handleApproveAssessment}
            onRejectAssessment={handleRejectAssessment}
            onAddComment={handleAddCommentToAssessment}
            onUpdateFactors={handleUpdatePendingFactors}
            onReopenAssessment={handleReopenAssessment}
          />
        )}

        {/* Tab 4: SOP Documentation */}
        {activeTab === 'sop' && (
          <SopViewer
            sopDocument={sopDocument}
            currentRole={userRole}
            onOpenUploadModal={() => setIsSopUploadOpen(true)}
            onSwitchVersion={handleSwitchSopVersion}
          />
        )}

        {/* Tab 5: Assessment Matrix & Rubric */}
        {activeTab === 'matrix' && <AssessmentMatrixView />}

        {/* Tab 6: Audit Trail */}
        {activeTab === 'audit' && <AuditTrailView logs={auditLogs} />}

      </main>
      </div>

      {/* Modals */}
      <AppDetailModal
        app={viewingApp}
        currentRole={userRole}
        onClose={() => setViewingApp(null)}
        onEdit={handleEditApp}
        onDelete={handleDeleteApp}
      />

      <AppFormModal
        isOpen={isFormOpen}
        editingApp={editingApp}
        applications={applications}
        pendingAssessments={pendingAssessments}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveApp}
      />

      <DeleteConfirmModal
        app={deletingApp}
        onClose={() => setDeletingApp(null)}
        onConfirm={handleConfirmDelete}
      />

      <SopUploadModal
        isOpen={isSopUploadOpen}
        currentVersion={sopDocument.activeVersion}
        onClose={() => setIsSopUploadOpen(false)}
        onUpload={handleUploadSOP}
        currentRole={userRole}
      />

      <AzureLoginModal
        isOpen={isAzureLoginOpen}
        onClose={() => setIsAzureLoginOpen(false)}
        ssoConfig={ssoConfig}
        groupMappings={groupMappings}
        onLoginSuccess={handleLoginSuccess}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentRole={userRole}
        activeSsoUser={activeSsoUser}
        onExportCSV={handleExportCSV}
        onExportJSON={handleExportJSON}
        onResetData={handleResetData}
        onOpenAzureLogin={() => setIsAzureLoginOpen(true)}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Application Criticality Database • AppSec & IT Operations Governance</span>
          <span className="font-mono text-slate-400">
            Role: {userRole === 'APPSEC_ADMIN' ? 'AppSec Admin (CRUD Enabled)' : 'IT Team (Read-Only Viewer)'}
          </span>
        </div>
      </footer>

    </div>
  );
}
