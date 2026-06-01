import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react';

import { adminApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { formatDateTime } from '../../utils/format';
import { TableSkeleton } from '../../components/Skeleton';

const ACTIONS = [
  'login', 'logout', 'upload_file', 'download_file', 'preview_file',
  'create_folder', 'rename_file', 'rename_folder', 'move_file', 'move_folder',
  'trash_file', 'trash_folder', 'restore_file', 'restore_folder',
  'permanent_delete_file', 'permanent_delete_folder',
  'create_user', 'update_user', 'block_user', 'delete_user',
];

const ACTION_BADGE = {
  login: 'badge-success',
  logout: '',
  upload_file: 'badge-accent',
  download_file: '',
  trash_file: 'badge-danger',
  trash_folder: 'badge-danger',
  permanent_delete_file: 'badge-danger',
  permanent_delete_folder: 'badge-danger',
  delete_user: 'badge-danger',
  block_user: 'badge-danger',
};

const PAGE = 25;

function detailText(log) {
  const v = log.newValue || log.oldValue;
  if (!v) return '—';
  if (v.name) return v.name;
  if (v.username) return v.username;
  if (v.passwordChanged) return '🔑';
  return '—';
}

export default function AdminLogs() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('tr') ? 'tr' : 'ru';
  const toast = useToast();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.logs({ limit: PAGE, offset, action: action || undefined });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || t('toast.error'));
    } finally {
      setLoading(false);
    }
  }, [offset, action, t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const page = Math.floor(offset / PAGE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div>
      <div className="toolbar">
        <h1 className="page-title" style={{ margin: 0 }}>
          <ScrollText size={22} style={{ verticalAlign: '-3px', marginRight: 8 }} />
          {t('admin.logs')}
        </h1>
        <div className="grow" />
        <select
          className="select"
          style={{ width: 'auto' }}
          value={action}
          onChange={(e) => {
            setOffset(0);
            setAction(e.target.value);
          }}
        >
          <option value="">{t('admin.filterAction')}: {t('common.all')}</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {t(`actions.${a}`, a)}
            </option>
          ))}
        </select>
      </div>

      <div className="panel table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{t('admin.when')}</th>
              <th>{t('admin.user')}</th>
              <th>{t('admin.action')}</th>
              <th>{t('admin.details')}</th>
              <th>{t('admin.ip')}</th>
            </tr>
          </thead>
          {loading ? (
            <TableSkeleton rows={8} cols={5} />
          ) : (
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                    {t('admin.noLogs')}
                  </td>
                </tr>
              ) : (
                items.map((log) => (
                  <tr key={log.id}>
                    <td className="muted tiny" style={{ whiteSpace: 'nowrap' }}>
                      {formatDateTime(log.createdAt, locale)}
                    </td>
                    <td style={{ fontWeight: 540 }}>{log.username || '—'}</td>
                    <td>
                      <span className={`badge ${ACTION_BADGE[log.action] || ''}`}>
                        {t(`actions.${log.action}`, log.action)}
                      </span>
                    </td>
                    <td className="muted">
                      {detailText(log)}
                      {log.targetType !== 'auth' && log.targetType !== 'system' && (
                        <span className="tiny muted"> ({log.targetType} #{log.targetId})</span>
                      )}
                    </td>
                    <td className="muted tiny">{log.ipAddress || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          )}
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
        <span className="muted tiny">
          {page} / {pages} · {total}
        </span>
        <button className="btn-icon" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
          <ChevronLeft size={20} />
        </button>
        <button
          className="btn-icon"
          disabled={offset + PAGE >= total}
          onClick={() => setOffset(offset + PAGE)}
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
