import { useEffect, useRef } from 'react';

/** Variable-font settings for a letter at `distance` px from the pointer (closer = bolder, narrower). */
export function morphSettings(distance: number, radius = 300): string {
  const k = Math.max(0, Math.min(1, 1 - distance / radius));
  return `'wght' ${Math.round(250 + 550 * k)}, 'wdth' ${Math.round(100 - 22 * k)}`;
}

const letters = (s: string) =>
  [...s].map((ch, i) => (
    <span className="ch" key={i}>
      {ch}
    </span>
  ));

/** Hero name. Server-renders plain text; after hydration the letters follow the pointer. */
export default function HeroName() {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (matchMedia('(pointer: coarse)').matches) return;
    let x = -999;
    let y = -999;
    let raf = 0;
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
    };
    addEventListener('pointermove', move);
    const loop = () => {
      ref.current?.querySelectorAll<HTMLElement>('.ch').forEach((c) => {
        const r = c.getBoundingClientRect();
        c.style.fontVariationSettings = morphSettings(
          Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)),
        );
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      removeEventListener('pointermove', move);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <h1 id="heroName" ref={ref} aria-label="Amir Zouerami">
      <span aria-hidden="true">
        {letters('Amir')}
        <br />
        {letters('Zouerami')}
        <span className="it">.</span>
      </span>
    </h1>
  );
}
