import React, { useState, useEffect } from 'react';
import { Application, PendingAssessment, CriticalityFactors, DataClassification, AppStatus, STANDARD_DEPARTMENTS } from '../types';
import { checkDuplicateAppDetails } from '../utils/validation';
import {
  calculateCriticalityScore,
  scoreToTier,
  getTierBadgeProps
} from '../utils/scoring';
import {
  X,
  Shield,
  Calculator,
  Save,
  Server,
  UserCheck,
  Globe,
  AlertTriangle,
  Info
} from 'lucide-react';

interface AppFormModalProps {
  isOpen: boolean;
  editingApp: Application | null;
  applications?: Application[];
  pendingAssessments?: PendingAssessment[];
  onClose: () => void;
  onSave: (appData: Omit<Application, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => void;
}

export const AppFormModal: React.FC<AppFormModalProps> = ({
  isOpen,
  editingApp,
  applications = [],
  pendingAssessments = [],
  onClose,
  onSave
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState('FinTech & Payments');
  const [ownerAppSec, setOwnerAppSec] = useState('Sarah Jenkins (AppSec Lead)');
  const [ownerIT, setOwnerIT] = useState('David Chen (SRE Ops)');
  const [hostingEnv, setHostingEnv] = useState('AWS Cloud (us-east-1)');
  const [dataClassification, setDataClassification] = useState<DataClassification>('CONFIDENTIAL');
  const [internetExposed, setInternetExposed] = useState(false);
  const [isGamingNetwork, setIsGamingNetwork] = useState(false);
  const [status, setStatus] = useState<AppStatus>('ACTIVE');
  const [complianceRequirements, setComplianceRequirements] = useState<string[]>(['SOC 2 Type II']);
  const [thirdPartyInput, setThirdPartyInput] = useState('');
  const [notes, setNotes] = useState('');
  const [assessedBy, setAssessedBy] = useState('AppSec Review Board');

  // Criticality Factors (Appendix II Criteria)
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

  // Pre-fill if editing
  useEffect(() => {
    if (!isOpen) return;
    if (editingApp) {
      setCode(editingApp.code);
      setName(editingApp.name);
      setDescription(editingApp.description);
      setDepartment(editingApp.department);
      setOwnerAppSec(editingApp.ownerAppSec);
      setOwnerIT(editingApp.ownerIT);
      setHostingEnv(editingApp.hostingEnv);
      setDataClassification(editingApp.dataClassification);
      setInternetExposed(editingApp.internetExposed);
      setIsGamingNetwork(Boolean(editingApp.isGamingNetwork));
      setStatus(editingApp.status);
      setComplianceRequirements(editingApp.complianceRequirements);
      setThirdPartyInput(editingApp.thirdPartyIntegrations.join(', '));
      setNotes(editingApp.notes);
      setAssessedBy(editingApp.assessedBy || 'AppSec Engineer');
      setFactors(editingApp.factors || {
        sensitiveDataScore: 8,
        exposureScore: editingApp.internetExposed ? 6 : 0,
        stabilityScore: 6,
        attackHistoryScore: 0,
        downtimeImpactScore: 6
      });
    } else {
      // Defaults for new application
      setCode(`APP-${Math.floor(1000 + Math.random() * 9000)}`);
      setName('');
      setDescription('');
      setDepartment('Engineering & Infrastructure');
      setOwnerAppSec('Sarah Jenkins (AppSec Lead)');
      setOwnerIT('Alex Vance (IT Ops)');
      setHostingEnv('GCP Cloud Run');
      setDataClassification('CONFIDENTIAL');
      setInternetExposed(false);
      setIsGamingNetwork(false);
      setStatus('ACTIVE');
      setComplianceRequirements(['SOC 2 Type II']);
      setThirdPartyInput('');
      setNotes('');
      setAssessedBy('AppSec Lead');
      setFactors({
        sensitiveDataScore: 8,
        exposureScore: 0,
        stabilityScore: 6,
        attackHistoryScore: 0,
        downtimeImpactScore: 6
      });
    }
  }, [editingApp, isOpen]);

  // Sync exposure score if internet exposed checkbox is changed
  const handleInternetExposedToggle = (checked: boolean) => {
    setInternetExposed(checked);
    if (checked && factors.exposureScore === 0) {
      setFactors((prev) => ({ ...prev, exposureScore: 6 }));
    } else if (!checked && factors.exposureScore > 6) {
      setFactors((prev) => ({ ...prev, exposureScore: 0 }));
    }
  };

  const handleComplianceToggle = (comp: string) => {
    if (complianceRequirements.includes(comp)) {
      setComplianceRequirements(complianceRequirements.filter((c) => c !== comp));
    } else {
      setComplianceRequirements([...complianceRequirements, comp]);
    }
  };

  useEffect(() => {
    setSubmitError(null);
  }, [name, code, isOpen]);

  const dupCheck = checkDuplicateAppDetails({
    name,
    code,
    applications,
    pendingAssessments,
    currentAppId: editingApp?.id
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (dupCheck.hasDuplicate) {
      setSubmitError(dupCheck.errorMessage || 'Duplicate application details detected!');
      return;
    }

    const thirdPartyIntegrations = thirdPartyInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const appData = {
      code: code || `APP-${Math.floor(1000 + Math.random() * 9000)}`,
      name: name.trim(),
      description: description.trim(),
      tier: liveTier,
      rating: liveTier,
      calculatedScore: liveScore,
      department,
      ownerAppSec,
      ownerIT,
      hostingEnv,
      dataClassification,
      internetExposed,
      isGamingNetwork,
      thirdPartyIntegrations,
      complianceRequirements,
      status,
      factors,
      lastAssessed: new Date().toISOString(),
      assessedBy,
      notes: notes.trim()
    };

    onSave(appData, editingApp ? editingApp.id : undefined);
    onClose();
  };

  const availableComplianceOptions = [
    'PCI-DSS v4.0',
    'SOC 2 Type II',
    'HIPAA',
    'GDPR / CPRA',
    'ISO 27001',
    'NIST 800-53',
    'FedRAMP'
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto flex flex-col my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {editingApp ? 'AppSec Update Application Criticality' : 'Register New Application Profile'}
              </h2>
              <p className="text-xs text-slate-400">
                AppSec Governance & Criticality Assessment Calculator
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 text-slate-700 text-xs">
          
          {/* Live Score Calculator Preview Box */}
          <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-indigo-400" />
                <span className="font-semibold text-sm text-slate-200">
                  Calculated Criticality Rating (Appendix II Framework)
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-md">
                Weighted composite score across 5 criteria (Data sensitivity 32.5%, Exposure 32.5%, Attack history 15%, Development status 10%, Downtime impact 10%).
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">
                  Weighted Score
                </span>
                <span className="text-2xl font-bold font-mono text-indigo-300">
                  {liveScore.toFixed(1)}<span className="text-xs text-slate-500"> / 12.0</span>
                </span>
              </div>
              <span className={`px-3.5 py-1.5 rounded-full font-bold text-sm border ${tierBadgeProps.bg}`}>
                Rating: {tierBadgeProps.code} ({tierBadgeProps.label})
              </span>
            </div>
          </div>

          {/* Duplicate Details Error Alert */}
          {(dupCheck.hasDuplicate || submitError) && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-xs font-semibold flex items-start gap-2 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Duplicate Application Records Detected!</p>
                <p className="text-[11px] text-rose-800 mt-0.5">
                  {dupCheck.errorMessage || submitError}
                </p>
              </div>
            </div>
          )}

          {/* Section 1: Basic Application Identity */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900 text-xs uppercase tracking-wider text-indigo-600 border-b border-slate-200 pb-1">
              1. Basic Application Identity
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  ARB Code * {dupCheck.hasDuplicateCode && <span className="text-rose-600 font-bold ml-1">(Duplicate Code)</span>}
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. PAY-GW-01"
                  className={`w-full px-3 py-2 border rounded-lg text-xs font-mono focus:bg-white focus:ring-2 transition-all ${
                    dupCheck.hasDuplicateCode
                      ? 'bg-rose-50 border-rose-400 text-rose-900 focus:ring-rose-500'
                      : 'bg-slate-50 border-slate-300 focus:ring-indigo-500'
                  }`}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-medium text-slate-700 mb-1">
                  Application Name * {dupCheck.hasDuplicateName && <span className="text-rose-600 font-bold ml-1">(Duplicate Name)</span>}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Global Checkout Payment API"
                  className={`w-full px-3 py-2 border rounded-lg text-xs font-medium focus:bg-white focus:ring-2 transition-all ${
                    dupCheck.hasDuplicateName
                      ? 'bg-rose-50 border-rose-400 text-rose-900 focus:ring-rose-500'
                      : 'bg-slate-50 border-slate-300 focus:ring-indigo-500'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Description & Scope</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of business purpose, target users, and key features..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Section 2: Criticality Rating Criteria (Appendix II Framework) */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="font-semibold text-slate-900 text-xs uppercase tracking-wider text-indigo-600 flex items-center justify-between">
              <span>2. Criticality Rating Criteria (Appendix II Standard)</span>
              <span className="text-[11px] text-slate-500 font-normal">
                Scale values: 0, 4, 6, 8, or 12
              </span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* 1. Processes / Contains Sensitive Data (32.5%) */}
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-800 text-xs">
                    1. Processes / Contains Sensitive Data
                  </label>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold">
                    Weight: 32.5%
                  </span>
                </div>
                <select
                  value={factors.sensitiveDataScore}
                  onChange={(e) =>
                    setFactors((prev) => ({ ...prev, sensitiveDataScore: parseInt(e.target.value) }))
                  }
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={0}>0 = Public (Non-sensitive)</option>
                  <option value={4}>4 = Internal (Internal use only)</option>
                  <option value={8}>8 = Restricted (Customer PII, Business Confidential)</option>
                  <option value={12}>12 = Confidential (PII, Financial, Health, Proprietary)</option>
                </select>
                <p className="text-[10px] text-slate-500">
                  Assesses if system stores PII, financial, health, or proprietary data.
                </p>
              </div>

              {/* 2. Public-Facing / Exposure (32.5%) */}
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-800 text-xs">
                    2. Network Exposure / Public-Facing
                  </label>
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded text-[10px] font-bold">
                    Weight: 32.5%
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
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="0">0 = Internal</option>
                  <option value="6">6 = Public with control</option>
                  <option value="12_GAMING">12 = Gaming network</option>
                  <option value="12_PUBLIC">12 = Fully public</option>
                </select>
                <p className="text-[10px] text-slate-500">
                  Exposure level determines potential threat surface.
                </p>
              </div>

              {/* 3. History of Cyber-Attacks (15.0%) */}
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-800 text-xs">
                    3. History of Cyber-Attacks
                  </label>
                  <span className="px-2 py-0.5 bg-rose-50 text-rose-800 rounded text-[10px] font-bold">
                    Weight: 15.0%
                  </span>
                </div>
                <select
                  value={factors.attackHistoryScore}
                  onChange={(e) =>
                    setFactors((prev) => ({ ...prev, attackHistoryScore: parseInt(e.target.value) }))
                  }
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={0}>0 = None (No past attack incidents reported)</option>
                  <option value={6}>6 = Attempted only (Probed / Scanned / Unsuccessful breaches)</option>
                  <option value={12}>12 = Compromised (Previous security breach or compromise)</option>
                </select>
                <p className="text-[10px] text-slate-500">
                  Past incidents may signal ongoing threat activity and elevated target risk.
                </p>
              </div>

              {/* 4. Newly Developed / Unstable (10.0%) */}
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-800 text-xs">
                    4. Newly Developed / Unstable
                  </label>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold">
                    Weight: 10.0%
                  </span>
                </div>
                <select
                  value={factors.stabilityScore}
                  onChange={(e) =>
                    setFactors((prev) => ({ ...prev, stabilityScore: parseInt(e.target.value) }))
                  }
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={0}>0 = Stable (No feature update in recent 1 year)</option>
                  <option value={6}>6 = Recently updated (Active features introduced recently)</option>
                  <option value={12}>12 = Newly built (Brand new application deployment)</option>
                </select>
                <p className="text-[10px] text-slate-500">
                  New feature(s) introduced increase potential code vulnerability.
                </p>
              </div>

              {/* 5. System Downtime Impact (10.0%) */}
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1.5 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-800 text-xs">
                    5. System Downtime Impact
                  </label>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded text-[10px] font-bold">
                    Weight: 10.0%
                  </span>
                </div>
                <select
                  value={factors.downtimeImpactScore}
                  onChange={(e) =>
                    setFactors((prev) => ({ ...prev, downtimeImpactScore: parseInt(e.target.value) }))
                  }
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={0}>0 = No impact (Negligible operational friction)</option>
                  <option value={6}>6 = Minor disruption (Productivity slowed, workarounds exist)</option>
                  <option value={12}>12 = Critical business impact (Revenue loss, business halts)</option>
                </select>
                <p className="text-[10px] text-slate-500">
                  Measures how system failure affects core business processes.
                </p>
              </div>

            </div>
          </div>

          {/* Section 3: Governance & Classification Details */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900 text-xs uppercase tracking-wider text-indigo-600 border-b border-slate-200 pb-1">
              3. Governance, Ownership & Infrastructure
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Department / Business Unit *</label>
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500"
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
                <label className="block font-medium text-slate-700 mb-1">AppSec Owner</label>
                <input
                  type="text"
                  value={ownerAppSec}
                  onChange={(e) => setOwnerAppSec(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">IT / DevOps Lead</label>
                <input
                  type="text"
                  value={ownerIT}
                  onChange={(e) => setOwnerIT(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Data Classification</label>
                <select
                  value={dataClassification}
                  onChange={(e) => setDataClassification(e.target.value as DataClassification)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold"
                >
                  <option value="RESTRICTED">Restricted (Highest Risk)</option>
                  <option value="CONFIDENTIAL">Confidential</option>
                  <option value="INTERNAL">Internal Use</option>
                  <option value="PUBLIC">Public</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Hosting Environment</label>
                <input
                  type="text"
                  value={hostingEnv}
                  onChange={(e) => setHostingEnv(e.target.value)}
                  placeholder="AWS Multi-AZ, GCP Cloud Run..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Operational Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AppStatus)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="DEPRECATED">Deprecated</option>
                </select>
              </div>
            </div>

            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={internetExposed}
                  onChange={(e) => handleInternetExposedToggle(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-amber-600" />
                  Internet Facing Application / Public Endpoint
                </span>
              </label>
            </div>
          </div>

          {/* Section 4: Compliance Frameworks & Integrations */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900 text-xs uppercase tracking-wider text-indigo-600 border-b border-slate-200 pb-1">
              4. Compliance & Integrations
            </h3>

            <div>
              <label className="block font-medium text-slate-700 mb-1.5">
                Applicable Compliance Frameworks
              </label>
              <div className="flex flex-wrap gap-2">
                {availableComplianceOptions.map((comp) => {
                  const isSelected = complianceRequirements.includes(comp);
                  return (
                    <button
                      key={comp}
                      type="button"
                      onClick={() => handleComplianceToggle(comp)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                        isSelected
                          ? 'bg-indigo-100 text-indigo-800 border-indigo-300 font-bold'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {isSelected ? '✓ ' : ''}
                      {comp}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Third-Party Integrations (Comma Separated)
              </label>
              <input
                type="text"
                value={thirdPartyInput}
                onChange={(e) => setThirdPartyInput(e.target.value)}
                placeholder="e.g. Stripe, Okta, Zendesk, Salesforce"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
          </div>

          {/* Section 5: AppSec Directives & Assessment Notes */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              AppSec Assessment Directives & Security Testing Mandates
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Requires annual penetration testing and bi-weekly SAST/DAST scans. DAST scan mandatory prior to major release."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          {/* Modal Footer Controls */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-xs transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-md flex items-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>
                {editingApp ? 'Save AppSec Criticality Update' : 'Create Application Record'}
              </span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
