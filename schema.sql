-- ====================================================================
-- On-Premises PostgreSQL Database Schema & Initial Data Seeding
-- Database Name: app_db
-- Connection: postgres://admin:P@ssw0rd@127.0.0.1:5432/app_db
-- ====================================================================

-- 1. Create Applications Table
CREATE TABLE IF NOT EXISTS applications (
  id VARCHAR(100) PRIMARY KEY,
  code VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  tier VARCHAR(10),
  rating VARCHAR(10),
  calculated_score NUMERIC(5,2),
  department VARCHAR(100),
  owner_app_sec VARCHAR(255),
  owner_it VARCHAR(255),
  hosting_env VARCHAR(255),
  data_classification VARCHAR(100),
  rto VARCHAR(100),
  rpo VARCHAR(100),
  internet_exposed BOOLEAN DEFAULT FALSE,
  is_gaming_network BOOLEAN DEFAULT FALSE,
  third_party_integrations JSONB DEFAULT '[]'::jsonb,
  compliance_requirements JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(50) DEFAULT 'ACTIVE',
  factors JSONB DEFAULT '{}'::jsonb,
  last_assessed TIMESTAMP WITH TIME ZONE,
  assessed_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- 2. Create SOP Documents Table
CREATE TABLE IF NOT EXISTS sop_documents (
  id VARCHAR(100) PRIMARY KEY,
  active_version VARCHAR(50),
  history JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(100) PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_name VARCHAR(255),
  role VARCHAR(50),
  action VARCHAR(100),
  details TEXT,
  app_id VARCHAR(100),
  app_name VARCHAR(255)
);

-- 4. Create Pending Assessments Table
CREATE TABLE IF NOT EXISTS pending_assessments (
  id VARCHAR(100) PRIMARY KEY,
  app_id VARCHAR(100),
  app_code VARCHAR(100),
  app_name VARCHAR(255),
  description TEXT,
  department VARCHAR(100),
  owner_it VARCHAR(255),
  owner_app_sec VARCHAR(255),
  submitter_name VARCHAR(255),
  submitter_email VARCHAR(255),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_classification VARCHAR(100),
  hosting_env VARCHAR(255),
  rto VARCHAR(100),
  rpo VARCHAR(100),
  internet_exposed BOOLEAN DEFAULT FALSE,
  factors JSONB DEFAULT '{}'::jsonb,
  calculated_score NUMERIC(5,2),
  proposed_tier VARCHAR(10),
  status VARCHAR(50) DEFAULT 'PENDING_REVIEW',
  notes TEXT,
  comments JSONB DEFAULT '[]'::jsonb,
  admin_decision_by VARCHAR(255),
  admin_decision_at TIMESTAMP WITH TIME ZONE,
  admin_decision_notes TEXT
);

-- 5. Create SCIM Users Table
CREATE TABLE IF NOT EXISTS scim_users (
  id VARCHAR(100) PRIMARY KEY,
  external_id VARCHAR(100),
  user_name VARCHAR(255) UNIQUE NOT NULL,
  name_json JSONB DEFAULT '{}'::jsonb,
  emails_json JSONB DEFAULT '[]'::jsonb,
  active BOOLEAN DEFAULT TRUE,
  groups_json JSONB DEFAULT '[]'::jsonb,
  mapped_role VARCHAR(50),
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  department VARCHAR(100),
  title VARCHAR(255)
);

-- 6. Create SCIM Audit Logs Table
CREATE TABLE IF NOT EXISTS scim_audit_logs (
  id VARCHAR(100) PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  method VARCHAR(10),
  endpoint VARCHAR(255),
  status_code INTEGER,
  action VARCHAR(100),
  details TEXT,
  target_user_id VARCHAR(100)
);

-- Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_apps_tier ON applications(tier);
CREATE INDEX IF NOT EXISTS idx_apps_department ON applications(department);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
