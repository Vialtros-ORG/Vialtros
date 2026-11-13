import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);
const STORAGE_KEY = "vialtros-theme";
const VALID_THEMES = new Set(["system", "light", "dark"]);

function readPreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return VALID_THEMES.has(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(readPreference);
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return undefined;
    const update = (event) => setSystemDark(event.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  const setTheme = useCallback((next) => {
    if (!VALID_THEMES.has(next)) return;
    setPreference(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Storage may be disabled. */ }
  }, []);

  const value = useMemo(() => ({
    preference,
    resolvedTheme: preference === "system" ? (systemDark ? "dark" : "light") : preference,
    setTheme,
  }), [preference, systemDark, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useAppTheme debe usarse dentro de ThemeProvider");
  return value;
}
