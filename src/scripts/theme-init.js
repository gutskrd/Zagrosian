// Sets the theme before the page is drawn, so it never flashes the wrong
// colours. Loaded as a small blocking script in <head> (an inline script would
// break the Content-Security-Policy). The controls are in theme.ts.
//
// When motion is welcome, it also decides whether the loading screen shows
// (Loader.astro, loader.ts): when a visit starts or the page is reloaded, not
// on the way from one page of the site to another. It makes room before the
// first paint for the homepage's pinned story (story.ts), so nothing shifts
// when it starts, and notes when a page slides in from another page of the
// site (global.css), so the homepage does not play its own entrance on top.
// And from 1 December to 6 January, Hevalo's icon is its Christmas version
// (HevaloIcon.astro).
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

  var today = new Date();
  if (today.getMonth() === 11 || (today.getMonth() === 0 && today.getDate() <= 6)) {
    root.dataset.season = 'christmas';
  }

  var motion = matchMedia('(prefers-reduced-motion: no-preference)').matches;
  if (motion) root.dataset.story = 'ready';

  try {
    var navigation = performance.getEntriesByType('navigation')[0];
    var reload = navigation && navigation.type === 'reload';
    if (motion && (reload || !sessionStorage.getItem('loaded'))) {
      sessionStorage.setItem('loaded', '1');
      root.dataset.loading = 'on';
    }
  } catch (error) {
    // Without session storage it would show on every page, so it does not.
  }

  // Fired just before the page is first drawn, also for a page Chrome prepared
  // in advance.
  addEventListener('pagereveal', function (event) {
    if (event.viewTransition) {
      root.dataset.arrival = 'slide';
      delete root.dataset.loading;
    }
  });
})();
