'use strict';

const config = require('../config');
const logger = require('../utils/logger');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const e = config.notify.email;
  if (!e.host || !e.user) return null;
  // Lazy require so the app runs fine without email configured.
  const nodemailer = require('nodemailer');
  transporter = nodemailer.createTransport({
    host: e.host,
    port: e.port,
    secure: e.secure,
    auth: { user: e.user, pass: e.pass },
  });
  return transporter;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendTelegram(html) {
  const { token, chatId } = config.notify.telegram;
  if (!token || !chatId) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) logger.warn(`Telegram notify failed: HTTP ${res.status}`);
  } catch (err) {
    logger.warn('Telegram notify error:', err.message);
  }
}

async function sendEmail(subject, text) {
  const t = getTransporter();
  const e = config.notify.email;
  if (!t || !e.to) return;
  try {
    await t.sendMail({ from: e.from || e.user, to: e.to, subject, text });
  } catch (err) {
    logger.warn('Email notify error:', err.message);
  }
}

const ACTION_LABELS = {
  create_user: '👤 Создан пользователь',
  delete_user: '🗑 Удалён пользователь',
  block_user: '🚫 Изменён статус пользователя',
  permanent_delete_file: '❌ Файл удалён навсегда',
  permanent_delete_folder: '❌ Папка удалена навсегда',
  trash_file: '🗂 Файл в корзину',
  trash_folder: '🗂 Папка в корзину',
  login: '🔑 Вход',
};

/**
 * Fire-and-forget notification for an important action. Gated by
 * config.notify.events; safe to call always (no-op if not configured).
 */
function event(action, { actor, target, detail } = {}) {
  if (!config.notify.events.includes(action)) return;
  const title = ACTION_LABELS[action] || action;
  const htmlLines = [
    `<b>${escapeHtml(title)}</b>`,
    `Кто: <b>${escapeHtml(actor?.username || '—')}</b>`,
  ];
  if (target) htmlLines.push(`Объект: ${escapeHtml(target)}`);
  if (detail) htmlLines.push(escapeHtml(detail));
  htmlLines.push(`<i>${new Date().toLocaleString('ru-RU')}</i>`);
  const html = htmlLines.join('\n');

  // Don't await — never block the request on a notification.
  sendTelegram(html);
  const plain = htmlLines.join('\n').replace(/<\/?[^>]+>/g, '');
  sendEmail(`Company Drive — ${title}`, plain);
}

/** Send a manual test message (used by the admin "test" endpoint). */
async function test() {
  const text = '✅ Company Drive: тестовое уведомление. Канал настроен корректно.';
  await Promise.all([sendTelegram(`<b>${text}</b>`), sendEmail('Company Drive — тест', text)]);
  return {
    telegram: !!(config.notify.telegram.token && config.notify.telegram.chatId),
    email: !!(config.notify.email.host && config.notify.email.to),
  };
}

/**
 * Helper to discover your Telegram chat id: returns chats that have recently
 * messaged the bot. Send any message to the bot first, then call this.
 */
async function getTelegramChats() {
  const { token } = config.notify.telegram;
  if (!token) return { configured: false, chats: [] };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const data = await res.json();
    const seen = new Map();
    for (const u of data.result || []) {
      const chat = u.message?.chat || u.channel_post?.chat;
      if (chat && !seen.has(chat.id)) {
        seen.set(chat.id, {
          id: chat.id,
          type: chat.type,
          title: chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username,
        });
      }
    }
    return { configured: true, chats: [...seen.values()] };
  } catch (err) {
    logger.warn('getTelegramChats error:', err.message);
    return { configured: true, chats: [], error: err.message };
  }
}

module.exports = { event, test, getTelegramChats };
