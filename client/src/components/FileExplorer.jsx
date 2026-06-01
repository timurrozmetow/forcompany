import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MoreVertical, ChevronUp, ChevronDown, Check } from 'lucide-react';
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

function Tile({ item, locale, onOpen, onMenu, selected, onToggle, selectionActive }) {
  const category = item.type === 'folder' ? 'folder' : categorize(item);
  const handleClick = () => (selectionActive ? onToggle() : onOpen(item));
  return (
    <div
      className={`tile ${selected ? 'selected' : ''}`}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu(e.clientX, e.clientY, item);
      }}
    >
      <SelectCheck selected={selected} onToggle={onToggle} />
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
}

function Row({ item, locale, onOpen, onMenu, selected, onToggle, selectionActive }) {
  const { t } = useTranslation();
  const category = item.type === 'folder' ? 'folder' : categorize(item);
  const handleClick = () => (selectionActive ? onToggle() : onOpen(item));
  return (
    <div
      className={`list-row ${selected ? 'selected' : ''}`}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu(e.clientX, e.clientY, item);
      }}
    >
      <div className="list-name">
        <SelectCheck selected={selected} onToggle={onToggle} />
        <FileIcon category={item.type === 'folder' ? 'folder' : category} size={26} />
        <span className="label" title={item.name}>
          {item.name}
        </span>
      </div>
      <div className="list-cell col-type">
        {item.type === 'folder' ? t('drive.folders') : (item.extension || '').toUpperCase() || t('common.none')}
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
}

const SortHeader = ({ label, sortKey, sort, onSort, className }) => (
  <div className={`sortable ${className || ''}`} onClick={() => onSort(sortKey)}>
    {label}
    {sort.key === sortKey &&
      (sort.dir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
  </div>
);

export default function FileExplorer({
  items,
  view,
  locale,
  onOpen,
  onMenu,
  selectedKeys,
  onToggleSelect,
  sort,
  onSort,
}) {
  const { t } = useTranslation();
  const selectionActive = selectedKeys.size > 0;
  const keyOf = (item) => `${item.type}-${item.id}`;

  if (view === 'grid') {
    return (
      <div className={`grid ${selectionActive ? 'selecting' : ''}`}>
        {items.map((item) => (
          <Tile
            key={keyOf(item)}
            item={item}
            locale={locale}
            onOpen={onOpen}
            onMenu={onMenu}
            selected={selectedKeys.has(keyOf(item))}
            onToggle={() => onToggleSelect(item)}
            selectionActive={selectionActive}
          />
        ))}
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
      {items.map((item) => (
        <Row
          key={keyOf(item)}
          item={item}
          locale={locale}
          onOpen={onOpen}
          onMenu={onMenu}
          selected={selectedKeys.has(keyOf(item))}
          onToggle={() => onToggleSelect(item)}
          selectionActive={selectionActive}
        />
      ))}
    </div>
  );
}
