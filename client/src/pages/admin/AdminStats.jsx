import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Files, Folder, HardDrive, Users, Activity, Trash2, UserCheck } from 'lucide-react';

import { adminApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { formatBytes, formatDateTime, initials } from '../../utils/format';

function StatCard({ icon, num, label }) {
  return (
    <div className="stat-card">
      <div className="ic">{icon}</div>
      <div className="num">{num}</div>
      <div className="lbl">{label}</div>
    </div>
  );
}

export default function AdminStats() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('tr') ? 'tr' : 'ru';
  const toast = useToast();
  const [data, setData] = useState(null);

  useEffect(() => {
    adminApi
      .stats()
      .then(setData)
      .catch((err) => toast.error(err?.response?.data?.error?.message || t('toast.error')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tt = data?.totals;

  return (
    <div>
      <h1 className="page-title">{t('admin.stats')}</h1>

      <div className="stat-grid">
        <StatCard icon={<Files size={20} />} num={tt ? tt.totalFiles : '—'} label={t('admin.totalFiles')} />
        <StatCard icon={<Folder size={20} />} num={tt ? tt.totalFolders : '—'} label={t('drive.folders')} />
        <StatCard
          icon={<HardDrive size={20} />}
          num={tt ? formatBytes(tt.totalSizeBytes, locale) : '—'}
          label={t('admin.totalSize')}
        />
        <StatCard icon={<Users size={20} />} num={tt ? tt.totalUsers : '—'} label={t('admin.totalUsers')} />
        <StatCard icon={<UserCheck size={20} />} num={tt ? tt.activeUsers : '—'} label={t('admin.activeUsers')} />
        <StatCard
          icon={<Trash2 size={20} />}
          num={tt ? tt.trashedFiles + tt.trashedFolders : '—'}
          label={t('nav.trash')}
        />
      </div>

      {data?.storage?.diskTotalBytes ? (
        <div className="panel" style={{ marginBottom: 18 }}>
          <div className="panel-head">
            <HardDrive size={17} style={{ verticalAlign: '-3px', marginRight: 8 }} />
            {t('admin.diskUsage')}
          </div>
          <div style={{ padding: 20 }}>
            {(() => {
              const total = data.storage.diskTotalBytes;
              const used = data.storage.diskUsedBytes;
              const free = data.storage.diskFreeBytes;
              const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
              return (
                <>
                  <div className="disk-meter">
                    <span className={pct > 85 ? 'warn' : ''} style={{ width: `${pct}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }} className="muted">
                    <span>
                      {t('admin.diskUsed')}: <strong style={{ color: 'var(--text)' }}>{formatBytes(used, locale)}</strong> ({pct}%)
                    </span>
                    <span>
                      {t('admin.diskFree')}: {formatBytes(free, locale)} / {formatBytes(total, locale)}
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}

      <div className="panel">
        <div className="panel-head">
          <Activity size={17} style={{ verticalAlign: '-3px', marginRight: 8 }} />
          {t('admin.activeNow')}
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>{t('admin.user')}</th>
                <th>{t('admin.role')}</th>
                <th>{t('admin.lastLogin')}</th>
              </tr>
            </thead>
            <tbody>
              {data?.recentlyActiveUsers?.length ? (
                data.recentlyActiveUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                          {initials(u.username)}
                        </div>
                        <span style={{ fontWeight: 540 }}>{u.username}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-accent' : ''}`}>
                        {u.role === 'admin' ? t('admin.roleAdmin') : t('admin.roleUser')}
                      </span>
                    </td>
                    <td className="muted tiny">{formatDateTime(u.lastActive, locale)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="muted" style={{ textAlign: 'center', padding: 28 }}>
                    {t('admin.noLogs')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
