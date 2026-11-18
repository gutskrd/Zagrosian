/**
 * The company's registered details in every footer: its address, its number
 * in the trade register (KvK) and its telephone number. Visitors see them, as
 * Dutch law asks; search engines are not to list them, so they are not in the
 * pages themselves. They come from /registration.json, which robots.txt asks
 * crawlers not to fetch, and are put in the footer's line here, between the
 * company's name and its email (Footer.astro).
 */
import type { Registration } from '../site';

/** A detail kept in one piece on a narrow screen: a line breaks between details, not through them. */
function whole(text: string) {
  const span = document.createElement('span');
  span.className = 'site-footer__whole';
  span.textContent = text;
  return span;
}

function fill(line: HTMLElement, slot: HTMLElement, { address, kvk, vat, phone }: Registration) {
  const details: Node[][] = [];
  // The address in two pieces: the street, then the postcode with the place.
  if (address) details.push([whole(`${address.street},`), document.createTextNode(' '), whole(`${address.postalCode} ${address.city}`)]);
  if (kvk) details.push([whole(`${line.dataset.kvk} ${kvk}`)]);
  if (vat) details.push([whole(`${line.dataset.vat} ${vat}`)]);
  if (phone) {
    // The number as registered, and a link that calls it.
    const link = document.createElement('a');
    link.className = 'site-footer__contact site-footer__whole';
    link.href = `tel:${phone.replace(/[^+\d]/g, '')}`;
    link.dir = 'ltr';
    link.textContent = phone;
    details.push([link]);
  }
  slot.replaceChildren(
    ...details.flatMap((parts) => {
      // The dot shows only where the details fit one line (Footer.astro).
      const dot = document.createElement('span');
      dot.className = 'site-footer__dot';
      dot.setAttribute('aria-hidden', 'true');
      dot.textContent = '·';
      // Isolated, so a right-to-left page keeps each detail in its own order.
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
      // Offline or refused: the line still gives the company's name and email.
    });
}
