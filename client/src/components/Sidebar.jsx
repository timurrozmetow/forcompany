import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  HardDrive,
  Trash2,
  Users,
  ScrollText,
  BarChart3,
  Settings,
  LayoutDashboard,
  LogOut,
  Cloud,
  Star,
  Clock,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ open, onClose }) {
  const { t } = useTranslation();
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const item = (to, Icon, label, end = false) => (
    <NavLink
      to={to}
      end={end}
      onClick={onClose}
      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
    >
      <Icon size={19} strokeWidth={1.9} />
      <span>{label}</span>
    </NavLink>
  );

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <span className="logo">
          <Cloud size={20} />
        </span>
        <span>{t('app.name')}</span>
      </div>

      <div className="nav-section-label">{t('nav.main')}</div>
      {item('/drive', HardDrive, t('nav.drive'))}
      {item('/worklog', ClipboardList, t('nav.worklog'))}
      {item('/favorites', Star, t('nav.favorites'))}
      {item('/recent', Clock, t('nav.recent'))}
      {item('/trash', Trash2, t('nav.trash'))}

      {isAdmin && (
        <>
          <div className="nav-section-label">{t('nav.administration')}</div>
          {item('/admin', LayoutDashboard, t('admin.dashboard'), true)}
          {item('/admin/users', Users, t('nav.users'))}
          {item('/admin/logs', ScrollText, t('nav.logs'))}
          {item('/admin/stats', BarChart3, t('nav.stats'))}
        </>
      )}

      <div className="sidebar-footer">
        {item('/settings', Settings, t('nav.settings'))}
        <div className="nav-item" onClick={handleLogout} role="button">
          <LogOut size={19} strokeWidth={1.9} />
          <span>{t('nav.logout')}</span>
        </div>
        <div className="storage-meter tiny muted">
          {t('settings.loggedInAs')}: <strong style={{ color: 'var(--text)' }}>{user?.username}</strong>
        </div>
      </div>
    </aside>
  );
}
