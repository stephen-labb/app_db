import React, { useState } from 'react';
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
  User,
  Clock,
  Save,
  Check
} from 'lucide-react';
import {
  loadSessionTimeoutMinutes,
  saveSessionTimeoutMinutes
} from '../utils/accessLogsStorage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
  activeSsoUser?: ActiveSsoUser;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onResetData: () => void;
  onOpenAzureLogin?: () => void;
  sessionTimeoutMinutes?: number;
  onUpdateSessionTimeout?: (minutes: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentRole,
  activeSsoUser,
  onExportCSV,
  onExportJSON,
  onResetData,
  onOpenAzureLogin,
  sessionTimeoutMinutes: initialTimeout,
  onUpdateSessionTimeout
}) => {
  if (!isOpen) return null;

  const isAdmin = currentRole === 'APPSEC_ADMIN' || currentRole === 'SUPER_ADMIN';
  const [timeoutVal, setTimeoutVal] = useState<number>(
    initialTimeout || loadSessionTimeoutMinutes()
  );
  const [savedFeedback, setSavedFeedback] = useState<boolean>(false);

  const handleSaveTimeout = (mins: number) => {
    const validMins = Math.max(1, Math.min(1440, mins));
    setTimeoutVal(validMins);
    saveSessionTimeoutMinutes(validMins);
    if (onUpdateSessionTimeout) {
      onUpdateSessionTimeout(validMins);
    }
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

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
                Session security timeouts, admin data controls, exports, and identity permissions
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

          {/* Session Security & Timeout Configuration Section */}
          <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Session Inactivity Timeout
                  </h3>
                  <p className="text-xs text-slate-500">
                    Enforced for all identities (Super Admin, AppSec Admin, IT Viewer, and OIDC users)
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold border ${
                isAdmin
                  ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {isAdmin ? 'Admin Configurable' : 'Read Only'}
              </span>
            </div>

            <div className="bg-white rounded-xl p-3 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block">
                  Inactivity Timeout Duration (minutes)
                </label>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Users will be automatically logged out after this period of idle time.
                </span>
              </div>

              <div className="flex items-center gap-2">
                <select
                  disabled={!isAdmin}
                  value={[5, 10, 15, 30, 60, 120].includes(timeoutVal) ? timeoutVal : 'custom'}
                  onChange={(e) => {
                    if (e.target.value !== 'custom') {
                      handleSaveTimeout(Number(e.target.value));
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value={5}>5 Minutes</option>
                  <option value={10}>10 Minutes</option>
                  <option value={15}>15 Minutes (Default)</option>
                  <option value={30}>30 Minutes</option>
                  <option value={60}>60 Minutes (1 Hour)</option>
                  <option value={120}>120 Minutes (2 Hours)</option>
                  <option value="custom">Custom Minutes</option>
                </select>

                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    disabled={!isAdmin}
                    value={timeoutVal}
                    onChange={(e) => setTimeoutVal(Number(e.target.value))}
                    className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 text-center"
                  />
                  <span className="text-xs text-slate-500 font-medium">min</span>
                  {isAdmin && (
                    <button
                      onClick={() => handleSaveTimeout(timeoutVal)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {savedFeedback ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-300" />
                          <span>Saved</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Apply</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
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

              {/* Clear / Reset Data */}
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 hover:bg-rose-50/80 transition-all flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-rose-900">
                      Clear / Reset Database State
                    </h4>
                    <p className="text-xs text-rose-700/80 mt-0.5">
                      Clears local cache and purges records to start with a clean production baseline.
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
                  title={isAdmin ? 'Clear database state' : 'Admin privilege required'}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear Data</span>
                </button>
              </div>

            </div>
          </div>

          {/* Governance & Information Footer Note */}
          <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-slate-600 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>AppSec Governance Platform • Security Inactivity Timeout Enforced</span>
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
