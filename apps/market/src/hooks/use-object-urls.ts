"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Previews for files that have not been uploaded to anything yet.
 *
 * The art is shown the moment it is picked, which is long before it reaches
 * IPFS — the folder is named after the collection address, and that does not
 * exist until the first transaction is mined. So the form reads the files
 * locally and the upload stays exactly where it was.
 *
 * ── Why the File is the cache key ───────────────────────────────────────────
 *
 * Naively this is one `createObjectURL` per file per change, revoked on the
 * way out. That works until you drag a tile: reordering produces a new array
 * of the SAME files, so every URL would be revoked and remade, every `<img>`
 * would get a new src, and the whole run would flash on a gesture whose entire
 * purpose is to show you the order. Keyed on the File itself, a reorder is
 * free and only genuinely new files cost anything.
 *
 * ── Why creation happens in an effect ───────────────────────────────────────
 *
 * `createObjectURL` in render is a side effect, and React StrictMode
 * double-invokes the mount cycle in development: the cleanup below would
 * revoke every URL while the already-rendered array still pointed at them, and
 * every preview would break in dev and work in production. Creating in an
 * effect and publishing through state means the remount re-runs it and the
 * previews come back.
 */
export function useObjectUrls(files: File[]): string[] {
  const [urls, setUrls] = useState<string[]>([]);
  const cache = useRef(new Map<File, string>());

  useEffect(() => {
    const map = cache.current;

    const next = files.map((file) => {
      const existing = map.get(file);
      if (existing) return existing;
      const made = URL.createObjectURL(file);
      map.set(file, made);
      return made;
    });

    // Anything dropped from the run is released now rather than at unmount.
    // A creator who picks a hundred images and changes their mind twice would
    // otherwise hold all three hundred for the life of the tab.
    const live = new Set(files);
    for (const [file, url] of map) {
      if (!live.has(file)) {
        URL.revokeObjectURL(url);
        map.delete(file);
      }
    }

    setUrls(next);
  }, [files]);

  useEffect(() => {
    const map = cache.current;
    return () => {
      for (const url of map.values()) URL.revokeObjectURL(url);
      map.clear();
    };
  }, []);

  return urls;
}
