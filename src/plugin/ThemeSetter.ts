export function setTheme() {
  document.documentElement.classList.add("dark:text-gray-200");

  if (isDarkTheme()) {
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.classList.add('dark', "dark:bg-gray-950");
    document.documentElement.style.background = "hsl(var(--background))";
  }
}

export function isDarkTheme(): boolean {
  const urlParams = new URLSearchParams(window.location.search);

  let theme = urlParams.get('theme');
  if (!theme || theme === 'system') {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  return theme === 'dark';
}