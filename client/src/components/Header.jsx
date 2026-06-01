import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Menu, Sun, Moon, Languages } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { initials } from '../utils/format';

export default function Header({ onMenuClick }) {
  const { t, i18n } = useTranslation();
  const { resolved, toggle } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');

  // Keep the field in sync with the URL when on the drive search view.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setQ(params.get('q') || '');
  }, [location.search]);

  // Debounced search -> navigates to /drive?q=
  useEffect(() => {
    const handle = setTimeout(() => {
      const current = new URLSearchParams(location.search).get('q') || '';
      if (q.trim() === current) return;
      if (q.trim()) {
        navigate(`/drive?q=${encodeURIComponent(q.trim())}`);
      } else if (current) {
        navigate('/drive');
      }
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const switchLang = () => {
    const next = i18n.language?.startsWith('tr') ? 'ru' : 'tr';
    i18n.changeLanguage(next);
  };

  return (
    <header className="header">
      <button className="btn-icon mobile-only" onClick={onMenuClick} aria-label="Menu">
        <Menu size={22} />
      </button>

      <div className="search-box">
        <Search size={18} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('common.search')}
          aria-label={t('common.search')}
        />
      </div>

      <div className="header-actions">
        <button className="btn-icon" onClick={switchLang} title="RU / TR" aria-label="Language">
          <Languages size={20} />
          <span className="tiny" style={{ marginLeft: 2, fontWeight: 700 }}>
            {i18n.language?.startsWith('tr') ? 'TR' : 'RU'}
          </span>
        </button>
        <button className="btn-icon" onClick={toggle} title={t('settings.theme')} aria-label="Theme">
          {resolved === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <div className="avatar" title={user?.username} onClick={() => navigate('/settings')}>
          {initials(user?.username)}
        </div>
      </div>
    </header>
  );
}
