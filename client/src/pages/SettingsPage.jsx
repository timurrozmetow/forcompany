import { useTranslation } from 'react-i18next';
import { Sun, Moon, Monitor, Globe, User, LogOut, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { initials } from '../utils/format';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const themeOption = (value, Icon, label) => (
    <button
      className={`btn ${theme === value ? 'btn-primary' : ''}`}
      onClick={() => setTheme(value)}
      style={{ flex: 1, justifyContent: 'center' }}
    >
      <Icon size={17} /> {label}
    </button>
  );

  const langOption = (value, label) => (
    <button
      className={`btn ${i18n.language?.startsWith(value) ? 'btn-primary' : ''}`}
      onClick={() => i18n.changeLanguage(value)}
      style={{ flex: 1, justifyContent: 'center' }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 className="page-title">{t('settings.title')}</h1>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head">
          <User size={17} style={{ verticalAlign: '-3px', marginRight: 8 }} />
          {t('settings.account')}
        </div>
        <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="avatar" style={{ width: 48, height: 48, fontSize: 17 }}>
            {initials(user?.username)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 640, fontSize: 16 }}>{user?.username}</div>
            <div className="muted tiny" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {isAdmin && <Shield size={13} style={{ color: 'var(--accent)' }} />}
              {isAdmin ? t('admin.roleAdmin') : t('admin.roleUser')}
            </div>
          </div>
          <button
            className="btn btn-danger"
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
          >
            <LogOut size={17} /> {t('nav.logout')}
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head">{t('settings.appearance')}</div>
        <div style={{ padding: 20 }}>
          <div className="field">
            <label>{t('settings.theme')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {themeOption('light', Sun, t('settings.themeLight'))}
              {themeOption('dark', Moon, t('settings.themeDark'))}
              {themeOption('system', Monitor, t('settings.themeSystem'))}
            </div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>
              <Globe size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
              {t('settings.language')}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {langOption('ru', 'Русский')}
              {langOption('tr', 'Türkçe')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
