import { useTranslation } from 'react-i18next';
import { ChevronDown, X, CheckCircle2, AlertCircle, Loader2, RotateCcw, UploadCloud } from 'lucide-react';
import { formatBytes, formatSpeed, formatEta } from '../utils/format';

export default function UploadPanel({ tasks, open, onToggle, onClose, onCancel, onRetry, locale }) {
  const { t } = useTranslation();
  if (!tasks.length) return null;

  const active = tasks.filter((x) => x.status === 'uploading');
  const done = tasks.filter((x) => x.status === 'done').length;
  const failed = tasks.filter((x) => x.status === 'error').length;

  // Overall progress across currently-active uploads.
  const totalSize = active.reduce((s, x) => s + (x.total || 0), 0);
  const totalLoaded = active.reduce((s, x) => s + (x.loaded || 0), 0);
  const overall = totalSize ? Math.round((totalLoaded / totalSize) * 100) : 0;
  const combinedRate = active.reduce((s, x) => s + (x.rate || 0), 0);

  const title =
    active.length > 0
      ? `${t('upload.uploading')} ${active.length}`
      : failed > 0
      ? `${t('upload.completed')} · ${done} ✓ · ${failed} ✕`
      : t('upload.completed');

  return (
    <div className="upload-panel">
      <div className="upload-panel-head">
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UploadCloud size={17} style={{ color: 'var(--accent)' }} />
          {title}
        </span>
        <span style={{ display: 'flex', gap: 4 }}>
          <button className="btn-icon" onClick={onToggle} aria-label="Toggle">
            <ChevronDown
              size={18}
              style={{ transform: open ? 'none' : 'rotate(180deg)', transition: '0.2s' }}
            />
          </button>
          <button className="btn-icon" onClick={onClose} aria-label="Close" disabled={active.length > 0}>
            <X size={18} />
          </button>
        </span>
      </div>

      {active.length > 0 && (
        <div className="upload-overall">
          <div className="progress" style={{ marginTop: 0 }}>
            <span style={{ width: `${overall}%` }} />
          </div>
          <div className="tiny muted" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
            <span>
              {formatBytes(totalLoaded, locale)} / {formatBytes(totalSize, locale)}
            </span>
            <span>{formatSpeed(combinedRate, locale)}</span>
          </div>
        </div>
      )}

      {open && (
        <div className="upload-list">
          {tasks.map((task) => (
            <div key={task.id} className="upload-row">
              <span className="ic">
                {task.status === 'uploading' && (
                  <Loader2 size={18} className="spin" style={{ color: 'var(--accent)' }} />
                )}
                {task.status === 'done' && <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />}
                {(task.status === 'error' || task.status === 'canceled') && (
                  <AlertCircle size={18} style={{ color: 'var(--danger)' }} />
                )}
              </span>
              <div className="info">
                <div className="fname" title={task.name}>
                  {task.name}
                </div>
                <div className={`progress ${task.status === 'error' || task.status === 'canceled' ? 'error' : task.status === 'done' ? 'done' : ''}`}>
                  <span style={{ width: `${task.progress}%` }} />
                </div>
                <div className="tiny muted" style={{ marginTop: 4 }}>
                  {task.status === 'error'
                    ? task.error || t('upload.failed')
                    : task.status === 'canceled'
                    ? t('common.cancel')
                    : task.status === 'uploading'
                    ? `${task.progress}% · ${formatSpeed(task.rate, locale)}${
                        task.eta ? ` · ${formatEta(task.eta, locale)}` : ''
                      }`
                    : formatBytes(task.size, locale)}
                </div>
              </div>
              {task.status === 'uploading' && (
                <button className="btn-icon" onClick={() => onCancel(task.id)} aria-label="Cancel">
                  <X size={16} />
                </button>
              )}
              {(task.status === 'error' || task.status === 'canceled') && (
                <button className="btn-icon" onClick={() => onRetry(task.id)} aria-label="Retry" title={t('common.confirm')}>
                  <RotateCcw size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
