import { useEffect, useRef } from 'react';
import { Lanyard as Sim } from '../lib/lanyard-physics';

const CARD_W = 236;
const CARD_H = 340;
const CLIP = 18; // distance from the card's top edge to where the strap clips on
const SEG = 24;
const SEGMENTS = 5;
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
  const strap = useRef<SVGPathElement>(null);
  const strapEdge = useRef<SVGPathElement>(null);
  const hintEl = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = box.current;
    const cardEl = card.current;
    const path = strap.current;
    const edge = strapEdge.current;
    if (!el || !cardEl || !path || !edge) return;
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

    const draw = () => {
      const t = sim.top;
      const pts = sim.pts.slice(0, SEGMENTS + 1);
      let d = `M ${pts[0]?.x} ${pts[0]?.y}`;
      for (let i = 1; i < pts.length - 1; i++) {
        const a = pts[i] as { x: number; y: number };
        const b = pts[i + 1] as { x: number; y: number };
        d += ` Q ${a.x} ${a.y} ${(a.x + b.x) / 2} ${(a.y + b.y) / 2}`;
      }
      d += ` L ${t.x} ${t.y}`;
      path.setAttribute('d', d);
      edge.setAttribute('d', d);
      const c = sim.center;
      const vx = c.x - prevCx; // horizontal speed -> a little 3D turn and glare
      prevCx = c.x;
      const turn = Math.max(-22, Math.min(22, vx * 3.2));
      cardEl.style.transform = `translate(${t.x}px, ${t.y}px) rotate(${sim.angle}rad) translate(${-CARD_W / 2}px, ${-CLIP}px) rotateY(${turn}deg)`;
      cardEl.style.setProperty('--glare', String(50 + turn * 2.2));
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
      draw();
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
    draw();

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
        <path ref={strapEdge} className="lanyard-strap-edge" fill="none" />
        <path ref={strap} className="lanyard-strap" fill="none" />
      </svg>
      <div className="lanyard-card" ref={card} style={{ width: CARD_W, height: CARD_H }}>
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
        <div className="lc-glare" />
      </div>
      <span className="lanyard-hint mono muted" ref={hintEl}>
        {hint}
      </span>
    </div>
  );
}
