export const THEME_STORAGE_KEY = "contractflow-theme";

// Runs in <head> before the first paint so a saved or system dark theme is
// applied before React hydrates. Keep it in step with applyTheme in
// theme-provider.tsx.
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t!=="light"&&t!=="dark"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}var d=document.documentElement;d.classList.toggle("dark",t==="dark");d.style.colorScheme=t}catch(e){}})()`;
