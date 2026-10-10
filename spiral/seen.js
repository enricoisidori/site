// Keep an unbounded identifier history independently of the 200-row info log.
// Both players share it on the same origin, including after a page reload.
export function createSeenVideos(storage, key = 'spiral.archive.seen.v1') {
  const seen = new Set();
  function sync() {
    try {
      const stored = JSON.parse(storage?.getItem(key) || '[]');
      if (Array.isArray(stored)) for (const id of stored) if (typeof id === 'string') seen.add(id);
    } catch { /* Private browsing or malformed storage: retain in-memory history. */ }
  }
  sync();
  return {
    has(id) { sync(); return seen.has(id); },
    add(id) {
      sync();
      seen.add(id);
      try { storage?.setItem(key, JSON.stringify([...seen])); } catch { /* Session memory still works. */ }
    },
    get size() { sync(); return seen.size; },
  };
}
