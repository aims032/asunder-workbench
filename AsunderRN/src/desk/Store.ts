import { useSyncExternalStore } from 'react';

// A TINY STORE: one value that screens can watch.
//
// The printer and the switchboard each keep their state in one of these.
// When the value changes, every screen showing it redraws. It lives outside
// React so the state survives screens being rebuilt (same reason the bench is
// made in App.tsx).

export interface Store<T> {
  get(): T;
  set(value: T): void;
  /** Call `listener` whenever the value changes. Returns a function that stops it. */
  subscribe(listener: () => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      if (next === value) {
        return;
      }
      value = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Use a store's value inside a screen; the screen redraws when it changes. */
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
