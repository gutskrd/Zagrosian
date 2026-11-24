/**
 * Renders the company's registration details (address, KvK number, phone) into the footer at
 * runtime. They're required to be visible but should stay out of search results, so they aren't in
 * the HTML: they're fetched from /registration.json, which robots.txt disallows and which is served
 * with `X-Robots-Tag: noindex` (Footer.astro has the markup).
 */
import type { Registration } from '../site';

/** Non-breaking unit, so lines wrap between details rather than inside them. */
function whole(text: string) {
  const span = document.createElement('span');
  span.className = 'site-footer__whole';
  span.textContent = text;
  return span;
}

function fill(line: HTMLElement, slot: HTMLElement, { address, kvk, vat, phone }: Registration) {
  const details: Node[][] = [];
  // Address in two units: street, then postcode and city.
  if (address) details.push([whole(`${address.street},`), document.createTextNode(' '), whole(`${address.postalCode} ${address.city}`)]);
  if (kvk) details.push([whole(`${line.dataset.kvk} ${kvk}`)]);
  if (vat) details.push([whole(`${line.dataset.vat} ${vat}`)]);
  if (phone) {
    // Phone as registered, linked for calling.
    const link = document.createElement('a');
    link.className = 'site-footer__contact site-footer__whole';
    link.href = `tel:${phone.replace(/[^+\d]/g, '')}`;
    link.dir = 'ltr';
    link.textContent = phone;
    details.push([link]);
  }
  slot.replaceChildren(
    ...details.flatMap((parts) => {
      // Separator dots only show where the details fit on one line (Footer.astro).
      const dot = document.createElement('span');
      dot.className = 'site-footer__dot';
      dot.setAttribute('aria-hidden', 'true');
      dot.textContent = '·';
      // Bidi isolation keeps each detail in its own order on RTL pages.
      const bdi = document.createElement('bdi');
      bdi.append(...parts);
      return [dot, bdi];
    }),
  );
  line.setAttribute('data-registered', '');
}

export function initRegistration() {
  const line = document.querySelector<HTMLElement>('[data-registration]');
  const slot = line?.querySelector<HTMLElement>('[data-registration-details]');
  if (!line || !slot) return;
  fetch('/registration.json')
    .then((response) => (response.ok ? (response.json() as Promise<Registration>) : null))
    .then((details) => {
      if (details) fill(line, slot, details);
    })
    .catch(() => {
      // Offline or blocked: the line still shows the company name and email.
    });
}
