// Sets the theme before the page is drawn, so it never flashes the wrong
// colours. Loaded as a small blocking script in <head> (an inline script would
// break the Content-Security-Policy). The controls are in theme.ts.
//
// When motion is welcome, it makes room before the first paint for the
// homepage's pinned story (story.ts), so nothing shifts when it starts. It
// notes when a page slides in from another page of the site (global.css), so
// the homepage does not play its own entrance on top. And it holds the
// homepage's entrance for a moment, until its typeface and the logo's images
// are in, so the page appears once, whole: never in a stand-in font that
// changes as it rises, nor with the logo arriving in pieces.
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

  if (motion) {
    // Hero.astro pauses the entrance while this is set. It is let go when the
    // fonts and images are ready, 0.6 s after the page is read at the latest,
    // and in any case 2.5 s after the page was opened.
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

  // Fired just before the page is first drawn, also for a page Chrome prepared
  // in advance.
  addEventListener('pagereveal', function (event) {
    if (event.viewTransition) {
      root.dataset.arrival = 'slide';
    }
  });
})();
