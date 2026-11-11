import { onPage } from './page-lifecycle';

/**
 * Draws the About time line as you scroll: the line grows, a comet rides its tip, events light up when reached.
 * The path is sampled once, so a scroll frame only does a lookup, a few style writes and one layout read.
 */
onPage((signal) => {
  const root = document.querySelector<HTMLElement>('[data-timeline]');
  const main = root?.querySelector<SVGPathElement>('[data-main]');
  const svg = main?.ownerSVGElement;
  if (!root || !main || !svg) return;
  const comet = root.querySelector<HTMLElement>('[data-comet]');
  const items = [...root.querySelectorAll<HTMLElement>('[data-item]')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const vb = svg.viewBox.baseVal;
  const total = main.getTotalLength();
  const N = 600;
  const xs = new Float32Array(N + 1);
  const ys = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const pt = main.getPointAtLength((i / N) * total);
    xs[i] = pt.x;
    ys[i] = pt.y;
  }
  main.style.strokeDasharray = `${total}`;
  const rtl = getComputedStyle(root).direction === 'rtl';
  let top = 0;
  let height = 1;
  let width = 1;
  let shown = -1;
  let queued = false;
  const lit = new Set<HTMLElement>();
  let itemTops: number[] = [];

  const measure = () => {
    const r = root.getBoundingClientRect();
    top = r.top + scrollY;
    height = r.height;
    width = r.width;
    itemTops = items.map((el) => el.getBoundingClientRect().top + scrollY);
  };

  const frame = () => {
    queued = false;
    const y = scrollY;
    const reached = innerHeight * 0.62;
    const p = reduce ? 1 : Math.min(1, Math.max(0, (y + reached - top) / height));
    if (p !== shown) {
      shown = p;
      main.style.strokeDashoffset = String(total * (1 - p));
      if (comet) {
        const f = p * N;
        const i = Math.min(N - 1, Math.floor(f));
        const t = f - i;
        const px = (xs[i] ?? 0) + ((xs[i + 1] ?? 0) - (xs[i] ?? 0)) * t;
        const py = (ys[i] ?? 0) + ((ys[i + 1] ?? 0) - (ys[i] ?? 0)) * t;
        const x = (px / vb.width) * width;
        comet.style.transform = `translate3d(${rtl ? width - x : x}px, ${(py / vb.height) * height}px, 0)`;
        comet.style.opacity = p > 0 && p < 1 ? '1' : '0';
      }
    }
    items.forEach((el, k) => {
      const on = reduce || (itemTops[k] ?? 0) - y < reached;
      if (on !== lit.has(el)) {
        el.classList.toggle('on', on);
        if (on) lit.add(el);
        else lit.delete(el);
      }
    });
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  };
  const remeasure = () => {
    measure();
    shown = -1;
    schedule();
  };
  addEventListener('scroll', schedule, { passive: true, signal });
  addEventListener('resize', remeasure, { passive: true, signal });
  void document.fonts?.ready.then(() => !signal.aborted && remeasure());
  measure();
  frame();
});
