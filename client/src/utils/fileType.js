/**
 * Classify a file by mime type / extension into a category that drives both the
 * icon and the preview strategy.
 *
 * categories: image | pdf | video | audio | text | doc | sheet | ppt | archive | file
 */
const EXT = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'heic', 'ico'],
  pdf: ['pdf'],
  video: ['mp4', 'webm', 'ogv', 'mov', 'm4v', 'mkv', 'avi'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'],
  text: ['txt', 'md', 'json', 'csv', 'log', 'xml', 'yml', 'yaml', 'js', 'ts', 'jsx', 'tsx',
    'css', 'html', 'py', 'java', 'c', 'cpp', 'sh', 'sql', 'ini', 'env', 'conf'],
  doc: ['doc', 'docx', 'odt', 'rtf', 'pages'],
  sheet: ['xls', 'xlsx', 'ods', 'numbers'],
  ppt: ['ppt', 'pptx', 'odp', 'key'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'],
};

export function categorize(file) {
  const mime = (file.mimeType || '').toLowerCase();
  const ext = (file.extension || extOf(file.name) || '').toLowerCase();

  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('text/')) return 'text';

  for (const [cat, list] of Object.entries(EXT)) {
    if (list.includes(ext)) return cat;
  }
  if (
    mime.includes('word') ||
    mime.includes('officedocument.wordprocessing')
  )
    return 'doc';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'sheet';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'ppt';
  if (mime.includes('zip') || mime.includes('compressed')) return 'archive';
  return 'file';
}

export function extOf(name) {
  if (!name) return '';
  const i = name.lastIndexOf('.');
  return i > -1 ? name.slice(i + 1) : '';
}

/**
 * Whether the category can be previewed inline in the browser.
 */
export function canPreview(category) {
  return ['image', 'pdf', 'video', 'audio', 'text'].includes(category);
}

/**
 * Map category -> css class used for icon coloring (see app.css .ftype.*).
 */
export function iconClass(category) {
  switch (category) {
    case 'image':
      return 'img';
    case 'pdf':
      return 'pdf';
    case 'video':
      return 'video';
    case 'audio':
      return 'audio';
    case 'doc':
      return 'doc';
    case 'sheet':
      return 'sheet';
    case 'ppt':
      return 'ppt';
    case 'archive':
      return 'zip';
    case 'text':
      return 'txt';
    default:
      return 'file';
  }
}
