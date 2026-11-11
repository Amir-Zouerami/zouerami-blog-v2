import { onPage } from './page-lifecycle';

/** Draws the About time line as you scroll: the line grows, a comet rides its tip, events light up when reached. */
onPage((signal) => {
  const root = document.querySelector<HTMLElement>('[data-timeline]');
  const main = root?.querySelector<SVGPathElement>('[data-main]');
  if (!root || !main) return;
  const comet = root.querySelector<HTMLElement>('[data-comet]');
  const items = [...root.querySelectorAll<HTMLElement>('[data-item]')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const vb = main.ownerSVGElement?.viewBox.baseVal;
  const total = main.getTotalLength();

  const update = () => {
    const r = root.getBoundingClientRect();
    const reached = innerHeight * 0.62;
    const p = reduce ? 1 : Math.min(1, Math.max(0, (reached - r.top) / r.height));
    main.style.strokeDashoffset = String(1 - p);
    if (comet && vb) {
      const pt = main.getPointAtLength(p * total);
      const rtl = getComputedStyle(root).direction === 'rtl';
      const x = (pt.x / vb.width) * r.width;
      comet.style.left = `${rtl ? r.width - x : x}px`;
      comet.style.top = `${(pt.y / vb.height) * r.height}px`;
      comet.style.opacity = p > 0 && p < 1 ? '1' : '0';
    }
    for (const el of items) {
      const top = el.getBoundingClientRect().top;
      el.classList.toggle('on', reduce || top < reached);
    }
  };
  addEventListener('scroll', update, { passive: true, signal });
  addEventListener('resize', update, { passive: true, signal });
  update();
});
