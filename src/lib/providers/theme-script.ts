/**
 * Runs before paint to apply the stored theme and avoid a flash. Respects an
 * explicit data-theme attribute set by an embedding host when the stored
 * preference is "system".
 */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement;var p="system";try{var raw=localStorage.getItem("insurewise-preferences");if(raw){var s=JSON.parse(raw);p=(s&&s.state&&s.state.theme)||"system";if(s&&s.state&&s.state.largerText){d.style.fontSize="112.5%";}}}catch(e){}var host=d.getAttribute("data-theme");var dark=p==="dark"||(p==="system"&&(host?host==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches));d.classList.toggle("dark",dark);}catch(e){}})();`;
