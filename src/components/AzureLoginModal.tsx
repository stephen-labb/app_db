import React, { useState, useEffect } from 'react';
import { ActiveSsoUser, SsoConfig, ScimConfig, ScimGroupMapping, ManualUserRoleMapping, UserRole, ProvisionedUser } from '../types';
import { calculateRoleForSsoUser, verifyIamMembership, saveProvisionedUsers, addScimAuditLog } from '../utils/ssoScimStorage';
import appSettings from '../../appsettings.json';
import {
  Shield,
  ShieldAlert,
  CheckCircle2,
  KeyRound,
  Globe,
  Copy,
  Check,
  Lock,
  ChevronRight,
  UserCheck,
  X,
  ShieldCheck,
  Key,
  AlertTriangle,
  ExternalLink,
  Code,
  Sparkles,
  Layers,
  LogOut,
  User,
  RotateCcw,
  XCircle
} from 'lucide-react';

interface AzureLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  ssoConfig: SsoConfig;
  scimConfig?: ScimConfig;
  manualMappings?: ManualUserRoleMapping[];
  provisionedUsers?: ProvisionedUser[];
  groupMappings: ScimGroupMapping[];
  activeSsoUser?: ActiveSsoUser;
  onLoginSuccess: (user: ActiveSsoUser) => void;
  onLogout?: () => void;
  isStandalonePage?: boolean;
}

export const AzureLoginModal: React.FC<AzureLoginModalProps> = ({
  isOpen,
  onClose,
  ssoConfig,
  scimConfig,
  manualMappings = [],
  provisionedUsers = [],
  groupMappings,
  activeSsoUser,
  onLoginSuccess,
  onLogout,
  isStandalonePage = false
}) => {
  const [authTab, setAuthTab] = useState<'oidc' | 'password'>('oidc');
  const [showAdvancedOidc, setShowAdvancedOidc] = useState(false);

  // Custom OIDC Test Claims State
  const [customEmail, setCustomEmail] = useState(appSettings.Security?.SuperAdminEmail || 'admin@enterprise.local');
  const [customDisplayName, setCustomDisplayName] = useState('Enterprise AppSec Lead');
  const [customGroups, setCustomGroups] = useState('AppSec-Engineers, CyberSecurity-Leads');
  const [copiedToken, setCopiedToken] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [popupError, setPopupError] = useState<string | null>(null);

  // Password Login State
  const [usernameInput, setUsernameInput] = useState(appSettings.Security?.SuperAdminUsername || 'superadmin');
  const [passwordInput, setPasswordInput] = useState(appSettings.Security?.SuperAdminPassword || 'adminpassword123!');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Mandatory Password Reset Intercept State
  const [resetPasswordUser, setResetPasswordUser] = useState<ProvisionedUser | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [pendingLoginUser, setPendingLoginUser] = useState<ActiveSsoUser | null>(null);

  const validatePasswordComplexity = (pwd: string) => {
    const hasMinLength = pwd.length >= 8;
    const hasUppercase = /[A-Z]/.test(pwd);
    const hasLowercase = /[a-z]/.test(pwd);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd);
    return {
      hasMinLength,
      hasUppercase,
      hasLowercase,
      hasSpecialChar,
      isValid: hasMinLength && hasUppercase && hasLowercase && hasSpecialChar
    };
  };

  // Listen for OIDC OAuth Popup Message Response (postMessage flow)
  useEffect(() => {
    if (!isOpen) return;

    const handleOidcMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (origin !== window.location.origin && !origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const payloadUser = event.data.user || {};
        setIsAuthorizing(false);
        const email = (payloadUser.email || payloadUser.upn || payloadUser.preferred_username || '').trim().toLowerCase();
        if (!email) {
          setPopupError('HTTP 403 Forbidden: OIDC Authentication Error - No valid email or user claim returned by Microsoft Entra ID.');
          return;
        }
        const groups = payloadUser.groups || [];

        // Verify if user is registered in IAM or auto-provision via OIDC
        const iamCheck = verifyIamMembership(
          email,
          manualMappings,
          provisionedUsers,
          scimConfig,
          groupMappings,
          groups,
          payloadUser.displayName || payloadUser.name
        );

        if (!iamCheck.isAddedInIam) {
          setPopupError(iamCheck.denyReason || `HTTP 403 Forbidden: User identity '${email}' is NOT registered in Enterprise IAM.`);
          return;
        }

        // Switch to the user's IAM identity
        onLoginSuccess({
          isAuthenticated: true,
          userId: payloadUser.userId || 'usr-oidc-001',
          displayName: iamCheck.displayName || payloadUser.displayName || 'Azure AD Authenticated User',
          email,
          upn: payloadUser.upn || email,
          role: iamCheck.assignedRole,
          groups: iamCheck.groups || groups,
          loginMethod: 'AZURE_SSO',
          loggedInAt: new Date().toISOString(),
          iamVerified: true,
          iamMatchedSource: iamCheck.matchedSource,
          iamVerifiedAt: new Date().toISOString()
        });
        onClose();
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        setIsAuthorizing(false);
        setPopupError(event.data.error || 'HTTP 403 Forbidden: OIDC Authentication failed or was cancelled.');
      }
    };

    window.addEventListener('message', handleOidcMessage);
    return () => window.removeEventListener('message', handleOidcMessage);
  }, [isOpen, onLoginSuccess, onClose, scimConfig, manualMappings, provisionedUsers, groupMappings]);

  if (!isOpen) return null;

  const getEffectiveUser = () => {
    const groups = customGroups.split(',').map(g => g.trim()).filter(Boolean);
    const email = customEmail || 'admin@enterprise.local';
    const role = calculateRoleForSsoUser(
      email,
      groups,
      scimConfig?.enabled ?? false,
      manualMappings,
      groupMappings,
      scimConfig?.defaultRole ?? 'APPSEC_ADMIN'
    );

    return {
      userId: `az-usr-${Math.floor(1000 + Math.random() * 9000)}`,
      displayName: customDisplayName || 'Enterprise User',
      email,
      upn: email,
      groups,
      title: 'Azure AD Authenticated User',
      department: 'Cybersecurity',
      role
    };
  };

  const currentUser = getEffectiveUser();

  const oidcJwtHeader = { alg: 'RS256', typ: 'JWT', kid: 'az_oidc_key_98231' };
  const oidcJwtClaims = {
    aud: ssoConfig.clientId,
    iss: `https://login.microsoftonline.com/${ssoConfig.tenantId}/v2.0`,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    nbf: Math.floor(Date.now() / 1000),
    sub: currentUser.userId,
    oid: currentUser.userId,
    tid: ssoConfig.tenantId,
    name: currentUser.displayName,
    preferred_username: currentUser.upn,
    email: currentUser.email,
    roles: currentUser.groups,
    groups: currentUser.groups,
    ver: '2.0',
    azp: ssoConfig.clientId
  };

  // Launch Live Azure OIDC Authorize Popup
  const handleLaunchLiveOidcPopup = async () => {
    setPopupError(null);
    setIsAuthorizing(true);
    try {
      localStorage.removeItem('azure_oidc_last_error');
      localStorage.removeItem('azure_oidc_success_user');
    } catch (e) {}

    let checkTimer: any = null;
    let authTimeout: any = null;
    let popupRef: Window | null = null;

    const cleanup = () => {
      if (checkTimer) clearInterval(checkTimer);
      if (authTimeout) clearTimeout(authTimeout);
    };

    // 25-second maximum timeout for authentication process
    authTimeout = setTimeout(() => {
      cleanup();
      setIsAuthorizing(false);
      setPopupError('Authentication timed out after 25 seconds. Authorization with Entra ID was interrupted or took too long.');
      if (popupRef && !popupRef.closed) {
        try { popupRef.close(); } catch (e) {}
      }
    }, 25000);

    try {
      const res = await fetch('/api/sso/azure/authorize-url');
      const data = await res.json();
      const authUrl = data.url || `${ssoConfig.loginUrl}?client_id=${ssoConfig.clientId}&response_type=code&redirect_uri=${encodeURIComponent(ssoConfig.redirectUri)}&scope=${encodeURIComponent(ssoConfig.scopes)}&prompt=select_account`;

      const popup = window.open(
        authUrl,
        'azure_oidc_popup',
        'width=600,height=720,status=no,toolbar=no,menubar=no,location=no'
      );
      popupRef = popup;

      if (!popup) {
        cleanup();
        setIsAuthorizing(false);
        setPopupError('Popup blocked! Please allow browser popups to test live Azure Entra ID OIDC Sign-In.');
        return;
      }

      checkTimer = setInterval(() => {
        // Check for OIDC success stored in localStorage
        try {
          const successUserStr = localStorage.getItem('azure_oidc_success_user');
          if (successUserStr) {
            localStorage.removeItem('azure_oidc_success_user');
            cleanup();
            setIsAuthorizing(false);
            setPopupError(null);
            if (popup && !popup.closed) {
              try { popup.close(); } catch (e) {}
            }
            try {
              const userData = JSON.parse(successUserStr);
              onLoginSuccess({
                ...userData,
                isAuthenticated: true
              });
              onClose();
            } catch (e) {}
            return;
          }
        } catch (e) {}

        // Check for OIDC error stored in localStorage
        try {
          const lastErr = localStorage.getItem('azure_oidc_last_error');
          if (lastErr) {
            localStorage.removeItem('azure_oidc_last_error');
            cleanup();
            setIsAuthorizing(false);
            setPopupError(lastErr);
            if (popup && !popup.closed) {
              try { popup.close(); } catch (e) {}
            }
            return;
          }
        } catch (e) {}

        // Check if popup closed without emitting success or error
        if (popup && popup.closed) {
          // Double-check localStorage one last time
          try {
            const successUserStr = localStorage.getItem('azure_oidc_success_user');
            if (successUserStr) {
              localStorage.removeItem('azure_oidc_success_user');
              cleanup();
              setIsAuthorizing(false);
              setPopupError(null);
              const userData = JSON.parse(successUserStr);
              onLoginSuccess({
                ...userData,
                isAuthenticated: true
              });
              onClose();
              return;
            }
          } catch (e) {}

          cleanup();
          setIsAuthorizing((currentlyAuthorizing) => {
            if (currentlyAuthorizing) {
              setPopupError((existingErr) => existingErr || 'HTTP 403 Forbidden: OIDC Authorization popup was closed or cancelled.');
            }
            return false;
          });
        }
      }, 300);

    } catch (err: any) {
      cleanup();
      setIsAuthorizing(false);
      setPopupError('Failed to initiate live OIDC authorization request.');
    }
  };

  // Instant Sign In via OIDC Token Claims (Test Simulation)
  const handleCompleteOidcSignIn = () => {
    setIsAuthorizing(true);
    setPopupError(null);

    const email = customEmail.trim().toLowerCase();
    if (!email) {
      setIsAuthorizing(false);
      setPopupError('HTTP 403 Forbidden: Please specify a valid email address claim.');
      return;
    }
    const groups = customGroups.split(',').map(g => g.trim()).filter(Boolean);

    const iamCheck = verifyIamMembership(
      email,
      manualMappings,
      provisionedUsers,
      scimConfig,
      groupMappings,
      groups,
      customDisplayName
    );

    setTimeout(() => {
      setIsAuthorizing(false);

      if (!iamCheck.isAddedInIam) {
        setPopupError(iamCheck.denyReason || `HTTP 403 Forbidden: User identity '${email}' is NOT registered in Enterprise IAM.`);
        return;
      }

      onLoginSuccess({
        isAuthenticated: true,
        userId: iamCheck.matchedUser && 'id' in iamCheck.matchedUser ? iamCheck.matchedUser.id : `az-usr-${Math.floor(1000 + Math.random() * 9000)}`,
        displayName: iamCheck.displayName || customDisplayName || email.split('@')[0],
        email,
        upn: email,
        role: iamCheck.assignedRole,
        groups: iamCheck.groups || groups,
        loginMethod: ssoConfig.ssoMode === 'LIVE_OIDC' ? 'AZURE_SSO' : 'SIMULATED_AZURE_OIDC',
        idToken: JSON.stringify(oidcJwtClaims),
        loggedInAt: new Date().toISOString(),
        iamVerified: true,
        iamMatchedSource: iamCheck.matchedSource,
        iamVerifiedAt: new Date().toISOString()
      });
      onClose();
    }, 400);
  };

  // Password / Local Account Login Handler
  const handlePasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    const userClean = usernameInput.trim().toLowerCase();
    const userEmail = userClean.includes('@') ? userClean : `${userClean}@enterprise.local`;

    // Check if matching user in Provisioned Users directory has mandatory password reset flagged
    const matchedProvisioned = provisionedUsers.find(
      (u) =>
        (u.email && u.email.trim().toLowerCase() === userEmail) ||
        (u.userName && u.userName.trim().toLowerCase() === userEmail) ||
        u.displayName.toLowerCase().replace(/\s+/g, '') === userClean
    );

    if (matchedProvisioned && matchedProvisioned.mustResetPassword) {
      const assignedRole = matchedProvisioned.mappedRole || (userClean.includes('admin') ? 'APPSEC_ADMIN' : 'IT_VIEWER');
      setPendingLoginUser({
        isAuthenticated: true,
        userId: matchedProvisioned.id,
        displayName: matchedProvisioned.displayName,
        email: matchedProvisioned.email || userEmail,
        upn: matchedProvisioned.email || userEmail,
        role: assignedRole,
        groups: matchedProvisioned.groups || ['Password-Authenticated-Users'],
        loginMethod: 'PASSWORD_AUTHENTICATED',
        loggedInAt: new Date().toISOString()
      });
      setResetPasswordUser(matchedProvisioned);
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      return;
    }
    
    if (userClean === 'superadmin' && passwordInput === 'adminpassword123!') {
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
      }, 400);
    } else if (userClean && passwordInput.length >= 6) {
      // Allow local credentials login
      setIsAuthorizing(true);
      setTimeout(() => {
        setIsAuthorizing(false);
        const mappedRole: UserRole = matchedProvisioned?.mappedRole || (userClean.includes('admin') ? 'APPSEC_ADMIN' : 'IT_VIEWER');
        onLoginSuccess({
          isAuthenticated: true,
          userId: matchedProvisioned?.id || `usr-pwd-${Math.floor(1000 + Math.random() * 9000)}`,
          displayName: matchedProvisioned?.displayName || userClean.split('@')[0].replace(/[_.]/g, ' '),
          email: userEmail,
          upn: userEmail,
          role: mappedRole,
          groups: matchedProvisioned?.groups || ['Password-Authenticated-Users'],
          loginMethod: 'PASSWORD_AUTHENTICATED',
          loggedInAt: new Date().toISOString()
        });
        onClose();
      }, 400);
    } else {
      setPasswordError('Invalid credentials. Please enter a valid username and password (at least 6 characters).');
    }
  };

  const copyToken = () => {
    navigator.clipboard.writeText(JSON.stringify({ header: oidcJwtHeader, payload: oidcJwtClaims }, null, 2));
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const containerClass = isStandalonePage
    ? "min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-4 py-8 animate-fadeIn"
    : "fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-fadeIn";

  if (resetPasswordUser && pendingLoginUser) {
    const complexity = validatePasswordComplexity(newPasswordInput);
    const passwordsMatch = newPasswordInput.length > 0 && newPasswordInput === confirmPasswordInput;

    const handleExecutePasswordReset = (e: React.FormEvent) => {
      e.preventDefault();
      setPasswordError(null);

      if (!complexity.isValid) {
        setPasswordError('Password does not satisfy all complexity requirements (8+ characters, uppercase, lowercase, special character).');
        return;
      }

      if (!passwordsMatch) {
        setPasswordError('New password and confirmation password do not match.');
        return;
      }

      // Update provisioned user record
      const updatedUsers = provisionedUsers.map((u) => {
        if (u.id === resetPasswordUser.id) {
          return {
            ...u,
            mustResetPassword: false,
            passwordResetAt: new Date().toISOString()
          };
        }
        return u;
      });

      saveProvisionedUsers(updatedUsers);

      addScimAuditLog(
        'POST',
        '/api/iam/users/password-reset',
        200,
        'PASSWORD_RESET_COMPLETE',
        `User '${resetPasswordUser.displayName}' (${resetPasswordUser.email}) successfully established a new compliant password during required login reset`,
        resetPasswordUser.id,
        resetPasswordUser.userName
      );

      // Complete authentication
      onLoginSuccess(pendingLoginUser);
      setResetPasswordUser(null);
      setPendingLoginUser(null);
      onClose();
    };

    return (
      <div className={containerClass}>
        <div className="bg-slate-900 border border-amber-500/50 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-100 animate-scaleIn">
          
          <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 p-6 border-b border-amber-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-amber-200">
                  Mandatory Password Reset Required
                </h3>
                <p className="text-xs text-amber-400/80">
                  Account password update required for {resetPasswordUser.displayName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setResetPasswordUser(null);
                setPendingLoginUser(null);
              }}
              className="text-slate-400 hover:text-slate-200 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleExecutePasswordReset} className="p-6 space-y-5">
            <div className="p-3.5 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-200/90 leading-relaxed">
              An administrator has flagged your account for a required password update. Please specify a new secure password adhering to compliance policies before accessing the system.
            </div>

            {passwordError && (
              <div className="p-3 bg-rose-950/90 border border-rose-700 text-rose-200 text-xs rounded-xl flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  New Password *
                </label>
                <input
                  type="password"
                  required
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="Min 8 chars, 1 uppercase, 1 lowercase, 1 special"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="Repeat new password"
                />
              </div>
            </div>

            {/* Password Policy Live Requirements Card */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
              <p className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
                Password Policy Requirements:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                <div className={`flex items-center gap-1.5 ${complexity.hasMinLength ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                  {complexity.hasMinLength ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-slate-600" />}
                  <span>At least 8 characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${complexity.hasUppercase ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                  {complexity.hasUppercase ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-slate-600" />}
                  <span>Uppercase letter (A-Z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${complexity.hasLowercase ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                  {complexity.hasLowercase ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-slate-600" />}
                  <span>Lowercase letter (a-z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${complexity.hasSpecialChar ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                  {complexity.hasSpecialChar ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-slate-600" />}
                  <span>At least 1 special char</span>
                </div>
              </div>
              {confirmPasswordInput.length > 0 && (
                <div className={`pt-1 border-t border-slate-800 flex items-center gap-1.5 ${passwordsMatch ? 'text-emerald-400 font-bold' : 'text-rose-400'}`}>
                  {passwordsMatch ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                  <span>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setResetPasswordUser(null);
                  setPendingLoginUser(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!complexity.isValid || !passwordsMatch}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/30 flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>Save New Password & Sign In</span>
              </button>
            </div>

          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden text-slate-100">
        
        {/* Header Branding */}
        <div className="bg-gradient-to-r from-blue-950 via-indigo-900 to-slate-900 p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
              <svg className="w-6 h-6" viewBox="0 0 23 23" fill="currentColor">
                <path fill="#f25022" d="M1 1h10v10H1z" />
                <path fill="#7fba00" d="M12 1h10v10H12z" />
                <path fill="#00a4ef" d="M1 12h10v10H1z" />
                <path fill="#ffb900" d="M12 12h10v10H12z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg text-white">
                  Enterprise Authentication Portal
                </h3>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                  OIDC SSO & Password Login
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Choose your authentication method to access the AppSec Criticality System
              </p>
            </div>
          </div>
          {!isStandalonePage && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Authenticated User Status Header (if already logged in) */}
        {activeSsoUser && activeSsoUser.isAuthenticated && (
          <div className="bg-emerald-950/40 border-b border-emerald-800/60 p-4 px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">Signed in as {activeSsoUser.displayName}</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono">
                    {activeSsoUser.role}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 font-mono">{activeSsoUser.email || activeSsoUser.upn}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Go to Front Page</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              {onLogout && (
                <button
                  onClick={() => {
                    onLogout();
                    setPopupError(null);
                  }}
                  className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 text-xs rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Authentication Choice Tabs: OIDC SSO vs Password Login */}
        <div className="flex border-b border-slate-800 bg-slate-950/80 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setAuthTab('oidc');
              setPopupError(null);
            }}
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              authTab === 'oidc'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-4 h-4 text-blue-400" />
            <span>Microsoft Entra ID (OIDC SSO)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthTab('password');
              setPasswordError(null);
            }}
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              authTab === 'password'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-4 h-4 text-indigo-400" />
            <span>Password / Credentials Login</span>
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto">
          
          {authTab === 'oidc' ? (
            <>
              {/* HTTP 403 Forbidden / OIDC Error Banner (Displayed in App Modal) */}
              {popupError && (
                <div className="p-4 bg-rose-950/90 border border-rose-500/60 rounded-xl space-y-2.5 animate-fadeIn shadow-lg shadow-rose-950/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded text-[10px] font-mono font-bold">
                        HTTP 403 FORBIDDEN
                      </span>
                      <h4 className="text-xs font-bold text-rose-200">
                        OIDC Authorization Error / Access Denied
                      </h4>
                    </div>
                    <button onClick={() => setPopupError(null)} className="text-rose-400 hover:text-white cursor-pointer p-0.5">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-rose-200/90 leading-relaxed font-mono bg-rose-900/40 p-2.5 rounded-lg border border-rose-800/50 break-words">
                    {popupError}
                  </p>
                  
                  {popupError.includes('AADSTS700016') ? (
                    <div className="bg-slate-900/90 border border-amber-500/40 rounded-xl p-3 text-xs space-y-2">
                      <div className="flex items-center gap-2 text-amber-300 font-semibold">
                        <Key className="w-4 h-4 text-amber-400" />
                        <span>Tenant ID & Client ID Mismatch Fix:</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Microsoft cannot find the Application ID in Tenant <code className="text-amber-300 font-mono">2c7d678a-3080-4d64-a967-67f2da6d3cae</code>.
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300">
                        <li>Go to Azure Portal &rarr; <strong>Microsoft Entra ID</strong> &rarr; <strong>Overview</strong> and copy your actual <strong>Directory (tenant) ID</strong>.</li>
                        <li>Click <strong>App registrations</strong> &rarr; Select your app and copy the <strong>Application (client) ID</strong>.</li>
                        <li>In this app, go to <strong>Azure AD SSO & SCIM</strong> tab &rarr; <strong>Azure AD Settings & Guide</strong> and paste BOTH the matching Tenant ID and Client ID.</li>
                      </ol>
                    </div>
                  ) : (popupError.includes('AADSTS7000215') || popupError.includes('Invalid')) ? (
                    <div className="bg-slate-900/90 border border-amber-500/40 rounded-xl p-3 text-xs space-y-2">
                      <div className="flex items-center gap-2 text-amber-300 font-semibold">
                        <Key className="w-4 h-4 text-amber-400" />
                        <span>How to fix Azure Client Secret in 3 steps:</span>
                      </div>
                      <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300">
                        <li>In Azure Portal &rarr; <strong>Microsoft Entra ID</strong> &rarr; <strong>App registrations</strong> &rarr; Select your app.</li>
                        <li>Click <strong>Certificates & secrets</strong> &rarr; <strong>+ New client secret</strong>.</li>
                        <li>Copy the string under the <strong>Value</strong> column (e.g. <code className="text-emerald-400 font-mono">eER8Q~...</code>), <em>NOT</em> the Secret ID GUID, then save it in the <strong>Azure AD SSO & SCIM</strong> tab.</li>
                      </ol>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400">
                      💡 <strong className="text-slate-300">Note:</strong> Check that your account is assigned to the Entra ID enterprise app or has valid email/UPN identity claims.
                    </p>
                  )}
                </div>
              )}

              {/* Primary OIDC Login Action Box */}
              <div className="bg-gradient-to-b from-indigo-950/40 to-slate-950 border border-indigo-500/30 rounded-2xl p-5 space-y-4 shadow-lg">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center shrink-0">
                    <svg className="w-7 h-7" viewBox="0 0 23 23" fill="currentColor">
                      <path fill="#f25022" d="M1 1h10v10H1z" />
                      <path fill="#7fba00" d="M12 1h10v10H12z" />
                      <path fill="#00a4ef" d="M1 12h10v10H1z" />
                      <path fill="#ffb900" d="M12 12h10v10H12z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      Sign In with Microsoft Entra ID (OIDC SSO)
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Authenticate with your corporate Azure AD / Microsoft Entra ID user account. You will be prompted to choose your Microsoft account in a pop-up window.
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800/80">
                  <div className="text-[11px] text-slate-400 font-mono">
                    Tenant ID: <span className="text-indigo-300">{ssoConfig.tenantId.substring(0, 8)}...</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleLaunchLiveOidcPopup}
                    disabled={isAuthorizing}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isAuthorizing ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span>Authorizing with Entra ID...</span>
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4" />
                        <span>Sign In with Microsoft Entra ID</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* OIDC Config & Issuer Info Badge */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs font-mono">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2 text-indigo-300">
                    <Globe className="w-4 h-4 text-indigo-400" />
                    <span className="font-bold font-sans">OIDC Endpoint:</span>
                    <span className="text-slate-300 truncate max-w-xs">{ssoConfig.issuerUrl}</span>
                  </div>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded font-sans">
                    Client ID: {ssoConfig.clientId}
                  </span>
                </div>
              </div>

              {/* Collapsible Advanced OIDC Test Options */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                <button
                  type="button"
                  onClick={() => setShowAdvancedOidc(!showAdvancedOidc)}
                  className="w-full p-3 text-xs font-semibold text-slate-400 hover:text-slate-200 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-indigo-400" />
                    <span>OIDC Test Claims & SCIM Mapping Simulator (Optional)</span>
                  </span>
                  <span className="text-slate-500 text-[10px]">{showAdvancedOidc ? '▲ Hide' : '▼ Show Options'}</span>
                </button>

                {showAdvancedOidc && (
                  <div className="p-4 border-t border-slate-800 space-y-4 animate-fadeIn">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Display Name (`name` claim)</label>
                        <input
                          type="text"
                          value={customDisplayName}
                          onChange={(e) => setCustomDisplayName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                          placeholder="e.g. Enterprise AppSec Lead"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Email (`preferred_username`)</label>
                        <input
                          type="email"
                          value={customEmail}
                          onChange={(e) => setCustomEmail(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                          placeholder="e.g. admin@enterprise.local"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Azure AD Security Groups (`groups` claim)</label>
                      <input
                        type="text"
                        value={customGroups}
                        onChange={(e) => setCustomGroups(e.target.value)}
                        placeholder="e.g. AppSec-Engineers, CyberSecurity-Leads"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={handleCompleteOidcSignIn}
                        disabled={isAuthorizing}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>Simulate OIDC Claims Sign-In</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Password / Local Account Login Form */
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs space-y-1">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-indigo-400" />
                  <span>Standard Password / Local Account Authentication</span>
                </h4>
                <p className="text-slate-400">
                  Log in directly using local account credentials or Break-Glass emergency system admin password.
                </p>
              </div>

              {passwordError && (
                <div className="p-3 bg-rose-950/90 border border-rose-700 text-rose-200 text-xs rounded-xl flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div className="space-y-4 bg-slate-950/80 p-5 rounded-2xl border border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Username or Email
                  </label>
                  <input
                    type="text"
                    required
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="superadmin or user@enterprise.local"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="••••••••••••"
                  />
                </div>

                <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 text-xs font-mono space-y-1 text-slate-400">
                  <p className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    <span>Emergency Super Admin Default Credentials:</span>
                  </p>
                  <p>Username: <span className="text-emerald-400 font-bold">superadmin</span></p>
                  <p>Password: <span className="text-emerald-400 font-bold">adminpassword123!</span></p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAuthorizing}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isAuthorizing ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Authenticating Credentials...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Sign In with Password</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          )}

        </div>

        {/* Footer for OIDC Tab */}
        {authTab === 'oidc' && (
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Microsoft Entra ID OIDC v2.0 • Standard OAuth 2.0 PKCE
            </span>
            {!isStandalonePage && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
