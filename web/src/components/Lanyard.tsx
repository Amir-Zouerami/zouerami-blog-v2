import { useEffect, useRef } from 'react';
import { Lanyard as Sim } from '../lib/lanyard-physics';

const CARD_W = 236;
const CARD_H = 340;
const CLIP = 26; // distance from the card's top edge to where the strap clips on
const SEG = 16;
const SEGMENTS = 8;
const STRAP_W = 24;
const DT = 1 / 120;

interface Props {
  photo: string;
  name: string;
  role: string;
  id: string;
  hint: string;
  site: string;
}

/**
 * Hero lanyard: a badge on a strap that you can grab and swing. Physics in lib/lanyard-physics (verlet), drawn with
 * plain DOM/SVG so text stays crisp, RTL and theming just work, and it costs no WebGL or extra library.
 * Server-renders as a hanging card; after hydration it comes alive. Reduced-motion users get the still card.
 */
export default function Lanyard({ photo, name, role, id, hint, site }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const band = useRef<SVGPathElement>(null);
  const edgeL = useRef<SVGPathElement>(null);
  const edgeR = useRef<SVGPathElement>(null);
  const stitchL = useRef<SVGPathElement>(null);
  const stitchR = useRef<SVGPathElement>(null);
  const mid = useRef<SVGPathElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const hintEl = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = box.current;
    const cardEl = card.current;
    const bandEl = band.current;
    const eL = edgeL.current;
    const eR = edgeR.current;
    const sL = stitchL.current;
    const sR = stitchR.current;
    const midEl = mid.current;
    if (!el || !cardEl || !bandEl || !eL || !eR || !sL || !sR || !midEl) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rtl = getComputedStyle(el).direction === 'rtl';

    const rect = () => el.getBoundingClientRect();
    const sim = new Sim({
      anchor: { x: rect().width / 2, y: -8 },
      segments: SEGMENTS,
      segLen: SEG,
      cardLen: CARD_H - CLIP,
      minX: 0,
      maxX: rect().width,
    });
    let raf = 0;
    let last = 0;
    let acc = 0;
    let running = false;
    let visible = true;
    let idleSince = 0;
    let prevCx = sim.center.x;

    let turn = 0;
    /** Ribbon along the rope: centre line smoothed with Catmull-Rom, then offset left/right to give it width. */
    const ribbon = (pts: { x: number; y: number }[]) => {
      const out: { x: number; y: number }[] = [];
      const n = pts.length;
      for (let i = 0; i < n - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)] as { x: number; y: number };
        const p1 = pts[i] as { x: number; y: number };
        const p2 = pts[i + 1] as { x: number; y: number };
        const p3 = pts[Math.min(n - 1, i + 2)] as { x: number; y: number };
        for (let k = 0; k < 4; k++) {
          const t = k / 4;
          const t2 = t * t;
          const t3 = t2 * t;
          out.push({
            x:
              0.5 *
              (2 * p1.x +
                (-p0.x + p2.x) * t +
                (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
            y:
              0.5 *
              (2 * p1.y +
                (-p0.y + p2.y) * t +
                (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
          });
        }
      }
      out.push(pts[n - 1] as { x: number; y: number });
      const side = (off: number) =>
        out.map((p, i) => {
          const a = out[Math.max(0, i - 1)] as { x: number; y: number };
          const b = out[Math.min(out.length - 1, i + 1)] as { x: number; y: number };
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 1;
          return { x: p.x + (-dy / d) * off, y: p.y + (dx / d) * off };
        });
      return {
        c: out,
        l: side(-STRAP_W / 2),
        r: side(STRAP_W / 2),
        ls: side(-STRAP_W / 2 + 3.5),
        rs: side(STRAP_W / 2 - 3.5),
      };
    };
    const line = (p: { x: number; y: number }[]) =>
      `M ${p.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' L ')}`;

    const draw = (alpha = 1) => {
      const pose = sim.pose(alpha);
      const pts = pose.slice(0, SEGMENTS + 1);
      const t = pose[SEGMENTS] as { x: number; y: number };
      const b = pose[SEGMENTS + 1] as { x: number; y: number };
      const rb = ribbon(pts);
      bandEl.setAttribute(
        'd',
        `${line(rb.l)} L ${[...rb.r]
          .reverse()
          .map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`)
          .join(' L ')} Z`,
      );
      eL.setAttribute('d', line(rb.l));
      eR.setAttribute('d', line(rb.r));
      sL.setAttribute('d', line(rb.ls));
      sR.setAttribute('d', line(rb.rs));
      midEl.setAttribute('d', line(rb.c));
      const angle = Math.atan2(-(b.x - t.x), b.y - t.y);
      const cx = (t.x + b.x) / 2;
      const vx = cx - prevCx; // horizontal speed -> a little 3D turn and glare, low-pass filtered so it never flickers
      prevCx = cx;
      turn += (Math.max(-20, Math.min(20, vx * 2.6)) - turn) * 0.12;
      cardEl.style.transform = `translate(${t.x}px, ${t.y}px) rotate(${angle}rad) translate(${-CARD_W / 2}px, ${-CLIP}px) rotateY(${turn}deg)`;
      cardEl.style.setProperty('--glare', String(50 + turn * 2.2));
      // light position slides with the tilt and the swing, so the gloss and the foil react like a real card
      const deg = (angle * 180) / Math.PI;
      cardEl.style.setProperty('--gx', `${50 + deg * 1.4 + turn * 2.4}%`);
      cardEl.style.setProperty('--gy', `${28 - deg * 0.5}%`);
      cardEl.style.setProperty('--foil', `${50 + deg * 2.2 + turn * 3}%`);
      const sh = shadow.current;
      if (sh)
        sh.style.transform = `translate(${cx + 26 + deg * 0.6}px, ${(t.y + b.y) / 2 + 34}px) rotate(${angle}rad)`;
    };

    const frame = (now: number) => {
      raf = 0;
      if (!running) return;
      acc += Math.min(0.05, (now - last) / 1000);
      last = now;
      while (acc >= DT) {
        sim.step(DT);
        acc -= DT;
      }
      draw(acc / DT);
      if (sim.dragging || sim.energy() > 0.004) idleSince = 0;
      else if (!idleSince) idleSince = now;
      if (idleSince && now - idleSince > 600) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (!visible || document.hidden) return;
      idleSince = 0;
      if (!running) {
        running = true;
        last = performance.now();
        acc = 0;
      }
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const local = (e: PointerEvent) => {
      const r = rect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    cardEl.classList.add('live');
    el.classList.add('live');
    draw(1);

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      cardEl.setPointerCapture(e.pointerId);
      sim.startDrag(local(e));
      cardEl.classList.add('grabbing');
      if (hintEl.current) hintEl.current.style.opacity = '0';
      wake();
    };
    const move = (e: PointerEvent) => {
      if (!sim.dragging) return;
      sim.dragTo(local(e));
      wake();
    };
    const up = () => {
      if (!sim.dragging) return;
      sim.endDrag();
      cardEl.classList.remove('grabbing');
      wake();
    };
    cardEl.addEventListener('pointerdown', down);
    cardEl.addEventListener('pointermove', move);
    cardEl.addEventListener('pointerup', up);
    cardEl.addEventListener('pointercancel', up);

    const resize = new ResizeObserver(() => {
      const r = rect();
      sim.setAnchor({ x: r.width / 2, y: -8 }, 0, r.width);
      wake();
    });
    resize.observe(el);
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible) wake();
      else running = false;
    });
    io.observe(el);
    const vis = () => (document.hidden ? (running = false) : wake());
    document.addEventListener('visibilitychange', vis);

    // a welcome swing so people notice it moves (towards the page's text, away from the edge)
    const hello = setTimeout(() => {
      sim.nudge(rtl ? 520 : -520);
      wake();
    }, 500);

    return () => {
      clearTimeout(hello);
      cancelAnimationFrame(raf);
      running = false;
      cardEl.removeEventListener('pointerdown', down);
      cardEl.removeEventListener('pointermove', move);
      cardEl.removeEventListener('pointerup', up);
      cardEl.removeEventListener('pointercancel', up);
      resize.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);

  return (
    <div className="lanyard" ref={box} aria-hidden="true">
      <i className="lanyard-strap-static" />
      <svg className="lanyard-svg">
        <path ref={mid} id="lanyard-mid" fill="none" stroke="none" />
        <path ref={band} className="lanyard-band" />
        <path ref={stitchL} className="lanyard-stitch" fill="none" />
        <path ref={stitchR} className="lanyard-stitch" fill="none" />
        <text className="lanyard-print" dy="3.4">
          <textPath href="#lanyard-mid" startOffset="6">
            {`${site.toUpperCase()}  ·  ${name.toUpperCase()}  ·  `.repeat(6)}
          </textPath>
        </text>
        <path ref={edgeL} className="lanyard-edge" fill="none" />
        <path ref={edgeR} className="lanyard-edge" fill="none" />
      </svg>
      <div className="lanyard-shadow" ref={shadow} style={{ width: CARD_W, height: CARD_H }} />
      <div className="lanyard-card" ref={card} style={{ width: CARD_W, height: CARD_H }}>
        <div className="lc-clip" />
        <i className="lc-thick lc-thick-3" />
        <i className="lc-thick lc-thick-2" />
        <i className="lc-thick lc-thick-1" />
        <div className="lc-face">
          <div className="lc-slot" />
          <div className="lc-photo">
            <img src={photo} alt="" width={640} height={640} draggable={false} decoding="async" />
          </div>
          <div className="lc-body">
            <strong dir="auto">{name}</strong>
            <span dir="auto">{role}</span>
          </div>
          <div className="lc-foot mono" dir="ltr">
            <span>{id}</span>
            <span>{site}</span>
          </div>
          <div className="lc-grain" />
          <div className="lc-holo" />
          <div className="lc-glare" />
          <div className="lc-spec" />
        </div>
      </div>
      <span className="lanyard-hint mono muted" ref={hintEl}>
        {hint}
      </span>
    </div>
  );
}
