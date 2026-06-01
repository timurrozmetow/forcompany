import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Eye, Download } from 'lucide-react';

import { recentApi, fileApi } from '../api';
import { useToast } from '../context/ToastContext';
import FileExplorer from '../components/FileExplorer';
import EmptyState from '../components/EmptyState';
import { GridSkeleton } from '../components/Skeleton';
import ContextMenu from '../components/ContextMenu';
import PreviewModal from '../components/PreviewModal';

const noop = () => {};
const EMPTY = new Set();

export default function RecentPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('tr') ? 'tr' : 'ru';
  const toast = useToast();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState(null);
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFiles(await recentApi.list());
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || t('toast.error'));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const anchor = (href) => {
    const a = document.createElement('a');
    a.href = href;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const menuItems = (item) => [
    { label: t('common.open'), icon: <Eye size={17} />, onClick: () => setPreview(item) },
    { label: t('common.download'), icon: <Download size={17} />, onClick: () => anchor(fileApi.downloadUrl(item.id)) },
  ];

  return (
    <div>
      <h1 className="page-title">
        <Clock size={22} style={{ verticalAlign: '-3px', marginRight: 8 }} />
        {t('nav.recent')}
      </h1>

      {loading ? (
        <GridSkeleton count={8} />
      ) : files.length === 0 ? (
        <EmptyState icon={<Clock size={30} />} title={t('recent.empty')} hint={t('recent.emptyHint')} />
      ) : (
        <FileExplorer
          items={files}
          view="grid"
          locale={locale}
          onOpen={(item) => setPreview(item)}
          onMenu={(x, y, item) => setMenu({ x, y, item })}
          selectedKeys={EMPTY}
          onToggleSelect={noop}
          favoriteKeys={EMPTY}
          onDropMove={noop}
          sort={{ key: 'date', dir: 'desc' }}
          onSort={noop}
        />
      )}

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.item)} onClose={() => setMenu(null)} />
      )}
      {preview && <PreviewModal file={preview} onClose={() => setPreview(null)} locale={locale} />}
    </div>
  );
}
