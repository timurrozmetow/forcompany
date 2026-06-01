import api, { mediaUrl } from './client';

/* ------------------------------- Auth ----------------------------------- */
export const authApi = {
  login: (username, password) => api.post('/auth/login', { username, password }).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data.user),
  logout: () => api.post('/auth/logout').then((r) => r.data),
};

/* ------------------------------ Folders ---------------------------------- */
export const folderApi = {
  list: (parentId) =>
    api.get('/folders', { params: { parentId: parentId ?? '' } }).then((r) => r.data),
  create: (name, parentId) =>
    api.post('/folders', { name, parentId: parentId ?? null }).then((r) => r.data.folder),
  rename: (id, name) => api.put(`/folders/${id}`, { name }).then((r) => r.data.folder),
  move: (id, targetParentId) =>
    api.patch(`/folders/${id}/move`, { targetParentId: targetParentId ?? null }).then((r) => r.data.folder),
  trash: (id) => api.delete(`/folders/${id}`).then((r) => r.data),
};

/* ------------------------------- Files ----------------------------------- */
export const fileApi = {
  // Returns { files, total, limit, offset }
  list: (folderId, { limit = 100, offset = 0 } = {}) =>
    api
      .get('/files', { params: { folderId: folderId ?? '', limit, offset } })
      .then((r) => r.data),
  checkConflicts: (folderId, names) =>
    api.post('/files/check-conflicts', { folderId: folderId ?? null, names }).then((r) => r.data.conflicts),
  upload: (files, folderId, onProgress, signal) => {
    const form = new FormData();
    for (const f of files) form.append('files', f);
    return api
      .post('/files/upload', form, {
        params: { folderId: folderId ?? '' },
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          // e carries { loaded, total, progress, rate (B/s), estimated (s) } in axios 1.x
          if (onProgress) onProgress(e);
        },
        signal,
        // allow up to 10GB; let the request run as long as needed
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 0,
      })
      .then((r) => r.data.files);
  },
  rename: (id, name) => api.put(`/files/${id}`, { name }).then((r) => r.data.file),
  move: (id, targetFolderId) =>
    api.patch(`/files/${id}/move`, { targetFolderId: targetFolderId ?? null }).then((r) => r.data.file),
  trash: (id) => api.delete(`/files/${id}`).then((r) => r.data),
  downloadUrl: (id) => mediaUrl(`/files/${id}/download`),
  previewUrl: (id) => mediaUrl(`/files/${id}/preview`),
  thumbnailUrl: (id) => mediaUrl(`/files/${id}/thumbnail`),
  officePreviewUrl: (id) => mediaUrl(`/files/${id}/office-preview`),

  // ---- Chunked / resumable upload ----
  uploadInit: (meta) => api.post('/files/upload/init', meta).then((r) => r.data),
  uploadStatus: (uploadId) => api.get(`/files/upload/${uploadId}/status`).then((r) => r.data),
  uploadChunk: (uploadId, index, blob, onProgress, signal) =>
    api
      .put(`/files/upload/${uploadId}/chunk/${index}`, blob, {
        headers: { 'Content-Type': 'application/octet-stream' },
        onUploadProgress: (e) => onProgress && onProgress(e),
        signal,
        timeout: 0,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      })
      .then((r) => r.data),
  uploadComplete: (uploadId, replace = false) =>
    api
      .post(`/files/upload/${uploadId}/complete`, null, { params: replace ? { replace: 1 } : {} })
      .then((r) => r.data.file),
  uploadAbort: (uploadId) => api.delete(`/files/upload/${uploadId}`).then((r) => r.data),

  // ---- ZIP download ----
  folderZipUrl: (id) => mediaUrl(`/folders/${id}/zip`),
  createZip: (fileIds, folderIds) =>
    api.post('/files/zip', { fileIds, folderIds }).then((r) => r.data.sessionId),
  zipUrl: (sessionId) => mediaUrl(`/files/zip/${sessionId}`),
};

/* ------------------------------ Search ----------------------------------- */
export const searchApi = {
  query: (q, filters = {}) => {
    const params = { q };
    for (const [k, v] of Object.entries(filters)) if (v) params[k] = v;
    return api.get('/search', { params }).then((r) => r.data);
  },
};

/* ------------------------------- Users ----------------------------------- */
export const userApi = {
  basic: () => api.get('/users/basic').then((r) => r.data.users),
};

/* --------------------------- Notifications ------------------------------- */
export const notificationApi = {
  list: () => api.get('/notifications').then((r) => r.data), // { items, unread }
  unreadCount: () => api.get('/notifications/unread-count').then((r) => r.data.count),
  markRead: (id) => api.patch('/notifications/read', id ? { id } : {}).then((r) => r.data),
};

/* ------------------------------- Trash ----------------------------------- */
export const trashApi = {
  list: () => api.get('/trash').then((r) => r.data),
  restoreFile: (id) => api.patch(`/trash/files/${id}/restore`).then((r) => r.data),
  restoreFolder: (id) => api.patch(`/trash/folders/${id}/restore`).then((r) => r.data),
  deleteFile: (id) => api.delete(`/trash/files/${id}/permanent`).then((r) => r.data),
  deleteFolder: (id) => api.delete(`/trash/folders/${id}/permanent`).then((r) => r.data),
};

/* ------------------------------- Admin ----------------------------------- */
export const adminApi = {
  users: () => api.get('/admin/users').then((r) => r.data.users),
  createUser: (payload) => api.post('/admin/users', payload).then((r) => r.data.user),
  updateUser: (id, payload) => api.put(`/admin/users/${id}`, payload).then((r) => r.data.user),
  changePassword: (id, password) =>
    api.patch(`/admin/users/${id}/password`, { password }).then((r) => r.data),
  setBlocked: (id, blocked) =>
    api.patch(`/admin/users/${id}/block`, { blocked }).then((r) => r.data.user),
  deleteUser: (id) => api.delete(`/admin/users/${id}`).then((r) => r.data),
  stats: () => api.get('/admin/dashboard/stats').then((r) => r.data),
  logs: (params) => api.get('/admin/activity-logs', { params }).then((r) => r.data),
  notifyTest: () => api.post('/admin/notify/test').then((r) => r.data),
  telegramChats: () => api.get('/admin/notify/telegram-chats').then((r) => r.data),
};

/* ----------------------------- Favorites --------------------------------- */
export const favoriteApi = {
  list: () => api.get('/favorites').then((r) => r.data),
  ids: () => api.get('/favorites/ids').then((r) => r.data),
  add: (target) => api.post('/favorites', target).then((r) => r.data),
  remove: (target) => api.delete('/favorites', { data: target }).then((r) => r.data),
};

/* ------------------------------- Recent ---------------------------------- */
export const recentApi = {
  list: () => api.get('/recent').then((r) => r.data.files),
};

/* -------------------------------- Tags ----------------------------------- */
export const tagApi = {
  list: () => api.get('/tags').then((r) => r.data.tags),
  create: (name, color) => api.post('/tags', { name, color }).then((r) => r.data.tag),
  remove: (id) => api.delete(`/tags/${id}`).then((r) => r.data),
  filesByTag: (id) => api.get(`/tags/${id}/files`).then((r) => r.data.files),
  ofFile: (fileId) => api.get(`/files/${fileId}/tags`).then((r) => r.data.tags),
  attach: (fileId, payload) => api.post(`/files/${fileId}/tags`, payload).then((r) => r.data.tags),
  detach: (fileId, tagId) => api.delete(`/files/${fileId}/tags/${tagId}`).then((r) => r.data.tags),
};

/* ------------------------------ Comments --------------------------------- */
export const commentApi = {
  list: (fileId) => api.get(`/files/${fileId}/comments`).then((r) => r.data.comments),
  add: (fileId, body) => api.post(`/files/${fileId}/comments`, { body }).then((r) => r.data.comment),
  remove: (id) => api.delete(`/comments/${id}`).then((r) => r.data),
};

/* ------------------------------ Storage ---------------------------------- */
export const storageApi = {
  quota: () => api.get('/storage/quota').then((r) => r.data),
};
