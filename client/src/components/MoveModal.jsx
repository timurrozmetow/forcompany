import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Folder, ChevronRight, Home, Loader2, CornerLeftUp } from 'lucide-react';
import Modal from './Modal';
import { folderApi } from '../api';

/**
 * Folder picker. Lets the user browse the tree and choose a destination.
 * `item` is the entry being moved (so we can prevent moving a folder into
 * itself / its subtree at the UI level — the backend enforces it too).
 */
export default function MoveModal({ open, onClose, onMove, item }) {
  const { t } = useTranslation();
  const [parentId, setParentId] = useState(null);
  const [folders, setFolders] = useState([]);
  const [crumbs, setCrumbs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (pid) => {
    setLoading(true);
    setError('');
    try {
      const data = await folderApi.list(pid);
      setFolders(data.folders);
      setCrumbs(data.breadcrumbs || []);
      setParentId(pid);
    } catch (err) {
      setError(err?.response?.data?.error?.message || t('toast.error'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (open) load(null);
  }, [open, load]);

  const isBulk = !item || item.type === 'bulk' || item.id == null;
  const isSelfFolder = (f) => !isBulk && item.type === 'folder' && Number(f.id) === Number(item.id);

  const currentSource = item?.type === 'folder' ? item.parentId : item?.folderId;
  // For a single item we disable "move here" when it's already in this folder;
  // for bulk moves we always allow it.
  const sameLocation = isBulk ? false : (currentSource ?? null) === (parentId ?? null);

  const doMove = async () => {
    setMoving(true);
    setError('');
    try {
      await onMove(parentId);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error?.message || t('toast.error'));
      setMoving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('common.move')}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={moving}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary" onClick={doMove} disabled={moving || sameLocation}>
            {moving ? <Loader2 size={16} className="spin" /> : t('drive.moveHere')}
          </button>
        </>
      }
    >
      <p className="muted tiny" style={{ marginTop: 0 }}>
        {t('drive.selectDestination')}
      </p>

      <div className="breadcrumbs" style={{ marginBottom: 10 }}>
        <span className="crumb" onClick={() => load(null)}>
          <Home size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
          {t('common.root')}
        </span>
        {crumbs.map((c) => (
          <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <ChevronRight size={14} className="sep" />
            <span className="crumb" onClick={() => load(c.id)}>
              {c.name}
            </span>
          </span>
        ))}
      </div>

      <div className="tree">
        {parentId !== null && (
          <div
            className="tree-node"
            onClick={() => load(crumbs.length > 1 ? crumbs[crumbs.length - 2].id : null)}
          >
            <CornerLeftUp size={17} />
            <span className="muted">..</span>
          </div>
        )}
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <Loader2 className="spin" size={20} style={{ color: 'var(--accent)' }} />
          </div>
        ) : folders.length === 0 ? (
          <div className="muted tiny" style={{ padding: 16, textAlign: 'center' }}>
            {t('drive.folders')}: 0
          </div>
        ) : (
          folders.map((f) => (
            <div
              key={f.id}
              className={`tree-node ${isSelfFolder(f) ? 'muted' : ''}`}
              style={isSelfFolder(f) ? { opacity: 0.45, pointerEvents: 'none' } : {}}
              onClick={() => !isSelfFolder(f) && load(f.id)}
            >
              <Folder size={17} style={{ color: 'var(--accent)' }} />
              <span style={{ flex: 1 }}>{f.name}</span>
              <ChevronRight size={15} className="muted" />
            </div>
          ))
        )}
      </div>

      {error && (
        <div className="login-error" style={{ marginTop: 12, marginBottom: 0 }}>
          {error}
        </div>
      )}
    </Modal>
  );
}
