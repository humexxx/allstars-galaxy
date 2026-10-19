/**
 * The element that scrolls `el`, or `null` for the window.
 *
 * It is not the same one at every width (SPACING.md): from `md` the portal's
 * `<main>` scrolls inside a fixed frame, below it the document does.
 */
export function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (/auto|scroll|overlay/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
}

/** The height of the box `el` scrolls in. */
export function scrollportHeight(el: HTMLElement): number {
  return scrollParent(el)?.clientHeight ?? document.documentElement.clientHeight;
}

/** Scrolls whatever scrolls `el` by `top` pixels. */
export function scrollByFrom(el: HTMLElement, top: number): void {
  (scrollParent(el) ?? window).scrollBy({ top });
}
