#!/usr/bin/env bash
# ============================================================================
#  Company Drive — one-shot VPS installer (Ubuntu 22.04 / 24.04)
#
#  1) Edit the CONFIG block below (domain, GitHub token, passwords).
#  2) Copy this file to the server and run it:
#        chmod +x setup-vps.sh
#        ./setup-vps.sh
#     Run as a normal sudo user (recommended) or as root.
#
#  It installs Node 20, MySQL, Nginx, PM2, clones the repo, builds the
#  frontend, configures the backend + Nginx + free SSL (Let's Encrypt).
# ============================================================================
set -euo pipefail

# ============================== CONFIG ======================================
DOMAIN="drive.example.com"                 # ваш домен (A-запись уже на этот VPS)
LETSENCRYPT_EMAIL="you@example.com"         # email для Let's Encrypt (уведомления о продлении)

GITHUB_USER="timurrozmetow"                 # ваш GitHub логин
GITHUB_TOKEN="PASTE_YOUR_GITHUB_TOKEN"      # Personal Access Token (scope: repo). См. инструкцию в чате.
GIT_REPO_PATH="timurrozmetow/forcompany.git"

DB_PASSWORD="CHANGE_db_password"            # пароль для MySQL-пользователя 'drive' (придумайте свой)
JWT_SECRET="CHANGE_me_to_a_long_random_string"  # или сгенерируйте: openssl rand -hex 48

ADMIN_PASSWORD="admin12345"                 # первый пароль админа (СМЕНИТЬ после входа)

APP_DIR="/var/www/company-drive"
STORAGE_DIR="$APP_DIR/storage"
MAX_FILE_SIZE_GB="10"
# ============================================================================

SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
RUN_USER="$(whoami)"
log() { echo -e "\n\033[1;36m==> $*\033[0m"; }

if [[ "$GITHUB_TOKEN" == "PASTE_YOUR_GITHUB_TOKEN" || "$DOMAIN" == "drive.example.com" ]]; then
  echo "ERROR: edit the CONFIG block (DOMAIN, GITHUB_TOKEN, DB_PASSWORD, JWT_SECRET) first." >&2
  exit 1
fi

# --------------------------------------------------------------------------
log "1/10  System packages"
$SUDO apt-get update -y
$SUDO apt-get install -y curl git ca-certificates ufw

# --------------------------------------------------------------------------
log "2/10  Node.js 20 + PM2"
if ! command -v node >/dev/null || [[ "$(node -v)" != v20* && "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
  $SUDO apt-get install -y nodejs
fi
$SUDO npm install -g pm2

# --------------------------------------------------------------------------
log "3/10  MySQL server + database/user"
$SUDO apt-get install -y mysql-server
$SUDO systemctl enable --now mysql
$SUDO mysql <<SQL
CREATE DATABASE IF NOT EXISTS company_drive CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'drive'@'localhost' IDENTIFIED BY 'new_passowrd';
ALTER USER 'drive'@'localhost' IDENTIFIED BY 'new_passowrd';
GRANT ALL PRIVILEGES ON company_drive.* TO 'drive'@'localhost';
FLUSH PRIVILEGES;
SQL

# --------------------------------------------------------------------------
log "4/10  Clone (or update) the repository"
$SUDO mkdir -p "$APP_DIR"
$SUDO chown -R "$RUN_USER":"$RUN_USER" "$(dirname "$APP_DIR")/company-drive" 2>/dev/null || $SUDO chown -R "$RUN_USER":"$RUN_USER" "$APP_DIR"
CLONE_URL="https://${GITHUB_USER}:${GITHUB_TOKEN}@github.com/${GIT_REPO_PATH}"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull
else
  git clone "$CLONE_URL" "$APP_DIR"
fi

# --------------------------------------------------------------------------
log "5/10  Storage directory + low-memory MySQL tuning"
mkdir -p "$STORAGE_DIR"
chmod 750 "$STORAGE_DIR"
if [ -f "$APP_DIR/deploy/mysql-lowmem.cnf" ]; then
  $SUDO cp "$APP_DIR/deploy/mysql-lowmem.cnf" /etc/mysql/mysql.conf.d/zz-lowmem.cnf
  $SUDO systemctl restart mysql
fi

# --------------------------------------------------------------------------
log "6/10  Backend .env + install + migrate + seed"
cat > "$APP_DIR/server/.env" <<ENV
PORT=5000
NODE_ENV=production
DB_HOST=localhost
DB_PORT=3306
DB_USER=drive
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=company_drive
DB_CONNECTION_LIMIT=10
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
STORAGE_DIR=${STORAGE_DIR}
MAX_FILE_SIZE_GB=${MAX_FILE_SIZE_GB}
CORS_ORIGIN=https://${DOMAIN}
TRUST_PROXY=true
LOW_SPACE_WARN_RATIO=0.1
NOTIFY_EVENTS=create_user,delete_user,block_user,permanent_delete_file,permanent_delete_folder
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
NOTIFY_EMAIL_FROM=
NOTIFY_EMAIL_TO=
ENV

cd "$APP_DIR/server"
npm ci --omit=dev
npm run migrate
npm run migrate:v2
ADMIN_PASSWORD="$ADMIN_PASSWORD" npm run seed   # creates admin with your password if no admin exists

# --------------------------------------------------------------------------
log "7/10  Frontend .env + build"
cat > "$APP_DIR/client/.env" <<ENV
VITE_API_URL=https://${DOMAIN}/api
ENV
cd "$APP_DIR/client"
npm ci
npm run build

# --------------------------------------------------------------------------
log "8/10  Start backend with PM2"
cd "$APP_DIR/server"
pm2 start ecosystem.config.js --env production || pm2 reload company-drive-api
pm2 save
$SUDO env PATH="$PATH" pm2 startup systemd -u "$RUN_USER" --hp "$HOME" | tail -n 1 | bash || true

# --------------------------------------------------------------------------
log "9/10  Nginx site"
$SUDO apt-get install -y nginx
$SUDO cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/company-drive
$SUDO sed -i "s/yourdomain\.com/${DOMAIN}/g" /etc/nginx/sites-available/company-drive
$SUDO ln -sf /etc/nginx/sites-available/company-drive /etc/nginx/sites-enabled/company-drive
$SUDO rm -f /etc/nginx/sites-enabled/default
$SUDO nginx -t
$SUDO systemctl reload nginx

# --------------------------------------------------------------------------
log "10/10  HTTPS (Let's Encrypt)"
$SUDO apt-get install -y certbot python3-certbot-nginx
$SUDO certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$LETSENCRYPT_EMAIL" --redirect

echo -e "\n\033[1;32m✅ DONE.\033[0m  Open: https://${DOMAIN}"
echo "   Login: admin / ${ADMIN_PASSWORD}   (CHANGE the password right after first login!)"
echo "   PM2:   pm2 status   |   pm2 logs company-drive-api"
echo
echo "Optional firewall (run manually, make sure SSH stays allowed):"
echo "   $SUDO ufw allow OpenSSH && $SUDO ufw allow 'Nginx Full' && $SUDO ufw --force enable"
