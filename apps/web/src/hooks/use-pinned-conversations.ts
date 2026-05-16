import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "elegram:pinned-conversations";

function readPinned(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function usePinnedConversations() {
  const [pinned, setPinned] = useState<string[]>(() => readPinned());

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || event.storageArea !== window.localStorage) {
        return;
      }
      setPinned(readPinned());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: string[]) => {
    setPinned(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota or access errors
    }
  }, []);

  const pin = useCallback((id: string) => {
    setPinned((current) => {
      if (current.includes(id)) return current;
      const next = [id, ...current];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const unpin = useCallback((id: string) => {
    setPinned((current) => {
      if (!current.includes(id)) return current;
      const next = current.filter((v) => v !== id);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const toggle = useCallback((id: string) => {
    setPinned((current) => {
      const next = current.includes(id) ? current.filter((v) => v !== id) : [id, ...current];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { pinned, pin, unpin, toggle, setPinned: persist };
}
