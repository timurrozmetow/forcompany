import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, MessageSquare, UploadCloud } from 'lucide-react';
import { notificationApi } from '../api';
import { relativeTime } from '../utils/format';

const ICONS = {
  comment_added: <MessageSquare size={16} />,
  file_uploaded: <UploadCloud size={16} />,
};

export default function NotificationBell() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('tr') ? 'tr' : 'ru';
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const ref = useRef(null);

  const poll = useCallback(() => {
    notificationApi
      .unreadCount()
      .then(setUnread)
      .catch(() => {});
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 45000);
    return () => clearInterval(id);
  }, [poll]);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, [open]);

  const openPanel = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      try {
        const data = await notificationApi.list();
        setItems(data.items);
        if (data.unread > 0) {
          await notificationApi.markRead();
          setUnread(0);
        }
      } catch (_) {
        /* ignore */
      }
    }
  };

  const onItemClick = (n) => {
    setOpen(false);
    if (n.folderId) navigate(`/drive/folder/${n.folderId}`);
    else navigate('/drive');
  };

  return (
    <div className="notif-wrap" ref={ref}>
      <button className="btn-icon" onClick={openPanel} aria-label={t('notif.title')}>
        <Bell size={20} />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-head">{t('notif.title')}</div>
          <div className="notif-list">
            {items.length === 0 ? (
              <div className="notif-empty muted tiny">{t('notif.empty')}</div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={`notif-item ${n.isRead ? '' : 'unread'}`}
                  onClick={() => onItemClick(n)}
                >
                  <span className="ic">{ICONS[n.type] || <Bell size={16} />}</span>
                  <div className="body">
                    <div className="msg">{n.message}</div>
                    <div className="muted tiny">{relativeTime(n.createdAt, locale)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
