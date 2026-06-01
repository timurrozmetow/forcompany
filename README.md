# Company Drive

Корпоративный файловый менеджер (mini Google Drive / iCloud Drive для внутреннего
использования компании). Общие папки и файлы фирмы, роли **admin** и **user**,
полное логирование действий, корзина, защищённые скачивание и предпросмотр.

**Стек:** React + Vite · Node.js + Express · MySQL (mysql2) · JWT · локальное
хранилище на VPS · деплой Ubuntu + Nginx + PM2. Интерфейс — русский и турецкий,
светлая/тёмная тема, mobile-first, Apple-like дизайн.

---

## ✨ Возможности

**Пользователь**
- Просмотр папок/файлов, создание вложенных папок, переименование, перемещение, удаление в корзину
- **Chunked / resumable загрузка** до **10 GB**: файл бьётся на части, докачка после обрыва связи (даже после перезагрузки страницы), прогресс/скорость/ETA, повтор при ошибке. Имена файлов сохраняются как есть
- **Drag & drop**, загрузка нескольких файлов, общий прогресс
- **Серверные миниатюры** изображений (webp, кэш) — быстрый просмотр галерей
- **Множественный выбор** (чекбоксы) + массовые операции: переместить / удалить / **скачать выбранное в ZIP**
- **ZIP-скачивание целой папки** (рекурсивно)
- **Параллельная загрузка чанков**, **drag-to-move** (перетаскивание в папку), разрешение **конфликтов имён** (заменить / оставить оба / пропустить)
- **Избранное** и **Недавние**, **теги** и **комментарии** к файлам
- **Полнотекстовый поиск** по содержимому PDF / Word / Excel / текстовых файлов
- Скачивание и предпросмотр (фото, PDF, видео с перемоткой, аудио, текст) через защищённые маршруты
- Поиск по названию, сортировка (имя/дата/размер/тип), вид сеткой/списком, breadcrumbs, кнопки назад/вперёд
- **PWA**: установка на телефон, оффлайн-кэш последних списков

**Админ**
- Пользователи: создать / редактировать / сменить пароль / заблокировать / удалить / роль admin·user
- Все файлы и логи: кто загрузил / скачал / удалил / переименовал / переместил
- Корзина: восстановление и **окончательное** удаление (только админ)
- Дашборд и статистика: число файлов, объём хранилища, **свободное место на диске**, пользователи, последние загрузки/удаления, активные пользователи
- **Контроль места на диске**: загрузка отклоняется (507) при нехватке свободного места; баннер «мало места»
- **Уведомления** (Telegram + Email) о важных действиях: создание/удаление/блокировка пользователей, окончательное удаление

**Безопасность**
- Вход только по логину/паролю (без регистрации, без восстановления, без 2FA). JWT access token, пароли — bcrypt
- Все защищённые API проверяют JWT; админские — роль `admin`
- Файлы лежат **вне** web-root, имя на диске — UUID, оригинальное имя/MIME/размер/расширение — в БД
- Защита от path traversal, helmet, CORS через env, rate-limit на login, валидация ввода, аккуратные ошибки без раскрытия путей
- Скачивание/preview — только stream + HTTP Range; никаких публичных ссылок

---

## 📁 Структура проекта

```
project/
├── server/                  # Express API
│   ├── src/
│   │   ├── config/          # загрузка/валидация env
│   │   ├── db/              # pool, migrate.js, seed.js
│   │   ├── middleware/      # auth(JWT), requireAdmin, errorHandler, rateLimit, requestContext
│   │   ├── services/        # бизнес-логика (auth, user, folder, file, trash, stats, activityLog, search)
│   │   ├── controllers/     # обработчики req/res
│   │   ├── routes/          # express routers
│   │   ├── utils/           # jwt, password, storagePath(anti-traversal), uploadStream(busboy), streamFile(range)…
│   │   ├── app.js
│   │   └── server.js
│   ├── database/{schema.sql, seed.sql}
│   ├── ecosystem.config.js  # PM2
│   └── .env.example
├── client/                  # React + Vite SPA
│   └── src/{api,components,pages,layouts,hooks,i18n,context,utils,styles}
├── deploy/nginx.conf
└── README.md
```

---

## 🔌 API

| Метод | Путь | Доступ |
|------|------|--------|
| POST | `/api/auth/login` | public (rate-limited) |
| GET | `/api/auth/me` | auth |
| GET/POST | `/api/folders`  `?parentId=` | auth |
| PUT/PATCH/DELETE | `/api/folders/:id` , `/:id/move` | auth |
| GET | `/api/files?folderId=` | auth |
| POST | `/api/files/upload?folderId=` | auth (streaming) |
| GET | `/api/files/:id/download` · `/preview` | auth (stream + Range) |
| PUT/PATCH/DELETE | `/api/files/:id` , `/:id/move` | auth |
| GET | `/api/search?q=` | auth |
| GET | `/api/trash` | auth |
| PATCH/DELETE | `/api/trash/{files,folders}/:id/{restore,permanent}` | **admin** |
| GET/POST/PUT/PATCH/DELETE | `/api/admin/users…` | **admin** |
| GET | `/api/admin/dashboard/stats` · `/api/admin/activity-logs` | **admin** |

> Для `<img>`/`<video>`, которые не умеют слать заголовки, токен можно передать в
> query: `…/preview?token=JWT`. Маршрут всё равно проверяет JWT.

---

## 🧑‍💻 Локальная разработка

**Требования:** Node.js ≥ 18, MySQL ≥ 8.

```bash
# 1. База
mysql -u root -p -e "CREATE DATABASE company_drive CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. Backend
cd server
cp .env.example .env          # отредактируйте DB_*, JWT_SECRET, STORAGE_DIR
npm install
npm run migrate               # применяет database/schema.sql (fresh DB — сразу со всеми таблицами v2)
# Если БД уже существовала с прошлой версии — догоните схему:
# npm run migrate:v2          # favorites, tags, comments, full-text
npm run seed                  # создаёт админа (admin / admin12345)
npm run dev                   # http://localhost:5000

# 3. Frontend (в новом терминале)
cd client
cp .env.example .env          # для локалки можно: VITE_API_URL=/api  (работает dev-proxy на :5000)
npm install
npm run dev                   # http://localhost:5173
```

**Первый вход:** `admin` / `admin12345` — **сразу смените пароль** в админке
(Пользователи → ✏️ или 🔑).

---

## ⚙️ Переменные окружения

**server/.env**
```
PORT=5000
NODE_ENV=production
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=company_drive
JWT_SECRET=change_this_secret      # node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
STORAGE_DIR=/var/www/company-drive/storage
MAX_FILE_SIZE_GB=10
CORS_ORIGIN=https://yourdomain.com
TRUST_PROXY=true
```

**client/.env**
```
VITE_API_URL=https://yourdomain.com/api
```

---

## 🚀 Деплой на Ubuntu (Nginx + PM2 + SSL)

### 1. Node.js 20 и инструменты
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
sudo npm install -g pm2
```

### 2. MySQL
```bash
sudo apt-get install -y mysql-server
sudo mysql_secure_installation
sudo mysql -e "CREATE DATABASE company_drive CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'drive'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD';"
sudo mysql -e "GRANT ALL PRIVILEGES ON company_drive.* TO 'drive'@'localhost'; FLUSH PRIVILEGES;"
```

### 3. Код проекта
```bash
sudo mkdir -p /var/www/company-drive
sudo chown -R $USER:$USER /var/www/company-drive
cd /var/www/company-drive
git clone <your-repo> .        # или скопируйте папки server/ и client/
```

### 4. Хранилище файлов (вне web-root) и права
```bash
sudo mkdir -p /var/www/company-drive/storage
# www-data — пользователь, под которым работает Node через PM2 (или ваш deploy-юзер)
sudo chown -R $USER:$USER /var/www/company-drive/storage
chmod 750 /var/www/company-drive/storage
```

### 5. Backend
```bash
cd /var/www/company-drive/server
cp .env.example .env
nano .env                      # DB_USER=drive, DB_PASSWORD=..., JWT_SECRET=..., STORAGE_DIR=/var/www/company-drive/storage, CORS_ORIGIN=https://yourdomain.com
npm ci --omit=dev
npm run migrate                # импорт схемы
npm run seed                   # первый админ
```

### 6. Frontend (сборка)
```bash
cd /var/www/company-drive/client
cp .env.example .env
nano .env                      # VITE_API_URL=https://yourdomain.com/api
npm ci
npm run build                  # -> client/dist
```

### 7. Запуск backend через PM2
```bash
cd /var/www/company-drive/server
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup                    # выполните выведенную команду, чтобы автозапуск при перезагрузке
```

### 8. Nginx
```bash
sudo apt-get install -y nginx
sudo cp /var/www/company-drive/deploy/nginx.conf /etc/nginx/sites-available/company-drive
sudo nano /etc/nginx/sites-available/company-drive   # замените yourdomain.com
sudo ln -s /etc/nginx/sites-available/company-drive /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```
Конфиг уже настраивает: отдачу `client/dist`, проксирование `/api` на
`127.0.0.1:5000`, `client_max_body_size 10g`, отключённую буферизацию (стриминг
больших файлов), увеличенные таймауты и запрет прямого доступа к `storage`.

### 9. SSL через certbot
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
# certbot добавит 443-блок и редирект 80→443, настроит авто-обновление
```

### Обновление версии
```bash
cd /var/www/company-drive && git pull
cd server && npm ci --omit=dev && npm run migrate && pm2 reload company-drive-api
cd ../client && npm ci && npm run build
```

---

## 🗄️ База данных

Таблицы: `users`, `folders` (self-reference tree), `files`, `activity_logs`
(`old_value`/`new_value` — JSON). Полная схема — в
[`server/database/schema.sql`](server/database/schema.sql), первый админ —
[`server/database/seed.sql`](server/database/seed.sql) (или `npm run seed`).

Логируемые действия: `login`, `logout`, `upload_file`, `download_file`,
`preview_file`, `create_folder`, `rename_file/folder`, `move_file/folder`,
`trash_file/folder`, `restore_file/folder`, `permanent_delete_file/folder`,
`create_user`, `update_user`, `block_user`, `delete_user`. Каждая запись хранит
user_id, действие, target, old/new value, IP и user-agent.

---

## 🔐 Заметки по безопасности

- `STORAGE_DIR` держите **вне** `client/dist` и не отдавайте через Nginx (см. `deny` в конфиге).
- Смените `JWT_SECRET` и пароль `admin` сразу после установки.
- Для MySQL используйте отдельного пользователя с правами только на `company_drive`.
- `TRUST_PROXY=true` обязателен за Nginx — иначе rate-limit и IP в логах будут видеть только адрес прокси.
- Резервное копирование: дамп MySQL (`mysqldump`) **и** каталог `storage/` — они связаны (метаданные в БД, байты на диске).

---

## 🛠 Эксплуатация: бэкап, ротация логов, мониторинг

### Авто-бэкап (mysqldump + storage)
Скрипт [`deploy/backup.sh`](deploy/backup.sh) делает дамп БД и архив `storage/`
(без регенерируемых `.thumbs` и временных `.uploads_tmp`), удаляет архивы старше
`RETENTION_DAYS` (по умолчанию 14).
```bash
chmod +x /var/www/company-drive/deploy/backup.sh
# проверить вручную:
sudo DB_PASSWORD='yourpass' /var/www/company-drive/deploy/backup.sh
# nightly в 03:30 (sudo crontab -e):
30 3 * * *  DB_PASSWORD='yourpass' /var/www/company-drive/deploy/backup.sh >> /var/log/company-drive-backup.log 2>&1
```

### Ротация логов PM2
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 20M
pm2 set pm2-logrotate:retain 14         # держать 14 файлов
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
```

### Мониторинг (healthcheck)
Эндпоинт `GET /api/health` проверяет соединение с БД и возвращает свободное
место на диске; при недоступной БД отвечает **503**.
```bash
curl -s https://yourdomain.com/api/health
# {"status":"ok","db":"ok","disk":{"freeBytes":...,"totalBytes":...}}
```
Повесьте внешний аптайм-монитор (UptimeRobot / БetterStack / Healthchecks.io) на
этот URL, либо локальный cron-алерт:
```bash
*/5 * * * * curl -fsS https://yourdomain.com/api/health > /dev/null || echo "Company Drive DOWN $(date)" | mail -s "ALERT" you@company.com
```

### Уведомления (Telegram / Email)
Включаются через `server/.env`. События задаются в `NOTIFY_EVENTS`.

**Telegram:** создайте бота через [@BotFather](https://t.me/BotFather), вставьте
`TELEGRAM_BOT_TOKEN`. Чтобы узнать `TELEGRAM_CHAT_ID` — напишите боту любое
сообщение, затем (войдя админом) откройте `GET /api/admin/notify/telegram-chats`
или нажмите кнопку проверки — вернётся список chat id. Впишите нужный в
`TELEGRAM_CHAT_ID`. Проверка: `POST /api/admin/notify/test`.

**Email:** заполните `SMTP_*` (для Gmail — App Password) и `NOTIFY_EMAIL_TO`.

> ⚠️ Если bot-токен где-то засветился (чат, скриншот) — **перевыпустите** его
> через @BotFather `/revoke`.

### Полнотекстовый поиск
Текст из PDF/DOCX/XLSX/txt извлекается при загрузке (`text_content` + FULLTEXT).
Поиск по содержимому работает автоматически в общей строке поиска. Для уже
загруженных ранее файлов один раз постройте индекс: `npm run reindex`.

### Обслуживание хранилища
- `npm run reconcile` — найти рассинхрон БД↔диск; `-- --delete` удалит файлы-сироты.
- `deploy/restore.sh` — восстановление из бэкапа (db + storage).

### Chunked upload — что важно знать
- Большие файлы грузятся частями (по умолчанию 8 MB); сессии лежат в
  `STORAGE_DIR/.uploads_tmp/<uuid>/` и автоматически чистятся через 24 ч
  (и при старте сервера).
- Nginx уже настроен на стриминг (`proxy_request_buffering off`) и большие
  таймауты — докачка работает «из коробки».
- Миниатюры кэшируются в `STORAGE_DIR/.thumbs/` и пересоздаются по запросу, если
  их удалить.

---

## Лицензия

Внутренний проект компании. Используйте и адаптируйте под свои нужды.
