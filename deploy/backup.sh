#!/usr/bin/env bash
# ============================================================================
#  Company Drive — backup script
#  Dumps the MySQL database AND archives the storage directory, then prunes
#  backups older than RETENTION_DAYS. The DB metadata and the file bytes are
#  linked, so they MUST be backed up together.
#
#  Usage (manual):   sudo -E ./backup.sh
#  Recommended: run nightly via cron (see crontab example at the bottom).
#
#  Override any setting via environment variables or edit the defaults below.
# ============================================================================
set -euo pipefail

DB_NAME="${DB_NAME:-company_drive}"
DB_USER="${DB_USER:-drive}"
DB_PASSWORD="${DB_PASSWORD:-}"
STORAGE_DIR="${STORAGE_DIR:-/var/www/company-drive/storage}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/company-drive}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "[backup] $(date)  dumping database '$DB_NAME'..."
mysqldump --single-transaction --quick --routines --triggers \
  -u "$DB_USER" ${DB_PASSWORD:+-p"$DB_PASSWORD"} "$DB_NAME" \
  | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz"

echo "[backup] archiving storage '$STORAGE_DIR'..."
# Skip regenerable thumbnails and transient chunk-upload temp files.
tar -C "$(dirname "$STORAGE_DIR")" \
  --exclude="$(basename "$STORAGE_DIR")/.thumbs" \
  --exclude="$(basename "$STORAGE_DIR")/.uploads_tmp" \
  -czf "$BACKUP_DIR/storage-$STAMP.tar.gz" "$(basename "$STORAGE_DIR")"

echo "[backup] pruning backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name 'db-*.sql.gz'      -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name 'storage-*.tar.gz' -mtime +"$RETENTION_DAYS" -delete

echo "[backup] done -> $BACKUP_DIR"
ls -lh "$BACKUP_DIR" | tail -n 4

# ---------------------------------------------------------------------------
# Cron example — nightly at 03:30 (run: sudo crontab -e):
#   30 3 * * *  DB_PASSWORD='yourpass' /var/www/company-drive/deploy/backup.sh >> /var/log/company-drive-backup.log 2>&1
# ---------------------------------------------------------------------------
