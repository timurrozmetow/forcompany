import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Cloud, Loader2, Sun, Moon, Languages } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { errorMessage } from '../api/client';

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const { resolved, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || '/drive';

  const switchLang = () => {
    i18n.changeLanguage(i18n.language?.startsWith('tr') ? 'ru' : 'tr');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError(t('auth.required'));
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      const code = err?.response?.data?.error?.code;
      if (code === 'BLOCKED') setError(t('auth.blocked'));
      else if (err?.response?.status === 401) setError(t('auth.invalid'));
      else setError(errorMessage(err, t('toast.error')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div style={{ position: 'fixed', top: 18, right: 18, display: 'flex', gap: 6 }}>
        <button className="btn-icon" onClick={switchLang} aria-label="Language">
          <Languages size={20} />
          <span className="tiny" style={{ marginLeft: 2, fontWeight: 700 }}>
            {i18n.language?.startsWith('tr') ? 'TR' : 'RU'}
          </span>
        </button>
        <button className="btn-icon" onClick={toggle} aria-label="Theme">
          {resolved === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">
          <Cloud size={28} />
        </div>
        <h1>{t('auth.loginTitle')}</h1>
        <p className="sub">{t('auth.loginSubtitle')}</p>

        {error && <div className="login-error">{error}</div>}

        <div className="field">
          <label htmlFor="username">{t('auth.username')}</label>
          <input
            id="username"
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </div>

        <div className="field">
          <label htmlFor="password">{t('auth.password')}</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{ marginTop: 6 }}>
          {loading ? (
            <>
              <Loader2 size={18} className="spin" /> {t('auth.signingIn')}
            </>
          ) : (
            t('auth.signIn')
          )}
        </button>
      </form>
    </div>
  );
}
