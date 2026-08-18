import React, { useState, useEffect } from 'react';
import { Application, UserRole, PromotionEvidence } from '../types';
import { getTierBadgeProps } from '../utils/scoring';
import {
  loadPromotionEvidences,
  asyncFetchPromotionEvidences,
  downloadEvidenceJSON
} from '../services/promotionEvidenceService';
import {
  X,
  Shield,
  Server,
  Globe,
  Gamepad2,
  UserCheck,
  DollarSign,
  AlertTriangle,
  FileCheck2,
  CheckCircle2,
  Edit2,
  Trash2,
  Award,
  FileCheck,
  Download,
  ExternalLink,
  ShieldCheck,
  Layers,
  Check
} from 'lucide-react';

interface AppDetailModalProps {
  app: Application | null;
  currentRole: UserRole;
  onClose: () => void;
  onEdit: (app: Application) => void;
  onDelete: (app: Application) => void;
}

export const AppDetailModal: React.FC<AppDetailModalProps> = ({
  app,
  currentRole,
  onClose,
  onEdit,
  onDelete
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PROMOTION_EVIDENCE'>('OVERVIEW');
  const [evidences, setEvidences] = useState<PromotionEvidence[]>([]);
  const [viewingCert, setViewingCert] = useState<PromotionEvidence | null>(null);

  useEffect(() => {
    if (app) {
      // Load promotion evidences asynchronously and fallback to localStorage
      asyncFetchPromotionEvidences().then(data => setEvidences(data));
    }
  }, [app]);

  if (!app) return null;

  const badgeProps = getTierBadgeProps(app.tier);

  // Filter promotion evidences mapped to this application
  const mappedEvidences = evidences.filter(ev =>
    ev.applicationId === app.id ||
    (ev.applicationName && ev.applicationName.toLowerCase() === app.name.toLowerCase()) ||
    ev.project.toLowerCase() === app.code.toLowerCase() ||
    ev.project.toLowerCase() === app.name.toLowerCase() ||
    (ev.repository && ev.repository.toLowerCase().includes(app.code.toLowerCase())) ||
    (ev.repository && ev.repository.toLowerCase().includes(app.name.toLowerCase().replace(/\s+/g, '-')))
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col my-8 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-6 bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-10 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs border ${badgeProps.bg}`}>
                  {badgeProps.label}
                </span>
                <span className="bg-slate-800 text-indigo-300 font-mono text-xs px-2 py-0.5 rounded border border-slate-700">
                  {app.code}
                </span>
                <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded font-medium border border-slate-700 uppercase">
                  {app.status}
                </span>
                {mappedEvidences.length > 0 && (
                  <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Award className="w-3 h-3 text-amber-400" />
                    <span>{mappedEvidences.length} Gate Certificate{mappedEvidences.length > 1 ? 's' : ''}</span>
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white">{app.name}</h2>
              <p className="text-xs text-slate-300 max-w-xl">{app.description}</p>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sub-Tabs: Overview vs Promotion Evidence */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('OVERVIEW')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'OVERVIEW'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Criticality Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('PROMOTION_EVIDENCE')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 relative ${
                activeTab === 'PROMOTION_EVIDENCE'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-amber-300" />
              <span>Auditable Promotion Evidence</span>
              {mappedEvidences.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-slate-950 font-black">
                  {mappedEvidences.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 space-y-6 text-slate-700 text-sm overflow-y-auto">
          
          {/* TAB 1: OVERVIEW & RATINGS */}
          {activeTab === 'OVERVIEW' && (
            <>
              {/* Key Metric Highlights Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Criticality Weighted Score
                  </span>
                  <span className="text-xl font-bold text-slate-900 font-mono">
                    {app.calculatedScore.toFixed(1)} <span className="text-xs text-slate-500 font-normal">/ 12.0</span>
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Hosting Environment
                  </span>
                  <span className="text-sm font-bold text-slate-900">{app.hostingEnv}</span>
                  <span className="text-[10px] text-slate-500 block">{app.internetExposed ? 'Internet Exposed' : 'Internal Only'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Data Classification
                  </span>
                  <span className="text-sm font-bold text-indigo-700 uppercase">
                    {app.dataClassification}
                  </span>
                </div>
              </div>

              {/* Section 1: Ownership & Environment Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                  <h3 className="font-semibold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    <span>Governance & Ownership</span>
                  </h3>
                  <div className="space-y-1.5 text-xs pt-1">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">AppSec Lead Owner:</span>
                      <span className="font-semibold text-slate-800">{app.ownerAppSec}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">IT / DevOps Lead:</span>
                      <span className="font-semibold text-slate-800">{app.ownerIT}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Managing Department:</span>
                      <span className="font-semibold text-slate-800">{app.department}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Last Assessed By:</span>
                      <span className="font-semibold text-indigo-700">{app.assessedBy}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                  <h3 className="font-semibold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Server className="w-4 h-4 text-indigo-600" />
                    <span>Infrastructure & Exposure</span>
                  </h3>
                  <div className="space-y-1.5 text-xs pt-1">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Hosting Environment:</span>
                      <span className="font-semibold text-slate-800 font-mono">{app.hostingEnv}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Network Exposure:</span>
                      {app.isGamingNetwork ? (
                        <span className="font-bold text-purple-900 bg-purple-100 px-2 py-0.5 rounded flex items-center gap-1 border border-purple-300">
                          <Gamepad2 className="w-3 h-3 text-purple-700" /> Gaming Network Endpoint
                        </span>
                      ) : app.internetExposed ? (
                        <span className="font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded flex items-center gap-1 border border-amber-300">
                          <Globe className="w-3 h-3 text-amber-600" /> Yes (Public Endpoint)
                        </span>
                      ) : (
                        <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          No (Internal Only)
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Last Assessed Date:</span>
                      <span className="font-mono text-slate-800">
                        {new Date(app.lastAssessed).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Section 2: Appendix II Criteria Breakdown */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h3 className="font-semibold text-slate-900 text-xs uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-indigo-600" />
                    <span>Appendix II Criteria Rating Breakdown</span>
                  </span>
                  <span className="text-[11px] font-normal text-slate-500">0 to 12 Scale per criterion</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  
                  {/* Sensitive Data */}
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-slate-800">Processes / Sensitive Data</span>
                      <span className="font-bold text-indigo-700 font-mono">Score: {app.factors?.sensitiveDataScore ?? 0} / 12</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Weight: 32.5%</span>
                      <span>Contrib: {((app.factors?.sensitiveDataScore ?? 0) * 0.325).toFixed(2)} pts</span>
                    </div>
                  </div>

                  {/* Exposure */}
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-slate-800">Network Exposure / Public</span>
                      <span className="font-bold text-amber-700 font-mono">Score: {app.factors?.exposureScore ?? 0} / 12</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Weight: 32.5%</span>
                      <span>Contrib: {((app.factors?.exposureScore ?? 0) * 0.325).toFixed(2)} pts</span>
                    </div>
                  </div>

                  {/* History of Cyber Attacks */}
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-slate-800">History of Cyber-Attacks</span>
                      <span className="font-bold text-rose-700 font-mono">Score: {app.factors?.attackHistoryScore ?? 0} / 12</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Weight: 15.0%</span>
                      <span>Contrib: {((app.factors?.attackHistoryScore ?? 0) * 0.15).toFixed(2)} pts</span>
                    </div>
                  </div>

                  {/* Newly Developed / Unstable */}
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-slate-800">Newly Developed / Unstable</span>
                      <span className="font-bold text-blue-700 font-mono">Score: {app.factors?.stabilityScore ?? 0} / 12</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Weight: 10.0%</span>
                      <span>Contrib: {((app.factors?.stabilityScore ?? 0) * 0.10).toFixed(2)} pts</span>
                    </div>
                  </div>

                  {/* System Downtime Impact */}
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 sm:col-span-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-slate-800">System Downtime Impact</span>
                      <span className="font-bold text-emerald-700 font-mono">Score: {app.factors?.downtimeImpactScore ?? 0} / 12</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Weight: 10.0%</span>
                      <span>Contrib: {((app.factors?.downtimeImpactScore ?? 0) * 0.10).toFixed(2)} pts</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Section 3: Compliance & Third Party Integrations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-semibold text-slate-800 text-xs flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4 text-emerald-600" />
                    <span>Compliance Requirements</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {app.complianceRequirements.length > 0 ? (
                      app.complianceRequirements.map((comp) => (
                        <span
                          key={comp}
                          className="px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-mono text-xs font-medium"
                        >
                          {comp}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">No specific regulatory mandates</span>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-semibold text-slate-800 text-xs flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-indigo-600" />
                    <span>Third-Party Integrations</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {app.thirdPartyIntegrations.length > 0 ? (
                      app.thirdPartyIntegrations.map((ext) => (
                        <span
                          key={ext}
                          className="px-2 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded font-mono text-xs"
                        >
                          {ext}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">No external API dependencies</span>
                    )}
                  </div>
                </div>

              </div>

              {/* Section 4: AppSec Directives & Notes */}
              {app.notes && (
                <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200 space-y-1">
                  <h4 className="font-semibold text-amber-900 text-xs flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>AppSec Operational Directives & Assessment Notes</span>
                  </h4>
                  <p className="text-xs text-amber-950/80 leading-relaxed font-sans">{app.notes}</p>
                </div>
              )}
            </>
          )}

          {/* TAB 2: AUDITABLE PROMOTION EVIDENCE (HIDDEN TAB REVEALED) */}
          {activeTab === 'PROMOTION_EVIDENCE' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-400" />
                    <h3 className="font-bold text-sm text-slate-100">
                      ArmorCode Promotion Gate Certificates
                    </h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400 text-slate-950">
                    {mappedEvidences.length} Mapped Certificate{mappedEvidences.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Auditable zero-critical security gate passports mapped to <strong>{app.name}</strong> ({app.code}). These certificates verify compliance prior to production release promotion.
                </p>
              </div>

              {mappedEvidences.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500 space-y-2">
                  <Award className="w-10 h-10 text-slate-400 mx-auto opacity-50" />
                  <p className="font-bold text-sm text-slate-700">No Mapped Promotion Evidences Found</p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    To link a promotion evidence certificate to <strong>{app.name}</strong>, go to the <strong>ArmorCode Security Reports & Promotion Gate</strong> tab, run a scan query, and select this application in the <em>Mapped Application in Inventory</em> dropdown when issuing evidence.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-mono text-[10px] uppercase font-bold border-b border-slate-200">
                        <th className="py-2.5 px-3">Evidence ID</th>
                        <th className="py-2.5 px-3">Target Pipeline</th>
                        <th className="py-2.5 px-3">Version & Branch</th>
                        <th className="py-2.5 px-3">Gate Status</th>
                        <th className="py-2.5 px-3">Issued By</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {mappedEvidences.map((ev) => (
                        <tr key={ev.evidenceId} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{ev.evidenceId}</span>
                            </div>
                            <span className="text-[9px] text-slate-400 block truncate max-w-[100px]">{ev.verificationHash}</span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[10px]">
                              {ev.targetEnvironment}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                            <span className="font-bold">{ev.releaseVersion}</span>
                            <span className="text-[10px] text-slate-500 block">({ev.branch})</span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {ev.status === 'REVOKED' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                REVOKED
                              </span>
                            ) : ev.complianceStatus === 'ADMIN_OVERRIDE' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                OVERRIDE
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                PASSED
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                            <p className="font-bold">{ev.createdBy}</p>
                            <p className="text-[9px] text-slate-400">{new Date(ev.createdAt).toLocaleDateString()}</p>
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => setViewingCert(ev)}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-md transition-all cursor-pointer"
                            >
                              Inspect Certificate
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>

          {currentRole === 'APPSEC_ADMIN' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onClose();
                  onDelete(app);
                }}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
              <button
                onClick={() => {
                  onClose();
                  onEdit(app);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Application</span>
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Embedded Certificate Viewer Modal inside AppDetailModal */}
      {viewingCert && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 text-slate-100 shadow-2xl space-y-4 font-sans text-xs">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-6 h-6 text-amber-400" />
                <div>
                  <h3 className="font-bold text-base text-white">Promotion Gate Certificate</h3>
                  <p className="text-[10px] text-slate-400 font-mono">ID: {viewingCert.evidenceId}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingCert(null)}
                className="text-slate-400 hover:text-white font-bold cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[9px] text-slate-500 uppercase block">Application</span>
                <span className="text-indigo-300 font-bold">{app.name} ({app.code})</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[9px] text-slate-500 uppercase block">Target Pipeline</span>
                <span className="text-emerald-400 font-bold">{viewingCert.targetEnvironment}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[9px] text-slate-500 uppercase block">Project / Repo</span>
                <span className="text-slate-300">{viewingCert.project} / {viewingCert.repository}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[9px] text-slate-500 uppercase block">Version / Branch</span>
                <span className="text-slate-300">{viewingCert.releaseVersion} ({viewingCert.branch})</span>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-[10px] font-mono border-b border-slate-800 pb-1.5">
                <span className="text-slate-400 font-bold">ARMORCODE SECURITY GATE CHECKS</span>
                <span className="text-emerald-400 font-bold">STATUS: {viewingCert.complianceStatus}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono py-1">
                <div className="bg-slate-900 p-1.5 rounded">
                  <span className="text-[9px] text-rose-400 block">Critical</span>
                  <span className="font-bold">{viewingCert.findingCounts.critical}</span>
                </div>
                <div className="bg-slate-900 p-1.5 rounded">
                  <span className="text-[9px] text-amber-400 block">High</span>
                  <span className="font-bold">{viewingCert.findingCounts.high}</span>
                </div>
                <div className="bg-slate-900 p-1.5 rounded">
                  <span className="text-[9px] text-yellow-400 block">Medium</span>
                  <span className="font-bold">{viewingCert.findingCounts.medium}</span>
                </div>
                <div className="bg-slate-900 p-1.5 rounded">
                  <span className="text-[9px] text-slate-400 block">Total</span>
                  <span className="font-bold">{viewingCert.findingCounts.total}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 font-mono text-[11px]">
              <div className="text-slate-400 font-bold text-[10px] uppercase">Cryptographic Integrity Hash</div>
              <div className="text-indigo-300 break-all">{viewingCert.verificationHash}</div>
              <div className="text-[10px] text-slate-500 pt-1">
                Issued by <strong>{viewingCert.createdBy}</strong> at {new Date(viewingCert.createdAt).toLocaleString()}
              </div>
            </div>

            {/* Saved API Response Snapshot Viewer */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                <span className="text-emerald-400 font-bold text-[10px]">SAVED API RESPONSE SNAPSHOT</span>
                <button
                  type="button"
                  onClick={() => {
                    const dataToCopy = viewingCert.apiResponseSnapshot || {
                      findings: viewingCert.snapshotFindings,
                      payload: viewingCert.snapshotPayload
                    };
                    navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
                    alert('API response snapshot copied to clipboard!');
                  }}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                >
                  Copy API JSON
                </button>
              </div>
              <div className="max-h-36 overflow-y-auto bg-slate-900 rounded p-2 text-[10px] text-slate-300">
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(viewingCert.apiResponseSnapshot || {
                    query: viewingCert.snapshotPayload,
                    findingsCount: viewingCert.snapshotFindings?.length || 0,
                    findings: viewingCert.snapshotFindings || []
                  }, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                onClick={() => downloadEvidenceJSON(viewingCert)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Certificate JSON</span>
              </button>
              <button
                onClick={() => setViewingCert(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-xs cursor-pointer"
              >
                Close Certificate
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
