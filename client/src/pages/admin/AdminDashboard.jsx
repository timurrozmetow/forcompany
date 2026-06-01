import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Files, HardDrive, Users, Activity, UploadCloud, Trash2 } from 'lucide-react';

import { adminApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { formatBytes, formatDateTime, relativeTime, initials } from '../../utils/format';

function StatCard({ icon, num, label }) {
  return (
    <div className="stat-card">
      <div className="ic">{icon}</div>
      <div className="num">{num}</div>
      <div className="lbl">{label}</div>
    </div>
  );
}

export default function AdminDashboard() {
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

  const totals = data?.totals;

  return (
    <div>
      <h1 className="page-title">{t('admin.dashboard')}</h1>

      <div className="stat-grid">
        <StatCard icon={<Files size={20} />} num={totals ? totals.totalFiles : '—'} label={t('admin.totalFiles')} />
        <StatCard
          icon={<HardDrive size={20} />}
          num={totals ? formatBytes(totals.totalSizeBytes, locale) : '—'}
          label={t('admin.totalSize')}
        />
        <StatCard icon={<Users size={20} />} num={totals ? totals.totalUsers : '—'} label={t('admin.totalUsers')} />
        <StatCard
          icon={<Activity size={20} />}
          num={totals ? totals.activeUsers : '—'}
          label={t('admin.activeUsers')}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
        <div className="panel">
          <div className="panel-head">
            <UploadCloud size={17} style={{ verticalAlign: '-3px', marginRight: 8 }} />
            {t('admin.recentUploads')}
          </div>
          <div className="table-scroll">
            <table className="table">
              <tbody>
                {data?.recentUploads?.length ? (
                  data.recentUploads.map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 540 }}>{u.name}</td>
                      <td className="muted">{formatBytes(u.sizeBytes, locale)}</td>
                      <td className="muted tiny">{u.uploadedByName}</td>
                      <td className="muted tiny">{relativeTime(u.createdAt, locale)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="muted">{t('admin.noLogs')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <Trash2 size={17} style={{ verticalAlign: '-3px', marginRight: 8 }} />
            {t('admin.recentDeletions')}
          </div>
          <div className="table-scroll">
            <table className="table">
              <tbody>
                {data?.recentDeletions?.length ? (
                  data.recentDeletions.map((d) => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 540 }}>{d.detail?.name || `#${d.targetId}`}</td>
                      <td className="muted tiny">{t(`actions.${d.action}`, d.action)}</td>
                      <td className="muted tiny">{d.username || '—'}</td>
                      <td className="muted tiny">{relativeTime(d.createdAt, locale)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="muted">{t('admin.noLogs')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <Activity size={17} style={{ verticalAlign: '-3px', marginRight: 8 }} />
          {t('admin.activeNow')}
        </div>
        <div style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {data?.recentlyActiveUsers?.length ? (
            data.recentlyActiveUsers.map((u) => (
              <div
                key={u.id}
                className="card"
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px 8px 8px' }}
              >
                <div className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>
                  {initials(u.username)}
                </div>
                <div>
                  <div style={{ fontWeight: 560, fontSize: 13 }}>{u.username}</div>
                  <div className="muted tiny">{formatDateTime(u.lastActive, locale)}</div>
                </div>
              </div>
            ))
          ) : (
            <span className="muted tiny">{t('admin.noLogs')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
