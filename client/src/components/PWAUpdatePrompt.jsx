import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, X } from 'lucide-react';

/**
 * Shows a banner when a new version of the app is available, letting the user
 * reload to update. Prevents the "stale service worker" problem.
 */
export default function PWAUpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      // Check for a new version every 30 minutes.
      if (r) setInterval(() => r.update().catch(() => {}), 30 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="pwa-update">
      <RefreshCw size={18} />
      <span>{t('pwa.newVersion')}</span>
      <button className="btn btn-primary" onClick={() => updateServiceWorker(true)}>
        {t('pwa.update')}
      </button>
      <button className="btn-icon" onClick={() => setNeedRefresh(false)} aria-label={t('pwa.later')}>
        <X size={18} />
      </button>
    </div>
  );
}
