import { onPage } from './page-lifecycle';
import { showToast } from './toast';

/**
 * Behaviour of the references (see lib/references.ts for the markup this works on):
 *  - hovering a marker lights its source: a margin card on wide screens (with a thread to it), a popover otherwise;
 *  - clicking a marker, a margin card or a "cited in" dot jumps to the source / the passage and flashes it;
 *  - hovering a source lights every passage that cites it and draws threads to the ones on screen;
 *  - the reading map shows where each citation sits in the article.
 * Without JavaScript the markers are plain links to the source (#ref-N) and the box is a normal list.
 */
interface Cite {
  k: number;
  key: string;
  el: HTMLAnchorElement;
  claim: HTMLElement | null;
}

const esc = (s: string) => CSS.escape(s);
const colorOf = (el: Element) =>
  getComputedStyle(el).getPropertyValue('--tc').trim() || 'var(--acc)';

onPage((signal) => {
  const box = document.querySelector<HTMLElement>('[data-refs]');
  const art = document.querySelector<HTMLElement>('main[data-post-slug] article');
  const prose = art?.querySelector<HTMLElement>('.prose');
  if (!box || !art || !prose) return undefined;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth';
  const cites: Cite[] = [...prose.querySelectorAll<HTMLAnchorElement>('a.ref-cite')]
    .map((el) => ({
      k: Number(el.dataset.k),
      key: el.dataset.ref ?? '',
      el,
      claim: el.closest<HTMLElement>('.ref-claim'),
    }))
    .sort((a, b) => a.k - b.k);
  const tiles = [...box.querySelectorAll<HTMLElement>('.ref-tile')];
  const tileOf = (key: string) =>
    box.querySelector<HTMLElement>(`.ref-tile[data-ref="${esc(key)}"]`);
  const bySame = (key: string) => cites.filter((c) => c.key === key);
  if (!cites.length) return undefined;
  const proseEl: HTMLElement = prose;

  // controls that need JavaScript
  for (const el of box.querySelectorAll<HTMLElement>(
    '[data-filters], [data-map], [data-mapcap], [data-bib], .ref-ib',
  ))
    el.hidden = false;

  /* ---------------------------------------------------------------- threads */
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'ref-threads');
  svg.setAttribute('aria-hidden', 'true');
  document.body.appendChild(svg);
  let threads: { pairs: [Element, Element][]; color: string } | null = null;

  const render = (animate: boolean) => {
    if (!threads) return;
    const vh = innerHeight;
    const rtl = document.documentElement.dir === 'rtl' ? -1 : 1;
    let html = '';
    for (const [a, b] of threads.pairs) {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const ax = ra.left + ra.width / 2;
      const ay = ra.top + ra.height / 2;
      const bx = rb.left + rb.width / 2;
      const by = rb.top + rb.height / 2;
      if (ay < -20 || ay > vh + 20 || by < -20 || by > vh + 20) continue; // only what is on screen
      const horizontal = Math.abs(bx - ax) > Math.abs(by - ay);
      const sx = Math.sign(bx - ax) || 1;
      const dx = Math.max(80, Math.abs(bx - ax) * 0.5);
      const dy = (by - ay) * 0.5;
      const d = horizontal
        ? `M${ax},${ay} C${ax + sx * dx},${ay} ${bx - sx * dx},${by} ${bx},${by}`
        : `M${ax},${ay} C${ax + 90 * rtl},${ay + dy} ${bx - 90 * rtl},${by - dy} ${bx},${by}`;
      const motion =
        animate && !reduce
          ? 'stroke-dasharray:1200;stroke-dashoffset:1200;animation:ref-dash .55s ease-out forwards'
          : '';
      html += `<path d="${d}" stroke="${threads.color}" style="${motion}"/><circle cx="${bx}" cy="${by}" r="5" fill="${threads.color}"/>`;
    }
    svg.innerHTML = html;
  };
  const drawThreads = (pairs: [Element, Element][], color: string) => {
    threads = { pairs, color };
    render(true);
  };
  const clearThreads = () => {
    threads = null;
    svg.innerHTML = '';
  };

  /* ---------------------------------------------------------------- lighting a source and its passages */
  const activate = (key: string, on: boolean) => {
    for (const c of bySame(key)) {
      c.el.classList.toggle('on', on);
      c.claim?.classList.toggle('on', on);
    }
    tileOf(key)?.classList.toggle('hot', on);
    for (const card of rail.querySelectorAll<HTMLElement>(`.ref-card[data-ref="${esc(key)}"]`))
      card.classList.toggle('on', on);
  };

  /* ---------------------------------------------------------------- margin cards */
  const rail = document.createElement('div');
  rail.className = 'ref-rail';
  rail.setAttribute('aria-hidden', 'true');
  rail.dir = 'ltr'; // English labels: keep the site's left-to-right label style even on Persian pages
  for (const c of cites) {
    const tile = tileOf(c.key);
    if (!tile) continue;
    const card = document.createElement('div');
    card.className = `ref-card ${[...tile.classList].find((x) => x.startsWith('t-')) ?? ''}`;
    card.dataset.k = String(c.k);
    card.dataset.ref = c.key;
    const type = tile.querySelector<HTMLElement>('.ref-type')?.cloneNode(true) as
      | HTMLElement
      | undefined;
    if (type) {
      const badge = document.createElement('b');
      badge.textContent = c.el.dataset.n ?? '';
      type.prepend(badge);
      card.appendChild(type);
    }
    const title = document.createElement('h4');
    const srcTitle = tile.querySelector<HTMLElement>('.ref-title');
    title.textContent = srcTitle?.textContent ?? '';
    for (const a of ['lang', 'dir'])
      if (srcTitle?.getAttribute(a)) title.setAttribute(a, srcTitle.getAttribute(a) as string);
    const small = document.createElement('small');
    small.textContent = tile.querySelector('.ref-dom span:last-child')?.textContent ?? '';
    card.append(title, small);
    rail.appendChild(card);
  }
  art.appendChild(rail);
  const isWide = () => {
    const r = art.getBoundingClientRect();
    const room = document.documentElement.dir === 'rtl' ? r.left : innerWidth - r.right;
    return room >= 36 + 240 + 16;
  };
  let wide = false;

  /* ---------------------------------------------------------------- popover (when there is no room for the margin) */
  const pop = document.createElement('div');
  pop.className = 'ref-pop';
  pop.setAttribute('role', 'dialog');
  pop.dir = 'ltr';
  document.body.appendChild(pop);
  let popTimer = 0;
  let popKey = '';
  const hidePop = (now = false) => {
    window.clearTimeout(popTimer);
    const done = () => {
      pop.classList.remove('show');
      popKey = '';
    };
    if (now) done();
    else popTimer = window.setTimeout(done, 160);
  };
  const showPop = (c: Cite) => {
    const tile = tileOf(c.key);
    if (!tile) return;
    window.clearTimeout(popTimer);
    popKey = c.key;
    const card = document.createElement('div');
    card.className = `ref-pop-card ${[...tile.classList].find((x) => x.startsWith('t-')) ?? ''}`;
    for (const sel of [
      '.ref-type',
      '.ref-title',
      '.ref-dom',
      '.ref-fig',
      '.ref-note',
      '.ref-by',
      '.ref-acts',
    ]) {
      const part = tile.querySelector(sel)?.cloneNode(true);
      if (part) card.appendChild(part);
    }
    pop.replaceChildren(card);
    pop.classList.add('show');
    const b = c.el.getBoundingClientRect();
    const w = Math.min(340, innerWidth - 24);
    const h = pop.offsetHeight;
    const left = Math.max(12, Math.min(innerWidth - w - 12, b.left + b.width / 2 - w / 2));
    let top = b.bottom + scrollY + 12;
    const up = b.bottom + h + 24 > innerHeight && b.top > h + 24;
    if (up) top = b.top + scrollY - h - 12;
    pop.classList.toggle('up', up);
    pop.style.left = `${left + scrollX}px`;
    pop.style.top = `${top}px`;
    pop.style.setProperty('--ax', `${Math.max(14, b.left + b.width / 2 - left - 6)}px`);
  };
  pop.addEventListener('pointerenter', () => window.clearTimeout(popTimer), { signal });
  pop.addEventListener('pointerleave', () => hidePop(), { signal });
  pop.addEventListener(
    'click',
    (e) => {
      const act = (e.target as Element).closest<HTMLElement>('[data-act]');
      if (!act) return;
      const key = popKey;
      hidePop(true);
      if (act.dataset.act === 'jump') gotoTile(key);
      else if (act.dataset.act === 'copy') copyCitation(key);
    },
    { signal },
  );

  /* ---------------------------------------------------------------- layout: margin cards, map ticks */
  const map = box.querySelector<HTMLElement>('[data-map]');
  const win = box.querySelector<HTMLElement>('[data-win]');
  const tip = document.createElement('div');
  tip.className = 'ref-tip';
  tip.dir = 'ltr';
  document.body.appendChild(tip);

  const layout = () => {
    wide = isWide();
    rail.style.display = wide ? 'block' : 'none';
    if (!wide) hidePop(true);
    const proseTop = prose.getBoundingClientRect().top + scrollY;
    const proseH = prose.offsetHeight || 1;
    if (map) {
      for (const t of map.querySelectorAll<HTMLElement>('.ref-tick')) {
        const c = cites[Number(t.dataset.k)];
        if (!c) continue;
        const y = (c.el.getBoundingClientRect().top + scrollY - proseTop) / proseH;
        t.style.left = `${Math.min(0.98, Math.max(0.02, y)) * 100}%`;
      }
    }
    if (wide) {
      const cards = [...rail.querySelectorAll<HTMLElement>('.ref-card')];
      const artTop = art.getBoundingClientRect().top + scrollY;
      const artH = art.offsetHeight;
      const ys = cards.map((card) => {
        const c = cites[Number(card.dataset.k)];
        return (c ? c.el.getBoundingClientRect().top + scrollY - artTop : 0) - 6;
      });
      for (let i = 1; i < cards.length; i += 1)
        ys[i] = Math.max(ys[i] ?? 0, (ys[i - 1] ?? 0) + (cards[i - 1]?.offsetHeight ?? 0) + 8);
      let limit = artH - 8;
      for (let i = cards.length - 1; i >= 0; i -= 1) {
        ys[i] = Math.min(ys[i] ?? 0, limit - (cards[i]?.offsetHeight ?? 0));
        limit = (ys[i] ?? 0) - 8;
      }
      cards.forEach((card, i) => {
        card.style.top = `${Math.max(0, ys[i] ?? 0)}px`;
      });
    }
    spy();
  };

  /* ---------------------------------------------------------------- scrolling to things and flashing them */
  const flashTile = (tile: HTMLElement) => {
    tile.classList.remove('flash');
    void tile.offsetWidth;
    tile.classList.add('flash');
    window.setTimeout(() => tile.classList.remove('flash'), 2300);
  };
  function gotoTile(key: string) {
    const tile = tileOf(key);
    if (!tile) return;
    // a filter may be hiding it: back to "all"
    for (const chip of box?.querySelectorAll<HTMLElement>('[data-filter]') ?? [])
      chip.setAttribute('aria-pressed', String(chip.dataset.filter === 'all'));
    for (const t of tiles) t.hidden = false;
    const r = tile.getBoundingClientRect();
    if (r.top >= 70 && r.bottom <= innerHeight - 10) {
      flashTile(tile);
      return;
    }
    tile.scrollIntoView({ block: 'center', behavior });
    // flash when the smooth scroll has arrived
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      removeEventListener('scrollend', go);
      flashTile(tile);
    };
    if ('onscrollend' in window && !reduce) {
      addEventListener('scrollend', go, { once: true });
      window.setTimeout(go, 1600);
    } else window.setTimeout(go, reduce ? 50 : 750);
  }
  const gotoCite = (k: number) => {
    const c = cites[k];
    if (!c) return;
    const target = c.claim ?? c.el;
    target.scrollIntoView({ block: 'center', behavior });
    if (c.claim) {
      c.claim.classList.remove('ping');
      void c.claim.offsetWidth;
      c.claim.classList.add('ping');
      window.setTimeout(() => c.claim?.classList.remove('ping'), 2100);
    }
  };

  /* ---------------------------------------------------------------- text of citations */
  const tileText = (tile: HTMLElement) => {
    const title = tile.querySelector('.ref-title')?.textContent?.trim() ?? '';
    const by = tile.querySelector('.ref-by')?.textContent?.trim() ?? '';
    const url = tile.querySelector<HTMLAnchorElement>('.ref-open')?.href ?? '';
    return { title, by, url };
  };
  function copyCitation(key: string) {
    const tile = tileOf(key);
    if (!tile) return;
    const { title, by, url } = tileText(tile);
    void navigator.clipboard?.writeText(`${title}${by ? `, ${by}` : ''}. ${url}`).catch(() => {});
    showToast('Citation copied');
  }
  const bib = box.querySelector<HTMLElement>('[data-bib]');
  bib?.addEventListener(
    'click',
    () => {
      const text = tiles
        .map((tile, i) => {
          const { title, by, url } = tileText(tile);
          return `@misc{ref${i + 1},\n  title={${title}},${by ? `\n  note={${by}},` : ''}\n  url={${url}}\n}`;
        })
        .join('\n\n');
      void navigator.clipboard?.writeText(text).catch(() => {});
      showToast('BibTeX copied');
    },
    { signal },
  );

  /* ---------------------------------------------------------------- the markers in the text */
  let lastPointer: { type: string; wasOpen: boolean } = { type: 'mouse', wasOpen: false };
  const chipOf = (e: Event) => (e.target as Element).closest<HTMLAnchorElement>('a.ref-cite');
  const cite = (el: HTMLAnchorElement) => cites.find((c) => c.el === el);
  prose.addEventListener(
    'pointerdown',
    (e) => {
      const el = chipOf(e);
      const c = el && cite(el);
      if (c)
        lastPointer = {
          type: e.pointerType,
          wasOpen: pop.classList.contains('show') && popKey === c.key,
        };
    },
    { signal },
  );
  prose.addEventListener(
    'pointerover',
    (e) => {
      if (e.pointerType === 'touch') return; // on a touch screen the tap decides (see the click handler)
      const el = chipOf(e);
      const c = el && cite(el);
      if (!c) return;
      activate(c.key, true);
      if (wide) {
        const card = rail.querySelector<HTMLElement>(`.ref-card[data-k="${c.k}"]`);
        if (card) drawThreads([[c.el, card]], colorOf(c.el));
      } else showPop(c);
    },
    { signal },
  );
  prose.addEventListener(
    'pointerout',
    (e) => {
      const el = chipOf(e);
      const c = el && cite(el);
      if (!c || c.el.contains(e.relatedTarget as Node | null)) return;
      activate(c.key, false);
      clearThreads();
      hidePop();
    },
    { signal },
  );
  prose.addEventListener(
    'focusin',
    (e) => {
      const el = chipOf(e);
      const c = el && cite(el);
      if (!c) return;
      activate(c.key, true);
      if (!wide && lastPointer.type !== 'touch') showPop(c);
    },
    { signal },
  );
  prose.addEventListener(
    'focusout',
    (e) => {
      const el = chipOf(e);
      const c = el && cite(el);
      if (!c) return;
      activate(c.key, false);
      hidePop();
    },
    { signal },
  );
  prose.addEventListener(
    'click',
    (e) => {
      const el = chipOf(e);
      const c = el && cite(el);
      if (!c) return;
      e.preventDefault();
      // a first tap on a touch screen only opens the popover; the next one goes to the source
      if (!wide && lastPointer.type === 'touch' && !lastPointer.wasOpen) {
        showPop(c);
        return;
      }
      hidePop(true);
      gotoTile(c.key);
    },
    { signal },
  );

  /* ---------------------------------------------------------------- margin cards: hover and click */
  rail.addEventListener(
    'pointerover',
    (e) => {
      const card = (e.target as Element).closest<HTMLElement>('.ref-card');
      const c = card && cites[Number(card.dataset.k)];
      if (!card || !c) return;
      activate(c.key, true);
      drawThreads([[card, c.el]], colorOf(card));
    },
    { signal },
  );
  rail.addEventListener(
    'pointerout',
    (e) => {
      const card = (e.target as Element).closest<HTMLElement>('.ref-card');
      if (!card || card.contains(e.relatedTarget as Node | null)) return;
      activate(card.dataset.ref ?? '', false);
      clearThreads();
    },
    { signal },
  );
  rail.addEventListener(
    'click',
    (e) => {
      const card = (e.target as Element).closest<HTMLElement>('.ref-card');
      if (card?.dataset.ref) gotoTile(card.dataset.ref);
    },
    { signal },
  );

  /* ---------------------------------------------------------------- the sources */
  let hovered: HTMLElement | null = null;
  const grid = box.querySelector<HTMLElement>('.ref-grid');
  grid?.addEventListener(
    'pointermove',
    (e) => {
      const tile = (e.target as Element).closest<HTMLElement>('.ref-tile');
      if (!tile) return;
      const r = tile.getBoundingClientRect();
      tile.style.setProperty('--mx', `${e.clientX - r.left}px`);
      tile.style.setProperty('--my', `${e.clientY - r.top}px`);
    },
    { signal },
  );
  grid?.addEventListener(
    'pointerover',
    (e) => {
      const tile = (e.target as Element).closest<HTMLElement>('.ref-tile');
      if (!tile || tile === hovered) return;
      hovered = tile;
      const key = tile.dataset.ref ?? '';
      activate(key, true);
      const from = tile.querySelector('.ref-num') ?? tile;
      drawThreads(
        bySame(key).map((c) => [from, c.el] as [Element, Element]),
        colorOf(tile),
      );
    },
    { signal },
  );
  grid?.addEventListener(
    'pointerout',
    (e) => {
      const tile = (e.target as Element).closest<HTMLElement>('.ref-tile');
      if (!tile || tile.contains(e.relatedTarget as Node | null)) return;
      hovered = null;
      activate(tile.dataset.ref ?? '', false);
      clearThreads();
    },
    { signal },
  );
  grid?.addEventListener(
    'click',
    (e) => {
      const b = (e.target as Element).closest<HTMLElement>('button');
      const tile = b?.closest<HTMLElement>('.ref-tile');
      if (!b || !tile) return;
      const key = tile.dataset.ref ?? '';
      if (b.dataset.k !== undefined) gotoCite(Number(b.dataset.k));
      else if (b.dataset.act === 'jump') gotoCite(bySame(key)[0]?.k ?? 0);
      else if (b.dataset.act === 'copy') copyCitation(key);
    },
    { signal },
  );
  box.querySelector('[data-filters]')?.addEventListener(
    'click',
    (e) => {
      const chip = (e.target as Element).closest<HTMLElement>('[data-filter]');
      if (!chip) return;
      for (const x of box.querySelectorAll<HTMLElement>('[data-filter]'))
        x.setAttribute('aria-pressed', String(x === chip));
      const f = chip.dataset.filter;
      for (const t of tiles) t.hidden = f !== 'all' && t.dataset.type !== f;
    },
    { signal },
  );

  /* ---------------------------------------------------------------- reading map */
  if (map) {
    for (const c of cites) {
      const tick = document.createElement('button');
      tick.type = 'button';
      tick.className = `ref-tick ${[...(tileOf(c.key)?.classList ?? [])].find((x) => x.startsWith('t-')) ?? ''}`;
      tick.dataset.k = String(c.k);
      tick.dataset.n = c.el.dataset.n ?? '';
      tick.setAttribute('aria-label', `Show the passage that cites reference ${c.el.dataset.n}`);
      map.appendChild(tick);
    }
    map.addEventListener(
      'pointerover',
      (e) => {
        const tick = (e.target as Element).closest<HTMLElement>('.ref-tick');
        const c = tick && cites[Number(tick.dataset.k)];
        if (!tick || !c) return;
        tick.classList.add('on');
        activate(c.key, true);
        const r = tick.getBoundingClientRect();
        const text =
          (c.claim ?? c.el.parentElement)?.textContent?.replace(/\d+$/, '').trim().slice(0, 110) ??
          '';
        tip.textContent = `${tick.dataset.n} · ${text}…`;
        tip.style.left = `${Math.max(8, Math.min(innerWidth - 270, r.left - 120))}px`;
        tip.style.top = `${r.top - tip.offsetHeight - 14}px`;
        tip.classList.add('show');
        drawThreads([[tick, c.el]], colorOf(tick));
      },
      { signal },
    );
    map.addEventListener(
      'pointerout',
      (e) => {
        const tick = (e.target as Element).closest<HTMLElement>('.ref-tick');
        const c = tick && cites[Number(tick.dataset.k)];
        if (!tick || !c) return;
        tick.classList.remove('on');
        activate(c.key, false);
        tip.classList.remove('show');
        clearThreads();
      },
      { signal },
    );
    map.addEventListener(
      'click',
      (e) => {
        const tick = (e.target as Element).closest<HTMLElement>('.ref-tick');
        if (tick) gotoCite(Number(tick.dataset.k));
      },
      { signal },
    );
  }

  /* ---------------------------------------------------------------- following the reader */
  function spy() {
    const vh = innerHeight;
    const live = new Set<string>();
    for (const c of cites) {
      const top = c.el.getBoundingClientRect().top;
      const inBand = top > vh * 0.18 && top < vh * 0.72;
      if (inBand) live.add(c.key);
      rail.querySelector(`.ref-card[data-k="${c.k}"]`)?.classList.toggle('ref-live', inBand);
    }
    for (const t of tiles) t.classList.toggle('ref-live', live.has(t.dataset.ref ?? ''));
    if (win) {
      const r = proseEl.getBoundingClientRect();
      const h = r.height || 1;
      const a = Math.max(0, Math.min(1, -r.top / h));
      const b = Math.max(0, Math.min(1, (vh - r.top) / h));
      win.style.left = `${a * 100}%`;
      win.style.width = `${Math.max(2, (b - a) * 100)}%`;
    }
    render(false);
  }
  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      spy();
    });
  };
  addEventListener('scroll', onScroll, { passive: true, signal });
  addEventListener('resize', layout, { signal });
  addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') {
        hidePop(true);
        clearThreads();
      }
    },
    { signal },
  );
  const resizer = new ResizeObserver(layout);
  resizer.observe(prose);
  document.fonts?.ready.then(layout).catch(() => {});
  layout();

  // arriving with #ref-N in the address: show that source
  const hash = location.hash.match(/^#ref-(\d+)$/);
  if (hash) {
    const tile = box.querySelector<HTMLElement>(`#ref-${hash[1]}`);
    if (tile) window.setTimeout(() => gotoTile(tile.dataset.ref ?? ''), 350);
  }

  return () => {
    resizer.disconnect();
    clearTimeout(popTimer);
    svg.remove();
    rail.remove();
    pop.remove();
    tip.remove();
  };
});
