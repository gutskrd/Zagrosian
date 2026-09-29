// Sets the theme before the page is drawn, so it never flashes the wrong
// colours. Loaded as a small blocking script in <head> (an inline script would
// break the Content-Security-Policy). The controls are in theme.ts.
//
// It also decides, before the first paint, whether the hero horseman will be
// drawn in ink particles (ink.ts), so the still image is not shown first.
(function () {
  var preference = 'system';
  try {
    var stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') preference = stored;
  } catch (error) {
    // Storage can be unavailable (private browsing, blocked cookies).
  }
  var dark = preference === 'dark' || (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  var root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.themePreference = preference;

  // Only when motion is welcome, the visitor is not saving data, colours are
  // not forced and the browser has WebGL.
  var connection = navigator.connection;
  if (
    matchMedia('(prefers-reduced-motion: no-preference)').matches &&
    !matchMedia('(forced-colors: active)').matches &&
    !(connection && connection.saveData) &&
    'WebGLRenderingContext' in window
  ) {
    root.dataset.ink = 'pending';
  }
})();
