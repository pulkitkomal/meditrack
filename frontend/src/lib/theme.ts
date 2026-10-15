import { useSyncExternalStore } from "react";

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "sehat-theme";
const listeners = new Set<() => void>();
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

const readPreference = (): ThemePreference => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
};

let current = readPreference();

const applyTheme = () => {
  const dark = current === "dark" || (current === "system" && darkQuery.matches);
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#1c1c1e" : "#0d9488");
};

darkQuery.addEventListener("change", applyTheme);
applyTheme();

export const setThemePreference = (preference: ThemePreference) => {
  current = preference;
  if (preference === "system") localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, preference);
  applyTheme();
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useThemePreference = () => useSyncExternalStore(subscribe, () => current);
