#!/bin/bash
set -euo pipefail

# ─── NovaCaisse — PostgreSQL Restore Script ───
# Downloads a backup from S3 and restores it to PostgreSQL

# Configuration
DB_USER="${DB_USER:-novacaisse}"
DB_PASSWORD="${DB_PASSWORD:?DB_PASSWORD is required}"
DB_HOST="${DB_HOST:-db}"
DB_NAME="${DB_NAME:-novacaisse}"
S3_BUCKET="${S3_BUCKET:?S3_BUCKET is required}"
S3_ENDPOINT="${S3_ENDPOINT:-}"
RESTORE_DIR="${RESTORE_DIR:-/tmp/restore}"

LOG_PREFIX="[restore $(date +%Y-%m-%d\ %H:%M:%S)]"

log() {
  echo "${LOG_PREFIX} $1"
}

error_exit() {
  log "ERROR: $1"
  exit 1
}

S3_FLAGS=""
if [ -n "${S3_ENDPOINT}" ]; then
  S3_FLAGS="--endpoint-url ${S3_ENDPOINT}"
fi

# ─── 1. Select backup to restore ───
if [ -z "${1:-}" ]; then
  log "Available backups:"
  aws s3 ls ${S3_FLAGS} "s3://${S3_BUCKET}/backups/" | sort -r | head -20
  echo ""
  echo "Usage: $0 <backup_filename>"
  echo "Example: $0 novacaisse_2026-03-07_03-00.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"
mkdir -p "${RESTORE_DIR}"

# ─── 2. Download from S3 ───
log "Downloading ${BACKUP_FILE} from S3..."
aws s3 cp ${S3_FLAGS} \
  "s3://${S3_BUCKET}/backups/${BACKUP_FILE}" \
  "${RESTORE_DIR}/${BACKUP_FILE}" \
  || error_exit "Failed to download backup from S3"

log "Download complete"

# ─── 3. Restore to PostgreSQL ───
log "Restoring database ${DB_NAME}..."
export PGPASSWORD="${DB_PASSWORD}"

gunzip -c "${RESTORE_DIR}/${BACKUP_FILE}" \
  | pg_restore -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" \
    --clean --if-exists --no-owner --no-privileges \
  || error_exit "pg_restore failed"

log "Database restored successfully"

# ─── 4. Verify integrity ───
log "Verifying integrity..."

TABLES=("Tenant" "User" "Product" "Category" "Menu" "Ticket" "Closure" "AuditLog")
ALL_OK=true

for TABLE in "${TABLES[@]}"; do
  COUNT=$(psql -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" -t -c \
    "SELECT COUNT(*) FROM \"${TABLE}\";" 2>/dev/null | tr -d ' ')
  if [ $? -eq 0 ] && [ -n "${COUNT}" ]; then
    log "  ${TABLE}: ${COUNT} rows"
  else
    log "  WARNING: Could not query table ${TABLE}"
    ALL_OK=false
  fi
done

if [ "${ALL_OK}" = true ]; then
  log "Integrity check passed"
else
  log "WARNING: Some tables could not be verified"
fi

# ─── 5. Cleanup ───
rm -f "${RESTORE_DIR}/${BACKUP_FILE}"
log "Restore completed"
