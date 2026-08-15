import React, { useState } from 'react';
import {
  Database,
  FileText,
  BarChart3,
  History,
  Sparkles,
  Calculator,
  CheckSquare,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  Shield,
  ShieldCheck,
  Eye,
  Menu,
  X,
  UserCheck,
  Users,
  ShieldAlert,
  Lock,
  Settings,
  Award
} from 'lucide-react';
import { UserRole, ActiveSsoUser } from '../types';

export type TabType = 'apps' | 'sso-scim' | 'user-management' | 'rbac-control' | 'security-reports' | 'promotion-records' | 'self-rating' | 'review-queue' | 'sop' | 'matrix' | 'audit';

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  appCount: number;
  activeSopVersion: string;
  auditCount: number;
  pendingCount?: number;
  scimUserCount?: number;
  groupMappingsCount?: number;
  provisionedUsersCount?: number;
  currentRole: UserRole;
  activeSsoUser?: ActiveSsoUser;
  onOpenAzureLogin?: () => void;
  onOpenSettings?: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  appCount,
  activeSopVersion,
  auditCount,
  pendingCount = 0,
  scimUserCount = 0,
  groupMappingsCount = 0,
  provisionedUsersCount = 0,
  currentRole,
  activeSsoUser,
  onOpenAzureLogin,
  onOpenSettings,
  isMobileOpen,
  setIsMobileOpen
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isAdmin = currentRole === 'SUPER_ADMIN' || currentRole === 'APPSEC_ADMIN';

  const navigationSections = [
    {
      group: 'Core Management',
      items: [
        {
          id: 'apps' as TabType,
          label: 'Applications Database',
          icon: Database,
          badge: `${appCount}`,
          badgeBg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300',
          adminOnly: false
        },
        {
          id: 'security-reports' as TabType,
          label: 'ArmorCode Reports',
          icon: ShieldCheck,
          badge: 'API',
          badgeBg: 'bg-emerald-100 text-emerald-800 font-bold dark:bg-emerald-900/60 dark:text-emerald-300',
          adminOnly: false
        },
        {
          id: 'promotion-records' as TabType,
          label: 'Auditable Promotion Records',
          icon: Award,
          badge: 'Audit',
          badgeBg: 'bg-amber-100 text-amber-800 font-bold dark:bg-amber-900/60 dark:text-amber-300',
          adminOnly: false
        }
      ]
    },
    {
      group: 'Workflow & Reviews',
      items: [
        {
          id: 'self-rating' as TabType,
          label: 'Self-Service Rating',
          icon: Calculator,
          badge: 'Form',
          badgeBg: 'bg-indigo-100 text-indigo-800',
          adminOnly: false
        },
        {
          id: 'review-queue' as TabType,
          label: 'Review Queue',
          icon: CheckSquare,
          badge: pendingCount > 0 ? `${pendingCount} Pending` : 'Clean',
          badgeBg: pendingCount > 0 ? 'bg-amber-100 text-amber-900 font-bold animate-pulse' : 'bg-slate-200 text-slate-700',
          adminOnly: false
        }
      ]
    },
    {
      group: 'Governance & Audits',
      items: [
        {
          id: 'sop' as TabType,
          label: 'SOP Document',
          icon: FileText,
          badge: `${activeSopVersion}`,
          badgeBg: 'bg-emerald-100 text-emerald-800',
          adminOnly: false
        },
        {
          id: 'matrix' as TabType,
          label: 'Assessment Matrix',
          icon: BarChart3,
          badge: 'SLA',
          badgeBg: 'bg-amber-100 text-amber-800',
          adminOnly: false
        }
      ]
    },
    {
      group: 'Settings',
      adminOnlySection: true,
      items: [
        {
          id: 'user-management' as TabType,
          label: 'User Management',
          icon: Users,
          badge: provisionedUsersCount > 0 ? `${provisionedUsersCount}` : 'IAM',
          badgeBg: 'bg-emerald-100 text-emerald-800 font-bold dark:bg-emerald-900/60 dark:text-emerald-300',
          adminOnly: true
        },
        {
          id: 'rbac-control' as TabType,
          label: 'RBAC Control',
          icon: Shield,
          badge: groupMappingsCount > 0 ? `${groupMappingsCount} Rules` : 'Policy',
          badgeBg: 'bg-purple-100 text-purple-800 font-bold dark:bg-purple-900/60 dark:text-purple-300',
          adminOnly: true
        },
        {
          id: 'sso-scim' as TabType,
          label: 'SSO Configuration',
          icon: KeyRound,
          badge: scimUserCount > 0 ? `${scimUserCount} Synced` : 'Enterprise',
          badgeBg: 'bg-blue-100 text-blue-800 font-bold dark:bg-blue-900/60 dark:text-blue-300',
          highlight: true,
          adminOnly: true
        },
        {
          id: 'audit' as TabType,
          label: 'Audit Log Trail',
          icon: History,
          badge: `${auditCount}`,
          badgeBg: 'bg-slate-200 text-slate-700',
          adminOnly: true
        }
      ]
    }
  ];

  const handleSelectTab = (tab: TabType, isRestricted: boolean) => {
    if (isRestricted && currentRole === 'IT_VIEWER') {
      alert('Access Restricted: The Azure SSO & SCIM configuration module requires an AppSec Admin or Super Admin role assigned via SCIM group mappings.');
      return;
    }
    onTabChange(tab);
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:sticky top-16 z-40 h-[calc(100vh-4rem)] bg-slate-900 text-slate-200 border-r border-slate-800 transition-all duration-300 flex flex-col shadow-xl ${
          isMobileOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'md:w-20' : 'md:w-64'}`}
      >
        {/* Collapse Toggle Button (Desktop Only) */}
        <div className="hidden md:flex items-center justify-between px-4 py-3 border-b border-slate-800/80">
          {!isCollapsed && (
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Navigation Menu
            </span>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors ml-auto cursor-pointer"
            title={isCollapsed ? 'Expand Side Menu' : 'Collapse Side Menu'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items Scroll Area */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-700">
          {navigationSections.map((section, idx) => {
            if (section.adminOnlySection && !isAdmin) {
              return null;
            }
            return (
              <div key={idx} className="space-y-1">
              {!isCollapsed && (
                <h3 className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  {section.group}
                </h3>
              )}
              {section.items.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const isRestrictedForRole = tab.adminOnly && currentRole === 'IT_VIEWER';

                return (
                  <button
                    key={tab.id}
                    onClick={() => handleSelectTab(tab.id, isRestrictedForRole)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all relative group cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : isRestrictedForRole
                        ? 'text-slate-500 bg-slate-950/40 opacity-70 hover:opacity-100 hover:bg-slate-900'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                    title={
                      isCollapsed
                        ? isRestrictedForRole
                          ? `${tab.label} (Admin Only)`
                          : tab.label
                        : undefined
                    }
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : isRestrictedForRole ? 'text-slate-600' : 'text-slate-400 group-hover:text-slate-200'}`} />

                    {!isCollapsed && (
                      <span className="truncate flex-1 text-left flex items-center justify-between">
                        <span>{tab.label}</span>
                        {isRestrictedForRole && (
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5 text-amber-500" />
                            <span>Admin</span>
                          </span>
                        )}
                      </span>
                    )}

                    {tab.highlight && !isCollapsed && !isRestrictedForRole && (
                      <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse shrink-0" />
                    )}

                    {tab.badge && !isCollapsed && !isRestrictedForRole && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : tab.badgeBg
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}

                    {/* Tooltip on collapsed desktop view */}
                    {isCollapsed && (
                      <div className="hidden md:block absolute left-full ml-2 px-2.5 py-1 bg-slate-950 text-white text-xs font-medium rounded-md shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 border border-slate-800">
                        {tab.label}
                        {isRestrictedForRole && <span className="ml-2 text-rose-400 font-mono">(Restricted)</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
        </div>

        {/* Sidebar Footer: Active Authenticated SCIM Identity Info */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 space-y-2">
          
          {/* Active Identity Card */}
          {!isCollapsed && activeSsoUser && activeSsoUser.isAuthenticated ? (
            <div
              onClick={onOpenAzureLogin}
              className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-2.5 ${
                currentRole === 'SUPER_ADMIN'
                  ? 'bg-rose-950/40 border-rose-800/80 hover:bg-rose-900/60'
                  : currentRole === 'APPSEC_ADMIN'
                  ? 'bg-indigo-950/40 border-indigo-800/80 hover:bg-indigo-900/60'
                  : 'bg-slate-900 border-slate-800 hover:border-blue-500/50'
              }`}
              title="Click to switch identity or log in as Super Admin"
            >
              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-xs shrink-0 ${
                currentRole === 'SUPER_ADMIN'
                  ? 'bg-rose-600/30 border-rose-500/50 text-rose-300'
                  : 'bg-blue-600/20 border-blue-500/40 text-blue-400'
              }`}>
                {currentRole === 'SUPER_ADMIN' ? <ShieldAlert className="w-4 h-4 text-rose-400" /> : 'AZ'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-200 truncate">{activeSsoUser.displayName}</p>
                <p className="text-[10px] text-indigo-300 font-mono font-semibold truncate">
                  {currentRole === 'SUPER_ADMIN'
                    ? 'Break-Glass Super Admin'
                    : currentRole === 'APPSEC_ADMIN'
                    ? 'AppSec Admin (SCIM)'
                    : 'IT Viewer (SCIM)'}
                </p>
              </div>
            </div>
          ) : !isCollapsed && onOpenAzureLogin ? (
            <button
              onClick={onOpenAzureLogin}
              className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>Connect SSO / Break-Glass</span>
            </button>
          ) : null}

          {!isCollapsed && onOpenSettings && (
            <button
              onClick={() => {
                onOpenSettings();
                setIsMobileOpen(false);
              }}
              className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition-all cursor-pointer shadow-xs hover:text-white"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-400" />
              <span>Admin Settings & Data</span>
            </button>
          )}

          {!isCollapsed && (
            <p className="text-[10px] text-slate-500 text-center font-mono pt-0.5">
              RBAC Enforced via SCIM 2.0
            </p>
          )}

        </div>
      </aside>
    </>
  );
};
