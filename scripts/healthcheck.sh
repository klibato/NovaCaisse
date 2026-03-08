#!/bin/bash
set -uo pipefail

# ─── NovaCaisse — Healthcheck Script ───
# Runs every 5 minutes via cron
# Checks API, frontend, PostgreSQL, and disk usage

# Configuration
API_URL="${API_URL:-https://api.novacaisse.fr}"
WEB_URL="${WEB_URL:-https://novacaisse.fr}"
DB_USER="${DB_USER:-novacaisse}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_HOST="${DB_HOST:-db}"
DB_NAME="${DB_NAME:-novacaisse}"
DISK_THRESHOLD="${DISK_THRESHOLD:-80}"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"
ALERT_EMAIL="${ALERT_EMAIL:-}"
LOG_FILE="${LOG_FILE:-/var/log/novacaisse/healthcheck.log}"

TIMESTAMP=$(date +%Y-%m-%d\ %H:%M:%S)
ERRORS=()

log() {
  echo "[${TIMESTAMP}] $1" | tee -a "${LOG_FILE}" 2>/dev/null || echo "[${TIMESTAMP}] $1"
}

add_error() {
  ERRORS+=("$1")
  log "FAIL: $1"
}

# Create log directory
mkdir -p "$(dirname "${LOG_FILE}")" 2>/dev/null || true

# ─── 1. Check API ───
if curl -sf --max-time 10 "${API_URL}/health" > /dev/null 2>&1; then
  log "OK: API is responding"
else
  add_error "API is not responding at ${API_URL}/health"
fi

# ─── 2. Check Frontend ───
if curl -sf --max-time 10 "${WEB_URL}" > /dev/null 2>&1; then
  log "OK: Frontend is responding"
else
  add_error "Frontend is not responding at ${WEB_URL}"
fi

# ─── 3. Check PostgreSQL ───
if [ -n "${DB_PASSWORD}" ]; then
  export PGPASSWORD="${DB_PASSWORD}"
  if psql -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1;" > /dev/null 2>&1; then
    log "OK: PostgreSQL is accessible"
  else
    add_error "PostgreSQL is not accessible"
  fi
else
  # Try via docker if running on host
  if docker compose -f /opt/novacaisse/docker-compose.prod.yml exec -T db pg_isready -U "${DB_USER}" > /dev/null 2>&1; then
    log "OK: PostgreSQL is accessible (via docker)"
  else
    add_error "PostgreSQL is not accessible"
  fi
fi

# ─── 4. Check Disk Usage ───
DISK_USAGE=$(df -h / | awk 'NR==2 {gsub(/%/,""); print $5}')
if [ "${DISK_USAGE}" -gt "${DISK_THRESHOLD}" ]; then
  add_error "Disk usage is at ${DISK_USAGE}% (threshold: ${DISK_THRESHOLD}%)"
else
  log "OK: Disk usage is at ${DISK_USAGE}%"
fi

# ─── 5. Send alerts if errors ───
if [ ${#ERRORS[@]} -gt 0 ]; then
  ALERT_MSG="NovaCaisse Healthcheck FAILED at ${TIMESTAMP}:\n"
  for err in "${ERRORS[@]}"; do
    ALERT_MSG+="- ${err}\n"
  done

  # Discord webhook
  if [ -n "${DISCORD_WEBHOOK_URL}" ]; then
    DISCORD_PAYLOAD=$(printf '{"content":"🚨 **NovaCaisse Alert**\\n%s"}' "${ALERT_MSG}")
    curl -sf -H "Content-Type: application/json" \
      -d "${DISCORD_PAYLOAD}" \
      "${DISCORD_WEBHOOK_URL}" > /dev/null 2>&1 \
      && log "Alert sent to Discord" \
      || log "WARNING: Failed to send Discord alert"
  fi

  # Email alert
  if [ -n "${ALERT_EMAIL}" ] && command -v mail > /dev/null 2>&1; then
    echo -e "${ALERT_MSG}" | mail -s "NovaCaisse Healthcheck FAILED" "${ALERT_EMAIL}" \
      && log "Alert sent to ${ALERT_EMAIL}" \
      || log "WARNING: Failed to send email alert"
  fi

  exit 1
fi

log "All checks passed"
exit 0
