import { useEffect, useState } from "react";

const STORAGE_KEY = "easyecookbook_theme";

function isDarkNow(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

/**
 * Toggles the `dark` class on <html> and persists the choice. The initial theme
 * is applied by an inline script in index.html (before paint) to avoid a flash,
 * so this component just reflects and updates that state.
 */
export default function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(isDarkNow);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    try {
      localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
    } catch {
      /* storage unavailable — ignore */
    }
  }, [dark]);

  return (
    <button
      type="button"
      onClick={() => setDark((d) => !d)}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={
        className ??
        "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-lg leading-none transition-colors"
      }
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
