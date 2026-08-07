import React, { useState } from 'react';
import { Application, CriticalityFactors, DataClassification, PendingAssessment, UserRole, ActiveSsoUser, STANDARD_DEPARTMENTS } from '../types';
import { checkDuplicateAppDetails } from '../utils/validation';
import { calculateCriticalityScore, scoreToTier, getTierBadgeProps, getRecommendedSLAs } from '../utils/scoring';
import {
  Sparkles,
  Calculator,
  Send,
  CheckCircle2,
  AlertTriangle,
  Info,
  Server,
  Building,
  User,
  Mail,
  FileText,
  Clock,
  ArrowRight,
  ShieldCheck,
  UserCheck
} from 'lucide-react';

interface SelfRatingViewProps {
  applications: Application[];
  pendingAssessments?: PendingAssessment[];
  onSubmitAssessment: (assessment: Omit<PendingAssessment, 'id' | 'submittedAt' | 'updatedAt' | 'status' | 'comments'>) => void;
  onGoToReviewQueue: () => void;
  currentRole: UserRole;
  activeSsoUser?: ActiveSsoUser;
}

export const SelfRatingView: React.FC<SelfRatingViewProps> = ({
  applications,
  pendingAssessments = [],
  onSubmitAssessment,
  onGoToReviewQueue,
  currentRole,
  activeSsoUser
}) => {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [assessmentType, setAssessmentType] = useState<'EXISTING' | 'NEW'>('NEW');
  const [selectedAppId, setSelectedAppId] = useState<string>('');

  // Form State
  const [appCode, setAppCode] = useState('');
  const [appName, setAppName] = useState('');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState('FinTech & Payments');
  const [ownerIT, setOwnerIT] = useState(
    activeSsoUser?.displayName ? `${activeSsoUser.displayName} (IT Lead)` : ''
  );
  const [ownerAppSec, setOwnerAppSec] = useState('AppSec Lead');
  const [submitterName, setSubmitterName] = useState(activeSsoUser?.displayName || '');
  const [submitterEmail, setSubmitterEmail] = useState(
    activeSsoUser?.email || activeSsoUser?.upn || ''
  );

  React.useEffect(() => {
    if (activeSsoUser && activeSsoUser.isAuthenticated) {
      if (activeSsoUser.displayName) {
        setSubmitterName(activeSsoUser.displayName);
        if (!ownerIT || ownerIT === 'Alex Vance (IT Ops)') {
          setOwnerIT(`${activeSsoUser.displayName} (IT Lead)`);
        }
      }
      if (activeSsoUser.email || activeSsoUser.upn) {
        setSubmitterEmail(activeSsoUser.email || activeSsoUser.upn);
      }
    }
  }, [activeSsoUser]);
  const [dataClassification, setDataClassification] = useState<DataClassification>('RESTRICTED');
  const [hostingEnv, setHostingEnv] = useState('GCP Cloud Run / AWS Multi-AZ');
  const [rto, setRto] = useState('1 Hour');
  const [rpo, setRpo] = useState('15 Minutes');
  const [internetExposed, setInternetExposed] = useState(false);
  const [isGamingNetwork, setIsGamingNetwork] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);

  // Criticality Factors (Appendix II Framework)
  const [factors, setFactors] = useState<CriticalityFactors>({
    sensitiveDataScore: 8,  // 0, 4, 8, 12
    exposureScore: 6,       // 0, 6, 12
    stabilityScore: 6,      // 0, 6, 12
    attackHistoryScore: 0,  // 0, 6, 12
    downtimeImpactScore: 6  // 0, 6, 12
  });

  // Calculate live score & tier
  const liveScore = calculateCriticalityScore(factors);
  const liveTier = scoreToTier(liveScore);
  const tierBadgeProps = getTierBadgeProps(liveTier);
  const recommendedSLA = getRecommendedSLAs(liveTier);

  // When switching to an existing application, populate fields
  const handleSelectExistingApp = (appId: string) => {
    setSelectedAppId(appId);
    const app = applications.find((a) => a.id === appId);
    if (app) {
      setAppCode(app.code);
      setAppName(app.name);
      setDescription(app.description);
      setDepartment(app.department);
      setOwnerIT(app.ownerIT);
      setOwnerAppSec(app.ownerAppSec);
      setDataClassification(app.dataClassification);
      setHostingEnv(app.hostingEnv);
      setRto(app.rto);
      setRpo(app.rpo);
      setInternetExposed(app.internetExposed);
      setIsGamingNetwork(Boolean(app.isGamingNetwork));
      setFactors(app.factors || {
        sensitiveDataScore: 8,
        exposureScore: app.internetExposed ? 6 : 0,
        stabilityScore: 6,
        attackHistoryScore: 0,
        downtimeImpactScore: 6
      });
      setNotes(`Re-assessment request for ${app.code} - ${app.name}`);
    }
  };

  const handleAssessmentTypeChange = (type: 'EXISTING' | 'NEW') => {
    setAssessmentType(type);
    setIsSubmittedSuccess(false);
    if (type === 'NEW') {
      setSelectedAppId('');
      setAppCode(`APP-${Math.floor(1000 + Math.random() * 9000)}`);
      setAppName('');
      setDescription('');
      setDepartment('FinTech & Payments');
      setOwnerIT(activeSsoUser?.displayName ? `${activeSsoUser.displayName} (IT Lead)` : '');
      setOwnerAppSec('AppSec Lead');
      if (activeSsoUser?.displayName) setSubmitterName(activeSsoUser.displayName);
      if (activeSsoUser?.email || activeSsoUser?.upn) setSubmitterEmail(activeSsoUser.email || activeSsoUser.upn);
      setDataClassification('RESTRICTED');
      setHostingEnv('GCP Cloud Run');
      setRto('1 Hour');
      setRpo('15 Minutes');
      setInternetExposed(false);
      setIsGamingNetwork(false);
      setNotes('');
      setFactors({
        sensitiveDataScore: 8,
        exposureScore: 0,
        stabilityScore: 6,
        attackHistoryScore: 0,
        downtimeImpactScore: 6
      });
    } else if (applications.length > 0) {
      handleSelectExistingApp(applications[0].id);
    }
  };

  // Compute effective submitter identity from active SSO session
  const effectiveSubmitterName =
    activeSsoUser?.displayName ||
    (submitterName && submitterName !== 'Authenticated User' ? submitterName : '') ||
    'Sarah Jenkins';
  const effectiveSubmitterEmail =
    activeSsoUser?.email ||
    activeSsoUser?.upn ||
    (submitterEmail && submitterEmail !== 'user@company.com' ? submitterEmail : '') ||
    'sjenkins@contoso.com';

  const dupCheck = checkDuplicateAppDetails({
    name: assessmentType === 'NEW' ? appName : '',
    code: assessmentType === 'NEW' ? appCode : '',
    applications,
    pendingAssessments
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim()) return;

    if (assessmentType === 'NEW' && dupCheck.hasDuplicate) {
      setSubmitError(dupCheck.errorMessage || 'Duplicate application name or code detected!');
      return;
    }

    setSubmitError(null);

    onSubmitAssessment({
      appId: assessmentType === 'EXISTING' ? selectedAppId : undefined,
      appCode: appCode.trim() || `APP-${Math.floor(1000 + Math.random() * 9000)}`,
      appName: appName.trim(),
      description: description.trim(),
      department,
      ownerIT,
      ownerAppSec,
      submitterName: effectiveSubmitterName,
      submitterEmail: effectiveSubmitterEmail,
      dataClassification,
      hostingEnv,
      rto,
      rpo,
      internetExposed,
      isGamingNetwork,
      factors,
      calculatedScore: liveScore,
      proposedTier: liveTier,
      notes: notes.trim()
    });

    setIsSubmittedSuccess(true);
  };

  return (
    <div className="space-y-6">
      
      {/* Banner / Instructions */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-6 rounded-2xl border border-indigo-800/60 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Sparkles className="w-48 h-48 text-indigo-300" />
        </div>
        <div className="relative z-10 max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-full text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
            <span>Self-Service Application Rating</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Submit Application Criticality Self-Assessment
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Fill out the Appendix II Criticality factors for your system. Once submitted, your rating proposal will be sent to the AppSec Review Queue for admin review and approval into the central database.
          </p>
        </div>
      </div>

      {/* Success Notification Alert */}
      {isSubmittedSuccess ? (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-emerald-950">
                Self-Assessment Rating Submitted Successfully!
              </h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                Your proposed score of <strong className="font-mono">{liveScore.toFixed(1)}/12</strong> ({tierBadgeProps.label}) has been placed in the AppSec Review Queue. Admins have been notified for review.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => setIsSubmittedSuccess(false)}
              className="px-4 py-2 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-semibold rounded-xl text-xs transition-colors"
            >
              Submit Another Rating
            </button>
            <button
              onClick={onGoToReviewQueue}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <span>Go to Review Queue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Rating Form */
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-8">
          
          {/* Assessment Mode Selector */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
              1. Assessment Target
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleAssessmentTypeChange('NEW')}
                className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  assessmentType === 'NEW'
                    ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-950 shadow-xs'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${assessmentType === 'NEW' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs">Register & Rate a New Application</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Submit initial criticality rating for a brand new deployment or service</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleAssessmentTypeChange('EXISTING')}
                className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  assessmentType === 'EXISTING'
                    ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-950 shadow-xs'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${assessmentType === 'EXISTING' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs">Re-assess an Existing Application</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Propose updated rating or factor adjustments for an existing system</div>
                </div>
              </button>
            </div>
          </div>

          {/* Select Existing Application if chosen */}
          {assessmentType === 'EXISTING' && (
            <div className="p-4 bg-indigo-50/60 border border-indigo-200/80 rounded-xl space-y-2">
              <label className="block font-semibold text-indigo-950 text-xs">
                Select System to Re-assess *
              </label>
              <select
                value={selectedAppId}
                onChange={(e) => handleSelectExistingApp(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
              >
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.code} — {app.name} (Current Tier: {app.tier}, Score: {app.calculatedScore})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Real-time Calculator Box */}
          <div className="p-5 bg-slate-900 text-white rounded-xl border border-slate-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-sm text-slate-200">
                  Calculated Proposed Score & Rating (Appendix II Standard)
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-xl">
                Weighted composite formula across Sensitive Data (32.5%), Exposure (32.5%), Attack History (15%), Stability (10%), Downtime Impact (10%).
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">
                  Score
                </span>
                <span className="text-2xl font-bold font-mono text-indigo-300">
                  {liveScore.toFixed(1)}<span className="text-xs text-slate-500"> / 12.0</span>
                </span>
              </div>
              <span className={`px-4 py-2 rounded-full font-extrabold text-sm border shadow-xs ${tierBadgeProps.bg}`}>
                Tier: {tierBadgeProps.code} ({tierBadgeProps.label})
              </span>
            </div>
          </div>

          {/* Basic Application Details */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-indigo-700 border-b border-slate-200 pb-1">
              2. System Identification & Metadata
            </h3>

            {/* Duplicate details alert banner */}
            {assessmentType === 'NEW' && (dupCheck.hasDuplicate || submitError) && (
              <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-xs font-semibold flex items-start gap-2 shadow-2xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Duplicate Application Details Detected!</p>
                  <p className="text-[11px] text-rose-800 mt-0.5">
                    {dupCheck.errorMessage || submitError}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ARB Code * {assessmentType === 'NEW' && dupCheck.hasDuplicateCode && <span className="text-rose-600 font-bold ml-1">(Duplicate Code)</span>}
                </label>
                <input
                  type="text"
                  required
                  value={appCode}
                  onChange={(e) => {
                    setAppCode(e.target.value);
                    setSubmitError(null);
                  }}
                  placeholder="e.g. PAY-GW-01"
                  className={`w-full px-3 py-2 border rounded-lg font-mono focus:bg-white focus:ring-2 transition-all ${
                    assessmentType === 'NEW' && dupCheck.hasDuplicateCode
                      ? 'bg-rose-50 border-rose-400 text-rose-900 focus:ring-rose-500'
                      : 'bg-slate-50 border-slate-300 focus:ring-indigo-500'
                  }`}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Application Name * {assessmentType === 'NEW' && dupCheck.hasDuplicateName && <span className="text-rose-600 font-bold ml-1">(Duplicate Name)</span>}
                </label>
                <input
                  type="text"
                  required
                  value={appName}
                  onChange={(e) => {
                    setAppName(e.target.value);
                    setSubmitError(null);
                  }}
                  placeholder="e.g. Merchant Checkout API V2"
                  className={`w-full px-3 py-2 border rounded-lg font-semibold focus:bg-white focus:ring-2 transition-all ${
                    assessmentType === 'NEW' && dupCheck.hasDuplicateName
                      ? 'bg-rose-50 border-rose-400 text-rose-900 focus:ring-rose-500'
                      : 'bg-slate-50 border-slate-300 focus:ring-indigo-500'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Department / Business Unit *</label>
                <select
                  required
                  value={
                    STANDARD_DEPARTMENTS.includes(department as any)
                      ? department
                      : department
                      ? 'OTHER'
                      : ''
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== 'OTHER') {
                      setDepartment(val);
                    } else if (STANDARD_DEPARTMENTS.includes(department as any)) {
                      setDepartment('Other Department');
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="" disabled>Select Department...</option>
                  {STANDARD_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                  <option value="OTHER">Other Department...</option>
                </select>
                {(!STANDARD_DEPARTMENTS.includes(department as any) && department !== '') && (
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Enter custom department name..."
                    className="mt-1.5 w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">IT / DevOps Lead</label>
                <input
                  type="text"
                  value={ownerIT}
                  onChange={(e) => setOwnerIT(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Data Classification</label>
                <select
                  value={dataClassification}
                  onChange={(e) => setDataClassification(e.target.value as DataClassification)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="RESTRICTED">Restricted (Highest Risk)</option>
                  <option value="CONFIDENTIAL">Confidential</option>
                  <option value="INTERNAL">Internal Use</option>
                  <option value="PUBLIC">Public</option>
                </select>
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-semibold text-slate-700 mb-1">Scope & Functional Summary</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain key architecture, data flow, users, and business impact..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Criticality Rating Factors (Appendix II) */}
          <div className="space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-200">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-indigo-700 flex items-center justify-between border-b border-slate-200 pb-2">
              <span>3. Fill Rating Factors (Appendix II Rubric)</span>
              <span className="text-[11px] text-slate-500 font-normal">
                Choose the option that best reflects your system's posture
              </span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              
              {/* 1. Processes / Contains Sensitive Data (32.5%) */}
              <div className="p-3.5 bg-white rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-900">
                    1. Processes / Contains Sensitive Data
                  </label>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold">
                    32.5% Weight
                  </span>
                </div>
                <select
                  value={factors.sensitiveDataScore}
                  onChange={(e) =>
                    setFactors((prev) => ({ ...prev, sensitiveDataScore: parseInt(e.target.value) }))
                  }
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={0}>0 = Public (Non-sensitive operational data)</option>
                  <option value={4}>4 = Internal (Internal corporate employee data)</option>
                  <option value={8}>8 = Restricted (Customer PII, Business confidential)</option>
                  <option value={12}>12 = Confidential (PII, Financial, Payment, Health, Passwords)</option>
                </select>
              </div>

              {/* 2. Public-Facing / Exposure (32.5%) */}
              <div className="p-3.5 bg-white rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-900">
                    2. Network Exposure / Public Endpoint
                  </label>
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded text-[10px] font-bold">
                    32.5% Weight
                  </span>
                </div>
                <select
                  value={
                    factors.exposureScore === 12
                      ? isGamingNetwork
                        ? '12_GAMING'
                        : '12_PUBLIC'
                      : String(factors.exposureScore)
                  }
                  onChange={(e) => {
                    const valStr = e.target.value;
                    if (valStr === '12_GAMING') {
                      setFactors((prev) => ({ ...prev, exposureScore: 12 }));
                      setIsGamingNetwork(true);
                      setInternetExposed(false);
                    } else if (valStr === '12_PUBLIC') {
                      setFactors((prev) => ({ ...prev, exposureScore: 12 }));
                      setIsGamingNetwork(false);
                      setInternetExposed(true);
                    } else {
                      const val = parseInt(valStr, 10);
                      setFactors((prev) => ({ ...prev, exposureScore: val }));
                      setIsGamingNetwork(false);
                      setInternetExposed(val > 0);
                    }
                  }}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="0">0 = Internal</option>
                  <option value="6">6 = Public with control</option>
                  <option value="12_GAMING">12 = Gaming network</option>
                  <option value="12_PUBLIC">12 = Fully public</option>
                </select>
              </div>

              {/* 3. Attack History (15.0%) */}
              <div className="p-3.5 bg-white rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-900">
                    3. Past Cyber-Attack History
                  </label>
                  <span className="px-2 py-0.5 bg-rose-50 text-rose-800 rounded text-[10px] font-bold">
                    15.0% Weight
                  </span>
                </div>
                <select
                  value={factors.attackHistoryScore}
                  onChange={(e) =>
                    setFactors((prev) => ({ ...prev, attackHistoryScore: parseInt(e.target.value) }))
                  }
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={0}>0 = None (No past incidents reported)</option>
                  <option value={6}>6 = Attempted (Unsuccessful probes / scanning)</option>
                  <option value={12}>12 = Compromised (Past breach or security incident)</option>
                </select>
              </div>

              {/* 4. Development Status / Stability (10.0%) */}
              <div className="p-3.5 bg-white rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-900">
                    4. Development & Update Status
                  </label>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold">
                    10.0% Weight
                  </span>
                </div>
                <select
                  value={factors.stabilityScore}
                  onChange={(e) =>
                    setFactors((prev) => ({ ...prev, stabilityScore: parseInt(e.target.value) }))
                  }
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={0}>0 = Stable (No feature changes in past 1 year)</option>
                  <option value={6}>6 = Recently updated (Active new feature updates)</option>
                  <option value={12}>12 = Newly built (Brand new system release)</option>
                </select>
              </div>

              {/* 5. Downtime Impact (10.0%) */}
              <div className="p-3.5 bg-white rounded-lg border border-slate-200 space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-900">
                    5. System Downtime Business Impact
                  </label>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded text-[10px] font-bold">
                    10.0% Weight
                  </span>
                </div>
                <select
                  value={factors.downtimeImpactScore}
                  onChange={(e) =>
                    setFactors((prev) => ({ ...prev, downtimeImpactScore: parseInt(e.target.value) }))
                  }
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={0}>0 = No impact (Negligible operational friction)</option>
                  <option value={6}>6 = Minor disruption (Workarounds exist, productivity slowed)</option>
                  <option value={12}>12 = Critical business impact (Direct revenue loss, operations halt)</option>
                </select>
              </div>

            </div>
          </div>

          {/* Proposed SLAs */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-indigo-700 border-b border-slate-200 pb-1">
              4. Proposed Operational SLAs (RTO & RPO)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Recovery Time (RTO)</label>
                <input
                  type="text"
                  required
                  value={rto}
                  onChange={(e) => setRto(e.target.value)}
                  placeholder="e.g. 1 Hour"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono focus:bg-white"
                />
                <span className="text-[10px] text-slate-500">Recommended for {liveTier}: {recommendedSLA.rto}</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Data Loss Limit (RPO)</label>
                <input
                  type="text"
                  required
                  value={rpo}
                  onChange={(e) => setRpo(e.target.value)}
                  placeholder="e.g. 15 Minutes"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono focus:bg-white"
                />
                <span className="text-[10px] text-slate-500">Recommended for {liveTier}: {recommendedSLA.rpo}</span>
              </div>
            </div>
          </div>

          {/* Submitter Info & Notes */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1 flex-wrap gap-2">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-indigo-700">
                5. SSO Submitter Identity & Assessment Justification
              </h3>
            </div>

            {/* SSO Authenticated Identity Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0 font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900">
                      {effectiveSubmitterName}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-mono font-bold flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-emerald-600" />
                      SSO Authenticated
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span>{effectiveSubmitterEmail}</span>
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-500 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                <Building className="w-3.5 h-3.5 text-indigo-500" />
                <span>Auth Provider: <strong className="text-slate-800 font-semibold">{activeSsoUser?.loginMethod || 'Azure AD Enterprise SSO'}</strong></span>
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-semibold text-slate-700 mb-1">Rating Justification & Notes for Admin Review</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Provide any context, security controls in place, or explanation for your score selection..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Info className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>Submitting creates a review ticket for AppSec Admin review. No database overwrite occurs until approved.</span>
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs shadow-md flex items-center justify-center gap-2 transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
              <span>Submit Rating for Admin Review</span>
            </button>
          </div>

        </form>
      )}

    </div>
  );
};
