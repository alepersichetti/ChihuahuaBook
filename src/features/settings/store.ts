export type Store<T> = {
  readonly subscribe: (listener: () => void) => () => void;
  readonly get: () => T;
  readonly set: (value: T) => void;
};

const readJson = (key: string): unknown => {
  try {
    const text = window.localStorage.getItem(key);
    return text === null ? null : JSON.parse(text);
  } catch {
    return null;
  }
};

const writeJson = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Navigazione privata o spazio esaurito: la scelta vale finché la pagina resta aperta.
  }
};

/**
 * Valore salvato in localStorage, da leggere con useSyncExternalStore.
 * Il valore letto resta lo stesso oggetto finché non cambia, come richiede React;
 * le modifiche fatte in un'altra scheda arrivano con l'evento "storage".
 */
export const localStore = <T>(key: string, parse: (input: unknown) => T): Store<T> => {
  const listeners = new Set<() => void>();
  let cached: T | undefined;
  const notify = () => listeners.forEach((listener) => listener());
  const onStorage = (event: StorageEvent) => {
    if (event.key !== key) return;
    cached = undefined;
    notify();
  };
  return {
    subscribe: (listener) => {
      if (listeners.size === 0) window.addEventListener("storage", onStorage);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener("storage", onStorage);
      };
    },
    get: () => (cached ??= parse(readJson(key))),
    set: (value) => {
      cached = value;
      writeJson(key, value);
      notify();
    },
  };
};
