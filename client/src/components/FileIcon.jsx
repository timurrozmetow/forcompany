import {
  Folder,
  Image as ImageIcon,
  FileText,
  FileVideo,
  FileAudio,
  FileSpreadsheet,
  FileArchive,
  Presentation,
  File as FileIco,
} from 'lucide-react';
import { iconClass } from '../utils/fileType';

const MAP = {
  folder: Folder,
  image: ImageIcon,
  pdf: FileText,
  video: FileVideo,
  audio: FileAudio,
  text: FileText,
  doc: FileText,
  sheet: FileSpreadsheet,
  ppt: Presentation,
  archive: FileArchive,
  file: FileIco,
};

export default function FileIcon({ category, size = 46, className = '' }) {
  const Cmp = MAP[category] || FileIco;
  const colorClass = category === 'folder' ? 'folder' : iconClass(category);
  return <Cmp size={size} strokeWidth={1.6} className={`ftype ${colorClass} ${className}`} />;
}
