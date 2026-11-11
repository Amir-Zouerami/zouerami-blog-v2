export interface Size {
  w: number;
  h: number;
}
export interface Viewport {
  w: number;
  h: number;
}
export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export interface Placement {
  left: number;
  top: number;
  /** For the scale-in animation: the corner nearest the pointer. */
  originX: 'left' | 'right';
  originY: 'top' | 'bottom';
}

const MARGIN = 8;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));

/**
 * Where to put a menu opened at a point: down-and-toward-the-inline-end by default,
 * flipped to the other side of the pointer when it would overflow, and finally clamped inside the viewport.
 */
export function placeMenu(
  pt: { x: number; y: number },
  size: Size,
  vp: Viewport,
  rtl = false,
  margin = MARGIN,
): Placement {
  let left = rtl ? pt.x - size.w : pt.x;
  if (left + size.w > vp.w - margin || left < margin) {
    const flipped = rtl ? pt.x : pt.x - size.w;
    if (flipped >= margin && flipped + size.w <= vp.w - margin) {
      left = flipped;
    }
  }
  let top = pt.y;
  if (top + size.h > vp.h - margin) {
    const flipped = pt.y - size.h;
    if (flipped >= margin) {
      top = flipped;
    }
  }
  const finalLeft = clamp(left, margin, vp.w - size.w - margin);
  const finalTop = clamp(top, margin, vp.h - size.h - margin);
  // the animation grows out of the corner nearest the pointer, wherever clamping finally put the menu
  return {
    left: finalLeft,
    top: finalTop,
    originX: pt.x > finalLeft + size.w / 2 ? 'right' : 'left',
    originY: pt.y > finalTop + size.h / 2 ? 'bottom' : 'top',
  };
}

/** A submenu opens beside its parent item (inline-end), flips to the other side when there is no room. */
export function placeSubmenu(
  anchor: Rect,
  size: Size,
  vp: Viewport,
  rtl = false,
  margin = MARGIN,
  overlap = 4,
): Placement {
  const endLeft = rtl ? anchor.left - size.w + overlap : anchor.right - overlap;
  const startLeft = rtl ? anchor.right - overlap : anchor.left - size.w + overlap;
  const fits = (l: number) => l >= margin && l + size.w <= vp.w - margin;
  const left = fits(endLeft) ? endLeft : fits(startLeft) ? startLeft : endLeft;
  const top = anchor.top - 6; // line the first item up with the parent
  return {
    left: clamp(left, margin, vp.w - size.w - margin),
    top: clamp(top, margin, vp.h - size.h - margin),
    originX: left === endLeft ? (rtl ? 'right' : 'left') : rtl ? 'left' : 'right',
    originY: 'top',
  };
}
