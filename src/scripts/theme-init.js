// Sets the theme before the page is drawn, so it never flashes the wrong
// colours. Loaded as a small blocking script in <head> (an inline script would
// break the Content-Security-Policy). The controls are in theme.ts.
//
// It also decides, before the first paint, whether the hero horseman will be
// drawn in ink particles (ink.ts), so the still image is not shown first, and
// whether the opening screen plays (intro.ts): on the first homepage visit of
// a session, when motion is welcome.
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

  var motion = matchMedia('(prefers-reduced-motion: no-preference)').matches;

  // The opening screen: homepages only (/, /de, /ckb, …), once per session.
  try {
    if (motion && /^\/([a-z]{2,3})?$/.test(location.pathname) && !sessionStorage.getItem('intro')) {
      sessionStorage.setItem('intro', '1');
      root.dataset.intro = 'loading';
    }
  } catch (error) {
    // Without session storage it would play on every visit, so it does not.
  }

  // Only when motion is welcome, the visitor is not saving data, colours are
  // not forced and the browser has WebGL.
  var connection = navigator.connection;
  if (
    motion &&
    !matchMedia('(forced-colors: active)').matches &&
    !(connection && connection.saveData) &&
    'WebGLRenderingContext' in window
  ) {
    root.dataset.ink = 'pending';
  }
})();
