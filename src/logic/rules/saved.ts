/** UX8: «Сохранено ✓» – the page a save goes back to gets `saved=1` (before any #anchor). */
export function withSaved(url: string): string {
  const [path, hash] = url.split("#");
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}saved=1${hash !== undefined ? `#${hash}` : ""}`;
}
