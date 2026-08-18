import pg from 'pg';
import appSettings from '../appsettings.json';

const { Pool } = pg;

// PostgreSQL Connection Configuration reading from appsettings.json
const dbConfig = {
  host: process.env.DB_HOST || appSettings.Database?.Host || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || String(appSettings.Database?.Port || 5432), 10),
  database: process.env.DB_NAME || appSettings.Database?.DatabaseName || 'app_db',
  user: process.env.DB_USER || appSettings.Database?.User || 'admin',
  password: process.env.DB_PASSWORD || appSettings.Database?.Password || 'P@ssw0rd',
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 10000,
};

let pool: pg.Pool | null = null;
let isConnected = false;
let lastTestedAt = 0;
let dbError: string | null = null;
const RETRY_COOLDOWN_MS = 30000; // 30 seconds before re-testing offline DB

export function getDbPool(): pg.Pool {
  if (!pool) {
    pool = new Pool(dbConfig);
    pool.on('error', (err) => {
      isConnected = false;
      dbError = err.message;
    });
  }
  return pool;
}

export function isDbConnected(): boolean {
  return isConnected;
}

export async function testDbConnection(): Promise<{ connected: boolean; message: string; config: typeof dbConfig }> {
  lastTestedAt = Date.now();
  try {
    const p = getDbPool();
    const client = await p.connect();
    const res = await client.query('SELECT NOW() as current_time, current_database() as db_name, current_user as db_user');
    client.release();
    isConnected = true;
    dbError = null;
    return {
      connected: true,
      message: `Successfully connected to on-prem PostgreSQL database "${res.rows[0].db_name}" as user "${res.rows[0].db_user}" at ${dbConfig.host}:${dbConfig.port}`,
      config: dbConfig
    };
  } catch (err: any) {
    isConnected = false;
    dbError = err.message || 'Connection failed';
    return {
      connected: false,
      message: `On-Premises PostgreSQL (127.0.0.1:5432/app_db) unreachable: ${dbError}. Operating in resilient local storage buffer mode.`,
      config: dbConfig
    };
  }
}

export async function safeDbQuery(text: string, params?: any[]): Promise<pg.QueryResult | null> {
  const now = Date.now();
  // If disconnected and within cooldown, skip query without attempting TCP socket
  if (!isConnected && (now - lastTestedAt < RETRY_COOLDOWN_MS)) {
    return null;
  }

  try {
    const p = getDbPool();
    const result = await p.query(text, params);
    isConnected = true;
    dbError = null;
    return result;
  } catch (err: any) {
    isConnected = false;
    lastTestedAt = Date.now();
    dbError = err.message;
    return null;
  }
}

export async function initDbTables(): Promise<boolean> {
  try {
    const p = getDbPool();
    await p.query(`
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

      CREATE TABLE IF NOT EXISTS sop_documents (
        id VARCHAR(100) PRIMARY KEY,
        active_version VARCHAR(50),
        history JSONB DEFAULT '[]'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

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
        title VARCHAR(255),
        iam_status VARCHAR(50) DEFAULT 'ACTIVE',
        added_to_iam_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        added_by_iam_admin VARCHAR(255) DEFAULT 'AppSec Administrator'
      );

      CREATE TABLE IF NOT EXISTS manual_user_mappings (
        id VARCHAR(100) PRIMARY KEY,
        email_or_upn VARCHAR(255) UNIQUE NOT NULL,
        assigned_role VARCHAR(50) NOT NULL,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_by VARCHAR(255),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        iam_status VARCHAR(50) DEFAULT 'ACTIVE'
      );

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

      CREATE TABLE IF NOT EXISTS promotion_evidences (
        evidence_id VARCHAR(100) PRIMARY KEY,
        project VARCHAR(255),
        repository VARCHAR(255),
        branch VARCHAR(255),
        target_environment VARCHAR(100),
        status VARCHAR(50) DEFAULT 'ISSUED',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        evidence_data JSONB DEFAULT '{}'::jsonb
      );
    `);
    isConnected = true;
    console.log('PostgreSQL database tables initialized successfully for app_db.');
    
    // Auto seed initialData into database if empty
    await seedInitialData();

    return true;
  } catch (err: any) {
    console.warn('PostgreSQL table initialization skipped/failed:', err.message);
    isConnected = false;
    dbError = err.message;
    return false;
  }
}

export async function seedInitialData(force: boolean = false): Promise<{ success: boolean; seeded: Record<string, number> }> {
  const pool = getDbPool();
  const counts = { apps: 0, sop: 0, logs: 0, pending: 0 };

  try {
    if (force) {
      await pool.query('TRUNCATE TABLE applications, sop_documents, audit_logs, pending_assessments RESTART IDENTITY');
    }

    // Seed default SOP document structure if empty
    const sopCountRes = await pool.query('SELECT COUNT(*) FROM sop_documents');
    if (force || parseInt(sopCountRes.rows[0].count, 10) === 0) {
      const defaultSopHistory = [{
        version: 'v1.0.0',
        title: 'Standard Operating Procedure for Application Criticality Rating',
        content: 'Standard operating procedure document for application security criticality evaluation.',
        uploadedBy: 'AppSec Lead',
        uploadedAt: new Date().toISOString(),
        changeSummary: 'Initial System SOP Setup',
        fileName: 'sop-v1.0.0.pdf'
      }];
      await pool.query(
        `INSERT INTO sop_documents (id, active_version, history, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (id) DO NOTHING`,
        ['MAIN_SOP', 'v1.0.0', JSON.stringify(defaultSopHistory)]
      );
      counts.sop = 1;
    }

    console.log(`[PostgreSQL DB Init] Database initialized: ${JSON.stringify(counts)}`);
    return { success: true, seeded: counts };
  } catch (err: any) {
    console.warn('[PostgreSQL DB Init] Warning:', err.message);
    return { success: false, seeded: counts };
  }
}

export function getDbStatusInfo() {
  return {
    configuredHost: dbConfig.host,
    configuredPort: dbConfig.port,
    configuredDatabase: dbConfig.database,
    configuredUser: dbConfig.user,
    connectionString: `postgres://${dbConfig.user}:*****@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`,
    isConnected,
    lastError: dbError
  };
}

