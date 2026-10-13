import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import type { Repository } from './repository';

// Opens the on-device store once and shares the repository. `open` is
// injected (openLogbook on the phone, an in-memory database in tests).

type LogbookState = {
  repo: Repository | null;
  error: Error | null;
  /** Bumped after a write so screens reload. */
  version: number;
  refresh: () => void;
};

const LogbookContext = createContext<LogbookState | null>(null);

export function LogbookProvider({
  open,
  children,
}: {
  open: () => Promise<Repository>;
  children: ReactNode;
}) {
  const [repo, setRepo] = useState<Repository | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    open().then(
      (r) => alive && setRepo(() => r),
      (e: unknown) => alive && setError(e instanceof Error ? e : new Error(String(e))),
    );
    return () => {
      alive = false;
    };
  }, [open]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  return (
    <LogbookContext.Provider value={{ repo, error, version, refresh }}>
      {children}
    </LogbookContext.Provider>
  );
}

export function useLogbook(): LogbookState {
  const ctx = useContext(LogbookContext);
  if (!ctx) throw new Error('useLogbook must be used inside LogbookProvider');
  return ctx;
}
