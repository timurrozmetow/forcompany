import { useState, useCallback, useRef, useEffect } from 'react';
import { fileApi } from '../api';
import { errorMessage } from '../api/client';

let taskSeq = 0;

const LS_PREFIX = 'cd_up:';

function fingerprint(file, folderId) {
  return `${LS_PREFIX}${file.name}|${file.size}|${file.lastModified}|${folderId ?? 'root'}`;
}

/**
 * Chunked + resumable upload queue.
 * - Each file is split into chunks (size decided by the server) and uploaded
 *   one chunk at a time. A dropped connection only loses the current chunk.
 * - The server upload session id is cached in localStorage keyed by a file
 *   fingerprint, so an interrupted upload RESUMES (skips chunks already on the
 *   server) — even after a page reload — when retried.
 * - Reports live progress, speed and ETA.
 */
export function useUploader() {
  const [tasks, setTasks] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const controllers = useRef(new Map());
  const optionsRef = useRef({});
  const tasksRef = useRef([]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const update = useCallback((id, patch) => {
    setTasks((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const runTask = useCallback(
    async (task) => {
      const controller = new AbortController();
      controllers.current.set(task.id, controller);
      const fp = fingerprint(task.file, task.folderId);
      update(task.id, { status: 'uploading', error: null });

      const startTime = Date.now();

      try {
        // 1) Resume or init the upload session.
        let session = null;
        const cachedId = localStorage.getItem(fp);
        if (cachedId) {
          try {
            session = await fileApi.uploadStatus(cachedId);
          } catch (_) {
            localStorage.removeItem(fp);
            session = null;
          }
        }
        if (!session) {
          session = await fileApi.uploadInit({
            name: task.file.name,
            size: task.file.size,
            folderId: task.folderId,
            mimeType: task.file.type || undefined,
          });
          localStorage.setItem(fp, session.uploadId);
        }

        const { uploadId, chunkSize, totalChunks } = session;
        const received = new Set(session.received || []);
        let completedChunks = received.size;
        const sessionStartLoaded = Math.min(completedChunks * chunkSize, task.size);

        const reportProgress = (currentChunkLoaded) => {
          const baseLoaded = completedChunks * chunkSize;
          const loaded = Math.min(baseLoaded + (currentChunkLoaded || 0), task.size);
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = elapsed > 0 ? (loaded - sessionStartLoaded) / elapsed : 0;
          const progress = task.size ? Math.min(100, Math.round((loaded / task.size) * 100)) : 100;
          const eta = rate > 0 ? (task.size - loaded) / rate : null;
          update(task.id, { progress, loaded, total: task.size, rate: Math.max(rate, 0), eta });
        };

        reportProgress(0);

        // 2) Upload missing chunks sequentially.
        for (let i = 0; i < totalChunks; i += 1) {
          if (controller.signal.aborted) throw new DOMException('canceled', 'AbortError');
          if (received.has(i)) continue;
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, task.file.size);
          const blob = task.file.slice(start, end);

          // eslint-disable-next-line no-await-in-loop
          await fileApi.uploadChunk(
            uploadId,
            i,
            blob,
            (e) => reportProgress(e.loaded || 0),
            controller.signal
          );
          completedChunks += 1;
          reportProgress(0);
        }

        // 3) Finalize.
        const file = await fileApi.uploadComplete(uploadId);
        localStorage.removeItem(fp);
        update(task.id, { status: 'done', progress: 100, rate: 0, eta: 0, loaded: task.size });
        optionsRef.current.onEach?.(file);
        return true;
      } catch (err) {
        const canceled =
          err?.name === 'AbortError' ||
          err?.code === 'ERR_CANCELED' ||
          err?.name === 'CanceledError' ||
          err?.message === 'canceled';
        update(task.id, {
          status: canceled ? 'canceled' : 'error',
          error: canceled ? null : errorMessage(err, 'Upload failed'),
          rate: 0,
          eta: null,
        });
        return false;
      } finally {
        controllers.current.delete(task.id);
      }
    },
    [update]
  );

  const upload = useCallback(
    async (files, folderId, opts = {}) => {
      const arr = Array.from(files);
      if (!arr.length) return;
      optionsRef.current = opts;
      setPanelOpen(true);

      const newTasks = arr.map((file) => ({
        id: ++taskSeq,
        name: file.name,
        size: file.size,
        total: file.size,
        loaded: 0,
        progress: 0,
        rate: 0,
        eta: null,
        status: 'uploading',
        error: null,
        file,
        folderId: folderId ?? null,
      }));
      setTasks((list) => [...newTasks, ...list]);

      // Upload files one after another to avoid saturating the link with many
      // parallel streams (better for large files); chunks within a file are
      // already sequential.
      for (const task of newTasks) {
        // eslint-disable-next-line no-await-in-loop
        await runTask(task);
      }
      opts.onAllDone?.();
    },
    [runTask]
  );

  const retryTask = useCallback(
    async (id) => {
      const task = tasksRef.current.find((t) => t.id === id);
      if (!task) return;
      setPanelOpen(true);
      const ok = await runTask(task);
      if (ok) optionsRef.current.onAllDone?.();
    },
    [runTask]
  );

  const cancelTask = useCallback((id) => {
    const c = controllers.current.get(id);
    if (c) c.abort();
  }, []);

  const clearFinished = useCallback(() => {
    setTasks((list) => list.filter((t) => t.status === 'uploading'));
  }, []);

  return { tasks, panelOpen, setPanelOpen, upload, cancelTask, retryTask, clearFinished };
}
