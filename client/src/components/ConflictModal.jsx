import { useTranslation } from 'react-i18next';
import { AlertTriangle, Copy, RefreshCw, SkipForward } from 'lucide-react';
import Modal from './Modal';

/**
 * Shown when uploaded file names already exist in the target folder.
 * onResolve('replace' | 'keep-both' | 'skip').
 */
export default function ConflictModal({ open, conflicts = [], onResolve, onClose }) {
  const { t } = useTranslation();

  return (
    <Modal open={open} onClose={onClose} title={t('conflict.title')}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
        <AlertTriangle size={22} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ margin: '0 0 8px' }}>{t('conflict.message', { count: conflicts.length })}</p>
          <div className="muted tiny" style={{ maxHeight: 120, overflowY: 'auto' }}>
            {conflicts.slice(0, 12).map((n) => (
              <div key={n}>• {n}</div>
            ))}
            {conflicts.length > 12 && <div>…</div>}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="btn btn-primary" onClick={() => onResolve('keep-both')}>
          <Copy size={17} /> {t('conflict.keepBoth')}
        </button>
        <button className="btn" onClick={() => onResolve('replace')}>
          <RefreshCw size={17} /> {t('conflict.replace')}
        </button>
        <button className="btn btn-ghost" onClick={() => onResolve('skip')}>
          <SkipForward size={17} /> {t('conflict.skip')}
        </button>
      </div>
    </Modal>
  );
}
