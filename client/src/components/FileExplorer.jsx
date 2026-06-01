import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MoreVertical, ChevronUp, ChevronDown, Check, Star } from 'lucide-react';
import FileIcon from './FileIcon';
import { categorize } from '../utils/fileType';
import { formatBytes, formatDate } from '../utils/format';
import { fileApi } from '../api';

function Thumb({ item, category }) {
  const [errored, setErrored] = useState(false);
  if (item.type === 'file' && category === 'image' && !errored) {
    return (
      <div className="tile-thumb">
        <img
          src={fileApi.thumbnailUrl(item.id)}
          alt={item.name}
          loading="lazy"
          onError={() => setErrored(true)}
        />
      </div>
    );
  }
  return (
    <div className="tile-thumb">
      <FileIcon category={item.type === 'folder' ? 'folder' : category} />
    </div>
  );
}

function SelectCheck({ selected, onToggle }) {
  return (
    <button
      className={`sel-check ${selected ? 'on' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label="Select"
      tabIndex={-1}
    >
      {selected && <Check size={13} strokeWidth={3} />}
    </button>
  );
}

export default function FileExplorer({
  items,
  view,
  locale,
  onOpen,
  onMenu,
  selectedKeys,
  onToggleSelect,
  favoriteKeys,
  onDropMove,
  sort,
  onSort,
}) {
  const { t } = useTranslation();
  const selectionActive = selectedKeys.size > 0;
  const keyOf = (item) => `${item.type}-${item.id}`;
  const [dragKey, setDragKey] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);

  const dragProps = (item) => ({
    draggable: true,
    onDragStart: (e) => {
      const k = keyOf(item);
      e.dataTransfer.setData('text/cd', k);
      e.dataTransfer.effectAllowed = 'move';
      setDragKey(k);
    },
    onDragEnd: () => {
      setDragKey(null);
      setDragOverKey(null);
    },
  });

  const dropProps = (item) => {
    if (item.type !== 'folder') return {};
    const k = keyOf(item);
    return {
      onDragOver: (e) => {
        if (dragKey && dragKey !== k) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (dragOverKey !== k) setDragOverKey(k);
        }
      },
      onDragLeave: () => setDragOverKey((cur) => (cur === k ? null : cur)),
      onDrop: (e) => {
        e.preventDefault();
        const payload = e.dataTransfer.getData('text/cd');
        setDragOverKey(null);
        setDragKey(null);
        if (payload && payload !== k) onDropMove(item, payload);
      },
    };
  };

  const Star_ = (item) =>
    favoriteKeys?.has(keyOf(item)) ? <Star size={15} className="fav-star" fill="currentColor" /> : null;

  if (view === 'grid') {
    return (
      <div className={`grid ${selectionActive ? 'selecting' : ''}`}>
        {items.map((item) => {
          const k = keyOf(item);
          const category = item.type === 'folder' ? 'folder' : categorize(item);
          return (
            <div
              key={k}
              className={`tile ${selectedKeys.has(k) ? 'selected' : ''} ${
                dragOverKey === k ? 'drag-over' : ''
              } ${dragKey === k ? 'dragging' : ''}`}
              onClick={() => (selectionActive ? onToggleSelect(item) : onOpen(item))}
              onContextMenu={(e) => {
                e.preventDefault();
                onMenu(e.clientX, e.clientY, item);
              }}
              {...dragProps(item)}
              {...dropProps(item)}
            >
              <SelectCheck selected={selectedKeys.has(k)} onToggle={() => onToggleSelect(item)} />
              {Star_(item)}
              <button
                className="btn-icon kebab"
                onClick={(e) => {
                  e.stopPropagation();
                  const r = e.currentTarget.getBoundingClientRect();
                  onMenu(r.right, r.bottom, item);
                }}
                aria-label="Menu"
              >
                <MoreVertical size={18} />
              </button>
              <Thumb item={item} category={category} />
              <div>
                <div className="tile-name" title={item.name}>
                  {item.name}
                </div>
                <div className="tile-meta">
                  {item.type === 'file' ? (
                    <>
                      <span>{formatBytes(item.sizeBytes, locale)}</span>
                      <span>·</span>
                      <span>{formatDate(item.createdAt, locale)}</span>
                    </>
                  ) : (
                    <span>{formatDate(item.createdAt, locale)}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`list ${selectionActive ? 'selecting' : ''}`}>
      <div className="list-head">
        <SortHeader label={t('common.name')} sortKey="name" sort={sort} onSort={onSort} />
        <SortHeader label={t('common.type')} sortKey="type" sort={sort} onSort={onSort} className="col-type" />
        <SortHeader label={t('common.size')} sortKey="size" sort={sort} onSort={onSort} />
        <SortHeader label={t('common.date')} sortKey="date" sort={sort} onSort={onSort} className="col-date" />
        <div />
      </div>
      {items.map((item) => {
        const k = keyOf(item);
        const category = item.type === 'folder' ? 'folder' : categorize(item);
        return (
          <div
            key={k}
            className={`list-row ${selectedKeys.has(k) ? 'selected' : ''} ${
              dragOverKey === k ? 'drag-over' : ''
            } ${dragKey === k ? 'dragging' : ''}`}
            onClick={() => (selectionActive ? onToggleSelect(item) : onOpen(item))}
            onContextMenu={(e) => {
              e.preventDefault();
              onMenu(e.clientX, e.clientY, item);
            }}
            {...dragProps(item)}
            {...dropProps(item)}
          >
            <div className="list-name">
              <SelectCheck selected={selectedKeys.has(k)} onToggle={() => onToggleSelect(item)} />
              <FileIcon category={item.type === 'folder' ? 'folder' : category} size={26} />
              <span className="label" title={item.name}>
                {item.name}
              </span>
              {Star_(item)}
            </div>
            <div className="list-cell col-type">
              {item.type === 'folder'
                ? t('drive.folders')
                : (item.extension || '').toUpperCase() || t('common.none')}
            </div>
            <div className="list-cell">
              {item.type === 'file' ? formatBytes(item.sizeBytes, locale) : '—'}
            </div>
            <div className="list-cell col-date">{formatDate(item.createdAt, locale)}</div>
            <button
              className="btn-icon"
              onClick={(e) => {
                e.stopPropagation();
                const r = e.currentTarget.getBoundingClientRect();
                onMenu(r.right, r.bottom, item);
              }}
              aria-label="Menu"
            >
              <MoreVertical size={18} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SortHeader({ label, sortKey, sort, onSort, className }) {
  return (
    <div className={`sortable ${className || ''}`} onClick={() => onSort(sortKey)}>
      {label}
      {sort.key === sortKey &&
        (sort.dir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
    </div>
  );
}
