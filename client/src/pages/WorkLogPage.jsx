import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  FileText,
  FileType2,
  BarChart3,
  Loader2,
} from 'lucide-react';

import { workLogApi, userApi } from '../api';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../utils/format';
import InputModal from '../components/InputModal';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';

const pad = (n) => String(n).padStart(2, '0');
const nowMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${ym}-01`, to: `${ym}-${pad(last)}` };
}

export default function WorkLogPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('tr') ? 'tr' : 'ru';
  const { user, isAdmin } = useAuth();
  const toast = useToast();

  const [month, setMonth] = useState(nowMonth);
  const [selectedUserId, setSelectedUserId] = useState(user?.id);
  const [users, setUsers] = useState([]);
  const [data, setData] = useState({ entries: [] });
  const [summary, setSummary] = useState({ perUser: [], total: 0 });
  const [loading, setLoading] = useState(true);

  const [newContent, setNewContent] = useState('');
  const [newDate, setNewDate] = useState(todayStr);
  const [adding, setAdding] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [delEntry, setDelEntry] = useState(null);
  const [busy, setBusy] = useState(false);

  const range = useMemo(() => monthRange(month), [month]);

  useEffect(() => {
    if (isAdmin) userApi.basic().then(setUsers).catch(() => {});
  }, [isAdmin]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([
        workLogApi.list({ userId: selectedUserId, from: range.from, to: range.to }),
        workLogApi.summary({ from: range.from, to: range.to }),
      ]);
      setData(list);
      setSummary(sum);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || t('toast.error'));
    } finally {
      setLoading(false);
    }
  }, [selectedUserId, range.from, range.to, t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const e of data.entries) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
    }
    return [...map.entries()];
  }, [data]);

  const addEntry = async () => {
    if (!newContent.trim() || adding) return;
    setAdding(true);
    try {
      await workLogApi.add({ userId: selectedUserId, content: newContent.trim(), entryDate: newDate });
      setNewContent('');
      toast.success(t('worklog.added'));
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || t('toast.error'));
    } finally {
      setAdding(false);
    }
  };

  const saveEdit = async (content) => {
    await workLogApi.update(editEntry.id, { content });
    toast.success(t('toast.renamed'));
    load();
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await workLogApi.remove(delEntry.id);
      setDelEntry(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || t('toast.error'));
    } finally {
      setBusy(false);
    }
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const exportLink = async (format, allUsers = false) => {
    const params = { format, from: range.from, to: range.to };
    if (!allUsers && selectedUserId) params.userId = selectedUserId;
    const base = `worklog-${range.from}_${range.to}`;
    try {
      const res = await api.get('/worklogs/export', { params, responseType: 'blob' });
      downloadBlob(res.data, `${base}.${format}`);
    } catch (err) {
      // 501 (no LibreOffice) -> fall back to HTML, which Word opens fine.
      if (format !== 'html') {
        toast.info(t('worklog.exportFallback'));
        try {
          const res = await api.get('/worklogs/export', {
            params: { ...params, format: 'html' },
            responseType: 'blob',
          });
          downloadBlob(res.data, `${base}.html`);
        } catch (_) {
          toast.error(t('toast.error'));
        }
      } else {
        toast.error(t('toast.error'));
      }
    }
  };

  const selectedName =
    selectedUserId === user?.id
      ? user?.username
      : users.find((u) => u.id === Number(selectedUserId))?.username || '';

  return (
    <div>
      <div className="toolbar">
        <h1 className="page-title" style={{ margin: 0 }}>
          <ClipboardList size={24} style={{ verticalAlign: '-4px', marginRight: 8 }} />
          {t('worklog.title')}
        </h1>
        <div className="grow" />
        <input
          className="input"
          style={{ width: 'auto' }}
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        {isAdmin && (
          <select
            className="select"
            style={{ width: 'auto' }}
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(Number(e.target.value))}
          >
            {!users.some((u) => u.id === user?.id) && <option value={user?.id}>{user?.username}</option>}
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username}
              </option>
            ))}
          </select>
        )}
        <button className="btn btn-ghost" onClick={() => exportLink('pdf')} title="PDF">
          <FileText size={17} /> PDF
        </button>
        <button className="btn btn-ghost" onClick={() => exportLink('docx')} title="Word">
          <FileType2 size={17} /> Word
        </button>
      </div>

      {/* Add entry */}
      <div className="card" style={{ padding: 16, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ width: 'auto' }}
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
          <input
            className="input"
            style={{ flex: 1, minWidth: 200 }}
            placeholder={t('worklog.placeholder')}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addEntry()}
          />
          <button className="btn btn-primary" onClick={addEntry} disabled={adding || !newContent.trim()}>
            {adding ? <Loader2 size={17} className="spin" /> : <Plus size={17} />} {t('worklog.add')}
          </button>
        </div>
        {isAdmin && selectedUserId !== user?.id && (
          <div className="muted tiny" style={{ marginTop: 8 }}>
            {t('worklog.addingFor')}: <strong>{selectedName}</strong>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 18, alignItems: 'start' }} className="wl-grid">
        {/* Entries */}
        <div className="panel">
          <div className="panel-head">
            {t('worklog.entriesOf')} {selectedName} · {data.entries?.length || 0}
          </div>
          <div style={{ padding: 16 }}>
            {loading ? (
              <div className="loading-row">
                <Loader2 size={22} className="spin" style={{ color: 'var(--accent)' }} />
              </div>
            ) : grouped.length === 0 ? (
              <EmptyState icon={<ClipboardList size={28} />} title={t('worklog.empty')} hint={t('worklog.emptyHint')} />
            ) : (
              grouped.map(([date, items]) => (
                <div key={date} style={{ marginBottom: 14 }}>
                  <div className="wl-date">{formatDate(date, locale)}</div>
                  <ol className="wl-list">
                    {items.map((e) => (
                      <li key={e.id} className="wl-item">
                        <span className="wl-text">{e.content}</span>
                        <span className="wl-actions">
                          <button className="btn-icon" onClick={() => setEditEntry(e)} aria-label="edit">
                            <Pencil size={15} />
                          </button>
                          <button className="btn-icon" onClick={() => setDelEntry(e)} aria-label="delete">
                            <Trash2 size={15} style={{ color: 'var(--danger)' }} />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Monthly analysis */}
        <div className="panel">
          <div className="panel-head">
            <BarChart3 size={16} style={{ verticalAlign: '-3px', marginRight: 7 }} />
            {t('worklog.analysis')}
          </div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('admin.user')}</th>
                  <th style={{ textAlign: 'right' }}>{t('worklog.entriesCol')}</th>
                  <th style={{ textAlign: 'right' }}>{t('worklog.days')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.perUser.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted" style={{ textAlign: 'center', padding: 20 }}>
                      {t('admin.noLogs')}
                    </td>
                  </tr>
                ) : (
                  summary.perUser.map((u) => (
                    <tr
                      key={u.userId}
                      style={{ cursor: isAdmin ? 'pointer' : 'default' }}
                      onClick={() => isAdmin && setSelectedUserId(u.userId)}
                    >
                      <td style={{ fontWeight: 540 }}>{u.username}</td>
                      <td style={{ textAlign: 'right' }}>{u.entries}</td>
                      <td style={{ textAlign: 'right' }} className="muted">{u.activeDays}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: 12, display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)' }}>
            <span className="muted tiny">{t('worklog.total')}: {summary.total}</span>
            {isAdmin && (
              <span style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost tiny" onClick={() => exportLink('pdf', true)}>{t('worklog.allPdf')}</button>
                <button className="btn btn-ghost tiny" onClick={() => exportLink('docx', true)}>{t('worklog.allWord')}</button>
              </span>
            )}
          </div>
        </div>
      </div>

      <InputModal
        open={!!editEntry}
        onClose={() => setEditEntry(null)}
        onSubmit={saveEdit}
        title={t('common.edit')}
        label={t('worklog.entry')}
        initialValue={editEntry?.content || ''}
        confirmLabel={t('common.save')}
      />
      <ConfirmDialog
        open={!!delEntry}
        onClose={() => setDelEntry(null)}
        onConfirm={doDelete}
        title={t('common.delete')}
        message={delEntry?.content}
        confirmLabel={t('common.delete')}
        danger
        loading={busy}
      />
    </div>
  );
}
