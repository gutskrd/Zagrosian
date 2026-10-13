/**
 * The site menu is in the page's own colours, in either theme, also when it is
 * opened from the header while that is in the other theme's colours over the
 * story's scene; Escape closes it. And nothing in it, or in the language menu,
 * overlaps, runs off the screen or is cut off: in every language, and with
 * every word 40% longer (as a longer language's would be), at six widths.
 */
import { type Page, expect, test } from "@playwright/test";
import { locales, prefix, settled } from "./support";

const paper = { light: "rgb(255, 255, 255)", dark: "rgb(10, 10, 10)" };

test.describe("on a phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test.describe(colorScheme, () => {
      test.use({ colorScheme });

      test("the menu is in the theme’s colours, and Escape closes it", async ({
        page,
      }) => {
        await settled(page.context());
        await page.goto("/", { waitUntil: "networkidle" });
        const menu = page.locator("#site-menu");
        await page.locator(".menu-button--open").click();
        await expect(menu).toBeVisible();
        await expect(menu).toHaveCSS("background-color", paper[colorScheme]);
        await page.keyboard.press("Escape");
        await expect(menu).toBeHidden();
      });
    });
  }

  test("opened over the story’s scene, the menu keeps the page’s colours", async ({
    page,
  }) => {
    await settled(page.context());
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/", { waitUntil: "networkidle" });
    const header = page.locator(".site-header");
    // Down into the story, until the header is drawn in the other colours.
    await expect
      .poll(
        async () => {
          await page.mouse.wheel(0, 300);
          return header.evaluate((element) =>
            element.hasAttribute("data-inverse"),
          );
        },
        { timeout: 30_000, intervals: [100] },
      )
      .toBe(true);
    await page.locator(".menu-button--open").click();
    const menu = page.locator("#site-menu");
    await expect(menu).toBeVisible();
    await expect(menu).toHaveCSS("background-color", paper.light);
  });
});

/** Makes every word in a menu 40% longer, the big rolling labels' letters too. */
async function lengthen(page: Page, selector: string) {
  await page.evaluate((selector) => {
    const menu = document.querySelector(selector)!;
    const longer = (text: string) =>
      text.replace(
        /[A-Za-z]{2,}/g,
        (word) => word + word.slice(0, Math.ceil(word.length * 0.4)),
      );
    const walker = document.createTreeWalker(menu, NodeFilter.SHOW_TEXT);
    const nodes: Node[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) node.textContent = longer(node.textContent ?? "");
    for (const track of menu.querySelectorAll(".roll__track")) {
      for (const piece of track.querySelectorAll<HTMLElement>(".roll__word")) {
        const letters = longer(
          [...piece.children]
            .map((letter) => (letter as HTMLElement).dataset.char)
            .join(""),
        );
        piece.replaceChildren(
          ...[...letters].map((letter) => {
            const span = document.createElement("span");
            span.className = "roll__piece";
            span.dataset.char = letter;
            return span;
          }),
        );
      }
    }
  }, selector);
}

/** What in a menu overlaps, runs off the screen or is cut off. */
function problemsIn(page: Page, selector: string) {
  return page.evaluate((selector) => {
    const menu = document.querySelector(selector)!;
    const width = document.documentElement.clientWidth;
    const out: string[] = [];
    const shown = (element: Element) => {
      const box = element.getBoundingClientRect();
      return (
        element.checkVisibility({
          opacityProperty: true,
          visibilityProperty: true,
        }) &&
        box.width > 0 &&
        box.height > 0
      );
    };
    // What a reader sees as one piece each: a link, a button, a label.
    const pieces = [...menu.querySelectorAll("a, button, p, li > span, svg")]
      .filter(
        (element) =>
          !element.closest(".visually-hidden") &&
          !element.parentElement!.closest("a, button"),
      )
      .filter(shown);
    const name = (element: Element) =>
      `${element.localName} "${element.textContent?.trim().slice(0, 24)}"`;
    const boxes = pieces.map((piece) => piece.getBoundingClientRect());
    boxes.forEach((a, i) => {
      if (a.right > width + 0.5 || a.left < -0.5)
        out.push(
          `${name(pieces[i])} spans ${Math.round(a.left)} to ${Math.round(a.right)}`,
        );
      boxes.forEach((b, j) => {
        if (
          j <= i ||
          pieces[i].contains(pieces[j]) ||
          pieces[j].contains(pieces[i])
        )
          return;
        const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (x > 2 && y > 2)
          out.push(`${name(pieces[i])} overlaps ${name(pieces[j])}`);
      });
    });
    for (const element of menu.querySelectorAll("*")) {
      const style = getComputedStyle(element);
      if (!shown(element) || element.closest(".visually-hidden")) continue;
      if (
        style.overflowX !== "visible" &&
        element.scrollWidth > element.clientWidth + 1
      )
        out.push(`${name(element)} is cut off`);
    }
    return [...new Set(out)];
  }, selector);
}

const sizes = [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

for (const viewport of sizes) {
  test.describe(`${viewport.width} wide`, () => {
    const touch = viewport.width < 800;
    test.use({
      viewport,
      isMobile: touch,
      hasTouch: touch,
      contextOptions: { reducedMotion: "reduce" },
    });

    test("nothing in the menus overlaps, runs off or is cut off, in any language", async ({
      page,
    }) => {
      await settled(page.context());
      const issues: string[] = [];
      const runs = [
        ...locales.map(({ code }) => ({
          name: code,
          path: prefix(code) || "/",
          longer: false,
        })),
        { name: "en, 40% longer", path: "/", longer: true },
      ];
      for (const run of runs) {
        await page.goto(run.path, { waitUntil: "networkidle" });
        const menus = [
          { selector: "#site-menu", open: page.locator(".menu-button--open") },
        ];
        const languages = page.locator(".language__button");
        if (await languages.isVisible())
          menus.push({ selector: "#language-menu", open: languages });
        for (const { selector, open } of menus) {
          await open.click();
          await expect(page.locator(selector)).toBeVisible();
          if (run.longer) await lengthen(page, selector);
          issues.push(
            ...(await problemsIn(page, selector)).map(
              (issue) => `${run.name} ${selector}: ${issue}`,
            ),
          );
          await page.keyboard.press("Escape");
          await expect(page.locator(selector)).toBeHidden();
        }
      }
      expect(issues).toEqual([]);
    });
  });
}
