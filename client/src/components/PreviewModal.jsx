import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Download, Loader2 } from 'lucide-react';
import FileIcon from './FileIcon';
import api from '../api/client';
import { fileApi } from '../api';
import { categorize, canPreview } from '../utils/fileType';
import { formatBytes } from '../utils/format';

export default function PreviewModal({ file, onClose, locale }) {
  const { t } = useTranslation();
  const [textContent, setTextContent] = useState(null);
  const [loadingText, setLoadingText] = useState(false);
  const [failed, setFailed] = useState(false);

  const category = file ? categorize(file) : 'file';

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
      return (
        <div className="preview-card">
          <FileIcon category={category} size={72} className="big-ic" />
          <div style={{ fontWeight: 660, fontSize: 17, marginBottom: 6, wordBreak: 'break-word' }}>
            {file.name}
          </div>
          <div className="muted tiny" style={{ marginBottom: 20 }}>
            {(file.extension || '').toUpperCase()} · {formatBytes(file.sizeBytes, locale)}
          </div>
          <p className="muted" style={{ marginTop: 0 }}>{t('preview.noPreviewHint')}</p>
          <a className="btn btn-primary" href={downloadUrl}>
            <Download size={18} /> {t('common.download')}
          </a>
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
        if (loadingText)
          return <Loader2 size={26} className="spin" style={{ color: '#fff' }} />;
        if (failed) return <pre>{t('preview.noPreview')}</pre>;
        return <pre>{textContent}</pre>;
      default:
        return null;
    }
  };

  return (
    <div className="preview-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="preview-bar">
        <FileIcon category={category} size={22} />
        <span className="title">{file.name}</span>
        <span className="spacer" />
        <a className="btn-icon" href={downloadUrl} title={t('common.download')}>
          <Download size={20} />
        </a>
        <button className="btn-icon" onClick={onClose} aria-label="Close">
          <X size={22} />
        </button>
      </div>
      <div className="preview-body" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        {renderBody()}
      </div>
    </div>
  );
}
