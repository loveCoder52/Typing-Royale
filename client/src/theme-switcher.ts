/**
 * Monkeytype-style theme picker.
 * Works outside React, so App.tsx stays untouched.
 *
 * Usage: add this ONE line to main.tsx (above the App import is fine):
 *   import "./theme-switcher";
 */

type Theme = {
  id: string;
  name: string;
  bg: string; // preview swatch background
  accent: string; // preview swatch accent dot
  text: string; // preview swatch text bar
};

// `id` must match a [data-theme="..."] block in index.css
const THEMES: Theme[] = [
  { id: "sky", name: "Sky", bg: "#f5f8ff", accent: "#3a62f0", text: "#0e1b57" },
  { id: "paper", name: "Paper", bg: "#f4f4f5", accent: "#18181b", text: "#6b6b76" },
  { id: "mint", name: "Mint", bg: "#f1faf5", accent: "#0e9556", text: "#0b2e1d" },
  { id: "lavender", name: "Lavender", bg: "#f7f4ff", accent: "#7048e8", text: "#1e1447" },
  { id: "sunset", name: "Sunset", bg: "#fff7f0", accent: "#e8590c", text: "#3b1a08" },
  { id: "midnight", name: "Midnight", bg: "#0b1020", accent: "#7c9bff", text: "#e8edff" },
  { id: "serika", name: "Serika Dark", bg: "#323437", accent: "#e2b714", text: "#d1d0c5" },
  { id: "nord", name: "Nord", bg: "#242933", accent: "#88c0d0", text: "#eceff4" },
  { id: "dracula", name: "Dracula", bg: "#1e1f29", accent: "#bd93f9", text: "#f8f8f2" },
  { id: "terminal", name: "Terminal", bg: "#000000", accent: "#39ff5a", text: "#b8ffb8" },
];

const STORAGE_KEY = "typing-royale-theme";
const DEFAULT_THEME = "paper";

function loadTheme(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && THEMES.some((theme) => theme.id === saved)) return saved;
  } catch {
    /* storage unavailable, use default */
  }
  return DEFAULT_THEME;
}

function saveTheme(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

function applyTheme(id: string) {
  document.documentElement.dataset.theme = id;
}

// Apply immediately so there is no flash of the wrong theme.
let currentId = loadTheme();
applyTheme(currentId);

function mount() {
  const wrapper = document.createElement("div");
  wrapper.className = "theme-switcher";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "theme-toggle";
  toggle.setAttribute("aria-haspopup", "true");
  toggle.setAttribute("aria-expanded", "false");

  const panel = document.createElement("div");
  panel.className = "theme-panel";
  panel.setAttribute("role", "group");
  panel.setAttribute("aria-label", "Choose theme");
  panel.hidden = true;

  const options = new Map<string, HTMLButtonElement>();

  function currentName() {
    return THEMES.find((theme) => theme.id === currentId)?.name ?? "Theme";
  }

  function refresh() {
    toggle.textContent = `🎨 ${currentName()}`;
    options.forEach((button, id) => {
      button.setAttribute("aria-pressed", String(id === currentId));
    });
  }

  function setOpen(open: boolean) {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  }

  THEMES.forEach((theme) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-option";

    const swatch = document.createElement("span");
    swatch.className = "theme-swatch";
    swatch.style.background = theme.bg;

    const dot = document.createElement("i");
    dot.style.background = theme.accent;
    const bar = document.createElement("i");
    bar.style.background = theme.text;
    swatch.append(dot, bar);

    const label = document.createElement("span");
    label.textContent = theme.name;

    button.append(swatch, label);
    button.addEventListener("click", () => {
      currentId = theme.id;
      applyTheme(theme.id);
      saveTheme(theme.id);
      refresh();
    });

    options.set(theme.id, button);
    panel.append(button);
  });

  toggle.addEventListener("click", () => setOpen(panel.hidden));

  document.addEventListener("click", (event) => {
    if (!wrapper.contains(event.target as Node)) setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });

  wrapper.append(panel, toggle);
  document.body.append(wrapper);
  refresh();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}