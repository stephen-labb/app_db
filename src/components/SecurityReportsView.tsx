import React, { useState, useEffect } from 'react';
import { ArmorCodeFinding, ArmorCodeQueryRequest, ArmorCodeQueryResponse, Application, PromotionEvidence, ComplianceEvaluationResult } from '../types';
import {
  fetchArmorCodeFindings,
  fetchArmorCodeProducts,
  fetchArmorCodeSubproducts,
  constructArmorCodePayload,
  exportArmorCodeFindingsCSV
} from '../services/armorcodeService';
import { SearchableSelect, SearchableOption } from './SearchableSelect';
import { MultiSearchableSelect } from './MultiSearchableSelect';
import {
  evaluateCompliance,
  isFindingResolved,
  createAndSavePromotionEvidence,
  loadPromotionEvidences,
  asyncFetchPromotionEvidences,
  revokePromotionEvidence,
  clearAllPromotionEvidences,
  deletePromotionEvidence,
  downloadEvidenceJSON
} from '../services/promotionEvidenceService';
import { loadActiveSsoUser } from '../utils/ssoScimStorage';
import appSettings from '../../appsettings.json';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  Code2,
  Terminal,
  Copy,
  Check,
  RefreshCw,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FileCode,
  Lock,
  Layers,
  Sparkles,
  Settings,
  HelpCircle,
  Database,
  Sliders,
  Bug,
  Shield,
  Award,
  CheckCircle2,
  XCircle,
  FileCheck,
  Printer,
  History,
  Trash2,
  UserCheck,
  ArrowRight,
  Zap,
  Boxes,
  Code,
  Package,
  Key,
  AlertOctagon
} from 'lucide-react';

export type ScanReportType = 'STATIC' | 'CONTAINER' | 'DYNAMIC';

interface SecurityReportsViewProps {
  applications?: Application[];
  initialSubTab?: 'QUERY' | 'EVIDENCES';
  initialReportType?: ScanReportType;
  onReportTypeChange?: (type: ScanReportType) => void;
}

export const SecurityReportsView: React.FC<SecurityReportsViewProps> = ({
  applications = [],
  initialSubTab = 'QUERY',
  initialReportType = 'STATIC',
  onReportTypeChange
}) => {
  // Navigation Sub-tab & Scan Report Type
  const [activeSubTab, setActiveSubTab] = useState<'QUERY' | 'EVIDENCES'>(initialSubTab);
  const [reportType, setReportType] = useState<ScanReportType>(initialReportType || 'STATIC');

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Query Form State defaults based on Report Type
  const getInitialProjectName = (_type: ScanReportType) => {
    return '';
  };

  const getInitialRepositories = (_type: ScanReportType) => {
    return [];
  };

  const getInitialScanTypes = (type: ScanReportType) => {
    if (type === 'CONTAINER') return ['Container Security'];
    if (type === 'DYNAMIC') return ['DAST'];
    return ['SAST', 'SCA', 'Secrets'];
  };

  const [projectName, setProjectName] = useState<string>(getInitialProjectName(initialReportType));
  const [selectedRepositories, setSelectedRepositories] = useState<string[]>(getInitialRepositories(initialReportType));
  const [branchName, setBranchName] = useState<string>('main');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(getInitialScanTypes(initialReportType));
  const [customEndpoint] = useState<string>(appSettings.ArmorCode?.ApiEndpoint || 'https://app.armorcode.com/user/findings/');
  const [apiKey] = useState<string>(appSettings.ArmorCode?.ApiKey || '');

  const repositoryName = selectedRepositories.join(', ');

  // Switch Report Types cleanly
  const handleSwitchReportType = (newType: ScanReportType, notifyParent = true) => {
    setReportType(newType);
    setActiveSubTab('QUERY');
    setSelectedProductId('');

    if (newType === 'CONTAINER') {
      setSelectedTypes(['Container Security']);
    } else if (newType === 'DYNAMIC') {
      setSelectedTypes(['DAST']);
    } else {
      setSelectedTypes(['SAST', 'SCA', 'Secrets']);
    }

    if (notifyParent && onReportTypeChange) {
      onReportTypeChange(newType);
    }
  };

  // Sync external initialReportType prop changes
  useEffect(() => {
    if (initialReportType && initialReportType !== reportType) {
      handleSwitchReportType(initialReportType, false);
    }
  }, [initialReportType]);

  // Supported scan categories strictly filtered per report type (unnecessary items removed)
  const getSupportedFindingTypes = (type: ScanReportType) => {
    switch (type) {
      case 'CONTAINER':
        return [
          { id: 'Container Security', name: 'Container Security', category: 'Aqua / Docker / K8s Images' }
        ];
      case 'DYNAMIC':
        return [
          { id: 'DAST', name: 'DAST', category: 'Dynamic Application Security Testing' }
        ];
      case 'STATIC':
      default:
        return [
          { id: 'SAST', name: 'SAST', category: 'Static Code Analysis' },
          { id: 'SCA', name: 'SCA', category: 'Software Composition Analysis' },
          { id: 'Secrets', name: 'Secrets', category: 'Keys & Credential Tokens' }
        ];
    }
  };

  const supportedFindingTypes = getSupportedFindingTypes(reportType);

  // Products & Subproducts List States (Searchable Dropdowns)
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productsOptions, setProductsOptions] = useState<SearchableOption[]>([]);
  const [isFetchingProducts, setIsFetchingProducts] = useState<boolean>(false);
  const [productsSource, setProductsSource] = useState<string>('');

  const [subproductsOptions, setSubproductsOptions] = useState<SearchableOption[]>([]);
  const [isFetchingSubproducts, setIsFetchingSubproducts] = useState<boolean>(false);
  const [subproductsSource, setSubproductsSource] = useState<string>('');

  // Fetch Products from https://app.armorcode.com/user/product/elastic/paged via proxy
  const loadArmorCodeProducts = async (searchQuery?: string) => {
    setIsFetchingProducts(true);
    try {
      const res = await fetchArmorCodeProducts(apiKey, undefined, {
        search: searchQuery !== undefined ? searchQuery : (projectName || ''),
        pageSize: 20,
        pageNumber: 0,
        environmentName: ['PRODUCTION'],
        sortBy: 'NAME',
        direction: 'ASC'
      });
      if (res.products) {
        const formattedOpts: SearchableOption[] = res.products.map(p => ({
          id: p.id !== undefined ? String(p.id) : p.name,
          name: p.name,
          description: p.id ? `Product ID: ${p.id}` : (p.description || `ArmorCode Product: ${p.name}`),
          category: p.category || 'Product'
        }));
        setProductsOptions(formattedOpts);
        setProductsSource(res.source || 'LIVE_API');

        // Automatically associate product ID if current projectName matches one of the results
        if (!selectedProductId && projectName) {
          const matched = formattedOpts.find(opt => opt.name.toLowerCase() === projectName.toLowerCase());
          if (matched && matched.id) {
            setSelectedProductId(String(matched.id));
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load ArmorCode products:', e);
    } finally {
      setIsFetchingProducts(false);
    }
  };

  // Fetch Subproducts (Repositories / Container Images) from https://app.armorcode.com/api/dashboard/sub-product/name-id via proxy
  const loadArmorCodeSubproducts = async (prodIdOrName?: string, searchSubproductQuery?: string) => {
    setIsFetchingSubproducts(true);
    try {
      let activeId = prodIdOrName || selectedProductId;
      // If activeId is a name, attempt lookup in productsOptions
      if (activeId && productsOptions.length > 0) {
        const matched = productsOptions.find(
          p => p.name.toLowerCase() === activeId.toLowerCase() || String(p.id) === String(activeId)
        );
        if (matched && matched.id) {
          activeId = String(matched.id);
        }
      }

      const res = await fetchArmorCodeSubproducts(
        activeId ? [activeId] : [],
        projectName,
        apiKey,
        undefined,
        searchSubproductQuery
      );

      if (res.subproducts && res.subproducts.length > 0) {
        setSubproductsOptions(res.subproducts.map(sp => ({
          id: String(sp.id || sp.name),
          name: sp.name,
          description: sp.id ? `ID: ${sp.id}` : (reportType === 'CONTAINER' ? `Container Image under ${projectName}` : `Repository under ${projectName}`),
          category: sp.category || (reportType === 'CONTAINER' ? 'Container Image' : 'Repository')
        })));
        setSubproductsSource(res.source || 'LIVE_API');
      } else {
        setSubproductsOptions([]);
      }
    } catch (e) {
      console.warn('Failed to load ArmorCode subproducts:', e);
    } finally {
      setIsFetchingSubproducts(false);
    }
  };

  // Auto-fetch products on mount & when apiKey or reportType changes
  useEffect(() => {
    loadArmorCodeProducts();
  }, [apiKey, reportType]);

  // Auto-fetch subproducts whenever selected product or project name changes
  useEffect(() => {
    if (selectedProductId || projectName) {
      loadArmorCodeSubproducts(selectedProductId || projectName);
    }
  }, [selectedProductId, projectName, apiKey, reportType]);

  // UI Toggle States
  const [showSchemaMappingInfo, setShowSchemaMappingInfo] = useState<boolean>(false);
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);

  // Response & Filter States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [queryResponse, setQueryResponse] = useState<ArmorCodeQueryResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSeverityFilter, setSelectedSeverityFilter] = useState<string>('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');

  // Promotion Evidence Modal & Historic Records State
  const [promotionModalOpen, setPromotionModalOpen] = useState<boolean>(false);
  const [targetEnv, setTargetEnv] = useState<string>('Staging -> Production');
  const [releaseVersion, setReleaseVersion] = useState<string>('v2.4.0-rc1');
  const [approvalNotes, setApprovalNotes] = useState<string>('ArmorCode automated security gate passed. Approved for production deployment.');
  const [isAdminOverride, setIsAdminOverride] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [selectedAppId, setSelectedAppId] = useState<string>('');

  const [evidenceList, setEvidenceList] = useState<PromotionEvidence[]>([]);
  const [viewingEvidence, setViewingEvidence] = useState<PromotionEvidence | null>(null);
  const [evidenceSearchTerm, setEvidenceSearchTerm] = useState<string>('');
  const [evidenceStatusFilter, setEvidenceStatusFilter] = useState<string>('ALL');
  const [evidenceCategoryFilter, setEvidenceCategoryFilter] = useState<'ALL' | 'STATIC' | 'CONTAINER' | 'DYNAMIC'>('ALL');

  const activeUser = loadActiveSsoUser();

  // Auto-suggest matching application when promotion modal opens
  useEffect(() => {
    if (promotionModalOpen && applications && applications.length > 0) {
      const matchedApp = applications.find(
        a => a.name.toLowerCase() === projectName.toLowerCase() ||
             a.code.toLowerCase() === projectName.toLowerCase() ||
             a.name.toLowerCase().includes(projectName.toLowerCase())
      );
      if (matchedApp) {
        setSelectedAppId(matchedApp.id);
      } else {
        setSelectedAppId('');
      }
    }
  }, [promotionModalOpen, projectName, applications]);

  // Auto-run initial sample query & load historic evidences on component mount & reportType change
  useEffect(() => {
    handleRunQuery();
    refreshEvidences();
  }, [reportType]);

  const refreshEvidences = async () => {
    const list = await asyncFetchPromotionEvidences();
    // Filter out any legacy sample certificates that might linger in client browser storage
    const sampleIds = ['PROMO-EVID-2026-88219', 'PROMO-EVID-2026-74912', 'PROMO-EVID-2026-61304'];
    const cleaned = list.filter(e => !sampleIds.includes(e.evidenceId) && e.project !== 'sample');
    if (cleaned.length !== list.length) {
      try {
        localStorage.setItem('appsec_armorcode_promotion_evidences_v1', JSON.stringify(cleaned));
      } catch {}
    }
    setEvidenceList(cleaned);
  };

  // Lookup subproduct IDs for selected repositories
  const selectedSubProductIds: (string | number)[] = selectedRepositories.map(repoNameOrId => {
    const matched = subproductsOptions.find(opt => opt.name === repoNameOrId || String(opt.id) === String(repoNameOrId));
    if (matched && matched.id !== undefined) {
      const num = Number(matched.id);
      return !isNaN(num) && String(num) === String(matched.id).trim() ? num : matched.id;
    }
    const num = Number(repoNameOrId);
    return !isNaN(num) ? num : repoNameOrId;
  });

  let effectiveProductId: string | number | undefined = selectedProductId;
  if (!effectiveProductId && projectName) {
    const matched = productsOptions.find(opt => opt.name === projectName || String(opt.id) === String(projectName));
    if (matched && matched.id !== undefined) {
      effectiveProductId = matched.id;
    } else {
      const num = Number(projectName);
      if (!isNaN(num)) effectiveProductId = num;
    }
  }

  const currentQueryRequest: ArmorCodeQueryRequest = {
    project: projectName,
    productId: effectiveProductId,
    repository: selectedRepositories.length === 1 ? selectedRepositories[0] : (selectedRepositories.length > 1 ? selectedRepositories.join(', ') : ''),
    repositories: selectedRepositories,
    subProductIds: selectedSubProductIds.length > 0 ? selectedSubProductIds : undefined,
    cycode_branch: branchName.trim() || 'main',
    finding_types: selectedTypes,
    scanTypes: selectedTypes,
    size: 100,
    page: 0,
    timezone: 'Asia/Shanghai',
    apiKey,
    customEndpoint
  };

  const handleRunQuery = async () => {
    setIsLoading(true);
    setExpandedFindingId(null);
    try {
      const res = await fetchArmorCodeFindings(currentQueryRequest);
      setQueryResponse(res);
    } catch (e) {
      console.error('Failed to fetch ArmorCode report findings:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleType = (typeId: string) => {
    if (selectedTypes.includes(typeId)) {
      if (selectedTypes.length === 1) return; // keep at least 1 selected
      setSelectedTypes(selectedTypes.filter(t => t !== typeId));
    } else {
      setSelectedTypes([...selectedTypes, typeId]);
    }
  };

  const handleSelectAppSuggestion = (app: Application) => {
    setProjectName(app.name.toLowerCase().replace(/[^a-z0-9]/g, '-'));
    if (app.code) {
      setSelectedRepositories([`${app.code.toLowerCase()}-repo`]);
    }
  };

  // Raw findings & Compliance evaluation
  const rawFindings = queryResponse?.results || [];
  const complianceResult: ComplianceEvaluationResult = evaluateCompliance(rawFindings);

  // Filtered Findings for data table
  const filteredFindings = rawFindings.filter(f => {
    const matchesSearch =
      (f.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.finding_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.remediation || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.repository || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.tool || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.status || f.ticketStatus || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSeverity =
      selectedSeverityFilter === 'ALL' ||
      (f.severity || 'MEDIUM').toUpperCase() === selectedSeverityFilter.toUpperCase();

    const matchesType =
      selectedTypeFilter === 'ALL' ||
      f.type.toLowerCase() === selectedTypeFilter.toLowerCase();

    const isResolved = isFindingResolved(f);
    const rawStatus = (f.status || f.ticketStatus || 'OPEN').toUpperCase();
    let matchesStatus = true;
    if (selectedStatusFilter === 'UNRESOLVED') {
      matchesStatus = !isResolved;
    } else if (selectedStatusFilter === 'RESOLVED') {
      matchesStatus = isResolved;
    } else if (selectedStatusFilter === 'BLOCKING') {
      matchesStatus = !isResolved && ((f.severity || '').toUpperCase() === 'CRITICAL' || (f.severity || '').toUpperCase() === 'HIGH');
    } else if (selectedStatusFilter !== 'ALL') {
      matchesStatus = rawStatus === selectedStatusFilter;
    }

    return matchesSearch && matchesSeverity && matchesType && matchesStatus;
  });

  // KPI Metrics
  const criticalCount = rawFindings.filter(f => (f.severity || '').toUpperCase() === 'CRITICAL').length;
  const highCount = rawFindings.filter(f => (f.severity || '').toUpperCase() === 'HIGH').length;
  const unresolvedCriticalHighCount = rawFindings.filter(
    f => ((f.severity || '').toUpperCase() === 'CRITICAL' || (f.severity || '').toUpperCase() === 'HIGH') && !isFindingResolved(f)
  ).length;
  const totalResolvedCount = rawFindings.filter(f => isFindingResolved(f)).length;
  const sastCount = rawFindings.filter(f => f.type.toLowerCase() === 'sast').length;
  const scaCount = rawFindings.filter(f => f.type.toLowerCase() === 'sca').length;
  const secretCount = rawFindings.filter(f => f.type.toLowerCase().includes('secret')).length;
  const containerCount = rawFindings.filter(f => f.type.toLowerCase().includes('container')).length;
  const dastCount = rawFindings.filter(f => f.type.toLowerCase().includes('dast')).length;

  // Handle generating new Promotion Evidence Snapshot
  const handleGenerateEvidenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const mappedApp = applications?.find(
      a => a.id === selectedAppId ||
      a.code.toLowerCase() === projectName.toLowerCase() ||
      a.name.toLowerCase() === projectName.toLowerCase()
    );
    const snapshotPayload = constructArmorCodePayload(currentQueryRequest);
    const apiSnapshot = queryResponse || {
      success: true,
      source: 'SIMULATED_DATA',
      endpointUsed: customEndpoint || 'https://app.armorcode.com/api/findings',
      httpStatus: 200,
      payloadSent: snapshotPayload,
      results: rawFindings,
      totalCount: rawFindings.length,
      timestamp: new Date().toISOString()
    };

    const resolvedReportCategory =
      reportType === 'CONTAINER' ? 'Container Security Report' :
      reportType === 'DYNAMIC' ? 'Dynamic Scan Report' :
      'Static Scan Report';

    const newEvidence = await createAndSavePromotionEvidence({
      project: projectName || (mappedApp ? mappedApp.code : 'Enterprise-App'),
      repository: repositoryName.trim() || 'ALL_REPOSITORIES',
      branch: branchName.trim() || 'master',
      targetEnvironment: targetEnv,
      releaseVersion: releaseVersion.trim() || 'v1.0.0',
      approvalNotes: isAdminOverride ? `ADMIN OVERRIDE: ${overrideReason}. ${approvalNotes}` : (approvalNotes || 'ArmorCode security gate compliance verified and signed.'),
      userEmail: activeUser.email || 'appsec.lead@enterprise.local',
      userRole: activeUser.role || 'APPSEC_ADMIN',
      complianceEvaluation: complianceResult,
      snapshotFindings: rawFindings,
      snapshotPayload,
      apiResponseSnapshot: apiSnapshot,
      apiEndpointUsed: customEndpoint || 'https://app.armorcode.com/api/findings',
      isAdminOverride,
      applicationId: mappedApp ? mappedApp.id : (selectedAppId || undefined),
      applicationName: mappedApp ? mappedApp.name : undefined,
      reportType: reportType,
      reportCategory: resolvedReportCategory
    });

    setPromotionModalOpen(false);
    setViewingEvidence(newEvidence);
    setEvidenceList(prev => [newEvidence, ...prev.filter(ev => ev.evidenceId !== newEvidence.evidenceId)]);
    await refreshEvidences();
    setActiveSubTab('EVIDENCES');
  };

  const handleRevokeEvidence = (id: string) => {
    if (confirm(`Are you sure you want to REVOKE Promotion Evidence [${id}]? This action will be recorded in audit logs.`)) {
      const updated = revokePromotionEvidence(id, activeUser.email || 'AppSec Lead', 'Security policy re-assessment revoked gate certificate.');
      setEvidenceList(updated);
      if (viewingEvidence?.evidenceId === id) {
        setViewingEvidence({ ...viewingEvidence, status: 'REVOKED' });
      }
    }
  };

  const handleDeleteEvidence = (id: string) => {
    if (confirm(`Are you sure you want to PERMANENTLY DELETE Promotion Evidence Certificate [${id}]?`)) {
      const updated = deletePromotionEvidence(id);
      setEvidenceList(updated);
      if (viewingEvidence?.evidenceId === id) {
        setViewingEvidence(null);
      }
    }
  };

  const handleClearAllEvidences = () => {
    if (confirm('Are you sure you want to CLEAR ALL Promotion Evidence Certificates? This will wipe all recorded gate certificates.')) {
      clearAllPromotionEvidences();
      setEvidenceList([]);
      setViewingEvidence(null);
    }
  };

  // Helper to determine category of evidence
  const getEvidenceCategory = (ev: PromotionEvidence): 'STATIC' | 'CONTAINER' | 'DYNAMIC' => {
    if (ev.reportType) return ev.reportType;
    const proj = (ev.project || '').toLowerCase();
    const repo = (ev.repository || '').toLowerCase();
    if (proj.includes('aqua') || repo.includes('aqua') || repo.includes('container') || repo.includes(':') || repo.includes('.tar')) return 'CONTAINER';
    if (proj.includes('dynamic') || proj.includes('dast') || (ev.snapshotFindings || []).some(f => (f.type || '').toLowerCase().includes('dast') || (f.scanType || '').toLowerCase().includes('dast'))) return 'DYNAMIC';
    return 'STATIC';
  };

  // Category counts for Promotion Records
  const evidenceCategoryCounts = {
    all: evidenceList.length,
    static: evidenceList.filter(e => getEvidenceCategory(e) === 'STATIC').length,
    container: evidenceList.filter(e => getEvidenceCategory(e) === 'CONTAINER').length,
    dynamic: evidenceList.filter(e => getEvidenceCategory(e) === 'DYNAMIC').length
  };

  // Filtered Evidence Records
  const filteredEvidences = evidenceList.filter(ev => {
    const matchesSearch =
      ev.evidenceId.toLowerCase().includes(evidenceSearchTerm.toLowerCase()) ||
      ev.project.toLowerCase().includes(evidenceSearchTerm.toLowerCase()) ||
      ev.repository.toLowerCase().includes(evidenceSearchTerm.toLowerCase()) ||
      ev.branch.toLowerCase().includes(evidenceSearchTerm.toLowerCase()) ||
      ev.createdBy.toLowerCase().includes(evidenceSearchTerm.toLowerCase()) ||
      ev.releaseVersion.toLowerCase().includes(evidenceSearchTerm.toLowerCase()) ||
      (ev.reportCategory || '').toLowerCase().includes(evidenceSearchTerm.toLowerCase());

    const matchesStatus = evidenceStatusFilter === 'ALL' || ev.status === evidenceStatusFilter;
    const evCat = getEvidenceCategory(ev);
    const matchesCategory = evidenceCategoryFilter === 'ALL' || evCat === evidenceCategoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Banner & Sub-tab Navigation */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                {reportType === 'CONTAINER' ? (
                  <>
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>ArmorCode Container Security API</span>
                  </>
                ) : reportType === 'DYNAMIC' ? (
                  <>
                    <Zap className="w-3.5 h-3.5 text-purple-400" />
                    <span>ArmorCode Dynamic Security API (DAST)</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>ArmorCode Static Security API (SAST/SCA/Secrets)</span>
                  </>
                )}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800/80">
                appsettings.json Configured
              </span>
            </div>

            <h1 className="text-2xl font-black text-slate-100 tracking-tight">
              {reportType === 'CONTAINER'
                ? 'Container Security Report & Promotion Gates'
                : reportType === 'DYNAMIC'
                ? 'Dynamic Scan Report & Promotion Gates'
                : 'Static Scan Report & Promotion Gates'}
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl mt-1">
              {reportType === 'CONTAINER'
                ? 'Query and audit container images (Aqua Container Images, Docker base layers, Kubernetes pods) against ArmorCode zero-critical gate policies.'
                : reportType === 'DYNAMIC'
                ? 'Query and audit dynamic runtime security findings (DAST, web API fuzzing, injection checks) against ArmorCode gate policies.'
                : 'Query and audit static application code, dependencies, and leaked secrets (SAST, SCA, Secrets) against ArmorCode gate policies.'}
            </p>
          </div>

          {/* Navigation Sub-tabs & Report Types */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-slate-950/80 p-1 rounded-2xl border border-slate-800 flex flex-wrap gap-1">
              <button
                onClick={() => handleSwitchReportType('STATIC')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSubTab === 'QUERY' && reportType === 'STATIC'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Static Scan Report</span>
              </button>

              <button
                onClick={() => handleSwitchReportType('CONTAINER')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSubTab === 'QUERY' && reportType === 'CONTAINER'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Container Security</span>
              </button>

              <button
                onClick={() => handleSwitchReportType('DYNAMIC')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSubTab === 'QUERY' && reportType === 'DYNAMIC'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Dynamic Scan (DAST)</span>
              </button>
            </div>

            <button
              onClick={() => setActiveSubTab('EVIDENCES')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer relative ${
                activeSubTab === 'EVIDENCES'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/30'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>Auditable Promotion Records</span>
              {evidenceList.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-900 text-amber-400 font-bold border border-amber-500/30">
                  {evidenceList.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* SUB-TAB 1: QUERY & COMPLIANCE EVALUATION   */}
      {/* ========================================== */}
      {activeSubTab === 'QUERY' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Compliance Gate Evaluation Banner */}
          {queryResponse && (
            <div className={`p-5 rounded-2xl border shadow-lg transition-all ${
              complianceResult.isCompliant
                ? 'bg-gradient-to-r from-emerald-950/60 via-slate-900 to-emerald-950/60 border-emerald-500/40 text-emerald-200'
                : 'bg-gradient-to-r from-rose-950/60 via-slate-900 to-rose-950/60 border-rose-500/40 text-rose-200'
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    complianceResult.isCompliant
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  }`}>
                    {complianceResult.isCompliant ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-slate-100">
                        Compliance Gate Status: {complianceResult.isCompliant ? 'PASSED / ELIGIBLE FOR PROMOTION' : 'NON-COMPLIANT / PROMOTION BLOCKED'}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-950 border border-slate-800 text-slate-300">
                        {complianceResult.gatePolicyName}
                      </span>
                    </div>
                    
                    <p className="text-xs text-slate-300 mt-1">
                      {complianceResult.isCompliant
                        ? `${reportType === 'CONTAINER' ? 'Product' : 'Project'} '${projectName}' (${reportType === 'CONTAINER' ? 'Container Images' : 'Repo'}: ${repositoryName || 'ALL'}, Branch: ${branchName}) has 0 unresolved Critical/High findings. Meets all security standards for production promotion.`
                        : `Gate standard failed: ${complianceResult.reasons.join(' ')}`}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] font-mono">
                      <span className="text-rose-400 font-bold">Unresolved Critical: {complianceResult.unresolvedCriticalCount ?? complianceResult.criticalCount} (Max: {complianceResult.maxCriticalAllowed})</span>
                      <span className="text-amber-400 font-bold">Unresolved High: {complianceResult.unresolvedHighCount ?? complianceResult.highCount} (Max: {complianceResult.maxHighAllowed})</span>
                      <span className="text-emerald-400 font-semibold">Resolved / Mitigated: {complianceResult.totalResolvedCount ?? 0}</span>
                      <span className="text-slate-400">Total Findings: {complianceResult.totalFindings}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2 self-start md:self-center shrink-0">
                  {complianceResult.isCompliant ? (
                    <button
                      onClick={() => {
                        setIsAdminOverride(false);
                        setPromotionModalOpen(true);
                      }}
                      className="w-full sm:w-auto px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Award className="w-4 h-4 text-slate-950" />
                      <span>Generate Promotion Evidence</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setIsAdminOverride(true);
                        setPromotionModalOpen(true);
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 bg-rose-950 hover:bg-rose-900 border border-rose-700/80 text-rose-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Issue Admin Gate Override</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* API Maintenance Info Bar */}
          {showSchemaMappingInfo && (
            <div className="bg-slate-900 border border-indigo-500/30 text-slate-200 rounded-2xl p-5 shadow-xl space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-bold text-slate-100 text-sm">ArmorCode API Schema & Gate Policy Configuration</h3>
                </div>
                <button
                  onClick={() => setShowSchemaMappingInfo(false)}
                  className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Close Info
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-[11px] font-bold text-indigo-400 uppercase font-mono tracking-wider block">
                    Configured Compliance Policy
                  </span>
                  <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto leading-tight">
{JSON.stringify(appSettings.ArmorCode?.ComplianceStandards || {}, null, 2)}
                  </pre>
                </div>
                <div className="bg-slate-950 p-3.5 rounded-xl border border-emerald-400 uppercase font-mono tracking-wider block">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase font-mono tracking-wider block">
                    Request / Response Mapping
                  </span>
                  <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto leading-tight">
{JSON.stringify(appSettings.ArmorCode?.RequestSchemaMapping || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Query Builder Form */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    Construct ArmorCode Query Parameters
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {reportType === 'CONTAINER'
                      ? 'Filter container security findings by Product Name (e.g. Aqua Container Images) and Container Image Subproducts.'
                      : reportType === 'DYNAMIC'
                      ? 'Filter dynamic application security findings (DAST) by Project and Target Endpoints.'
                      : 'Filter static security findings (SAST, SCA, Secrets) by Product, Repositories, and Branch.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRunQuery}
                  disabled={isLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>{isLoading ? 'Querying...' : 'Query Findings'}</span>
                </button>
                <button
                  onClick={() => setShowSchemaMappingInfo(!showSchemaMappingInfo)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer font-medium px-2 py-1"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Config Info</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Product / Project Name (Searchable Product Dropdown) */}
              <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
                <SearchableSelect
                  label={reportType === 'CONTAINER' ? 'Product Name (ArmorCode Product)' : 'Project Name (ArmorCode Product)'}
                  value={projectName}
                  onChange={(val, selectedOpt) => {
                    setProjectName(val);
                    if (selectedOpt?.id) {
                      setSelectedProductId(String(selectedOpt.id));
                      loadArmorCodeSubproducts(String(selectedOpt.id));
                    } else {
                      const matched = productsOptions.find(p => p.name.toLowerCase() === val.toLowerCase());
                      if (matched && matched.id) {
                        setSelectedProductId(String(matched.id));
                        loadArmorCodeSubproducts(String(matched.id));
                      }
                    }
                  }}
                  onSearchChange={(query) => {
                    loadArmorCodeProducts(query);
                  }}
                  options={productsOptions}
                  placeholder={
                    reportType === 'CONTAINER'
                      ? 'Type to search container product (e.g. Aqua Container Images)...'
                      : 'Type to search or select ArmorCode product...'
                  }
                  isLoading={isFetchingProducts}
                  onRefresh={() => loadArmorCodeProducts(projectName || '')}
                  required={true}
                  iconType="product"
                  badgeText={productsSource === 'LIVE_API' ? 'ArmorCode Elastic API (Live)' : (reportType === 'CONTAINER' ? 'Aqua Container Catalog' : 'ArmorCode Catalog')}
                  helpText={
                    reportType === 'CONTAINER'
                      ? 'Searches live against ArmorCode Elastic API for container image products.'
                      : 'Searches live in real-time against POST https://app.armorcode.com/user/product/elastic/paged.'
                  }
                />
                {applications.length > 0 && reportType !== 'CONTAINER' && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Quick App Shortcuts:</span>
                    {applications.slice(0, 5).map((app) => (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => handleSelectAppSuggestion(app)}
                        className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-slate-600 dark:text-slate-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-[11px] font-mono transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                      >
                        + {app.name}
                      </button>
                    ))}
                  </div>
                )}
                {reportType === 'CONTAINER' && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium">Sample Container Product:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setProjectName('Aqua Container Images');
                        loadArmorCodeSubproducts('Aqua Container Images');
                      }}
                      className="px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/70 hover:bg-cyan-100 dark:hover:bg-cyan-900/80 text-cyan-800 dark:text-cyan-300 text-[11px] font-mono transition-all cursor-pointer border border-cyan-200 dark:border-cyan-800 font-semibold"
                    >
                      🐳 Aqua Container Images
                    </button>
                  </div>
                )}
              </div>

              {/* Subproducts: Container Image Names / Repository Names */}
              <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
                <MultiSearchableSelect
                  label={
                    reportType === 'CONTAINER'
                      ? 'Container Image Names (Subproducts)'
                      : reportType === 'DYNAMIC'
                      ? 'Target Endpoints / Microservices (Subproducts)'
                      : 'Repository Names (Subproducts)'
                  }
                  values={selectedRepositories}
                  onChange={(vals) => setSelectedRepositories(vals)}
                  onSearchChange={(query) => {
                    loadArmorCodeSubproducts(selectedProductId || projectName, query);
                  }}
                  options={subproductsOptions}
                  placeholder={
                    reportType === 'CONTAINER'
                      ? 'Select container images or type to search (e.g. frontend-app:v2.4.0)...'
                      : reportType === 'DYNAMIC'
                      ? 'Select target endpoints or type to search (e.g. /api/v1/search)...'
                      : 'Select repositories or type to search...'
                  }
                  selectAllLabel={
                    reportType === 'CONTAINER'
                      ? 'Select All Container Images'
                      : reportType === 'DYNAMIC'
                      ? 'Select All Endpoints'
                      : 'Select All Repositories'
                  }
                  isLoading={isFetchingSubproducts}
                  onRefresh={() => loadArmorCodeSubproducts(selectedProductId || projectName)}
                  required={false}
                  iconType="repository"
                  badgeText={subproductsSource === 'LIVE_API' ? 'ArmorCode Dashboard Sub-Product API' : (reportType === 'CONTAINER' ? 'Container Registry' : 'ArmorCode Catalog')}
                  helpText={
                    reportType === 'CONTAINER'
                      ? `Queries container image subproducts live via ArmorCode API${selectedProductId ? ` (Product ID: ${selectedProductId})` : ''}.`
                      : `Queries repositories live via POST https://app.armorcode.com/api/dashboard/sub-product/name-id${selectedProductId ? ` (Product ID: ${selectedProductId})` : ''}.`
                  }
                />
                {subproductsOptions.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const allNames = subproductsOptions.map(opt => opt.name);
                          setSelectedRepositories(allNames);
                        }}
                        className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/90 text-indigo-700 dark:text-indigo-300 font-medium transition-all cursor-pointer border border-indigo-200 dark:border-indigo-800"
                      >
                        ✓ Select All ({subproductsOptions.length})
                      </button>
                      {selectedRepositories.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedRepositories([])}
                          className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-600 dark:text-slate-400 hover:text-rose-600 font-medium transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                        >
                          ✕ Clear (Query All)
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      {selectedRepositories.length === 0
                        ? (reportType === 'CONTAINER' ? 'Will scan ALL container images' : 'Will scan ALL repositories')
                        : `${selectedRepositories.length} selected`}
                    </span>
                  </div>
                )}
              </div>

              {/* Branch / Tag Identifier */}
              <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {reportType === 'CONTAINER' ? 'Image Tag / Branch' : 'Branch Name'}{' '}
                  <span className="text-slate-600 dark:text-slate-400 font-normal">(cycode_branch)</span>
                </label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder={reportType === 'CONTAINER' ? 'e.g. latest, v2.4.0, main' : 'e.g. master, main, release/v2'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                  {reportType === 'CONTAINER' ? 'Container image tag or VCS branch identifier.' : 'Branch identifier for scanner findings.'}
                </p>
              </div>
            </div>

            {/* Scan Types (Locked and strictly filtered according to report type requirement) */}
            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Security Report Scanner Types ({selectedTypes.length}/{supportedFindingTypes.length})
                  </label>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-500" />
                    <span>Policy Fixed</span>
                  </span>
                </div>
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {reportType === 'CONTAINER'
                    ? 'Container Security mode active'
                    : reportType === 'DYNAMIC'
                    ? 'Dynamic Scan (DAST) mode active'
                    : 'Static Scan (SAST, SCA, Secrets) active'}
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {supportedFindingTypes.map((t) => {
                  const isSelected = selectedTypes.includes(t.id);
                  return (
                    <div
                      key={t.id}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                        isSelected
                          ? reportType === 'CONTAINER'
                            ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-300 dark:border-cyan-800 text-cyan-900 dark:text-cyan-200'
                            : reportType === 'DYNAMIC'
                            ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-200'
                            : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200'
                          : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          reportType === 'CONTAINER'
                            ? 'bg-cyan-600/10 text-cyan-600 dark:text-cyan-400'
                            : reportType === 'DYNAMIC'
                            ? 'bg-purple-600/10 text-purple-600 dark:text-purple-400'
                            : 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400'
                        }`}>
                          {reportType === 'CONTAINER' ? (
                            <Layers className="w-4 h-4" />
                          ) : reportType === 'DYNAMIC' ? (
                            <Zap className="w-4 h-4" />
                          ) : (
                            <Shield className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <span className="text-xs font-bold uppercase font-mono block">{t.id}</span>
                          <span className="text-[11px] leading-tight block text-slate-500 dark:text-slate-400 truncate max-w-xs">{t.category}</span>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold ${
                        reportType === 'CONTAINER'
                          ? 'bg-cyan-600 text-white'
                          : reportType === 'DYNAMIC'
                          ? 'bg-purple-600 text-white'
                          : 'bg-indigo-600 text-white'
                      }`}>
                        ✓
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                {reportType === 'CONTAINER'
                  ? '🔒 Container Security scanners analyze Aqua Container base layers, installed OS packages, and container runtime CVEs.'
                  : reportType === 'DYNAMIC'
                  ? '🔒 Dynamic Application Security Testing (DAST) analyzes live endpoints for OWASP Top 10 vulnerabilities.'
                  : '🔒 Static scan policies evaluate SAST source code flaws, SCA library dependencies, and hardcoded API tokens.'}
              </p>
            </div>

            {/* Bottom Action Bar */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>ArmorCode Security Gates active with zero-tolerance policy for Critical/High issues.</span>
              </div>

              <button
                type="button"
                onClick={handleRunQuery}
                disabled={isLoading}
                className="sm:self-end px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{isLoading ? 'Querying ArmorCode...' : `Query ${reportType === 'CONTAINER' ? 'Container' : reportType === 'DYNAMIC' ? 'Dynamic' : 'Static'} Findings`}</span>
              </button>
            </div>
          </div>

          {/* Results KPI Summary & Export */}
          {queryResponse && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">Total Findings</span>
                <span className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1 block">{rawFindings.length}</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/40 shadow-xs">
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">Unresolved Crit/High</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-black text-rose-600 dark:text-rose-400">{unresolvedCriticalHighCount}</span>
                  {unresolvedCriticalHighCount > 0 && (
                    <span className="text-[10px] font-bold text-rose-500 font-mono">BLOCKING</span>
                  )}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/40 shadow-xs">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Resolved / Mitigated</span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{totalResolvedCount}</span>
              </div>
              {reportType === 'CONTAINER' ? (
                <>
                  <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                    <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider block">Container Vulns</span>
                    <span className="text-xl font-black text-cyan-600 dark:text-cyan-400 mt-1 block">{containerCount || rawFindings.length}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">Critical Vulns</span>
                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">{criticalCount}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">High Vulns</span>
                    <span className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 block">{highCount}</span>
                  </div>
                </>
              ) : reportType === 'DYNAMIC' ? (
                <>
                  <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">DAST Endpoints</span>
                    <span className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1 block">{dastCount || rawFindings.length}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">Critical Vulns</span>
                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">{criticalCount}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">High Vulns</span>
                    <span className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 block">{highCount}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">SAST Code</span>
                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">{sastCount}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">SCA Libraries</span>
                    <span className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1 block">{scaCount}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Secrets Leaked</span>
                    <span className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 block">{secretCount}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Results Table & Filter Toolbar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-0">
            
            {/* Filter Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-950/50">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search findings by ID, description, tool, status, or remediation..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 outline-none font-medium cursor-pointer"
                >
                  <option value="ALL">All Finding Statuses</option>
                  <option value="BLOCKING">Unresolved Critical/High (Blocking)</option>
                  <option value="UNRESOLVED">All Unresolved (Open / In Progress)</option>
                  <option value="RESOLVED">Resolved / Mitigated / Fixed</option>
                  <option value="OPEN">Status: OPEN</option>
                  <option value="MITIGATED">Status: MITIGATED</option>
                </select>

                <select
                  value={selectedSeverityFilter}
                  onChange={(e) => setSelectedSeverityFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 outline-none font-medium cursor-pointer"
                >
                  <option value="ALL">All Severities</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>

                <select
                  value={selectedTypeFilter}
                  onChange={(e) => setSelectedTypeFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 outline-none font-medium cursor-pointer"
                >
                  <option value="ALL">All Scanner Types</option>
                  <option value="SAST">SAST</option>
                  <option value="SCA">SCA</option>
                  <option value="SECRET">Secrets</option>
                  <option value="DAST">DAST</option>
                  <option value="IAC">IaC</option>
                  <option value="CONTAINER">Container</option>
                </select>

                {queryResponse && (
                  <button
                    onClick={() => exportArmorCodeFindingsCSV(queryResponse.results, projectName)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>CSV</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Category & Severity Filter Chips */}
            <div className="px-4 py-2.5 bg-slate-100/60 dark:bg-slate-950/30 border-b border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] font-bold text-slate-500 mr-1">Quick Filters:</span>
              
              {/* Category Chips */}
              <button
                onClick={() => setSelectedTypeFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  selectedTypeFilter === 'ALL'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400'
                }`}
              >
                All Types
              </button>
              <button
                onClick={() => setSelectedTypeFilter('SAST')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  selectedTypeFilter === 'SAST'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                }`}
              >
                <Code className="w-3 h-3" />
                <span>SAST</span>
              </button>
              <button
                onClick={() => setSelectedTypeFilter('SCA')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  selectedTypeFilter === 'SCA'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 hover:border-blue-300'
                }`}
              >
                <Package className="w-3 h-3" />
                <span>SCA</span>
              </button>
              <button
                onClick={() => setSelectedTypeFilter('SECRET')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  selectedTypeFilter === 'SECRET'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 border border-slate-200 dark:border-slate-700 hover:border-amber-300'
                }`}
              >
                <Key className="w-3 h-3" />
                <span>Secrets</span>
              </button>
              <button
                onClick={() => setSelectedTypeFilter('CONTAINER')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  selectedTypeFilter === 'CONTAINER'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 border border-slate-200 dark:border-slate-700 hover:border-cyan-300'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>Container</span>
              </button>
              <button
                onClick={() => setSelectedTypeFilter('DAST')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  selectedTypeFilter === 'DAST'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 border border-slate-200 dark:border-slate-700 hover:border-purple-300'
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>DAST</span>
              </button>

              <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1 hidden sm:block" />

              {/* Gate Blocker Quick Toggle */}
              <button
                onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'BLOCKING' ? 'ALL' : 'BLOCKING')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  selectedStatusFilter === 'BLOCKING'
                    ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-500/20'
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/80 hover:border-rose-400'
                }`}
              >
                <AlertOctagon className="w-3 h-3" />
                <span>Gate Blockers Only</span>
              </button>

              {/* Reset All Filters Button */}
              {(selectedTypeFilter !== 'ALL' || selectedSeverityFilter !== 'ALL' || selectedStatusFilter !== 'ALL' || searchTerm) && (
                <button
                  onClick={() => {
                    setSelectedTypeFilter('ALL');
                    setSelectedSeverityFilter('ALL');
                    setSelectedStatusFilter('ALL');
                    setSearchTerm('');
                  }}
                  className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline font-medium cursor-pointer ml-auto"
                >
                  Reset Filters
                </button>
              )}
            </div>

            {/* Findings Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider font-mono border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-4">Finding ID</th>
                    <th className="py-3 px-4">Risk Score</th>
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Scan Type</th>
                    <th className="py-3 px-4">Title & Context</th>
                    <th className="py-3 px-4">Repo & Branch</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-600 dark:text-slate-400 font-mono">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                        <span>Querying ArmorCode API Endpoint...</span>
                      </td>
                    </tr>
                  ) : filteredFindings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-600 dark:text-slate-400">
                        <ShieldAlert className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <p className="font-bold text-sm text-slate-700 dark:text-slate-300">No security findings returned</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Try adjusting your status, product, subproduct, or scan type filters.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredFindings.map((finding) => {
                      const isExpanded = expandedFindingId === finding.finding_id;
                      const severityUpper = (finding.severity || 'MEDIUM').toUpperCase();
                      
                      const severityBg =
                        severityUpper === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300'
                          : severityUpper === 'HIGH'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300'
                          : severityUpper === 'MEDIUM'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/80 dark:text-yellow-300 border-yellow-300'
                          : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300';

                      const scanTypeDisplay = finding.scanType || finding.type || 'SAST';
                      
                      // Score formatting (supports both 0-10 and 0-1000 scales)
                      const rawScore = finding.riskScore !== undefined ? finding.riskScore : finding.findingScore;
                      const scoreDisplay = rawScore !== undefined ? (rawScore >= 100 ? String(Math.round(rawScore)) : Number(rawScore).toFixed(1)) : undefined;
                      const isScoreHigh = rawScore !== undefined && (rawScore >= 500 || rawScore >= 7.5);
                      const isScoreCritical = rawScore !== undefined && (rawScore >= 600 || rawScore >= 9.0);
                      const riskScoreBg = isScoreCritical 
                        ? 'bg-rose-600 text-white' 
                        : isScoreHigh 
                        ? 'bg-amber-500 text-slate-950 font-bold' 
                        : 'bg-slate-700 text-slate-100';

                      const statusUpper = (finding.status || finding.ticketStatus || 'OPEN').toUpperCase();
                      const isResolved = isFindingResolved(finding);
                      const isBlockingGate = !isResolved && (severityUpper === 'CRITICAL' || severityUpper === 'HIGH');
                      
                      const statusBg = isResolved
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                        : isBlockingGate
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800';

                      const findingTitle = finding.title || finding.description?.split('\n')[0].replace(/^\*\*Policy name:\*\*\s*/, '') || 'Security Finding';

                      return (
                        <React.Fragment key={finding.finding_id}>
                          <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span>{finding.finding_id}</span>
                                {finding.findingUrl && (
                                  <a
                                    href={finding.findingUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                    title="Open in ArmorCode"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {scoreDisplay ? (
                                <span className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-black shadow-xs ${riskScoreBg}`}>
                                  {scoreDisplay}
                                </span>
                              ) : (
                                <span className="font-mono text-slate-400 text-[11px]">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${severityBg}`}>
                                {severityUpper}
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                {scanTypeDisplay}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-medium max-w-md">
                              <p className="font-bold text-slate-900 dark:text-slate-100 text-xs line-clamp-1">{findingTitle}</p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                {finding.tool && (
                                  <span className="text-[10px] text-slate-600 dark:text-slate-400 font-mono">
                                    Source: <strong>{finding.tool}</strong>
                                  </span>
                                )}
                                {finding.cve_id && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.2 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 rounded border border-rose-200 dark:border-rose-800">
                                    {finding.cve_id}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              <p className="text-slate-900 dark:text-slate-200 font-bold">{finding.repository || repositoryName || 'All Repos'}</p>
                              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">{finding.cycode_branch || branchName}</p>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="flex flex-col gap-0.5">
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold inline-block text-center ${statusBg}`}>
                                  {statusUpper}
                                </span>
                                {isBlockingGate ? (
                                  <span className="text-[9px] font-mono font-bold text-rose-600 dark:text-rose-400">
                                    ✕ Blocks Promotion
                                  </span>
                                ) : isResolved ? (
                                  <span className="text-[9px] font-mono font-medium text-emerald-600 dark:text-emerald-400">
                                    ✓ Mitigated / Safe
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <button
                                onClick={() => setExpandedFindingId(isExpanded ? null : finding.finding_id)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer"
                              >
                                {isExpanded ? 'Hide Details' : 'View Remediation'}
                              </button>
                            </td>
                          </tr>

                          {/* Expandable Remediation Row */}
                          {isExpanded && (
                            <tr className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
                              <td colSpan={8} className="p-4 space-y-3">
                                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                      <Bug className="w-4 h-4 text-rose-500" />
                                      <span>Remediation Guidance & Vulnerability Context</span>
                                    </span>
                                    <div className="flex items-center gap-2 text-[11px] font-mono">
                                      {scoreDisplay && (
                                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                          Risk Score: <strong>{scoreDisplay}</strong>
                                        </span>
                                      )}
                                      {finding.file_path && (
                                        typeof finding.raw_file_path === 'string' && finding.raw_file_path.startsWith('http') ? (
                                          <a
                                            href={finding.raw_file_path}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                          >
                                            <span>{finding.file_path}:{finding.line_number || 1}</span>
                                            <ExternalLink className="w-3 h-3" />
                                          </a>
                                        ) : (
                                          <span className="text-indigo-600 dark:text-indigo-400">
                                            {finding.file_path}:{finding.line_number || 1}
                                          </span>
                                        )
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                                    <p>
                                      <strong>Remediation / Actionable Step:</strong> {finding.remediation}
                                    </p>
                                    {finding.description && finding.description !== finding.remediation && (
                                      <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                                        {finding.description}
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                                    <div className="flex items-center gap-2">
                                      {finding.cve_id && (
                                        <span className="text-[11px] font-mono text-slate-500">
                                          Reference / CVE: <span className="text-rose-500 font-bold">{finding.cve_id}</span>
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {finding.url && (
                                        <a
                                          href={finding.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-[11px] flex items-center gap-1 transition-all"
                                        >
                                          <span>Open in {finding.tool || 'Scanner'}</span>
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                      {finding.findingUrl && (
                                        <a
                                          href={finding.findingUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="px-2.5 py-1 rounded bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-medium text-[11px] flex items-center gap-1 transition-all"
                                        >
                                          <span>Open in ArmorCode</span>
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* SUB-TAB 2: AUDITABLE PROMOTION RECORDS    */}
      {/* ========================================== */}
      {activeSubTab === 'EVIDENCES' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Promotion Records Category KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <button
              onClick={() => setEvidenceCategoryFilter('ALL')}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                evidenceCategoryFilter === 'ALL'
                  ? 'bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 shadow-sm ring-2 ring-indigo-500/20'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">All Certificates</span>
                <Award className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{evidenceCategoryCounts.all}</span>
                <span className="text-[10px] text-slate-400 font-mono">Issued Total</span>
              </div>
            </button>

            <button
              onClick={() => setEvidenceCategoryFilter('STATIC')}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                evidenceCategoryFilter === 'STATIC'
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 shadow-sm ring-2 ring-emerald-500/20'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Static Scan Gates</span>
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{evidenceCategoryCounts.static}</span>
                <span className="text-[10px] text-slate-400 font-mono">SAST / SCA / Secrets</span>
              </div>
            </button>

            <button
              onClick={() => setEvidenceCategoryFilter('CONTAINER')}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                evidenceCategoryFilter === 'CONTAINER'
                  ? 'bg-cyan-50/80 dark:bg-cyan-950/60 border-cyan-300 dark:border-cyan-700 shadow-sm ring-2 ring-cyan-500/20'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Container Gates</span>
                <Layers className="w-4 h-4 text-cyan-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-cyan-600 dark:text-cyan-400">{evidenceCategoryCounts.container}</span>
                <span className="text-[10px] text-slate-400 font-mono">Aqua Images</span>
              </div>
            </button>

            <button
              onClick={() => setEvidenceCategoryFilter('DYNAMIC')}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                evidenceCategoryFilter === 'DYNAMIC'
                  ? 'bg-purple-50/80 dark:bg-purple-950/60 border-purple-300 dark:border-purple-700 shadow-sm ring-2 ring-purple-500/20'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Dynamic Gates</span>
                <Zap className="w-4 h-4 text-purple-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-purple-600 dark:text-purple-400">{evidenceCategoryCounts.dynamic}</span>
                <span className="text-[10px] text-slate-400 font-mono">DAST & APIs</span>
              </div>
            </button>
          </div>

          {/* Records Search & Filter Toolbar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={evidenceSearchTerm}
                onChange={(e) => setEvidenceSearchTerm(e.target.value)}
                placeholder="Search evidences by ID, project, repo, branch, version, or category..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={evidenceCategoryFilter}
                onChange={(e) => setEvidenceCategoryFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 outline-none font-medium cursor-pointer"
              >
                <option value="ALL">All Categories ({evidenceCategoryCounts.all})</option>
                <option value="STATIC">Static Scan Reports ({evidenceCategoryCounts.static})</option>
                <option value="CONTAINER">Container Security Reports ({evidenceCategoryCounts.container})</option>
                <option value="DYNAMIC">Dynamic Scan Reports ({evidenceCategoryCounts.dynamic})</option>
              </select>

              <select
                value={evidenceStatusFilter}
                onChange={(e) => setEvidenceStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 outline-none font-medium cursor-pointer"
              >
                <option value="ALL">All Gate Statuses</option>
                <option value="ISSUED">ISSUED (Active Certificate)</option>
                <option value="REVOKED">REVOKED</option>
              </select>

              <button
                onClick={refreshEvidences}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Logs</span>
              </button>

              {evidenceList.length > 0 && (
                <button
                  onClick={handleClearAllEvidences}
                  className="px-3.5 py-2 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-rose-200 dark:border-rose-800"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All Certificates</span>
                </button>
              )}
            </div>
          </div>

          {/* Evidence Records Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider font-mono border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3.5 px-4">Evidence ID</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Project / Repository</th>
                    <th className="py-3.5 px-4">Branch & Version</th>
                    <th className="py-3.5 px-4">Target Env</th>
                    <th className="py-3.5 px-4">Gate Compliance</th>
                    <th className="py-3.5 px-4">Issued By & Time</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {filteredEvidences.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-slate-400">
                        <Award className="w-10 h-10 text-slate-400 mx-auto mb-2 opacity-50" />
                        <p className="font-bold text-sm text-slate-700 dark:text-slate-300">No Auditable Promotion Evidences Found</p>
                        <p className="text-xs text-slate-500 mt-1">Run an ArmorCode scan query and click "Generate Promotion Evidence" when compliant.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredEvidences.map((ev) => {
                      const isRevoked = ev.status === 'REVOKED';
                      const evCat = getEvidenceCategory(ev);

                      return (
                        <tr key={ev.evidenceId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <FileCheck className="w-4 h-4 text-emerald-500" />
                              <span>{ev.evidenceId}</span>
                            </div>
                            <span className="text-[9px] font-mono text-slate-400 block truncate max-w-[120px]">{ev.verificationHash}</span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {evCat === 'CONTAINER' ? (
                              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 flex items-center gap-1.5 w-fit">
                                <Layers className="w-3 h-3 text-cyan-500" />
                                <span>Container Security</span>
                              </span>
                            ) : evCat === 'DYNAMIC' ? (
                              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1.5 w-fit">
                                <Zap className="w-3 h-3 text-purple-500" />
                                <span>Dynamic Scan (DAST)</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 w-fit">
                                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                                <span>Static Scan (SAST/SCA)</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            <p>{ev.project}</p>
                            <p className="text-[10px] text-slate-500 font-mono font-normal">{ev.repository}</p>
                            {ev.applicationName && (
                              <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[9px] font-mono font-bold">
                                App: {ev.applicationName}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            <p className="font-bold text-indigo-600 dark:text-indigo-400">{ev.branch}</p>
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400">
                              {ev.releaseVersion}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              {ev.targetEnvironment}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {isRevoked ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300">
                                REVOKED
                              </span>
                            ) : ev.complianceStatus === 'ADMIN_OVERRIDE' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                                ADMIN OVERRIDE
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                                GATE PASSED (0 Crit / 0 High)
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400 text-[11px] whitespace-nowrap">
                            <p className="font-bold text-slate-800 dark:text-slate-200">{ev.createdBy}</p>
                            <p className="text-[10px] text-slate-500">{new Date(ev.createdAt).toLocaleString()}</p>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1.5">
                            <button
                              onClick={() => setViewingEvidence(ev)}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer"
                            >
                              Inspect Certificate
                            </button>
                            {!isRevoked && (
                              <button
                                onClick={() => handleRevokeEvidence(ev.evidenceId)}
                                className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-950 text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-300 text-xs rounded-lg transition-all cursor-pointer"
                                title="Revoke Certificate"
                              >
                                Revoke
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteEvidence(ev.evidenceId)}
                              className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 text-xs rounded-lg transition-all cursor-pointer"
                              title="Delete Certificate"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 1: GENERATE PROMOTION EVIDENCE FORM */}
      {/* ========================================== */}
      {promotionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Issue Auditable Promotion Evidence
                </h3>
              </div>
              <button
                onClick={() => setPromotionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateEvidenceSubmit} className="space-y-4 text-xs">
              
              {/* Scan Category Indicator */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-600 dark:text-slate-400">Report Category:</span>
                {reportType === 'CONTAINER' ? (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    <span>Container Security Report (Aqua)</span>
                  </span>
                ) : reportType === 'DYNAMIC' ? (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>Dynamic Scan Report (DAST)</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Static Scan Report (SAST/SCA/Secrets)</span>
                  </span>
                )}
              </div>

              {/* Snapshot metadata summary */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 font-mono">
                <div className="flex justify-between text-slate-700 dark:text-slate-300 font-bold">
                  <span>Project / Repo:</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{projectName} / {repositoryName || 'ALL'}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Branch (cycode_branch):</span>
                  <span>{branchName || 'master'}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Scan Snapshot:</span>
                  <span>{rawFindings.length} Total Findings (0 Critical / 0 High)</span>
                </div>
              </div>

              {/* Mapped Application in Inventory (Optional) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    Mapped Application in Inventory <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  {selectedAppId && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                      Mapped
                    </span>
                  )}
                </div>
                <select
                  value={selectedAppId}
                  onChange={(e) => setSelectedAppId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-medium outline-none"
                >
                  <option value="">-- None / Unmapped (Not registered in App Database) --</option>
                  {applications && applications.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name} ({app.code}) - Tier {app.tier}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Associates this evidence record directly with an application in your Application Database.
                </p>
              </div>

              {/* Target Environment */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">Target Promotion Pipeline Environment</label>
                <select
                  value={targetEnv}
                  onChange={(e) => setTargetEnv(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-medium outline-none"
                >
                  <option value="Staging -> Production">Staging → Production (Main Gate)</option>
                  <option value="QA -> UAT">QA → UAT Environment</option>
                  <option value="UAT -> Production">UAT → Production Release</option>
                  <option value="Development -> Staging">Development → Staging</option>
                </select>
              </div>

              {/* Release Version */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">Release Build / Tag Version</label>
                <input
                  type="text"
                  value={releaseVersion}
                  onChange={(e) => setReleaseVersion(e.target.value)}
                  placeholder="e.g. v2.4.0-rc1, build-90412"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono outline-none"
                />
              </div>

              {/* Admin Override Reason if non-compliant */}
              {isAdminOverride && (
                <div className="space-y-1 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-xl">
                  <label className="font-bold text-amber-800 dark:text-amber-300 block flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Admin Exception Rationale (Required for Non-Zero Gate)</span>
                  </label>
                  <textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Provide mandatory business rationale or mitigating controls for bypassing gate threshold..."
                    required={isAdminOverride}
                    rows={2}
                    className="w-full px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs outline-none"
                  />
                </div>
              )}

              {/* Approval Notes / Rationale */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">Approval Rationale & Auditor Sign-off</label>
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPromotionModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Award className="w-4 h-4 text-amber-300" />
                  <span>Sign & Issue Evidence</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 2: INSPECT PROMOTION EVIDENCE CERT   */}
      {/* ========================================== */}
      {viewingEvidence && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 text-slate-100 shadow-2xl space-y-6 my-8">
            
            {/* Certificate Official Header */}
            <div className="text-center border-b border-slate-800 pb-5 space-y-2 relative">
              <button
                onClick={() => setViewingEvidence(null)}
                className="absolute top-0 right-0 text-slate-400 hover:text-slate-100 font-bold cursor-pointer"
              >
                ✕
              </button>
              
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 via-indigo-500 to-emerald-500 p-0.5 shadow-xl">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <Award className="w-7 h-7 text-amber-400" />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest bg-emerald-950 text-emerald-400 border border-emerald-800/80 inline-block">
                  OFFICIAL PROMOTION PASSPORT & EVIDENCE CERTIFICATE
                </span>

                {getEvidenceCategory(viewingEvidence) === 'CONTAINER' ? (
                  <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Container Security Report (Aqua)</span>
                  </span>
                ) : getEvidenceCategory(viewingEvidence) === 'DYNAMIC' ? (
                  <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-purple-400" />
                    <span>Dynamic Scan Report (DAST)</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Static Scan Report (SAST/SCA)</span>
                  </span>
                )}
              </div>

              <h2 className="text-xl font-black text-slate-100 tracking-tight">
                {viewingEvidence.project}
              </h2>

              <p className="text-xs text-slate-400 font-mono">
                Evidence ID: <strong className="text-amber-400">{viewingEvidence.evidenceId}</strong> | SHA256: <code className="text-indigo-300">{viewingEvidence.verificationHash}</code>
              </p>
            </div>

            {/* Certificate Details Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Target Pipeline</span>
                <span className="text-slate-200 font-bold text-sm">{viewingEvidence.targetEnvironment}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Release Version</span>
                <span className="text-indigo-400 font-bold text-sm">{viewingEvidence.releaseVersion}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Repository & Branch</span>
                <span className="text-slate-200">{viewingEvidence.repository} ({viewingEvidence.branch})</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Issued By</span>
                <span className="text-emerald-400">{viewingEvidence.createdBy} ({viewingEvidence.createdRole})</span>
              </div>
            </div>

            {/* Scan Snapshot & Compliance Status */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2 text-xs">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="font-bold text-slate-300 font-mono uppercase text-[10px]">
                  ArmorCode Scan Snapshot Metrics
                </span>
                <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                  viewingEvidence.status === 'REVOKED'
                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                }`}>
                  STATUS: {viewingEvidence.status}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center py-1">
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                  <span className="text-[9px] text-rose-400 block font-mono uppercase">Critical</span>
                  <span className="text-base font-black text-slate-100">{viewingEvidence.findingCounts.critical}</span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                  <span className="text-[9px] text-amber-400 block font-mono uppercase">High</span>
                  <span className="text-base font-black text-slate-100">{viewingEvidence.findingCounts.high}</span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                  <span className="text-[9px] text-slate-400 block font-mono uppercase">Medium</span>
                  <span className="text-base font-black text-slate-100">{viewingEvidence.findingCounts.medium}</span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                  <span className="text-[9px] text-slate-400 block font-mono uppercase">Low / Info</span>
                  <span className="text-base font-black text-slate-100">{viewingEvidence.findingCounts.low + viewingEvidence.findingCounts.info}</span>
                </div>
              </div>

              <div className="pt-2 text-slate-300 font-sans space-y-1">
                <p className="text-[11px]"><strong>Sign-off Rationale:</strong> {viewingEvidence.approvalNotes}</p>
                <p className="text-[10px] text-slate-500 font-mono">Issued at: {new Date(viewingEvidence.createdAt).toUTCString()}</p>
              </div>
            </div>

            {/* Saved API Response Snapshot Viewer */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3 text-xs">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-slate-200 font-mono text-[11px]">
                    Saved ArmorCode API Response Snapshot
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-bold">
                    HTTP 200 OK
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const dataToCopy = viewingEvidence.apiResponseSnapshot || {
                        results: viewingEvidence.snapshotFindings,
                        payload: viewingEvidence.snapshotPayload,
                        endpoint: viewingEvidence.apiEndpointUsed
                      };
                      navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
                      alert('API Response Snapshot JSON copied to clipboard!');
                    }}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy Raw JSON</span>
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 font-mono flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>Endpoint: <code className="text-indigo-400">{viewingEvidence.apiEndpointUsed || 'https://app.armorcode.com/user/findings/'}</code></span>
                <span>Snapshot Findings Count: <strong className="text-emerald-400">{viewingEvidence.snapshotFindings?.length ?? viewingEvidence.findingCounts.total}</strong></span>
              </div>

              <div className="max-h-48 overflow-y-auto bg-slate-900/90 rounded-lg p-3 border border-slate-800 text-[10px] font-mono text-slate-300">
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(viewingEvidence.apiResponseSnapshot || {
                    query: viewingEvidence.snapshotPayload,
                    findingsCount: viewingEvidence.snapshotFindings?.length || 0,
                    findings: viewingEvidence.snapshotFindings || []
                  }, null, 2)}
                </pre>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadEvidenceJSON(viewingEvidence)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Export JSON Evidence</span>
                </button>
                <button
                  onClick={() => handleDeleteEvidence(viewingEvidence.evidenceId)}
                  className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-rose-800"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Delete</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Print Certificate</span>
                </button>
                <button
                  onClick={() => setViewingEvidence(null)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
