import { useSyncExternalStore } from "react";

/**
 * Tiny cross-section UI store for the slide-over cart drawer.
 *
 * Sections render as independent components inside the host's React tree, so
 * the Header (which owns the drawer) and any product card's "Add" button can't
 * share React state directly. They DO share this module, so a module-level
 * external store is the clean bridge — no window globals, no context plumbing,
 * SSR-safe via a constant server snapshot.
 */
let open = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function openCart() {
  if (open) return;
  open = true;
  emit();
}

export function closeCart() {
  if (!open) return;
  open = false;
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** React hook: is the drawer open? Re-renders subscribers on toggle. */
export function useCartOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false, // server snapshot — drawer is always closed on first paint
  );
}
