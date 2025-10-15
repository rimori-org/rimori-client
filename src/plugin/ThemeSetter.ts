export function setTheme(theme?: string | null) {
  document.documentElement.classList.add('dark:text-gray-200');

  if (isDarkTheme(theme)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.classList.add('dark', 'dark:bg-gray-950');
    document.documentElement.style.background = 'hsl(var(--background))';
  }
}

export function isDarkTheme(theme?: string | null): boolean {
  // If no theme provided, try to get from URL as fallback (for standalone mode)
  if (!theme) {
    const urlParams = new URLSearchParams(window.location.search);
    theme = urlParams.get('theme');
  }

  if (!theme || theme === 'system') {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  return theme === 'dark';
}
