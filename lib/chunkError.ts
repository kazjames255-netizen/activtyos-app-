// A deploy replaces the JS chunk files; a tab opened before it then asks for a chunk that no longer exists and the page goes white (ChunkLoadError).
// One automatic reload fixes it; the flag stops a reload loop if the problem is something else.
export function isChunkLoadError(e: { name?: string; message?: string } | null | undefined): boolean {
  const s = `${e?.name ?? ""} ${e?.message ?? ""}`;
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(s);
}

/** Reloads once per tab session for a chunk error. Returns true if it reloaded. */
export function reloadOnceForChunkError(e: { name?: string; message?: string }, store: Pick<Storage, "getItem" | "setItem">, reload: () => void): boolean {
  if (!isChunkLoadError(e)) return false;
  try {
    if (store.getItem("aos-chunk-reloaded")) return false;
    store.setItem("aos-chunk-reloaded", "1");
  } catch { return false; }
  reload();
  return true;
}
