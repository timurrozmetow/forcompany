export function formatBytes(bytes, locale = 'ru') {
  if (bytes === null || bytes === undefined) return '—';
  const b = Number(bytes);
  if (Number.isNaN(b) || b === 0) return locale === 'tr' ? '0 B' : '0 Б';
  const units =
    locale === 'tr'
      ? ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
      : ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ', 'ПБ'];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  const value = b / Math.pow(1024, i);
  const formatted = value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1);
  return `${formatted} ${units[i]}`;
}

export function formatDate(dateStr, locale = 'ru') {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr, locale = 'ru') {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale === 'tr' ? 'tr-TR' : 'ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function relativeTime(dateStr, locale = 'ru') {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = (Date.now() - d.getTime()) / 1000; // seconds; > 0 means in the past
  const rtf = new Intl.RelativeTimeFormat(locale === 'tr' ? 'tr' : 'ru', { numeric: 'auto' });

  // Under a minute (incl. timestamps that land slightly in the FUTURE because
  // of a server/client clock skew) -> "just now". Never show raw seconds.
  if (diff < 60) return locale === 'tr' ? 'az önce' : 'только что';
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
  if (diff < 2592000) return rtf.format(-Math.round(diff / 86400), 'day');
  return formatDate(dateStr, locale);
}

export function initials(name) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

export function formatSpeed(bytesPerSec, locale = 'ru') {
  if (!bytesPerSec || bytesPerSec <= 0) return '';
  return `${formatBytes(bytesPerSec, locale)}/s`;
}

export function formatEta(seconds, locale = 'ru') {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '';
  const s = Math.round(seconds);
  if (s < 60) return locale === 'tr' ? `${s} sn` : `${s} с`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}${locale === 'tr' ? ' dk' : ' мин'} ${rem}${locale === 'tr' ? ' sn' : ' с'}`;
  const h = Math.floor(m / 60);
  return `${h}${locale === 'tr' ? ' sa' : ' ч'} ${m % 60}${locale === 'tr' ? ' dk' : ' мин'}`;
}
