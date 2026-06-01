import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, X } from 'lucide-react';
import { storageApi } from '../api';
import { formatBytes } from '../utils/format';

/**
 * Polls storage quota and shows a dismissible banner when free space is low.
 */
export default function LowSpaceBanner({ locale }) {
  const { t } = useTranslation();
  const [quota, setQuota] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () =>
      storageApi
        .quota()
        .then((q) => active && setQuota(q))
        .catch(() => {});
    load();
    const id = setInterval(load, 60000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  if (!quota || !quota.low || dismissed) return null;

  return (
    <div className="lowspace-banner">
      <AlertTriangle size={18} />
      <span>
        {t('storage.lowSpace')} — {t('admin.diskFree')}: <strong>{formatBytes(quota.freeBytes, locale)}</strong> /{' '}
        {formatBytes(quota.totalBytes, locale)}
      </span>
      <button className="btn-icon" onClick={() => setDismissed(true)} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}
