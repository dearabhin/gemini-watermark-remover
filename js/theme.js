// ── Fluent theme switcher ─────────────────────────────────────────────
// Default to light mode; persist user choice in localStorage.
(function () {
  const html = document.documentElement;
  const stored = localStorage.getItem("theme");

  if (stored === "dark") {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
    if (!stored) {
      localStorage.setItem("theme", "light");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("themeToggle");
    if (!btn) return;

    btn.addEventListener("click", () => {
      if (html.classList.contains("dark")) {
        html.classList.remove("dark");
        localStorage.setItem("theme", "light");
      } else {
        html.classList.add("dark");
        localStorage.setItem("theme", "dark");
      }
    });
  });
})();
