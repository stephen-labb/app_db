import React, { useState } from 'react';
import { ActiveSsoUser, SsoConfig, ScimGroupMapping, UserRole } from '../types';
import { calculateRoleFromAzureGroups } from '../utils/ssoScimStorage';
import { Shield, ShieldAlert, CheckCircle2, KeyRound, Globe, Copy, Check, Lock, ChevronRight, UserCheck, X, ShieldCheck, Key, AlertTriangle } from 'lucide-react';

interface AzureLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  ssoConfig: SsoConfig;
  groupMappings: ScimGroupMapping[];
  onLoginSuccess: (user: ActiveSsoUser) => void;
}

export const AzureLoginModal: React.FC<AzureLoginModalProps> = ({
  isOpen,
  onClose,
  ssoConfig,
  groupMappings,
  onLoginSuccess
}) => {
  const [authTab, setAuthTab] = useState<'sso' | 'superadmin'>('sso');

  // Azure SSO State
  const [selectedAccount, setSelectedAccount] = useState<'sarah' | 'david' | 'alex' | 'custom'>('sarah');
  const [customEmail, setCustomEmail] = useState('user@contoso.com');
  const [customDisplayName, setCustomDisplayName] = useState('Custom Enterprise User');
  const [customGroups, setCustomGroups] = useState('AppSec-Engineers, IT-Operations-Viewers');
  const [copiedToken, setCopiedToken] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  // Super Admin Credentials State
  const [superUsername, setSuperUsername] = useState('superadmin');
  const [superPassword, setSuperPassword] = useState('adminpassword123!');
  const [superError, setSuperError] = useState<string | null>(null);

  if (!isOpen) return null;

  const presetAccounts = {
    sarah: {
      userId: 'az-usr-1001',
      displayName: 'Sarah Jenkins',
      email: 'sjenkins@contoso.com',
      upn: 'sjenkins@contoso.com',
      groups: ['AppSec-Engineers', 'CyberSecurity-Leads'],
      title: 'Lead Application Security Engineer',
      department: 'InfoSec'
    },
    david: {
      userId: 'az-usr-1002',
      displayName: 'David Chen',
      email: 'dchen@contoso.com',
      upn: 'dchen@contoso.com',
      groups: ['IT-Operations-Viewers'],
      title: 'Senior IT Specialist',
      department: 'IT Infrastructure'
    },
    alex: {
      userId: 'az-usr-1003',
      displayName: 'Alex Rivera',
      email: 'arivera@contoso.com',
      upn: 'arivera@contoso.com',
      groups: ['SOC-Analyst-Auditor'],
      title: 'SOC Security Auditor',
      department: 'Compliance'
    }
  };

  const getEffectiveUser = (): {
    userId: string;
    displayName: string;
    email: string;
    upn: string;
    groups: string[];
    title: string;
    department: string;
    role: UserRole;
  } => {
    if (selectedAccount === 'custom') {
      const groups = customGroups.split(',').map(g => g.trim()).filter(Boolean);
      const role = calculateRoleFromAzureGroups(groups, groupMappings, 'IT_VIEWER');
      return {
        userId: `az-usr-${Math.floor(1000 + Math.random() * 9000)}`,
        displayName: customDisplayName || 'Enterprise User',
        email: customEmail || 'user@contoso.com',
        upn: customEmail || 'user@contoso.com',
        groups,
        title: 'Azure AD Provisioned User',
        department: 'Corporate',
        role
      };
    }

    const preset = presetAccounts[selectedAccount];
    const role = calculateRoleFromAzureGroups(preset.groups, groupMappings, 'IT_VIEWER');
    return { ...preset, role };
  };

  const currentUser = getEffectiveUser();

  const mockJwtToken = {
    header: { alg: 'RS256', typ: 'JWT', kid: 'az_key_98231' },
    payload: {
      aud: ssoConfig.clientId,
      iss: `https://login.microsoftonline.com/${ssoConfig.tenantId}/v2.0`,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      nbf: Math.floor(Date.now() / 1000),
      name: currentUser.displayName,
      preferred_username: currentUser.upn,
      oid: currentUser.userId,
      tid: ssoConfig.tenantId,
      groups: currentUser.groups,
      roles: currentUser.groups,
      wids: ['62e90394-69f5-4237-9190-012177145e10']
    }
  };

  const handleSignIn = () => {
    setIsAuthorizing(true);
    setTimeout(() => {
      setIsAuthorizing(false);
      onLoginSuccess({
        isAuthenticated: true,
        userId: currentUser.userId,
        displayName: currentUser.displayName,
        email: currentUser.email,
        upn: currentUser.upn,
        role: currentUser.role,
        groups: currentUser.groups,
        loginMethod: ssoConfig.ssoMode === 'LIVE_OIDC' ? 'AZURE_SSO' : 'SIMULATED_AZURE_OIDC',
        idToken: JSON.stringify(mockJwtToken.payload),
        loggedInAt: new Date().toISOString()
      });
      onClose();
    }, 600);
  };

  const handleSuperAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setSuperError(null);

    // Validate Super Admin Credentials
    if (superUsername.trim().toLowerCase() === 'superadmin' && superPassword === 'adminpassword123!') {
      setIsAuthorizing(true);
      setTimeout(() => {
        setIsAuthorizing(false);
        onLoginSuccess({
          isAuthenticated: true,
          userId: 'sa-usr-0001',
          displayName: 'Emergency Super Admin',
          email: 'superadmin@local.internal',
          upn: 'superadmin@local.internal',
          role: 'SUPER_ADMIN',
          groups: ['Super-Admin-BreakGlass', 'Global-System-Admins'],
          loginMethod: 'SUPER_ADMIN_BREAKGLASS',
          loggedInAt: new Date().toISOString()
        });
        onClose();
      }, 500);
    } else {
      setSuperError('Invalid Super Admin credentials. Use username "superadmin" and default password "adminpassword123!"');
    }
  };

  const copyToken = () => {
    navigator.clipboard.writeText(JSON.stringify(mockJwtToken, null, 2));
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden text-slate-100">
        
        {/* Header Branding */}
        <div className="bg-gradient-to-r from-blue-900/60 via-indigo-900/40 to-slate-900 p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg text-white">Identity & Access Authentication</h3>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-mono">
                  RBAC Enforced
                </span>
              </div>
              <p className="text-xs text-slate-400">Authenticate via Azure SSO or Emergency Break-Glass Super Admin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: SSO vs Super Admin */}
        <div className="flex border-b border-slate-800 bg-slate-950/80 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setAuthTab('sso')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              authTab === 'sso'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Azure AD SSO & SCIM Mapped Identity</span>
          </button>
          
          <button
            type="button"
            onClick={() => setAuthTab('superadmin')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              authTab === 'superadmin'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-rose-400" />
            <span>Emergency Super Admin (Break-Glass)</span>
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {authTab === 'sso' ? (
            <>
              {/* Tenant Info Banner */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between text-xs font-mono text-slate-300">
                <div>
                  <span className="text-slate-500">Tenant ID: </span>
                  <span className="text-indigo-300">{ssoConfig.tenantId}</span>
                </div>
                <div>
                  <span className="text-slate-500">App ID: </span>
                  <span className="text-blue-300">{ssoConfig.clientId}</span>
                </div>
              </div>

              {/* Account Picker */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Select SCIM Provisioned Azure AD Enterprise User
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* Sarah */}
                  <button
                    type="button"
                    onClick={() => setSelectedAccount('sarah')}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      selectedAccount === 'sarah'
                        ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-md shadow-indigo-500/10'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">Sarah Jenkins</span>
                      <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded font-mono">
                        AppSec Admin
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">sjenkins@contoso.com</p>
                    <p className="text-[11px] text-indigo-300/80 mt-1">SCIM: AppSec-Engineers</p>
                  </button>

                  {/* David */}
                  <button
                    type="button"
                    onClick={() => setSelectedAccount('david')}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      selectedAccount === 'david'
                        ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-md shadow-indigo-500/10'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">David Chen</span>
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded font-mono">
                        IT Viewer
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">dchen@contoso.com</p>
                    <p className="text-[11px] text-blue-300/80 mt-1">SCIM: IT-Operations</p>
                  </button>

                  {/* Custom */}
                  <button
                    type="button"
                    onClick={() => setSelectedAccount('custom')}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      selectedAccount === 'custom'
                        ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-md shadow-indigo-500/10'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">Custom Azure User</span>
                      <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                        Manual
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">Specify UPN & Groups</p>
                    <p className="text-[11px] text-amber-300/80 mt-1">Dynamic SCIM map</p>
                  </button>

                </div>
              </div>

              {/* Custom Input Form if selected */}
              {selectedAccount === 'custom' && (
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Display Name</label>
                      <input
                        type="text"
                        value={customDisplayName}
                        onChange={(e) => setCustomDisplayName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Azure UPN / Email</label>
                      <input
                        type="email"
                        value={customEmail}
                        onChange={(e) => setCustomEmail(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Azure AD Security Groups (comma separated)</label>
                    <input
                      type="text"
                      value={customGroups}
                      onChange={(e) => setCustomGroups(e.target.value)}
                      placeholder="e.g. AppSec-Engineers, IT-Operations"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              )}

              {/* SCIM Role Mapping Preview Card */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-indigo-400" />
                    <span>SCIM Group-to-Role Evaluation Result</span>
                  </h4>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                    currentUser.role === 'APPSEC_ADMIN'
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                      : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                  }`}>
                    Assigned Role: {currentUser.role === 'APPSEC_ADMIN' ? 'AppSec Admin (Full CRUD)' : 'IT Viewer (Read-Only)'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500">Identity: </span>
                    <span className="text-slate-200 font-medium">{currentUser.displayName}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500">Email: </span>
                    <span className="text-slate-200 font-mono">{currentUser.email}</span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-500 block mb-1">Passed Azure AD Security Groups:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {currentUser.groups.map((grp, idx) => (
                      <span key={idx} className="text-xs bg-slate-800 text-indigo-300 border border-slate-700 px-2.5 py-0.5 rounded-md font-mono">
                        {grp}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Decoded OIDC Token Preview */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                    <span>Azure OIDC ID Token Payload (Decoded JWT)</span>
                  </span>
                  <button
                    type="button"
                    onClick={copyToken}
                    className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800"
                  >
                    {copiedToken ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedToken ? 'Copied' : 'Copy JWT'}</span>
                  </button>
                </div>
                <pre className="text-[11px] font-mono bg-slate-900/90 p-3 rounded-lg text-emerald-400/90 overflow-x-auto max-h-32 border border-slate-800">
                  {JSON.stringify(mockJwtToken.payload, null, 2)}
                </pre>
              </div>
            </>
          ) : (
            /* Super Admin Break-Glass Tab */
            <form onSubmit={handleSuperAdminLogin} className="space-y-5">
              
              <div className="bg-rose-950/30 border border-rose-800/80 rounded-xl p-4 text-xs space-y-2">
                <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>Break-Glass Emergency Super Admin Account</span>
                </div>
                <p className="text-rose-200/80 leading-relaxed">
                  This account provides emergency full-system access to prevent system lockout if Azure AD SSO or SCIM sync is misconfigured or inaccessible.
                </p>
              </div>

              {superError && (
                <div className="p-3 bg-rose-950/80 border border-rose-700 text-rose-200 text-xs rounded-xl flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{superError}</span>
                </div>
              )}

              <div className="space-y-4 bg-slate-950/80 p-5 rounded-2xl border border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Super Admin Username
                  </label>
                  <input
                    type="text"
                    required
                    value={superUsername}
                    onChange={(e) => setSuperUsername(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    placeholder="superadmin"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Break-Glass Password
                  </label>
                  <input
                    type="password"
                    required
                    value={superPassword}
                    onChange={(e) => setSuperPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    placeholder="••••••••••••"
                  />
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs font-mono space-y-1 text-slate-400">
                  <p className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    <span>Default System Credentials (For Emergency Demo):</span>
                  </p>
                  <p>Username: <span className="text-emerald-400 font-bold">superadmin</span></p>
                  <p>Password: <span className="text-emerald-400 font-bold">adminpassword123!</span></p>
                </div>
              </div>

              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                <span>
                  Authenticating as Super Admin unlocks all system capabilities, including SCIM configuration, full application CRUD, assessment approvals, and audit log management.
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAuthorizing}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/30 flex items-center gap-2 transition-all cursor-pointer"
                >
                  {isAuthorizing ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Authenticating Super Admin...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Log In as Super Admin</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          )}

        </div>

        {/* Footer Actions for Azure SSO tab */}
        {authTab === 'sso' && (
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            
            <button
              type="button"
              onClick={handleSignIn}
              disabled={isAuthorizing}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-md shadow-blue-600/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isAuthorizing ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Authenticating with Azure AD...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Complete Azure AD SSO Sign In</span>
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
