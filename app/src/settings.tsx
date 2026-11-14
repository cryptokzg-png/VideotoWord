import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getAllSettings, setSetting } from './db/db';

export * from './lib/settingsModel';
import { DEFAULTS, parseSettings, type Settings } from './lib/settingsModel';

type Ctx = { settings: Settings; update: (patch: Partial<Settings>) => void; ready: boolean };
const SettingsContext = createContext<Ctx>({ settings: DEFAULTS, update: () => {}, ready: false });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getAllSettings()
      .then((raw) => setSettings(parseSettings(raw)))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    for (const [k, v] of Object.entries(patch)) setSetting(k, String(v)).catch(() => {});
  }, []);

  const value = useMemo(() => ({ settings, update, ready }), [settings, update, ready]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
