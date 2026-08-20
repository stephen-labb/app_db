#!/usr/bin/env bash
# ==============================================================================
# PostgreSQL Automated Backup Script for Docker
# Based on: https://medium.com/@vinayakchittora/backup-and-restore-postgresql-database-using-docker-9e145e974ab6
#
# Usage:
#   ./backup_postgres.sh
#
# Cron Setup (Run daily at 02:00 AM):
#   0 2 * * * /path/to/backup_postgres.sh >> /path/to/backups/backup.log 2>&1
# ==============================================================================

set -eo pipefail

# Determine script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load .env file if present in script directory or current working directory
if [ -f "${SCRIPT_DIR}/.env" ]; then
  # Export variables from .env without overriding existing environment variables
  set -a
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/.env"
  set +a
elif [ -f ".env" ]; then
  set -a
  # shellcheck source=/dev/null
  source ".env"
  set +a
fi

# ==============================================================================
# Configuration Variables (override via environment variables if desired)
# ==============================================================================
CONTAINER_NAME="${CONTAINER_NAME:-appsec_postgres}"
DB_NAME="${DB_NAME:-app_db}"
DB_USER="${DB_USER:-admin}"
BACKUP_DIR="${BACKUP_DIR:-${SCRIPT_DIR}/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# Formatting & Timestamps
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
DATE_HUMAN="$(date +"%Y-%m-%d %H:%M:%S %Z")"
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_backup_${TIMESTAMP}.sql.gz"

# Log helper functions
log_info() {
  echo "[${DATE_HUMAN}] [INFO]  $*"
}

log_error() {
  echo "[${DATE_HUMAN}] [ERROR] $*" >&2
}

log_success() {
  echo "[${DATE_HUMAN}] [SUCCESS] $*"
}

# ==============================================================================
# Pre-flight Validations
# ==============================================================================
log_info "Starting automated PostgreSQL database backup..."
log_info "Container: ${CONTAINER_NAME} | Database: ${DB_NAME} | User: ${DB_USER}"

# Check Docker installation
if ! command -v docker &> /dev/null; then
  log_error "Docker CLI is not installed or not in PATH."
  exit 1
fi

# Check if Docker container is currently running
if ! docker ps --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}\$"; then
  log_error "Docker container '${CONTAINER_NAME}' is not running. Backup aborted."
  exit 1
fi

# Create backup directory if it does not exist
mkdir -p "${BACKUP_DIR}"

# ==============================================================================
# Perform Database Dump & Compression
# ==============================================================================
log_info "Dumping and compressing database to: ${BACKUP_FILE}"

# Execute pg_dump inside container and pipe through gzip
if docker exec -i "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists | gzip > "${BACKUP_FILE}"; then
  # Verify file exists and is not empty
  if [ -s "${BACKUP_FILE}" ]; then
    FILE_SIZE="$(du -h "${BACKUP_FILE}" | cut -f1)"
    log_success "Backup completed successfully! File: ${BACKUP_FILE} (Size: ${FILE_SIZE})"
  else
    log_error "Backup file was created but is empty (0 bytes). Check container logs."
    rm -f "${BACKUP_FILE}"
    exit 1
  fi
else
  log_error "Failed to execute pg_dump inside container '${CONTAINER_NAME}'."
  rm -f "${BACKUP_FILE}"
  exit 1
fi

# ==============================================================================
# Retention Policy - Purge Backups Older Than RETENTION_DAYS
# ==============================================================================
if [ "${RETENTION_DAYS}" -gt 0 ]; then
  log_info "Cleaning up backups older than ${RETENTION_DAYS} days in ${BACKUP_DIR}..."
  DELETED_COUNT=0
  while IFS= read -r old_file; do
    if [ -n "${old_file}" ]; then
      rm -f "${old_file}"
      log_info "Removed expired backup: $(basename "${old_file}")"
      DELETED_COUNT=$((DELETED_COUNT + 1))
    fi
  done < <(find "${BACKUP_DIR}" -type f -name "${DB_NAME}_backup_*.sql.gz" -mtime +"${RETENTION_DAYS}")

  log_info "Retention cleanup finished. Removed ${DELETED_COUNT} old backup(s)."
fi

log_success "PostgreSQL backup job finished."
exit 0
