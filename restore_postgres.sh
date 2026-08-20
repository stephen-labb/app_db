#!/usr/bin/env bash
# ==============================================================================
# PostgreSQL Database Restore Script for Docker
# Based on: https://medium.com/@vinayakchittora/backup-and-restore-postgresql-database-using-docker-9e145e974ab6
#
# Usage:
#   ./restore_postgres.sh /path/to/backup.sql.gz
#   OR (restores latest backup automatically):
#   ./restore_postgres.sh
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load .env file if present
if [ -f "${SCRIPT_DIR}/.env" ]; then
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

CONTAINER_NAME="${CONTAINER_NAME:-appsec_postgres}"
DB_NAME="${DB_NAME:-app_db}"
DB_USER="${DB_USER:-admin}"
BACKUP_DIR="${BACKUP_DIR:-${SCRIPT_DIR}/backups}"

# Determine backup file to restore
BACKUP_FILE="$1"

if [ -z "${BACKUP_FILE}" ]; then
  # Find latest backup in BACKUP_DIR
  LATEST_BACKUP="$(find "${BACKUP_DIR}" -type f -name "${DB_NAME}_backup_*.sql.gz" | sort -r | head -n 1)"
  if [ -n "${LATEST_BACKUP}" ]; then
    BACKUP_FILE="${LATEST_BACKUP}"
    echo "[INFO] No backup file specified. Using latest found: ${BACKUP_FILE}"
  else
    echo "[ERROR] No backup file specified and no backups found in ${BACKUP_DIR}"
    echo "Usage: $0 [/path/to/backup.sql.gz]"
    exit 1
  fi
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "[ERROR] Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "[INFO] Restoring PostgreSQL database '${DB_NAME}' in container '${CONTAINER_NAME}'..."
echo "[INFO] Source file: ${BACKUP_FILE}"

# Check Docker container
if ! docker ps --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}\$"; then
  echo "[ERROR] Container '${CONTAINER_NAME}' is not running."
  exit 1
fi

# Restore depending on compression
if [[ "${BACKUP_FILE}" == *.gz ]]; then
  gunzip -c "${BACKUP_FILE}" | docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}"
else
  docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" < "${BACKUP_FILE}"
fi

echo "[SUCCESS] Database '${DB_NAME}' restored successfully from: ${BACKUP_FILE}"
exit 0
