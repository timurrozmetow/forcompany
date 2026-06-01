import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Download, Loader2, Star, Info, Tag as TagIcon, Send, Trash2, Plus, Eye } from 'lucide-react';
import FileIcon from './FileIcon';
import api from '../api/client';
import { fileApi, tagApi, commentApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { categorize, canPreview } from '../utils/fileType';
import { formatBytes, formatDateTime, initials } from '../utils/format';

function InfoPanel({ file, locale }) {
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const [tags, setTags] = useState([]);
  const [comments, setComments] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [newComment, setNewComment] = useState('');
  const [busy, setBusy] = useState(false);

  const reloadTags = useCallback(() => tagApi.ofFile(file.id).then(setTags).catch(() => {}), [file.id]);
  const reloadComments = useCallback(
    () => commentApi.list(file.id).then(setComments).catch(() => {}),
    [file.id]
  );

  useEffect(() => {
    reloadTags();
    reloadComments();
  }, [reloadTags, reloadComments]);

  const addTag = async () => {
    if (!newTag.trim()) return;
    try {
      const updated = await tagApi.attach(file.id, { name: newTag.trim() });
      setTags(updated);
      setNewTag('');
    } catch (_) {
      /* ignore */
    }
  };
  const removeTag = async (tagId) => {
    try {
      setTags(await tagApi.detach(file.id, tagId));
    } catch (_) {
      /* ignore */
    }
  };
  const addComment = async () => {
    if (!newComment.trim() || busy) return;
    setBusy(true);
    try {
      const c = await commentApi.add(file.id, newComment.trim());
      setComments((prev) => [...prev, c]);
      setNewComment('');
    } catch (_) {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };
  const removeComment = async (id) => {
    try {
      await commentApi.remove(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch (_) {
      /* ignore */
    }
  };

  return (
    <aside className="preview-info">
      <div className="pi-section">
        <div className="pi-title">
          <TagIcon size={15} /> {t('tags.title')}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {tags.length === 0 && <span className="muted tiny">{t('tags.none')}</span>}
          {tags.map((tg) => (
            <span className="tag-chip" key={tg.id}>
              <span className="dot" style={tg.color ? { background: tg.color } : undefined} />
              {tg.name}
              <button onClick={() => removeTag(tg.id)} aria-label="remove">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            className="input"
            style={{ padding: '8px 10px' }}
            value={newTag}
            placeholder={t('tags.add')}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
          />
          <button className="btn-icon" onClick={addTag} aria-label="add tag">
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="pi-section" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="pi-title">{t('comments.title')}</div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 80 }}>
          {comments.length === 0 && <span className="muted tiny">{t('comments.none')}</span>}
          {comments.map((c) => (
            <div className="comment" key={c.id}>
              <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                {initials(c.username)}
              </div>
              <div className="body">
                <div className="head">
                  <span className="name">{c.username || '—'}</span>
                  <span className="muted tiny">{formatDateTime(c.createdAt, locale)}</span>
                  {(isAdmin || c.userId === user?.id) && (
                    <button
                      className="btn-icon"
                      style={{ marginLeft: 'auto', padding: 4 }}
                      onClick={() => removeComment(c.id)}
                      aria-label="delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="text">{c.body}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <input
            className="input"
            style={{ padding: '8px 10px' }}
            value={newComment}
            placeholder={t('comments.add')}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addComment()}
          />
          <button className="btn-icon" onClick={addComment} disabled={busy} aria-label="send">
            <Send size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default function PreviewModal({ file, onClose, locale, isFavorite, onToggleFavorite }) {
  const { t } = useTranslation();
  const [textContent, setTextContent] = useState(null);
  const [loadingText, setLoadingText] = useState(false);
  const [failed, setFailed] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [officeState, setOfficeState] = useState('idle'); // idle | loading | ready | error
  const [officeUrl, setOfficeUrl] = useState(null);

  const category = file ? categorize(file) : 'file';
  const isOfficeDoc = ['doc', 'sheet', 'ppt'].includes(category);

  // Reset + cleanup the office-preview blob URL when the file changes.
  useEffect(() => {
    setOfficeState('idle');
    setOfficeUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [file]);

  const loadOfficePreview = async () => {
    setOfficeState('loading');
    try {
      const res = await api.get(`/files/${file.id}/office-preview`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      setOfficeUrl(url);
      setOfficeState('ready');
    } catch (_) {
      setOfficeState('error');
    }
  };

  useEffect(() => {
    if (!file) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [file, onClose]);

  useEffect(() => {
    let active = true;
    setTextContent(null);
    setFailed(false);
    if (file && category === 'text') {
      setLoadingText(true);
      api
        .get(`/files/${file.id}/preview`, { responseType: 'text', transformResponse: (d) => d })
        .then((res) => active && setTextContent(String(res.data).slice(0, 500000)))
        .catch(() => active && setFailed(true))
        .finally(() => active && setLoadingText(false));
    }
    return () => {
      active = false;
    };
  }, [file, category]);

  if (!file) return null;

  const previewUrl = fileApi.previewUrl(file.id);
  const downloadUrl = fileApi.downloadUrl(file.id);

  const renderBody = () => {
    if (!canPreview(category)) {
      // Office documents: offer an on-demand PDF preview (LibreOffice on server).
      if (isOfficeDoc && officeState === 'ready') {
        return <iframe src={officeUrl} title={file.name} />;
      }
      return (
        <div className="preview-card">
          <FileIcon category={category} size={72} className="big-ic" />
          <div style={{ fontWeight: 660, fontSize: 17, marginBottom: 6, wordBreak: 'break-word' }}>
            {file.name}
          </div>
          <div className="muted tiny" style={{ marginBottom: 20 }}>
            {(file.extension || '').toUpperCase()} · {formatBytes(file.sizeBytes, locale)}
          </div>
          {isOfficeDoc && officeState === 'error' ? (
            <p className="muted" style={{ marginTop: 0 }}>{t('preview2.officeUnavailable')}</p>
          ) : (
            <p className="muted" style={{ marginTop: 0 }}>{t('preview.noPreviewHint')}</p>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {isOfficeDoc && officeState !== 'error' && (
              <button
                className="btn"
                onClick={loadOfficePreview}
                disabled={officeState === 'loading'}
              >
                {officeState === 'loading' ? (
                  <Loader2 size={18} className="spin" />
                ) : (
                  <Eye size={18} />
                )}
                {t('preview2.showOffice')}
              </button>
            )}
            <a className="btn btn-primary" href={downloadUrl}>
              <Download size={18} /> {t('common.download')}
            </a>
          </div>
        </div>
      );
    }
    switch (category) {
      case 'image':
        return <img src={previewUrl} alt={file.name} />;
      case 'video':
        return <video src={previewUrl} controls autoPlay playsInline />;
      case 'audio':
        return (
          <div className="preview-card">
            <FileIcon category="audio" size={64} className="big-ic" />
            <div style={{ fontWeight: 600, marginBottom: 18, wordBreak: 'break-word' }}>{file.name}</div>
            <audio src={previewUrl} controls autoPlay style={{ width: '100%' }} />
          </div>
        );
      case 'pdf':
        return <iframe src={previewUrl} title={file.name} />;
      case 'text':
        if (loadingText) return <Loader2 size={26} className="spin" style={{ color: '#fff' }} />;
        if (failed) return <pre>{t('preview.noPreview')}</pre>;
        return <pre>{textContent}</pre>;
      default:
        return null;
    }
  };

  return (
    <div className="preview-overlay">
      <div className="preview-bar">
        <FileIcon category={category} size={22} />
        <span className="title">{file.name}</span>
        <span className="spacer" />
        {onToggleFavorite && (
          <button
            className="btn-icon"
            onClick={onToggleFavorite}
            title={t('favorites.add')}
            style={{ color: isFavorite ? 'var(--warning)' : undefined }}
          >
            <Star size={20} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        )}
        <button
          className="btn-icon"
          onClick={() => setInfoOpen((o) => !o)}
          title={t('comments.title')}
          style={{ color: infoOpen ? 'var(--accent)' : undefined }}
        >
          <Info size={20} />
        </button>
        <a className="btn-icon" href={downloadUrl} title={t('common.download')}>
          <Download size={20} />
        </a>
        <button className="btn-icon" onClick={onClose} aria-label="Close">
          <X size={22} />
        </button>
      </div>
      <div className="preview-main">
        <div className="preview-body" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          {renderBody()}
        </div>
        {infoOpen && <InfoPanel file={file} locale={locale} />}
      </div>
    </div>
  );
}
