import React from 'react';
import { UserRole, ActiveSsoUser } from '../types';
import { ShieldCheck, KeyRound, Menu, X, ShieldAlert, Settings } from 'lucide-react';

interface HeaderProps {
  currentRole: UserRole;
  appCount: number;
  activeSsoUser?: ActiveSsoUser;
  onOpenAzureLogin?: () => void;
  onOpenSettings?: () => void;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  appCount,
  activeSsoUser,
  onOpenAzureLogin,
  onOpenSettings,
  onToggleMobileMenu,
  isMobileMenuOpen
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Branding, Mobile Toggle & Title */}
        <div className="flex items-center gap-3">
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              className="md:hidden p-2 rounded-xl bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
              aria-label="Toggle Side Menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}

          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg text-slate-100 tracking-tight leading-none">
                DevSecOps Management Console
              </h1>
              <span className="hidden sm:inline-block text-xs bg-slate-800 text-indigo-300 px-2 py-0.5 rounded-full font-mono border border-slate-700">
                v2.4 Azure SSO & SCIM
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
              <span>AppSec & IT Governance Matrix</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300">{appCount} Systems</span>
            </p>
          </div>
        </div>

        {/* Right Actions: Authenticated SCIM Identity Badge & Export Actions */}
        <div className="flex items-center gap-3">
          
          {/* Active Identity & SCIM Role Badge */}
          {activeSsoUser && activeSsoUser.isAuthenticated ? (
            <button
              onClick={onOpenAzureLogin}
              className={`flex items-center gap-2 p-1.5 pl-2.5 pr-3 rounded-xl border text-xs transition-all cursor-pointer ${
                currentRole === 'SUPER_ADMIN'
                  ? 'bg-rose-950/60 border-rose-700 text-rose-200 hover:bg-rose-900/80 shadow-xs'
                  : currentRole === 'APPSEC_ADMIN'
                  ? 'bg-indigo-950/60 border-indigo-700 text-indigo-200 hover:bg-indigo-900/80 shadow-xs'
                  : 'bg-slate-950 border-slate-800 text-slate-200 hover:bg-slate-800 shadow-xs'
              }`}
              title="Click to manage SSO identity or switch to Super Admin"
            >
              {currentRole === 'SUPER_ADMIN' ? (
                <div className="w-6 h-6 rounded-lg bg-rose-600/30 border border-rose-500/50 flex items-center justify-center text-rose-300 font-bold">
                  <ShieldAlert className="w-3.5 h-3.5" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-300 font-bold text-[10px]">
                  AZ
                </div>
              )}

              <div className="text-left hidden sm:block">
                <span className="font-semibold text-slate-200 block leading-tight">
                  {activeSsoUser.displayName}
                </span>
                <span className="text-[10px] text-slate-400 font-mono block leading-none">
                  {activeSsoUser.email}
                </span>
              </div>

              {/* Role Badge */}
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold border ml-1 ${
                currentRole === 'SUPER_ADMIN'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : currentRole === 'APPSEC_ADMIN'
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
              }`}>
                {currentRole === 'SUPER_ADMIN'
                  ? 'Super Admin'
                  : currentRole === 'APPSEC_ADMIN'
                  ? 'AppSec Admin (SCIM)'
                  : 'IT Viewer (SCIM)'}
              </span>
            </button>
          ) : (
            <button
              onClick={onOpenAzureLogin}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Sign In / SSO</span>
            </button>
          )}

          {/* Settings Trigger */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-2 transition-all cursor-pointer shadow-xs hover:text-white"
              title="Open Database & Governance Settings"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          )}

        </div>
      </div>
    </header>
  );
};
