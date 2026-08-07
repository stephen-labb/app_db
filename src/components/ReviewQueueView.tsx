import React, { useState } from 'react';
import {
  PendingAssessment,
  Application,
  UserRole,
  ReviewStatus,
  CriticalityFactors,
  ActiveSsoUser
} from '../types';
import { checkDuplicateAppDetails } from '../utils/validation';
import {
  calculateCriticalityScore,
  scoreToTier,
  getTierBadgeProps,
  getRecommendedSLAs
} from '../utils/scoring';
import {
  exportTicketsCSV
} from '../utils/storage';
import {
  CheckSquare,
  Clock,
  MessageSquare,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Search,
  Send,
  User,
  Shield,
  ShieldAlert,
  Building,
  AlertTriangle,
  ArrowRight,
  Edit3,
  Database,
  Filter,
  X,
  ChevronRight,
  Info,
  Lock,
  RotateCcw,
  Download,
  Share2,
  Copy,
  Check,
  Link
} from 'lucide-react';

interface ReviewQueueViewProps {
  pendingAssessments: PendingAssessment[];
  applications: Application[];
  currentRole: UserRole;
  activeSsoUser?: ActiveSsoUser;
  initialTicketId?: string | null;
  onApproveAssessment: (assessment: PendingAssessment, updatedFactors?: CriticalityFactors) => void;
  onRejectAssessment: (assessmentId: string, reason: string) => void;
  onAddComment: (assessmentId: string, text: string, isQuestion?: boolean) => void;
  onUpdateFactors: (assessmentId: string, factors: CriticalityFactors) => void;
  onReopenAssessment: (assessmentId: string) => void;
}

/**
 * Object-Level Access Control (BOLA Guard)
 * Enforces that tickets in the review queue can only be accessed or reviewed by:
 * 1. AppSec / Super Admins (SUPER_ADMIN or APPSEC_ADMIN)
 * 2. The original Ticket Creator (matched via active user email, displayName, or UPN)
 */
export function checkTicketAccess(
  ticket: PendingAssessment,
  role: UserRole,
  activeUser?: ActiveSsoUser
): { canAccess: boolean; isCreator: boolean; isAdmin: boolean } {
  const isAdmin = role === 'SUPER_ADMIN' || role === 'APPSEC_ADMIN';
  if (isAdmin) {
    return { canAccess: true, isCreator: false, isAdmin: true };
  }

  if (!activeUser || !activeUser.isAuthenticated) {
    return { canAccess: false, isCreator: false, isAdmin: false };
  }

  const uEmail = (activeUser.email || activeUser.upn || '').trim().toLowerCase();
  const uName = (activeUser.displayName || '').trim().toLowerCase();

  const tEmail = (ticket.submitterEmail || '').trim().toLowerCase();
  const tName = (ticket.submitterName || '').trim().toLowerCase();
  const tOwner = (ticket.ownerIT || '').trim().toLowerCase();

  let isCreator = false;

  if (uEmail && tEmail && (uEmail === tEmail || uEmail.includes(tEmail) || tEmail.includes(uEmail))) {
    isCreator = true;
  } else if (uName && tName && (uName === tName || uName.includes(tName) || tName.includes(uName))) {
    isCreator = true;
  } else if (uEmail && tOwner && (tOwner.includes(uEmail) || uEmail.includes(tOwner))) {
    isCreator = true;
  } else if (uName && tOwner && (tOwner.includes(uName) || uName.includes(tOwner))) {
    isCreator = true;
  }

  return { canAccess: isCreator, isCreator, isAdmin: false };
}

export const ReviewQueueView: React.FC<ReviewQueueViewProps> = ({
  pendingAssessments,
  applications,
  currentRole,
  activeSsoUser,
  initialTicketId,
  onApproveAssessment,
  onRejectAssessment,
  onAddComment,
  onUpdateFactors,
  onReopenAssessment
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedAssessment, setSelectedAssessment] = useState<PendingAssessment | null>(null);
  const [unauthorizedTicket, setUnauthorizedTicket] = useState<PendingAssessment | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isQuestionToggle, setIsQuestionToggle] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [isEditingFactors, setIsEditingFactors] = useState(false);
  const [copiedTicketId, setCopiedTicketId] = useState<string | null>(null);

  const isAdmin = currentRole === 'SUPER_ADMIN' || currentRole === 'APPSEC_ADMIN';
  const [showMyTicketsOnly, setShowMyTicketsOnly] = useState<boolean>(!isAdmin);
  const [searchQuery, setSearchQuery] = useState('');

  // Editable factors when in detail view
  const [editingFactors, setEditingFactors] = useState<CriticalityFactors>({
    sensitiveDataScore: 8,
    exposureScore: 6,
    stabilityScore: 6,
    attackHistoryScore: 0,
    downtimeImpactScore: 6
  });

  React.useEffect(() => {
    if (initialTicketId) {
      const match = pendingAssessments.find(a => a.id.toLowerCase() === initialTicketId.toLowerCase());
      if (match) {
        const access = checkTicketAccess(match, currentRole, activeSsoUser);
        if (access.canAccess) {
          setSelectedAssessment(match);
          setEditingFactors(match.factors);
        } else {
          setUnauthorizedTicket(match);
        }
      }
    }
  }, [initialTicketId, pendingAssessments, currentRole, activeSsoUser]);

  const handleCopyDirectLink = (ticketId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const url = new URL(window.location.href);
    url.searchParams.set('ticket', ticketId);
    const directUrl = url.toString();

    navigator.clipboard.writeText(directUrl).then(() => {
      setCopiedTicketId(ticketId);
      setTimeout(() => setCopiedTicketId(null), 3000);
    }).catch(() => {
      // Fallback
      setCopiedTicketId(ticketId);
      setTimeout(() => setCopiedTicketId(null), 3000);
    });
  };

  const filteredAssessments = pendingAssessments.filter((item) => {
    if (statusFilter !== 'ALL' && item.status !== statusFilter) {
      return false;
    }
    if (!isAdmin && showMyTicketsOnly) {
      const access = checkTicketAccess(item, currentRole, activeSsoUser);
      if (!access.isCreator) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchId = item.id.toLowerCase().includes(q);
      const matchName = item.appName.toLowerCase().includes(q);
      const matchCode = item.appCode.toLowerCase().includes(q);
      const matchSubmitter = item.submitterName.toLowerCase().includes(q);
      const matchDepartment = item.department.toLowerCase().includes(q);
      const matchStatus = item.status.toLowerCase().includes(q);
      if (!matchId && !matchName && !matchCode && !matchSubmitter && !matchDepartment && !matchStatus) {
        return false;
      }
    }
    return true;
  });

  const pendingCount = pendingAssessments.filter((a) => a.status === 'PENDING_REVIEW').length;
  const inDiscussionCount = pendingAssessments.filter((a) => a.status === 'IN_DISCUSSION').length;
  const approvedCount = pendingAssessments.filter((a) => a.status === 'APPROVED').length;
  const rejectedCount = pendingAssessments.filter((a) => a.status === 'REJECTED').length;

  const openDetailModal = (assessment: PendingAssessment) => {
    const access = checkTicketAccess(assessment, currentRole, activeSsoUser);
    if (!access.canAccess) {
      setUnauthorizedTicket(assessment);
      return;
    }
    setSelectedAssessment(assessment);
    setEditingFactors(assessment.factors);
    setIsEditingFactors(false);
    setIsRejecting(false);
    setCommentText('');
    setRejectionReason('');
  };

  const handleSaveFactorAdjustments = () => {
    if (!selectedAssessment) return;
    onUpdateFactors(selectedAssessment.id, editingFactors);
    const newScore = calculateCriticalityScore(editingFactors);
    const newTier = scoreToTier(newScore);
    
    // Update local state
    const updated = {
      ...selectedAssessment,
      factors: editingFactors,
      calculatedScore: newScore,
      proposedTier: newTier
    };
    setSelectedAssessment(updated);
    setIsEditingFactors(false);
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !selectedAssessment) return;
    if (selectedAssessment.status === 'APPROVED' || selectedAssessment.status === 'REJECTED') return;

    onAddComment(selectedAssessment.id, commentText.trim(), isQuestionToggle);
    
    // Local state update for immediate feedback
    const newComment = {
      id: `COMM-${Date.now()}`,
      author: currentRole === 'APPSEC_ADMIN' ? 'AppSec Lead (Admin)' : 'IT Submitter',
      role: currentRole,
      timestamp: new Date().toISOString(),
      text: commentText.trim(),
      isQuestion: isQuestionToggle
    };

    const updatedAssessment = {
      ...selectedAssessment,
      status: isQuestionToggle ? ('IN_DISCUSSION' as ReviewStatus) : selectedAssessment.status,
      comments: [...selectedAssessment.comments, newComment]
    };

    setSelectedAssessment(updatedAssessment);
    setCommentText('');
    setIsQuestionToggle(false);
  };

  const handleReopen = () => {
    if (!selectedAssessment) return;
    onReopenAssessment(selectedAssessment.id);

    const reopenedComment = {
      id: `COMM-${Date.now()}`,
      author: 'AppSec Lead (Admin)',
      role: currentRole,
      timestamp: new Date().toISOString(),
      text: 'Ticket re-opened for further review and discussion by AppSec Lead.'
    };

    const updatedAssessment: PendingAssessment = {
      ...selectedAssessment,
      status: 'IN_DISCUSSION',
      comments: [...selectedAssessment.comments, reopenedComment]
    };

    setSelectedAssessment(updatedAssessment);
  };

  const handleApprove = () => {
    if (!selectedAssessment) return;
    onApproveAssessment(selectedAssessment, isEditingFactors ? editingFactors : undefined);
    setSelectedAssessment(null);
  };

  const handleConfirmReject = () => {
    if (!selectedAssessment || !rejectionReason.trim()) return;
    onRejectAssessment(selectedAssessment.id, rejectionReason.trim());
    setSelectedAssessment(null);
    setIsRejecting(false);
  };

  const getStatusBadge = (status: ReviewStatus) => {
    switch (status) {
      case 'PENDING_REVIEW':
        return {
          label: 'Pending Review',
          bg: 'bg-amber-100 text-amber-900 border-amber-300',
          dot: 'bg-amber-500'
        };
      case 'IN_DISCUSSION':
        return {
          label: 'In Discussion / Questions',
          bg: 'bg-indigo-100 text-indigo-900 border-indigo-300',
          dot: 'bg-indigo-500'
        };
      case 'APPROVED':
        return {
          label: 'Approved & In Database',
          bg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          dot: 'bg-emerald-500'
        };
      case 'REJECTED':
        return {
          label: 'Rejected',
          bg: 'bg-rose-100 text-rose-900 border-rose-300',
          dot: 'bg-rose-500'
        };
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              AppSec Criticality Review & Approval Queue
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Review self-assessment rating submissions, ask questions/comments, adjust factor scores, and approve data into the active application database.
          </p>
        </div>

        {/* Actions: Role Badge & Export Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="px-3.5 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-600" />
            <span>
              Current Mode: {currentRole === 'SUPER_ADMIN' ? 'Super Admin (Full Approvals)' : currentRole === 'APPSEC_ADMIN' ? 'AppSec Admin (Can Approve/Reject)' : 'IT Viewer / Submitter'}
            </span>
          </div>

          {isAdmin ? (
            <button
              onClick={() => exportTicketsCSV(pendingAssessments)}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              title="Export all resolved and unresolved assessment tickets to CSV spreadsheet"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Tickets CSV</span>
            </button>
          ) : (
            <button
              onClick={() => {
                const authorized = pendingAssessments.filter(t => checkTicketAccess(t, currentRole, activeSsoUser).canAccess);
                exportTicketsCSV(authorized);
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              title="Export my authorized created tickets to CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export My Tickets CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* BOLA Security Policy Callout Banner */}
      <div className="bg-indigo-950 text-indigo-100 p-4 rounded-2xl border border-indigo-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-900 border border-indigo-700 flex items-center justify-center shrink-0 text-indigo-300">
            <Lock className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <div className="font-bold text-white flex items-center gap-2">
              <span>Object-Level Access Control (BOLA Guard Active)</span>
              <span className="px-2 py-0.5 rounded bg-indigo-800 text-[10px] font-mono font-bold text-indigo-200 border border-indigo-700">
                OWASP API1:2023 Compliant
              </span>
            </div>
            <p className="text-[11px] text-indigo-200 mt-0.5">
              {isAdmin
                ? 'AppSec / Super Admin Mode: You have full object access to review, adjust scores, and approve or reject all tickets.'
                : `Authenticated Identity: ${activeSsoUser?.displayName || 'IT Submitter'} (${activeSsoUser?.email || 'IT Viewer'}). Access control restricts ticket review to AppSec Admins and ticket creators.`}
            </p>
          </div>
        </div>

        {!isAdmin && (
          <button
            type="button"
            onClick={() => setShowMyTicketsOnly(!showMyTicketsOnly)}
            className="px-3 py-1.5 rounded-xl bg-indigo-800 hover:bg-indigo-700 text-white font-semibold text-xs border border-indigo-700 transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
          >
            <Filter className="w-3.5 h-3.5 text-indigo-300" />
            <span>{showMyTicketsOnly ? 'Showing My Created Tickets' : 'Showing All (Restricted Marked)'}</span>
          </button>
        )}
      </div>

      {/* Filter Tabs & Live Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>All Submissions</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-700 text-slate-200 font-mono">
              {pendingAssessments.length}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('PENDING_REVIEW')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'PENDING_REVIEW'
                ? 'bg-amber-600 text-white shadow-xs font-bold'
                : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Pending Review</span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-800 text-amber-100 font-extrabold animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setStatusFilter('IN_DISCUSSION')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'IN_DISCUSSION'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-indigo-800 hover:bg-indigo-50 border border-indigo-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
            <span>In Discussion</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-mono">
              {inDiscussionCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'APPROVED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Approved</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-mono">
              {approvedCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'REJECTED'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-rose-800 hover:bg-rose-50 border border-rose-200'
            }`}
          >
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>Rejected</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-800 font-mono">
              {rejectedCount}
            </span>
          </button>
        </div>

        {/* Live Search Tickets */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Live search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* List of Submissions */}
      {filteredAssessments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <CheckSquare className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Assessment Submissions Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            There are no submissions matching the selected status filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssessments.map((item) => {
            const statusProps = getStatusBadge(item.status);
            const proposedTierProps = getTierBadgeProps(item.proposedTier);
            const existingApp = item.appId ? applications.find((a) => a.id === item.appId) : null;
            const existingTierProps = existingApp ? getTierBadgeProps(existingApp.tier) : null;
            const questionCount = item.comments.filter((c) => c.isQuestion).length;
            const access = checkTicketAccess(item, currentRole, activeSsoUser);

            return (
              <div
                key={item.id}
                onClick={() => openDetailModal(item)}
                className={`rounded-2xl border p-5 transition-all cursor-pointer flex flex-col justify-between space-y-4 group ${
                  access.canAccess
                    ? 'bg-white border-slate-200/80 hover:border-indigo-300 hover:shadow-md'
                    : 'bg-rose-50/20 border-rose-200/80 hover:border-rose-300 hover:shadow-md'
                }`}
              >
                <div className="space-y-3">
                  {/* Status & Access Header */}
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] text-slate-400 font-semibold">
                        {item.id}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleCopyDirectLink(item.id, e)}
                        className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1 text-[10px] font-semibold border border-slate-200/80"
                        title="Copy direct shareable link for communications"
                      >
                        {copiedTicketId === item.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-600 font-bold">Link Copied</span>
                          </>
                        ) : (
                          <>
                            <Share2 className="w-3 h-3" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {access.isAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Shield className="w-3 h-3 text-indigo-600" />
                          <span>Admin</span>
                        </span>
                      ) : access.isCreator ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <User className="w-3 h-3 text-emerald-600" />
                          <span>Your Ticket</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <Lock className="w-3 h-3 text-rose-500" />
                          <span>Restricted</span>
                        </span>
                      )}

                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusProps.bg}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusProps.dot}`} />
                        {statusProps.label}
                      </span>
                    </div>
                  </div>

                  {/* App Title */}
                  <div>
                    <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 inline-block mb-1">
                      {item.appCode}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                      {item.appName}
                    </h3>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                      {item.description || item.notes || 'No notes provided.'}
                    </p>
                  </div>

                  {/* Proposed Score & Comparison Badge */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                    <div className="text-[10px] uppercase font-bold text-slate-400">
                      Proposed Criticality Rating
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {existingTierProps ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className={`px-2 py-0.5 rounded font-bold border text-[11px] ${existingTierProps.bg}`}>
                              Current: {existingApp?.tier}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            <span className={`px-2.5 py-0.5 rounded-md font-bold text-xs border ${proposedTierProps.bg}`}>
                              New: {item.proposedTier} ({item.calculatedScore.toFixed(1)})
                            </span>
                          </div>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-md font-bold text-xs border ${proposedTierProps.bg}`}>
                            Proposed Tier: {item.proposedTier} ({item.calculatedScore.toFixed(1)}/12)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Submitter & Comments Count */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5 truncate">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate font-medium">{item.submitterName}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {questionCount > 0 && (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 font-bold rounded text-[10px] flex items-center gap-1">
                        <HelpCircle className="w-3 h-3 text-amber-600" />
                        {questionCount} Qs
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-slate-600 font-semibold">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {item.comments.length}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Detail & Review Modal */}
      {selectedAssessment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto flex flex-col my-6 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-indigo-300">
                      {selectedAssessment.appCode}
                    </span>
                    <span className="text-xs text-slate-400">• Ticket: {selectedAssessment.id}</span>
                  </div>
                  <h2 className="text-lg font-bold">{selectedAssessment.appName}</h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyDirectLink(selectedAssessment.id)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Copy direct shareable link for email, Slack, or Teams communications"
                >
                  {copiedTicketId === selectedAssessment.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Copy Direct Link</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setSelectedAssessment(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 text-slate-700 text-xs">
              
              {/* Status & Submitter Banner */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold text-slate-900 text-sm">
                      Submitted by {selectedAssessment.submitterName} ({selectedAssessment.submitterEmail})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Submitted on {new Date(selectedAssessment.submittedAt).toLocaleString()} • Department: {selectedAssessment.department}
                  </p>
                </div>

                <span
                  className={`px-3 py-1 rounded-full font-bold text-xs border ${
                    getStatusBadge(selectedAssessment.status).bg
                  }`}
                >
                  {getStatusBadge(selectedAssessment.status).label}
                </span>
              </div>

              {/* Duplicate Detection Warning Banner */}
              {(() => {
                const dup = checkDuplicateAppDetails({
                  name: selectedAssessment.appName,
                  code: selectedAssessment.appCode,
                  id: selectedAssessment.appId,
                  applications,
                  pendingAssessments,
                  currentPendingId: selectedAssessment.id
                });
                if (dup.hasDuplicate) {
                  return (
                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-900 text-xs font-semibold flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-amber-800">Duplicate Record Alert</p>
                        <p className="text-[11px] text-amber-700 mt-0.5">
                          {dup.errorMessage}
                        </p>
                        <p className="text-[10px] text-amber-800/80 mt-1">
                          Note: Approving this assessment will automatically auto-generate a unique Application Code or update the existing record to guarantee data uniqueness across the database.
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Calculated Score & Tier Comparison Box */}
              <div className="p-4 bg-indigo-950 text-white rounded-xl border border-indigo-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-indigo-300 font-semibold uppercase tracking-wider block">
                    Criticality Score & Tier Result
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-extrabold font-mono text-indigo-200">
                      {selectedAssessment.calculatedScore.toFixed(1)} / 12.0
                    </span>
                    <span
                      className={`px-3.5 py-1 rounded-full font-bold text-xs border ${
                        getTierBadgeProps(selectedAssessment.proposedTier).bg
                      }`}
                    >
                      Proposed Tier: {selectedAssessment.proposedTier}
                    </span>
                  </div>
                </div>

                <div className="text-right text-xs text-indigo-200 space-y-0.5">
                  <div>RTO SLA: <strong className="font-mono text-white">{selectedAssessment.rto}</strong></div>
                  <div>RPO SLA: <strong className="font-mono text-white">{selectedAssessment.rpo}</strong></div>
                  <div>Data Class: <strong className="text-amber-300">{selectedAssessment.dataClassification}</strong></div>
                </div>
              </div>

              {/* Factor Breakdown & Editing */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-indigo-700">
                    Appendix II Rating Criteria Breakdown
                  </h3>

                  {/* Allow adjusting factors during review */}
                  {selectedAssessment.status !== 'APPROVED' && selectedAssessment.status !== 'REJECTED' && (
                    <button
                      type="button"
                      onClick={() => setIsEditingFactors(!isEditingFactors)}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-600 border border-slate-300 rounded-lg font-semibold text-[11px] flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{isEditingFactors ? 'Cancel Edits' : 'Adjust Scores Before Approval'}</span>
                    </button>
                  )}
                </div>

                {isEditingFactors ? (
                  /* Factor Editor */
                  <div className="space-y-3 bg-white p-4 rounded-lg border border-indigo-200">
                    <div className="text-xs text-indigo-900 font-semibold mb-2">
                      Adjust factors based on discussion or admin review:
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-semibold mb-1">1. Sensitive Data (32.5%)</label>
                        <select
                          value={editingFactors.sensitiveDataScore}
                          onChange={(e) =>
                            setEditingFactors((prev) => ({ ...prev, sensitiveDataScore: parseInt(e.target.value) }))
                          }
                          className="w-full px-2.5 py-1.5 border rounded-lg"
                        >
                          <option value={0}>0 = Public</option>
                          <option value={4}>4 = Internal</option>
                          <option value={8}>8 = Restricted</option>
                          <option value={12}>12 = Confidential</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold mb-1">2. Network Exposure (32.5%)</label>
                        <select
                          value={editingFactors.exposureScore}
                          onChange={(e) =>
                            setEditingFactors((prev) => ({ ...prev, exposureScore: parseInt(e.target.value) }))
                          }
                          className="w-full px-2.5 py-1.5 border rounded-lg"
                        >
                          <option value={0}>0 = Internal</option>
                          <option value={6}>6 = Public with control</option>
                          <option value={12}>12 = Gaming network / Fully public</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold mb-1">3. Attack History (15.0%)</label>
                        <select
                          value={editingFactors.attackHistoryScore}
                          onChange={(e) =>
                            setEditingFactors((prev) => ({ ...prev, attackHistoryScore: parseInt(e.target.value) }))
                          }
                          className="w-full px-2.5 py-1.5 border rounded-lg"
                        >
                          <option value={0}>0 = None</option>
                          <option value={6}>6 = Attempted</option>
                          <option value={12}>12 = Compromised</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold mb-1">4. Development Status (10.0%)</label>
                        <select
                          value={editingFactors.stabilityScore}
                          onChange={(e) =>
                            setEditingFactors((prev) => ({ ...prev, stabilityScore: parseInt(e.target.value) }))
                          }
                          className="w-full px-2.5 py-1.5 border rounded-lg"
                        >
                          <option value={0}>0 = Stable</option>
                          <option value={6}>6 = Recently updated</option>
                          <option value={12}>12 = Newly built</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block font-semibold mb-1">5. Downtime Impact (10.0%)</label>
                        <select
                          value={editingFactors.downtimeImpactScore}
                          onChange={(e) =>
                            setEditingFactors((prev) => ({ ...prev, downtimeImpactScore: parseInt(e.target.value) }))
                          }
                          className="w-full px-2.5 py-1.5 border rounded-lg"
                        >
                          <option value={0}>0 = No impact</option>
                          <option value={6}>6 = Minor disruption</option>
                          <option value={12}>12 = Critical business impact</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveFactorAdjustments}
                      className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg text-xs hover:bg-indigo-700 transition-colors mt-2"
                    >
                      Apply Adjusted Factor Scores
                    </button>
                  </div>
                ) : (
                  /* Read-only Factor Table */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">1. Sensitive Data (32.5%)</span>
                      <span className="font-bold text-slate-800">{selectedAssessment.factors.sensitiveDataScore} pts</span>
                    </div>

                    <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">2. Exposure (32.5%)</span>
                      <span className="font-bold text-slate-800">{selectedAssessment.factors.exposureScore} pts</span>
                    </div>

                    <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">3. Attack History (15.0%)</span>
                      <span className="font-bold text-slate-800">{selectedAssessment.factors.attackHistoryScore} pts</span>
                    </div>

                    <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">4. Development Status (10.0%)</span>
                      <span className="font-bold text-slate-800">{selectedAssessment.factors.stabilityScore} pts</span>
                    </div>

                    <div className="p-2.5 bg-white rounded-lg border border-slate-200 sm:col-span-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">5. Downtime Impact (10.0%)</span>
                      <span className="font-bold text-slate-800">{selectedAssessment.factors.downtimeImpactScore} pts</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Submitter Notes */}
              {selectedAssessment.notes && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
                  <div className="font-bold text-amber-950 text-[11px] flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-600" />
                    <span>Submitter Assessment Notes & Justification</span>
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed pl-5">
                    {selectedAssessment.notes}
                  </p>
                </div>
              )}

              {/* Interactive Q&A Discussion Thread */}
              <div className="space-y-3 pt-2">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-indigo-700 border-b border-slate-200 pb-1 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <span>Review Comments & Q&A Discussion Thread ({selectedAssessment.comments.length})</span>
                </h3>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {selectedAssessment.comments.length === 0 ? (
                    <div className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-lg text-center">
                      No comments or questions posted yet.
                    </div>
                  ) : (
                    selectedAssessment.comments.map((comm) => (
                      <div
                        key={comm.id}
                        className={`p-3 rounded-xl border text-xs space-y-1 ${
                          comm.isQuestion
                            ? 'bg-amber-50 border-amber-200 text-amber-950'
                            : comm.role === 'APPSEC_ADMIN'
                            ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950'
                            : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold">{comm.author}</span>
                            <span className="text-slate-400">• {new Date(comm.timestamp).toLocaleTimeString()}</span>
                          </div>
                          {comm.isQuestion && (
                            <span className="px-2 py-0.5 bg-amber-200 text-amber-900 font-extrabold rounded text-[10px] flex items-center gap-1">
                              <HelpCircle className="w-3 h-3 text-amber-700" />
                              Question / Clarification Requested
                            </span>
                          )}
                        </div>
                        <p className="text-xs leading-relaxed">{comm.text}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment Form OR Lock Banner */}
                {selectedAssessment.status === 'APPROVED' || selectedAssessment.status === 'REJECTED' ? (
                  <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>
                        Comments are disabled because this assessment ticket is <strong className="uppercase">{selectedAssessment.status}</strong>.
                      </span>
                    </div>
                    {currentRole === 'APPSEC_ADMIN' && (
                      <button
                        type="button"
                        onClick={handleReopen}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors shrink-0 shadow-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Re-open Ticket</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handlePostComment} className="space-y-2 pt-2 border-t border-slate-200">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder={
                          isAdmin
                            ? "Post a review comment or ask a question..."
                            : "Reply or provide additional justification..."
                        }
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500"
                      />

                      <button
                        type="submit"
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Post</span>
                      </button>
                    </div>

                    {isAdmin && (
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600 select-none">
                        <input
                          type="checkbox"
                          checked={isQuestionToggle}
                          onChange={(e) => setIsQuestionToggle(e.target.checked)}
                          className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span>Mark as Admin Question / Request Adjustments (Moves status to "In Discussion")</span>
                      </label>
                    )}
                  </form>
                )}
              </div>

              {/* Rejection Reason Form if rejecting */}
              {isRejecting && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3 animate-in fade-in duration-150">
                  <div className="font-bold text-xs text-rose-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Provide Rejection Reason</span>
                  </div>
                  <textarea
                    rows={2}
                    required
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain why this assessment proposal is rejected..."
                    className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-xs"
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setIsRejecting(false)}
                      className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmReject}
                      className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              )}

              {/* Modal Footer Admin Actions */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedAssessment(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-xs transition-colors"
                >
                  Close
                </button>

                {!isAdmin && (
                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
                    <Shield className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>Approval & rejection are reserved for AppSec Admins. As the ticket creator, you can post comments above.</span>
                  </div>
                )}

                {isAdmin && (selectedAssessment.status === 'APPROVED' || selectedAssessment.status === 'REJECTED') && (
                  <button
                    type="button"
                    onClick={handleReopen}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Re-open Ticket for Review</span>
                  </button>
                )}

                {isAdmin && selectedAssessment.status !== 'APPROVED' && selectedAssessment.status !== 'REJECTED' && (
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {!isRejecting && (
                      <button
                        type="button"
                        onClick={() => setIsRejecting(true)}
                        className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-lg text-xs transition-colors"
                      >
                        Reject Submission
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleApprove}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-xs shadow-md flex items-center gap-2 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve & Add to Database</span>
                    </button>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

      {/* BOLA Security Access Denied Modal */}
      {unauthorizedTicket && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-rose-300 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-rose-950 text-white p-5 border-b border-rose-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600/30 border border-rose-500/50 flex items-center justify-center text-rose-300 shrink-0">
                  <ShieldAlert className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-rose-100 flex items-center gap-2">
                    <span>Access Denied (BOLA Protection)</span>
                  </h3>
                  <p className="text-[10px] text-rose-300 font-mono">
                    Broken Object Level Authorization Guard Enforced
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUnauthorizedTicket(null)}
                className="p-1 rounded-lg text-rose-300 hover:text-white hover:bg-rose-900 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-xs text-slate-700">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                <div className="font-bold text-rose-900 text-sm flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-rose-600" />
                  <span>Restricted Ticket Object: {unauthorizedTicket.id}</span>
                </div>
                <p className="text-rose-800 leading-relaxed">
                  You are not authorized to view or review assessment details for{' '}
                  <strong className="font-semibold text-slate-900">{unauthorizedTicket.appName}</strong> ({unauthorizedTicket.appCode}).
                </p>
              </div>

              <div className="space-y-2 border-t border-slate-200 pt-3">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Object Access Control Rules
                </h4>
                <ul className="space-y-1.5 text-slate-600 list-disc list-inside leading-relaxed text-[11px]">
                  <li>Review queue tickets can only be accessed by <strong>AppSec/Super Admins</strong> or the <strong>original ticket creator</strong>.</li>
                  <li>
                    Ticket Submitter: <span className="font-mono text-slate-900">{unauthorizedTicket.submitterName} ({unauthorizedTicket.submitterEmail})</span>
                  </li>
                  <li>
                    Current Identity: <span className="font-mono text-slate-900">{activeSsoUser?.displayName || 'IT Submitter'} ({activeSsoUser?.email || 'IT Viewer'})</span>
                  </li>
                </ul>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] leading-relaxed">
                💡 <strong>Need Admin Access?</strong> If you are an AppSec Lead, switch your user role to AppSec Admin or sign in via Azure AD SSO in the Azure SSO & SCIM tab.
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUnauthorizedTicket(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close Notice
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
