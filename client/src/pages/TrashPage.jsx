import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, RotateCcw, Trash, Info } from 'lucide-react';

import { trashApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatBytes, formatDateTime } from '../utils/format';
import { categorize } from '../utils/fileType';
import FileIcon from '../components/FileIcon';
import EmptyState from '../components/EmptyState';
import { GridSkeleton } from '../components/Skeleton';
import ConfirmDialog from '../components/ConfirmDialog';

export default function TrashPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('tr') ? 'tr' : 'ru';
  const { isAdmin } = useAuth();
  const toast = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null); // item to delete forever
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await trashApi.list();
      const merged = [...data.folders, ...data.files].sort(
        (a, b) => new Date(b.trashedAt) - new Date(a.trashedAt)
      );
      setItems(merged);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || t('toast.error'));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const restore = async (item) => {
    try {
      if (item.type === 'folder') await trashApi.restoreFolder(item.id);
      else await trashApi.restoreFile(item.id);
      toast.success(t('toast.restored'));
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || t('toast.error'));
    }
  };

  const deleteForever = async () => {
    const item = confirm;
    setBusy(true);
    try {
      if (item.type === 'folder') await trashApi.deleteFolder(item.id);
      else await trashApi.deleteFile(item.id);
      toast.success(t('toast.deletedForever'));
      setConfirm(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || t('toast.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">
        <Trash2 size={24} style={{ verticalAlign: '-4px', marginRight: 8 }} />
        {t('trash.title')}
      </h1>

      {!isAdmin && (
        <div
          className="card"
          style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18 }}
        >
          <Info size={18} style={{ color: 'var(--accent)' }} />
          <span className="muted tiny">{t('trash.adminOnly')}</span>
        </div>
      )}

      {loading ? (
        <GridSkeleton count={6} />
      ) : items.length === 0 ? (
        <EmptyState icon={<Trash2 size={30} />} title={t('trash.empty')} hint={t('trash.emptyHint')} />
      ) : (
        <div className="panel table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>{t('common.name')}</th>
                <th>{t('trash.originalPath')}</th>
                <th>{t('common.size')}</th>
                <th>{t('trash.deletedBy')}</th>
                <th>{t('trash.deletedAt')}</th>
                {isAdmin && <th style={{ textAlign: 'right' }}>{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.type}-${item.id}`}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <FileIcon
                        category={item.type === 'folder' ? 'folder' : categorize(item)}
                        size={22}
                      />
                      <span style={{ fontWeight: 540 }}>{item.name}</span>
                    </div>
                  </td>
                  <td className="muted tiny">{item.originalPath}</td>
                  <td className="muted">{item.type === 'file' ? formatBytes(item.sizeBytes, locale) : '—'}</td>
                  <td className="muted">{item.trashedByName || '—'}</td>
                  <td className="muted tiny">{formatDateTime(item.trashedAt, locale)}</td>
                  {isAdmin && (
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost" onClick={() => restore(item)}>
                          <RotateCcw size={16} /> {t('trash.restore')}
                        </button>
                        <button className="btn-icon" onClick={() => setConfirm(item)} title={t('trash.deleteForever')}>
                          <Trash size={18} style={{ color: 'var(--danger)' }} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={deleteForever}
        title={t('trash.deleteForever')}
        message={`${confirm?.name} — ${t('trash.deleteForeverConfirm')}`}
        confirmLabel={t('trash.deleteForever')}
        danger
        loading={busy}
      />
    </div>
  );
}
