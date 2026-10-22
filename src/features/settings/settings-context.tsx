"use client";

import { createContext, use, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { canOpenSettings, defaultPreferences, parsePreferences, type Preferences, type Role } from "./model";
import { localStore } from "./store";

const preferencesStore = localStore("chihuahuabook:preferences", parsePreferences);

// Sul server non c'è localStorage: si parte dai predefiniti e il browser li corregge.
const serverPreferences = () => defaultPreferences;

const useSettingsValue = (role: Role, userId: string) => {
  const preferences = useSyncExternalStore(preferencesStore.subscribe, preferencesStore.get, serverPreferences);
  const [panelOpen, setPanelOpen] = useState(false);
  return useMemo(
    () => ({
      role,
      userId,
      canOpen: canOpenSettings(role),
      panelOpen: panelOpen && canOpenSettings(role),
      openPanel: () => setPanelOpen(true),
      closePanel: () => setPanelOpen(false),
      preferences,
      setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
        preferencesStore.set({ ...preferencesStore.get(), [key]: value }),
    }),
    [role, userId, preferences, panelOpen],
  );
};

type SettingsContextValue = ReturnType<typeof useSettingsValue>;

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * Impostazioni dell'app per chi la sta usando: il ruolo decide cosa vede
 * (il server ricontrolla comunque ogni modifica).
 */
export function SettingsProvider({ role, userId, children }: { role: Role; userId: string; children: ReactNode }) {
  return <SettingsContext value={useSettingsValue(role, userId)}>{children}</SettingsContext>;
}

export const useSettings = () => {
  const value = use(SettingsContext);
  if (!value) throw new Error("useSettings va usato dentro SettingsProvider");
  return value;
};
