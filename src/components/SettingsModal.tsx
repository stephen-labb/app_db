import React from 'react';
import { UserRole, ActiveSsoUser } from '../types';
import {
  X,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Download,
  Database,
  RotateCcw,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  FileJson,
  User
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
  activeSsoUser?: ActiveSsoUser;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onResetData: () => void;
  onOpenAzureLogin?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentRole,
  activeSsoUser,
  onExportCSV,
  onExportJSON,
  onResetData,
  onOpenAzureLogin
}) => {
  if (!isOpen) return null;

  const isAdmin = currentRole === 'APPSEC_ADMIN' || currentRole === 'SUPER_ADMIN';

  const handleTriggerReset = () => {
    onResetData();
    onClose();
  };

  const handleTriggerExportCSV = () => {
    onExportCSV();
  };

  const handleTriggerExportJSON = () => {
    onExportJSON();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">
                Database & Governance Settings
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Admin data controls, exports, and identity permissions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Active Identity & Role Context */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                  currentRole === 'SUPER_ADMIN'
                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                    : currentRole === 'APPSEC_ADMIN'
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                    : 'bg-blue-100 text-blue-700 border border-blue-200'
                }`}>
                  {currentRole === 'SUPER_ADMIN' ? (
                    <ShieldAlert className="w-5 h-5" />
                  ) : currentRole === 'APPSEC_ADMIN' ? (
                    <ShieldCheck className="w-5 h-5" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">
                      {activeSsoUser?.displayName || 'Active Session'}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                      currentRole === 'SUPER_ADMIN'
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : currentRole === 'APPSEC_ADMIN'
                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                        : 'bg-blue-100 text-blue-800 border border-blue-300'
                    }`}>
                      {currentRole === 'SUPER_ADMIN'
                        ? 'Super Admin'
                        : currentRole === 'APPSEC_ADMIN'
                        ? 'AppSec Admin'
                        : 'IT Viewer'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {activeSsoUser?.email || 'Local Session'}
                  </p>
                </div>
              </div>

              {onOpenAzureLogin && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenAzureLogin();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Switch Role / SSO</span>
                </button>
              )}
            </div>
          </div>

          {/* Admin Data Management Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Admin Data Operations
                </h3>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold border ${
                isAdmin
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {isAdmin ? 'Admin Privileges Active' : 'Restricted to Admin'}
              </span>
            </div>

            {!isAdmin && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-900">
                    Administrator Access Required
                  </h4>
                  <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                    Database exports (CSV spreadsheet, JSON backup) and database reset operations are strictly restricted to <strong>AppSec Admin</strong> and <strong>Super Admin</strong> roles.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              
              {/* Export CSV */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Download CSV Spreadsheet
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Export all active application profiles, criticality tiers, and owner contacts to CSV format.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleTriggerExportCSV}
                  disabled={!isAdmin}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0 transition-all ${
                    isAdmin
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  }`}
                  title={isAdmin ? 'Download applications table as CSV' : 'Admin privilege required'}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
                </button>
              </div>

              {/* Export JSON */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                    <FileJson className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Export JSON Backup
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Download a full database snapshot including applications, audit trails, SOP versions, and review tickets.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleTriggerExportJSON}
                  disabled={!isAdmin}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0 transition-all ${
                    isAdmin
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs cursor-pointer'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  }`}
                  title={isAdmin ? 'Export database backup as JSON' : 'Admin privilege required'}
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>JSON Backup</span>
                </button>
              </div>

              {/* Reset Data */}
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 hover:bg-rose-50/80 transition-all flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-rose-900">
                      Reset to Default Demo Data
                    </h4>
                    <p className="text-xs text-rose-700/80 mt-0.5">
                      Reverts application records, pending reviews, and SOP document history to the default baseline demo state.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleTriggerReset}
                  disabled={!isAdmin}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0 transition-all ${
                    isAdmin
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-xs cursor-pointer'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  }`}
                  title={isAdmin ? 'Reset database to demo data' : 'Admin privilege required'}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Demo Data</span>
                </button>
              </div>

            </div>
          </div>

          {/* Governance & Information Footer Note */}
          <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-slate-600 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>AppSec Criticality Database v2.4 • Azure AD & SCIM Governance Enforced</span>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Close Settings
          </button>
        </div>
      </div>
    </div>
  );
};
