/**
 * Local time at headquarters, next to the country in About; formatted for the page locale and
 * updated every minute.
 */
export function initLocalTime() {
  for (const slot of document.querySelectorAll<HTMLElement>('[data-local-time]')) {
    const { timeZone, template = '{time}' } = slot.dataset;
    if (!timeZone) continue;

    let formatter: Intl.DateTimeFormat;
    try {
      formatter = new Intl.DateTimeFormat(document.documentElement.lang, { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    } catch {
      continue;
    }

    const time = document.createElement('time');
    const [before = '', after = ''] = template.split('{time}');
    slot.append(before, time, after);
    slot.hidden = false;

    const tick = () => {
      const now = new Date();
      time.dateTime = now.toISOString();
      time.textContent = formatter.format(now);
      window.setTimeout(tick, 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
    };
    tick();
  }
}
