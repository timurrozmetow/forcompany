import { useState, useCallback, useRef, useEffect } from 'react';
import { fileApi } from '../api';
import { errorMessage } from '../api/client';

let taskSeq = 0;
const LS_PREFIX = 'cd_up:';
const CONCURRENCY = 3; // parallel chunks per file

function fingerprint(file, folderId) {
  return `${LS_PREFIX}${file.name}|${file.size}|${file.lastModified}|${folderId ?? 'root'}`;
}

/**
 * Chunked + resumable + PARALLEL upload queue.
 * - Each file is split into chunks; up to CONCURRENCY chunks upload at once.
 * - Resumes interrupted uploads (skips chunks already on the server), even
 *   after a page reload, via a localStorage-cached upload session id.
 * - Reports live progress, speed and ETA; supports cancel and retry.
 * - `opts.replace` finalizes with ?replace=1 (older same-name versions -> trash).
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
        // 1) Resume or init the session.
        let session = null;
        const cachedId = localStorage.getItem(fp);
        if (cachedId) {
          try {
            session = await fileApi.uploadStatus(cachedId);
          } catch (_) {
            localStorage.removeItem(fp);
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
        const chunkBytes = (i) => Math.min(chunkSize, task.file.size - i * chunkSize);

        let completedBytes = 0;
        for (const i of received) completedBytes += chunkBytes(i);
        const sessionStartLoaded = completedBytes;
        const inflight = new Map(); // index -> loaded bytes

        const report = () => {
          let loaded = completedBytes;
          for (const v of inflight.values()) loaded += v;
          loaded = Math.min(loaded, task.size);
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = elapsed > 0 ? (loaded - sessionStartLoaded) / elapsed : 0;
          const progress = task.size ? Math.min(100, Math.round((loaded / task.size) * 100)) : 100;
          const eta = rate > 0 ? (task.size - loaded) / rate : null;
          update(task.id, { progress, loaded, total: task.size, rate: Math.max(rate, 0), eta });
        };
        report();

        // 2) Build the work queue of missing chunks and run a small pool.
        const queue = [];
        for (let i = 0; i < totalChunks; i += 1) if (!received.has(i)) queue.push(i);

        let qi = 0;
        const worker = async () => {
          while (qi < queue.length) {
            if (controller.signal.aborted) throw new DOMException('canceled', 'AbortError');
            const i = queue[qi++];
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, task.file.size);
            const blob = task.file.slice(start, end);
            inflight.set(i, 0);
            // eslint-disable-next-line no-await-in-loop
            await fileApi.uploadChunk(
              uploadId,
              i,
              blob,
              (e) => {
                inflight.set(i, e.loaded || 0);
                report();
              },
              controller.signal
            );
            inflight.delete(i);
            completedBytes += chunkBytes(i);
            report();
          }
        };
        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length || 1) }, worker));

        // 3) Finalize.
        const file = await fileApi.uploadComplete(uploadId, !!optionsRef.current.replace);
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
