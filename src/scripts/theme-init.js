// Render-blocking script in <head> (an inline script would violate the CSP). Runs before first
// paint:
//
// - applies the stored theme, avoiding a flash of the wrong one (controls live in theme.ts);
// - when motion is allowed, reserves space for the homepage story (story.ts) so nothing shifts when
//   it starts;
// - flags arrivals via a same-site view transition (global.css), so the homepage skips its own
//   entrance;
// - holds the homepage entrance until the font and the logo images are ready, so the page appears
//   once, complete, rather than swapping fonts mid-animation;
// - from Dec 1 to Jan 6, switches Hevalo's icon to the Christmas version (HevaloIcon.astro).
(function () {
  var preference = 'system';
  try {
    var stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') preference = stored;
  } catch {
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

  if (motion) {
    // Hero.astro pauses the entrance while this is set. Released when fonts and images are ready,
    // at most 0.6 s after DOMContentLoaded, and 2.5 s after navigation at the latest.
    root.dataset.entrance = 'waiting';
    var release = function () {
      delete root.dataset.entrance;
    };
    setTimeout(release, 2500);
    document.addEventListener('DOMContentLoaded', function () {
      var waits = [];
      var fonts = document.fonts;
      if (fonts) {
        waits.push(fonts.load('400 1em "Inter Variable"'), fonts.load('600 1em "Inter Variable"'));
        if (root.dir === 'rtl') waits.push(fonts.load('600 1em "Vazirmatn Variable"', '\u0627'));
      }
      document.querySelectorAll('link[rel="preload"][as="image"]').forEach(function (link) {
        if (link.media && !matchMedia(link.media).matches) return;
        var image = new Image();
        image.src = link.href;
        if (image.decode) waits.push(image.decode());
      });
      var settled = waits.map(function (wait) {
        return wait.catch(function () {});
      });
      Promise.race([
        Promise.all(settled),
        new Promise(function (resolve) {
          setTimeout(resolve, 600);
        }),
      ]).then(release);
    });
  }

  // Fires just before first render, including for pages Chrome prerendered.
  addEventListener('pagereveal', function (event) {
    if (event.viewTransition) {
      root.dataset.arrival = 'slide';
    }
  });
})();
