/** A tiny event bus: the repository announces local writes; sync listens. */
const listeners = new Set<() => void>();

export function onLocalChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitLocalChange(): void {
  listeners.forEach((l) => l());
}
