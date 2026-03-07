#!/bin/bash
set -euo pipefail

# ─── NovaCaisse — PostgreSQL Backup Script ───
# Runs daily at 3:00 AM via cron
# Uploads to S3-compatible storage (Scaleway, GCS, AWS)

# Configuration (set via environment variables)
DB_USER="${DB_USER:-novacaisse}"
DB_PASSWORD="${DB_PASSWORD:?DB_PASSWORD is required}"
DB_HOST="${DB_HOST:-db}"
DB_NAME="${DB_NAME:-novacaisse}"
S3_BUCKET="${S3_BUCKET:?S3_BUCKET is required}"
S3_ENDPOINT="${S3_ENDPOINT:-}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/backups}"
LOCAL_RETENTION_DAYS=7
S3_RETENTION_DAYS=30

TIMESTAMP=$(date +%Y-%m-%d_%H-%M)
BACKUP_FILE="novacaisse_${TIMESTAMP}.sql.gz"
LOG_PREFIX="[backup $(date +%Y-%m-%d\ %H:%M:%S)]"

log() {
  echo "${LOG_PREFIX} $1"
}

error_exit() {
  log "ERROR: $1"
  exit 1
}

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# ─── 1. pg_dump + compress ───
log "Starting backup of ${DB_NAME}..."
export PGPASSWORD="${DB_PASSWORD}"

pg_dump -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" \
  --format=custom --compress=9 \
  | gzip > "${BACKUP_DIR}/${BACKUP_FILE}" \
  || error_exit "pg_dump failed"

BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
log "Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ─── 2. Upload to S3 ───
S3_FLAGS=""
if [ -n "${S3_ENDPOINT}" ]; then
  S3_FLAGS="--endpoint-url ${S3_ENDPOINT}"
fi

log "Uploading to s3://${S3_BUCKET}/backups/${BACKUP_FILE}..."
aws s3 cp ${S3_FLAGS} \
  "${BACKUP_DIR}/${BACKUP_FILE}" \
  "s3://${S3_BUCKET}/backups/${BACKUP_FILE}" \
  || error_exit "S3 upload failed"

log "Upload complete"

# ─── 3. Cleanup local backups older than ${LOCAL_RETENTION_DAYS} days ───
log "Cleaning local backups older than ${LOCAL_RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "novacaisse_*.sql.gz" -mtime +${LOCAL_RETENTION_DAYS} -delete
LOCAL_CLEANED=$(find "${BACKUP_DIR}" -name "novacaisse_*.sql.gz" | wc -l)
log "Local backups remaining: ${LOCAL_CLEANED}"

# ─── 4. Cleanup S3 backups older than ${S3_RETENTION_DAYS} days ───
log "Cleaning S3 backups older than ${S3_RETENTION_DAYS} days..."
CUTOFF_DATE=$(date -d "-${S3_RETENTION_DAYS} days" +%Y-%m-%d 2>/dev/null || date -v-${S3_RETENTION_DAYS}d +%Y-%m-%d)

aws s3 ls ${S3_FLAGS} "s3://${S3_BUCKET}/backups/" 2>/dev/null | while read -r line; do
  FILE_DATE=$(echo "${line}" | awk '{print $1}')
  FILE_NAME=$(echo "${line}" | awk '{print $4}')
  if [ -n "${FILE_NAME}" ] && [[ "${FILE_DATE}" < "${CUTOFF_DATE}" ]]; then
    log "Deleting old S3 backup: ${FILE_NAME}"
    aws s3 rm ${S3_FLAGS} "s3://${S3_BUCKET}/backups/${FILE_NAME}"
  fi
done

log "Backup completed successfully"
