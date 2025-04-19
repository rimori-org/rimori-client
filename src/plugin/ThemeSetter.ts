export function setTheme() {
  const urlParams = new URLSearchParams(window.location.search);

  let theme = urlParams.get('theme');
  const isSidebar = urlParams.get('applicationMode') === "sidebar";

  if (!theme || theme === 'system') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  document.documentElement.classList.add("dark:text-gray-200", "bg-white");

  if (theme === 'dark') {
    document.documentElement.classList.add('dark', isSidebar ? "bg-gray-920" : "bg-gray-950");
    document.documentElement.style.background = isSidebar ? "rgb(6, 12, 30)" : "rgb(3, 7, 18)";
  }
}