# Enterprise Application Security Criticality & ASPM Governance Platform

A full-stack enterprise application security posture management (ASPM) and criticality tiering platform. This system provides centralized inventory management, Appendix II criticality scoring, self-service developer assessments, AppSec review workflows, Azure AD SSO & SCIM 2.0 identity integration, and automated ArmorCode zero-critical security gate promotion evidence generation.

---

## 🌟 Core Features & Modules

### 1. 🛡️ Application Criticality Inventory & Assessment Matrix
- **Automated Appendix II Criticality Scoring**: Calculates weighted risk scores (0.0 to 12.0) across 5 core risk factors:
  - Processes & Sensitive Data Classification (32.5% weight)
  - Network Exposure & Internet Access (32.5% weight)
  - History of Cyber Attacks (15.0% weight)
  - System Stability & New Development (10.0% weight)
  - System Downtime Impact (10.0% weight)
- **4-Tier Classification System**:
  - **Tier 1 (Critical)**: Score ≥ 9.0 (24h RTO / 1h RPO)
  - **Tier 2 (High)**: Score 6.0 – 8.9 (48h RTO / 4h RPO)
  - **Tier 3 (Medium)**: Score 3.0 – 5.9 (72h RTO / 12h RPO)
  - **Tier 4 (Low)**: Score < 3.0 (168h RTO / 24h RPO)
- **Comprehensive Lifecycle Tracking**: Manage hosting environments, regulatory compliance mandates (PCI-DSS, SOC2, HIPAA, ISO27001), IT/AppSec owners, and third-party dependencies.
- **Data Export & Backup**: Full database JSON backup/restore and CSV inventory export.

---

### 2. 🛡️ ArmorCode ASPM Security Reports & Promotion Gate
- **Live ArmorCode API Integration**: Query security findings by Project, Sub-Product/Repository, Environment, Severity, and Status directly from ArmorCode ASPM endpoints.
- **Zero-Critical Security Gate Policy**: Evaluates codebases against production promotion policies (enforcing 0 open Critical vulnerabilities).
- **Digitally Signed Auditable Evidence**: Generates cryptographically hashed (HMAC-SHA256) **Promotion Gate Certificates** ("Passports") capturing snapshot findings, release version, branch, and issuer signature.
- **Application Inventory Association**: Optionally link promotion evidence certificates directly to registered applications in the database, viewable via a dedicated inspector tab.

---

### 3. 🔑 Azure AD (Entra ID) SSO & SCIM 2.0 Provisioning
- **Enterprise Single Sign-On (SSO)**: Live OIDC/OAuth2 authentication with Azure Active Directory / Entra ID, including fallback mock login for localized sandbox testing.
- **SCIM 2.0 Protocol Engine**: Standard `/api/scim/v2/Users` and `/api/scim/v2/Groups` REST endpoints supporting automated enterprise user lifecycle management (Provision, Update, Deprovision).
- **Group-to-Role Mapping**: Automatically assign RBAC roles based on Azure AD Security Group memberships.
- **Manual Role Overrides**: Admin controls for individual user role assignments and session tracking.

---

### 4. 📝 Self-Service Rating & Review Workflows
- **Developer Portal**: Application owners can submit new application criticality self-assessments via guided questionnaires.
- **AppSec Review Queue**: AppSec Managers review, approve, reject, or request changes on pending assessments before committing them to the official application inventory.

---

### 5. 🔐 Role-Based Access Control (RBAC) & Governance
- **5 Built-in System Roles**:
  - `APPSEC_ADMIN`: Full administrative control over inventory, settings, SSO, and review queue.
  - `IT_OPS_LEAD`: Operations management and RTO/RPO SLA oversight.
  - `APPLICATION_OWNER`: Self-assessment submissions and application management.
  - `COMPLIANCE_AUDITOR`: Read-only access to audit trails, SOPs, and promotion evidence certificates.
  - `READ_ONLY`: View-only dashboard access.
- **Dynamic RBAC Matrix**: Visual view of module permissions per role with custom policy modification capabilities.

---

### 6. 📜 Governance SOP & Compliance Audit Logging
- **Versioned SOP Repository**: Interactive viewer for standard operating procedures (v2.4) with multi-version historical document management.
- **Immutable Audit Trail**: Logs all system events, risk score modifications, assessment approvals, security gate certifications, and SCIM provisioning events.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide React Icons, Recharts.
- **Backend / API**: Node.js, Express, Vite middleware.
- **Database Support**: Dual persistence engine supporting client-side LocalStorage and server-side PostgreSQL integration.
- **Build System**: Vite & Esbuild bundled CJS server distribution.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation
```bash
# Install dependencies
npm install

# Start the dev server (Express + Vite on port 3000)
npm run dev
```

### Environment Configuration
Copy `.env.example` to `.env` and supply optional credentials:
```env
PORT=3000
NODE_ENV=development
AZURE_TENANT_ID=your_azure_tenant_id
AZURE_CLIENT_ID=your_azure_client_id
AZURE_CLIENT_SECRET=your_azure_client_secret
```

---

## 📄 License
Internal Enterprise License — All rights reserved.
