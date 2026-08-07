import React from 'react';
import { Application, UserRole } from '../types';
import { getTierBadgeProps, getRecommendedSLAs } from '../utils/scoring';
import {
  X,
  Shield,
  Clock,
  Server,
  Globe,
  Gamepad2,
  UserCheck,
  DollarSign,
  AlertTriangle,
  FileCheck2,
  CheckCircle2,
  Edit2,
  Trash2
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
  if (!app) return null;

  const badgeProps = getTierBadgeProps(app.tier);
  const recommendedSLA = getRecommendedSLAs(app.tier);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col my-8 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-6 bg-slate-900 text-white flex items-start justify-between border-b border-slate-800 sticky top-0 z-10">
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
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">{app.name}</h2>
            <p className="text-xs text-slate-300 max-w-xl">{app.description}</p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 space-y-6 text-slate-700 text-sm overflow-y-auto">
          
          {/* Key Metric Highlights Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
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
                IT RTO Target
              </span>
              <span className="text-sm font-bold text-slate-900 font-mono">{app.rto}</span>
              <span className="text-[10px] text-slate-500 block">Rec: {recommendedSLA.rto}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                IT RPO Target
              </span>
              <span className="text-sm font-bold text-slate-900 font-mono">{app.rpo}</span>
              <span className="text-[10px] text-slate-500 block">Rec: {recommendedSLA.rpo}</span>
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

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition-colors"
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
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
              <button
                onClick={() => {
                  onClose();
                  onEdit(app);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Application</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
