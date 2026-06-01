import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HardDrive, Trash2, LayoutDashboard, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function BottomNav() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();

  const item = (to, Icon, label, end = false) => (
    <NavLink to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
      <Icon size={21} strokeWidth={1.9} />
      <span>{label}</span>
    </NavLink>
  );

  return (
    <nav className="bottom-nav">
      {item('/drive', HardDrive, t('nav.drive'))}
      {item('/trash', Trash2, t('nav.trash'))}
      {isAdmin && item('/admin', LayoutDashboard, t('nav.admin'), true)}
      {item('/settings', Settings, t('nav.settings'))}
    </nav>
  );
}
