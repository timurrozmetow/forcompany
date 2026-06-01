#!/usr/bin/env bash
# ============================================================================
#  Company Drive — restore from backup
#  Restores a database dump AND a storage archive produced by backup.sh.
#
#  Usage:
#    CONFIRM=yes DB_PASSWORD='pass' ./restore.sh <db-YYYY...sql.gz> <storage-YYYY...tar.gz>
#
#  WARNING: this OVERWRITES the current database content and storage files.
#  It refuses to run unless CONFIRM=yes is set.
# ============================================================================
set -euo pipefail

DB_NAME="${DB_NAME:-company_drive}"
DB_USER="${DB_USER:-drive}"
DB_PASSWORD="${DB_PASSWORD:-}"
STORAGE_DIR="${STORAGE_DIR:-/var/www/company-drive/storage}"

DB_BACKUP="${1:-}"
STORAGE_BACKUP="${2:-}"

if [[ "${CONFIRM:-}" != "yes" ]]; then
  echo "Refusing to run without CONFIRM=yes (this overwrites data)." >&2
  exit 1
fi
if [[ -z "$DB_BACKUP" || -z "$STORAGE_BACKUP" ]]; then
  echo "Usage: CONFIRM=yes DB_PASSWORD=... ./restore.sh <db.sql.gz> <storage.tar.gz>" >&2
  exit 1
fi

echo "[restore] restoring database '$DB_NAME' from $DB_BACKUP ..."
gunzip -c "$DB_BACKUP" | mysql -u "$DB_USER" ${DB_PASSWORD:+-p"$DB_PASSWORD"} "$DB_NAME"

echo "[restore] restoring storage into $(dirname "$STORAGE_DIR") from $STORAGE_BACKUP ..."
tar -xzf "$STORAGE_BACKUP" -C "$(dirname "$STORAGE_DIR")"

echo "[restore] done. Restart the app:  pm2 reload company-drive-api"
