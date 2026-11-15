export type TileVariant = 'hero' | 'big' | 'tall' | 'side' | 'half' | 'full' | 'third';

/**
 * Bento layout for `n` posts on a 6-column grid with two-row tiles: one large tile on the left, smaller ones stacked
 * beside it and a row underneath, arranged so every row is completely filled whatever the count.
 */
export function tileVariants(n: number): TileVariant[] {
  const plans: TileVariant[][] = [
    [],
    ['hero'],
    ['big', 'tall'],
    ['big', 'side', 'side'],
    ['big', 'side', 'side', 'full'],
    ['big', 'side', 'side', 'half', 'half'],
  ];
  const plan = plans[Math.min(n, 5)] ?? [];
  return [...plan, ...Array.from({ length: Math.max(0, n - 5) }, () => 'third' as const)];
}
