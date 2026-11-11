/** Party colours: the site palette (grey + lime) is far too restrained for confetti. */
export const CONFETTI_COLORS = [
  '#ff595e',
  '#ffca3a',
  '#8ac926',
  '#1982c4',
  '#6a4c93',
  '#ff924c',
  '#ff70a6',
  '#70d6ff',
  '#d4ff3a',
] as const;

export interface BurstOptions {
  particleCount: number;
  spread: number;
  startVelocity: number;
  scalar: number;
  decay?: number;
  shapes?: ('circle' | 'square')[];
  /** Delay before this wave (ms). */
  delay: number;
  origin: { x?: number; y: number };
  colors: string[];
  zIndex: number;
  ticks: number;
  gravity: number;
  disableForReducedMotion: boolean;
}

/** Three overlapping waves out of the like button (`origin` in 0–1 viewport coordinates): big, wide and varied. */
export function burstPlan(origin: { x?: number; y: number }): BurstOptions[] {
  const base = {
    origin,
    colors: [...CONFETTI_COLORS],
    zIndex: 700,
    ticks: 280,
    gravity: 0.9,
    disableForReducedMotion: true,
  };
  return [
    { ...base, particleCount: 130, spread: 100, startVelocity: 50, scalar: 1.5, delay: 0 },
    {
      ...base,
      particleCount: 70,
      spread: 150,
      startVelocity: 30,
      scalar: 1.1,
      decay: 0.92,
      delay: 0,
    },
    {
      ...base,
      particleCount: 60,
      spread: 70,
      startVelocity: 58,
      scalar: 1.9,
      shapes: ['circle', 'square'],
      delay: 130,
    },
  ];
}
