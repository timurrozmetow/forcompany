import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Star, FolderOpen, Eye, Download, FileArchive, StarOff } from 'lucide-react';

import { favoriteApi, fileApi } from '../api';
import { useToast } from '../context/ToastContext';
import FileExplorer from '../components/FileExplorer';
import EmptyState from '../components/EmptyState';
import { GridSkeleton } from '../components/Skeleton';
import ContextMenu from '../components/ContextMenu';
import PreviewModal from '../components/PreviewModal';

const noop = () => {};
const EMPTY = new Set();

export default function FavoritesPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('tr') ? 'tr' : 'ru';
  const navigate = useNavigate();
  const toast = useToast();

  const [data, setData] = useState({ folders: [], files: [] });
  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState(null);
  const [preview, setPreview] = useState(null);
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await favoriteApi.list());
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || t('toast.error'));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const entries = useMemo(
    () => [...data.folders, ...data.files].sort((a, b) => a.name.localeCompare(b.name)),
    [data]
  );
  const favoriteKeys = useMemo(
    () => new Set(entries.map((e) => `${e.type}-${e.id}`)),
    [entries]
  );

  const open = (item) =>
    item.type === 'folder' ? navigate(`/drive/folder/${item.id}`) : setPreview(item);

  const anchor = (href, label) => {
    const a = document.createElement('a');
    a.href = href;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (label) toast.info(label);
  };

  const removeFav = async (item) => {
    const target = item.type === 'file' ? { fileId: item.id } : { folderId: item.id };
    try {
      await favoriteApi.remove(target);
      toast.success(t('toast.removed'));
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || t('toast.error'));
    }
  };

  const menuItems = (item) => {
    const list = [
      {
        label: t('common.open'),
        icon: item.type === 'folder' ? <FolderOpen size={17} /> : <Eye size={17} />,
        onClick: () => open(item),
      },
    ];
    if (item.type === 'file') {
      list.push({ label: t('common.download'), icon: <Download size={17} />, onClick: () => anchor(fileApi.downloadUrl(item.id)) });
    } else {
      list.push({ label: t('select.downloadZip'), icon: <FileArchive size={17} />, onClick: () => anchor(fileApi.folderZipUrl(item.id)) });
    }
    list.push({ separator: true });
    list.push({ label: t('favorites.remove'), icon: <StarOff size={17} />, danger: true, onClick: () => removeFav(item) });
    return list;
  };

  return (
    <div>
      <h1 className="page-title">
        <Star size={22} style={{ verticalAlign: '-3px', marginRight: 8, color: 'var(--warning)' }} fill="currentColor" />
        {t('nav.favorites')}
      </h1>

      {loading ? (
        <GridSkeleton count={8} />
      ) : entries.length === 0 ? (
        <EmptyState icon={<Star size={30} />} title={t('favorites.empty')} hint={t('favorites.emptyHint')} />
      ) : (
        <FileExplorer
          items={entries}
          view="grid"
          locale={locale}
          onOpen={open}
          onMenu={(x, y, item) => setMenu({ x, y, item })}
          selectedKeys={EMPTY}
          onToggleSelect={noop}
          favoriteKeys={favoriteKeys}
          onDropMove={noop}
          sort={sort}
          onSort={(key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))}
        />
      )}

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.item)} onClose={() => setMenu(null)} />
      )}
      {preview && (
        <PreviewModal
          file={preview}
          onClose={() => setPreview(null)}
          locale={locale}
          isFavorite
          onToggleFavorite={() => removeFav(preview)}
        />
      )}
    </div>
  );
}
