import {
  ArmorCodeQueryRequest,
  ArmorCodeQueryResponse,
  ArmorCodeFinding,
  ArmorCodeProduct,
  ArmorCodeSubproduct,
  ArmorCodeProductsResponse,
  ArmorCodeSubproductsResponse,
  ArmorCodeProductElasticQuery
} from '../types';
import appSettings from '../../appsettings.json';

export async function fetchArmorCodeProducts(
  apiKey?: string,
  customEndpoint?: string,
  elasticQuery?: ArmorCodeProductElasticQuery
): Promise<ArmorCodeProductsResponse> {
  const defaultEndpoint = appSettings.ArmorCode?.ProductApiEndpoint || 'https://app.armorcode.com/user/product/elastic/paged';
  const targetEndpoint = customEndpoint || defaultEndpoint;

  // Elastic paged query payload specification
  const payload = {
    environmentName: elasticQuery?.environmentName || ['PRODUCTION'],
    pageSize: elasticQuery?.pageSize ?? 20,
    pageNumber: elasticQuery?.pageNumber ?? 0,
    sortBy: elasticQuery?.sortBy || 'NAME',
    search: elasticQuery?.search ?? 'testing',
    direction: elasticQuery?.direction || 'ASC',
    apiKey,
    customEndpoint: targetEndpoint
  };

  try {
    const res = await fetch('/api/armorcode/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return {
        success: false,
        products: [],
        source: 'FALLBACK',
        errorMessage: `HTTP ${res.status}: ${res.statusText}`,
        endpointUsed: targetEndpoint
      };
    }

    const data = await res.json();
    return data;
  } catch (error: any) {
    return {
      success: false,
      products: [],
      source: 'FALLBACK',
      errorMessage: error.message || 'Failed to fetch ArmorCode products',
      endpointUsed: targetEndpoint
    };
  }
}

export async function fetchArmorCodeSubproducts(
  productId?: string | number | (string | number)[],
  project?: string,
  apiKey?: string,
  customEndpoint?: string,
  search?: string
): Promise<ArmorCodeSubproductsResponse> {
  const defaultEndpoint = appSettings.ArmorCode?.SubproductApiEndpoint || 'https://app.armorcode.com/api/dashboard/sub-product/name-id';
  const targetEndpoint = customEndpoint || defaultEndpoint;

  // Format productId as array of strings e.g. ["385162"]
  const productIds: string[] = [];
  if (Array.isArray(productId)) {
    productId.forEach(id => {
      if (id !== undefined && id !== null && String(id).trim()) {
        productIds.push(String(id).trim());
      }
    });
  } else if (productId !== undefined && productId !== null && String(productId).trim()) {
    productIds.push(String(productId).trim());
  }

  const payload = {
    productId: productIds,
    project,
    search,
    apiKey,
    customEndpoint: targetEndpoint
  };

  try {
    const res = await fetch('/api/armorcode/subproducts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return {
        success: false,
        subproducts: [],
        source: 'FALLBACK',
        errorMessage: `HTTP ${res.status}: ${res.statusText}`,
        endpointUsed: targetEndpoint
      };
    }

    const data = await res.json();
    return data;
  } catch (error: any) {
    return {
      success: false,
      subproducts: [],
      source: 'FALLBACK',
      errorMessage: error.message || 'Failed to fetch ArmorCode subproducts',
      endpointUsed: targetEndpoint
    };
  }
}

export async function fetchArmorCodeFindings(
  query: ArmorCodeQueryRequest
): Promise<ArmorCodeQueryResponse> {
  try {
    const res = await fetch('/api/armorcode/findings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        source: 'FALLBACK_DEMO',
        endpointUsed: query.customEndpoint || appSettings.ArmorCode?.ApiEndpoint || 'https://app.armorcode.com/api/findings',
        httpStatus: res.status,
        payloadSent: constructArmorCodePayload(query),
        results: [],
        errorMessage: `HTTP ${res.status}: ${errText || res.statusText}`,
        timestamp: new Date().toISOString()
      };
    }

    const data: ArmorCodeQueryResponse = await res.json();
    return data;
  } catch (error: any) {
    return {
      success: false,
      source: 'FALLBACK_DEMO',
      endpointUsed: query.customEndpoint || appSettings.ArmorCode?.ApiEndpoint || 'https://app.armorcode.com/api/findings',
      httpStatus: 0,
      payloadSent: constructArmorCodePayload(query),
      results: [],
      errorMessage: error.message || 'Network error connecting to ArmorCode API proxy handler',
      timestamp: new Date().toISOString()
    };
  }
}

export const DEFAULT_ARMORCODE_SCAN_TYPES = [
  "SAST",
  "SCA",
  "Secrets"
];

export function constructArmorCodePayload(query: ArmorCodeQueryRequest): Record<string, any> {
  // Extract product ID (number or string)
  let productFilter: (number | string)[] = [];
  if (query.productId !== undefined && query.productId !== '') {
    const num = Number(query.productId);
    productFilter = [!isNaN(num) && String(num) === String(query.productId).trim() ? num : query.productId];
  } else if (query.project) {
    const num = Number(query.project);
    productFilter = [!isNaN(num) ? num : query.project];
  }

  // Extract subProduct IDs
  let subProductFilter: (number | string)[] = [];
  if (query.subProductIds && query.subProductIds.length > 0) {
    subProductFilter = query.subProductIds.map(id => {
      const num = Number(id);
      return !isNaN(num) && String(num) === String(id).trim() ? num : id;
    });
  } else if (query.repositories && query.repositories.length > 0) {
    subProductFilter = query.repositories.map(r => {
      const num = Number(r);
      return !isNaN(num) ? num : r;
    });
  } else if (query.repository && query.repository.trim() !== '') {
    const num = Number(query.repository);
    subProductFilter = [!isNaN(num) ? num : query.repository.trim()];
  }

  const rawBranch = (query.cycode_branch || 'main').replace(/^"|"$/g, '').trim();
  const formattedBranchValue = `\"${rawBranch}\"`;
  const branchKey = appSettings.ArmorCode?.DefaultBranchKey || '\"custom_cycode_branch\"';

  // Construct filters object according to ArmorCode user/findings payload specification
  const filters: Record<string, any> = {
    product: productFilter,
    ...(subProductFilter.length > 0 ? { subProduct: subProductFilter } : {}),
    keyValue: [
      {
        key: branchKey,
        value: formattedBranchValue
      }
    ],
    scanType: query.scanTypes && query.scanTypes.length > 0 ? query.scanTypes : (appSettings.ArmorCode?.DefaultScanTypes || DEFAULT_ARMORCODE_SCAN_TYPES)
  };

  const payload: Record<string, any> = {
    size: query.size || 100,
    sortColumns: [
      {
        property: "riskScore",
        direction: "desc"
      }
    ],
    filters,
    filterOperations: {},
    page: query.page || 0,
    ticketStatusRequired: true,
    commentCountRequired: true,
    addLastResolutionNote: false,
    ignoreMitigated: null,
    ignoreDuplicate: true,
    timezone: query.timezone || appSettings.ArmorCode?.DefaultTimezone || "Asia/Shanghai"
  };

  return payload;
}

export function exportArmorCodeFindingsCSV(findings: ArmorCodeFinding[], projectName: string): void {
  if (!findings || findings.length === 0) return;

  const headers = ['Finding ID', 'Type / ScanType', 'Severity', 'Risk Score', 'Project / Product', 'Repository / SubProduct', 'Branch', 'Description', 'Remediation', 'Tool', 'CVE / CWE', 'File Path', 'Ticket Status'];
  const rows = findings.map(f => [
    f.finding_id,
    (f.scanType || f.type || 'SAST').toUpperCase(),
    f.severity || 'MEDIUM',
    f.riskScore !== undefined ? String(f.riskScore) : 'N/A',
    f.project || f.product || projectName,
    f.repository || f.subProduct || 'N/A',
    f.cycode_branch || 'main',
    `"${(f.description || '').replace(/"/g, '""')}"`,
    `"${(f.remediation || '').replace(/"/g, '""')}"`,
    f.tool || 'Cycode / ArmorCode Scanner',
    f.cve_id || 'N/A',
    f.file_path ? `${f.file_path}:${f.line_number || 1}` : 'N/A',
    f.ticketStatus || f.status || 'OPEN'
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `ArmorCode_Security_Report_${projectName}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
