import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FolderPlus,
  Upload,
  LayoutGrid,
  List as ListIcon,
  FolderOpen,
  Download,
  Pencil,
  FolderInput,
  Trash2,
  Eye,
  Inbox,
  Search as SearchIcon,
  FileArchive,
  X,
} from 'lucide-react';

import { folderApi, fileApi, searchApi } from '../api';
import { useToast } from '../context/ToastContext';
import { categorize } from '../utils/fileType';
import { useUploader } from '../hooks/useUploader';

import Breadcrumbs from '../components/Breadcrumbs';
import FileExplorer from '../components/FileExplorer';
import EmptyState from '../components/EmptyState';
import { GridSkeleton, ListSkeleton } from '../components/Skeleton';
import ContextMenu from '../components/ContextMenu';
import InputModal from '../components/InputModal';
import MoveModal from '../components/MoveModal';
import PreviewModal from '../components/PreviewModal';
import ConfirmDialog from '../components/ConfirmDialog';
import UploadPanel from '../components/UploadPanel';

const VIEW_KEY = 'cd_view';

function sortEntries(folders, files, sort) {
  const dir = sort.dir === 'asc' ? 1 : -1;
  const cmp = (a, b) => {
    switch (sort.key) {
      case 'date':
        return (new Date(a.createdAt) - new Date(b.createdAt)) * dir;
      case 'size':
        return ((a.sizeBytes || 0) - (b.sizeBytes || 0)) * dir;
      case 'type': {
        const ta = a.type === 'folder' ? '' : categorize(a);
        const tb = b.type === 'folder' ? '' : categorize(b);
        return ta.localeCompare(tb) * dir || a.name.localeCompare(b.name);
      }
      default:
        return a.name.localeCompare(b.name, undefined, { numeric: true }) * dir;
    }
  };
  return [...[...folders].sort(cmp), ...[...files].sort(cmp)];
}

export default function DrivePage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('tr') ? 'tr' : 'ru';
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const folderId = params.id ? Number(params.id) : null;
  const searchQuery = searchParams.get('q') || '';
  const isSearching = searchQuery.trim().length > 0;

  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [crumbs, setCrumbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) || 'grid');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });

  const [menu, setMenu] = useState(null); // { x, y, item }
  const [createOpen, setCreateOpen] = useState(false);
  const [renameItem, setRenameItem] = useState(null);
  const [moveItem, setMoveItem] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [trashItem, setTrashItem] = useState(null);
  const [trashing, setTrashing] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);
  const uploader = useUploader();

  const setViewPersist = (v) => {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isSearching) {
        const res = await searchApi.query(searchQuery.trim());
        setFolders(res.folders);
        setFiles(res.files);
        setCrumbs([]);
      } else {
        const [folderData, fileList] = await Promise.all([
          folderApi.list(folderId),
          fileApi.list(folderId),
        ]);
        setFolders(folderData.folders);
        setCrumbs(folderData.breadcrumbs || []);
        setFiles(fileList);
      }
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || t('toast.error'));
    } finally {
      setLoading(false);
    }
  }, [folderId, isSearching, searchQuery, t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Clear selection whenever we change folder or enter/exit search.
  useEffect(() => {
    setSelectedKeys(new Set());
  }, [folderId, searchQuery]);

  const entries = useMemo(() => sortEntries(folders, files, sort), [folders, files, sort]);

  const keyOf = (item) => `${item.type}-${item.id}`;
  const toggleSelect = (item) =>
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      const k = keyOf(item);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  const clearSelection = () => setSelectedKeys(new Set());
  const selectedItems = useMemo(
    () => entries.filter((e) => selectedKeys.has(keyOf(e))),
    [entries, selectedKeys]
  );

  const openItem = (item) => {
    if (item.type === 'folder') navigate(`/drive/folder/${item.id}`);
    else setPreviewFile(item);
  };

  const onSort = (key) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

  const openMenu = (x, y, item) => setMenu({ x, y, item });

  /* ----------------------------- actions -------------------------------- */
  const downloadFile = (item) => {
    // No `download` attribute set on purpose: the server sends
    // Content-Disposition with the ORIGINAL filename, so the file keeps its
    // exact name (incl. Cyrillic/Turkish) on download.
    const a = document.createElement('a');
    a.href = fileApi.downloadUrl(item.id);
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.info(`${t('common.download')}: ${item.name}`);
  };

  const doRename = async (name) => {
    const it = renameItem;
    if (it.type === 'folder') await folderApi.rename(it.id, name);
    else await fileApi.rename(it.id, name);
    toast.success(t('toast.renamed'));
    load();
  };

  const doMove = async (targetId) => {
    const it = moveItem;
    if (it.type === 'folder') await folderApi.move(it.id, targetId);
    else await fileApi.move(it.id, targetId);
    toast.success(t('toast.moved'));
    load();
  };

  const doCreateFolder = async (name) => {
    await folderApi.create(name, folderId);
    toast.success(t('toast.folderCreated'));
    load();
  };

  const doTrash = async () => {
    const it = trashItem;
    setTrashing(true);
    try {
      if (it.type === 'folder') await folderApi.trash(it.id);
      else await fileApi.trash(it.id);
      toast.success(t('toast.trashed'));
      setTrashItem(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || t('toast.error'));
    } finally {
      setTrashing(false);
    }
  };

  const downloadFolderZip = (item) => {
    const a = document.createElement('a');
    a.href = fileApi.folderZipUrl(item.id);
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.info(`${t('common.download')}: ${item.name}.zip`);
  };

  const doBulkMove = async (targetId) => {
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(
        selectedItems.map((it) =>
          it.type === 'folder' ? folderApi.move(it.id, targetId) : fileApi.move(it.id, targetId)
        )
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed) toast.error(`${t('toast.error')} (${failed})`);
      else toast.success(t('toast.moved'));
      setBulkMoveOpen(false);
      clearSelection();
      load();
    } finally {
      setBulkBusy(false);
    }
  };

  const doBulkDelete = async () => {
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(
        selectedItems.map((it) =>
          it.type === 'folder' ? folderApi.trash(it.id) : fileApi.trash(it.id)
        )
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed) toast.error(`${t('toast.error')} (${failed})`);
      else toast.success(t('toast.trashed'));
      setBulkDeleteOpen(false);
      clearSelection();
      load();
    } finally {
      setBulkBusy(false);
    }
  };

  const downloadZipSelection = async () => {
    try {
      const fileIds = selectedItems.filter((i) => i.type === 'file').map((i) => i.id);
      const folderIds = selectedItems.filter((i) => i.type === 'folder').map((i) => i.id);
      const sessionId = await fileApi.createZip(fileIds, folderIds);
      const a = document.createElement('a');
      a.href = fileApi.zipUrl(sessionId);
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.info(`${t('common.download')}: ZIP`);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || t('toast.error'));
    }
  };

  const menuItems = (item) => {
    const list = [
      {
        label: t('common.open'),
        icon: item.type === 'folder' ? <FolderOpen size={17} /> : <Eye size={17} />,
        onClick: () => openItem(item),
      },
    ];
    if (item.type === 'file') {
      list.push({ label: t('common.download'), icon: <Download size={17} />, onClick: () => downloadFile(item) });
    } else {
      list.push({ label: t('select.downloadZip'), icon: <FileArchive size={17} />, onClick: () => downloadFolderZip(item) });
    }
    list.push(
      { label: t('common.rename'), icon: <Pencil size={17} />, onClick: () => setRenameItem(item) },
      { label: t('common.move'), icon: <FolderInput size={17} />, onClick: () => setMoveItem(item) },
      { separator: true },
      { label: t('common.delete'), icon: <Trash2 size={17} />, danger: true, onClick: () => setTrashItem(item) }
    );
    return list;
  };

  /* --------------------------- upload / dnd ----------------------------- */
  const startUpload = (fileList) => {
    if (!fileList || !fileList.length) return;
    uploader.upload(fileList, folderId, { onAllDone: () => load() });
  };

  const onPickFiles = (e) => {
    startUpload(e.target.files);
    e.target.value = '';
  };

  const onDrop = (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    if (e.dataTransfer?.files?.length) startUpload(e.dataTransfer.files);
  };
  const onDragEnter = (e) => {
    e.preventDefault();
    if (isSearching) return;
    dragCounter.current += 1;
    setDragging(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) setDragging(false);
  };

  /* ------------------------------ render -------------------------------- */
  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      style={{ position: 'relative', minHeight: '70vh' }}
    >
      {dragging && (
        <div className="dropzone-overlay">
          <div className="inner">
            <Upload size={40} style={{ marginBottom: 10 }} />
            <div>{t('drive.dropHere')}</div>
          </div>
        </div>
      )}

      {isSearching ? (
        <h1 className="page-title">
          <SearchIcon size={22} style={{ verticalAlign: '-3px', marginRight: 8 }} />
          {t('common.search')}: “{searchQuery}”
        </h1>
      ) : (
        <Breadcrumbs
          crumbs={crumbs}
          onNavigate={(id) => navigate(id ? `/drive/folder/${id}` : '/drive')}
          onBack={() => navigate(-1)}
          onForward={() => navigate(1)}
        />
      )}

      {selectedItems.length > 0 && (
        <div className="selbar">
          <span className="count">
            {t('select.selected')}: {selectedItems.length}
          </span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={downloadZipSelection}>
            <FileArchive size={17} /> {t('select.downloadZip')}
          </button>
          <button className="btn btn-ghost" onClick={() => setBulkMoveOpen(true)}>
            <FolderInput size={17} /> {t('common.move')}
          </button>
          <button className="btn btn-ghost" onClick={() => setBulkDeleteOpen(true)}>
            <Trash2 size={17} /> {t('common.delete')}
          </button>
          <button className="btn-icon" onClick={clearSelection} title={t('select.clear')}>
            <X size={18} />
          </button>
        </div>
      )}

      <div className="toolbar">
        {!isSearching && (
          <>
            <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              <FolderPlus size={18} /> {t('drive.newFolder')}
            </button>
            <button className="btn" onClick={() => fileInputRef.current?.click()}>
              <Upload size={18} /> {t('drive.upload')}
            </button>
          </>
        )}
        <div className="grow" />
        <div className="seg">
          <button
            className={view === 'grid' ? 'active' : ''}
            onClick={() => setViewPersist('grid')}
            title={t('drive.gridView')}
          >
            <LayoutGrid size={16} />
          </button>
          <button className={view === 'list' ? 'active' : ''} onClick={() => setViewPersist('list')}>
            <ListIcon size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        view === 'grid' ? (
          <GridSkeleton />
        ) : (
          <ListSkeleton />
        )
      ) : entries.length === 0 ? (
        isSearching ? (
          <EmptyState icon={<SearchIcon size={30} />} title={t('drive.emptyTitle')} />
        ) : (
          <EmptyState
            icon={<Inbox size={30} />}
            title={t('drive.emptyTitle')}
            hint={t('drive.emptyHint')}
          />
        )
      ) : (
        <FileExplorer
          items={entries}
          view={view}
          locale={locale}
          onOpen={openItem}
          onMenu={openMenu}
          selectedKeys={selectedKeys}
          onToggleSelect={toggleSelect}
          sort={sort}
          onSort={onSort}
        />
      )}

      {/* hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={onPickFiles}
      />

      {/* mobile FAB */}
      {!isSearching && (
        <button className="fab" onClick={() => fileInputRef.current?.click()} aria-label={t('drive.upload')}>
          <Upload size={24} />
        </button>
      )}

      {/* context menu */}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.item)}
          onClose={() => setMenu(null)}
        />
      )}

      {/* modals */}
      <InputModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={doCreateFolder}
        title={t('drive.newFolder')}
        label={t('common.name')}
        confirmLabel={t('common.create')}
        placeholder={t('drive.newFolder')}
      />
      <InputModal
        open={!!renameItem}
        onClose={() => setRenameItem(null)}
        onSubmit={doRename}
        title={t('common.rename')}
        label={t('common.name')}
        initialValue={renameItem?.name || ''}
        confirmLabel={t('common.save')}
      />
      <MoveModal
        open={!!moveItem}
        onClose={() => setMoveItem(null)}
        onMove={doMove}
        item={moveItem}
      />
      <MoveModal
        open={bulkMoveOpen}
        onClose={() => setBulkMoveOpen(false)}
        onMove={doBulkMove}
        item={{ type: 'bulk' }}
      />
      <ConfirmDialog
        open={!!trashItem}
        onClose={() => setTrashItem(null)}
        onConfirm={doTrash}
        title={t('common.delete')}
        message={`${trashItem?.name} — ${t('nav.trash')}?`}
        confirmLabel={t('common.delete')}
        danger
        loading={trashing}
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={doBulkDelete}
        title={t('common.delete')}
        message={`${t('select.selected')}: ${selectedItems.length} — ${t('nav.trash')}?`}
        confirmLabel={t('common.delete')}
        danger
        loading={bulkBusy}
      />

      {previewFile && (
        <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} locale={locale} />
      )}

      {/* upload progress */}
      <UploadPanel
        tasks={uploader.tasks}
        open={uploader.panelOpen}
        onToggle={() => uploader.setPanelOpen((o) => !o)}
        onClose={uploader.clearFinished}
        onCancel={uploader.cancelTask}
        onRetry={uploader.retryTask}
        locale={locale}
      />
    </div>
  );
}
