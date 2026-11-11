const ARROW = [
  '#...........',
  '##..........',
  '#o#.........',
  '#oo#........',
  '#ooo#.......',
  '#oooo#......',
  '#ooooo#.....',
  '#oooooo#....',
  '#ooooooo#...',
  '#oooooooo#..',
  '#ooooooooo#.',
  '#oooooo#####',
  '#oo#oo#.....',
  '#o#.#oo#....',
  '##..#oo#....',
  '#....#oo#...',
  '.....#oo#...',
  '......##....',
];
const HAND = [
  '......##.........',
  '.....#oo#........',
  '.....#oo#........',
  '.....#oo#........',
  '.....#oo#........',
  '.....#oo###......',
  '.....#oo#oo###...',
  '.##..#oo#oo#oo#..',
  '#oo#.#oooooooo#..',
  '#ooo##oooooooo#..',
  '.#oooooooooooo#..',
  '..#ooooooooooo#..',
  '..#ooooooooooo#..',
  '...#oooooooooo#..',
  '...#oooooooooo#..',
  '....#oooooooo#...',
  '....#oooooooo#...',
  '....##########...',
];

function px(map: string[], hx: number, hy: number, k = 2): string {
  const w = Math.max(...map.map((r) => r.length));
  let r = '';
  map.forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (c === '#' || c === 'o')
        r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c === '#' ? '#000' : '#fff'}"/>`;
    });
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * k}" height="${map.length * k}" viewBox="0 0 ${w} ${map.length}" shape-rendering="crispEdges">${r}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hx * k} ${hy * k}`;
}

/** XP-style pixel cursors. Plain CSS cursors: no element follows the pointer, no hover growth. */
export function cursorCss(): string {
  return `html,body{cursor:${px(ARROW, 0, 0)},default}a,button,summary,.row,.tile,.dd-btn,.ftab,label[for]{cursor:${px(HAND, 6, 0)},pointer}input,textarea{cursor:text}`;
}

export function initCursor(): void {
  if (document.getElementById('sig-cursor')) return;
  if (matchMedia('(pointer: coarse)').matches) return;
  const st = document.createElement('style');
  st.id = 'sig-cursor';
  st.textContent = cursorCss();
  document.head.appendChild(st);
}
