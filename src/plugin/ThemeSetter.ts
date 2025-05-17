export function setTheme() {
  const urlParams = new URLSearchParams(window.location.search);

  let theme = urlParams.get('theme');
  if (!theme || theme === 'system') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  document.documentElement.classList.add("dark:text-gray-200");

  if (theme === 'dark') {
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.classList.add('dark', "dark:bg-gray-950");
    document.documentElement.style.background = "hsl(var(--background))";
  }
}