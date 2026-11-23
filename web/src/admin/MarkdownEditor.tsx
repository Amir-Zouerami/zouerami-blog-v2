import { redo, undo } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { search } from '@codemirror/search';
import { Compartment, EditorSelection, Prec } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  keymap,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import { basicSetup, EditorView } from 'codemirror';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { icons, type MenuEntry, showMenu } from '../lib/context-menu';
import { previewMarkdown } from './api';
import { collectAnchors, lineForTop, topForLine } from './scrollSync';

interface Props {
  value: string;
  onChange: (v: string) => void;
  dir: 'ltr' | 'rtl';
  lang: string;
  /** Post id so `img:` references resolve to the post's uploaded files in the preview. */
  postId?: string;
  /** Uploads files and returns the stored filenames (undefined = uploads unavailable). */
  onUpload?: (files: File[]) => Promise<string[]>;
  uploadHint?: string;
}

/** Lines of fenced code (fences included) are always left-to-right, even in a right-to-left post. */
const codeLtr = Decoration.line({ attributes: { dir: 'ltr' } });
function codeLines(view: EditorView): DecorationSet {
  const out: ReturnType<typeof codeLtr.range>[] = [];
  const doc = view.state.doc;
  let fence = '';
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n);
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(line.text)?.[1];
    if (!fence && f) {
      fence = f;
      out.push(codeLtr.range(line.from));
    } else if (fence) {
      out.push(codeLtr.range(line.from));
      if (
        f &&
        f[0] === fence[0] &&
        f.length >= fence.length &&
        !line.text.slice(f.length + 1).trim()
      )
        fence = '';
    }
  }
  return Decoration.set(out);
}
const codeDirection = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = codeLines(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged) this.decorations = codeLines(u.view);
    }
  },
  { decorations: (v) => v.decorations },
);

const theme = EditorView.theme({
  '&': { height: '100%', background: 'var(--bg2)', color: 'var(--fg)', fontSize: '16px' },
  // JetBrains Mono has no Persian letters: name a Persian font so they don't fall back to a random system face
  '.cm-content': {
    fontFamily: 'var(--code), "Vazirmatn Variable", ui-monospace, monospace',
    padding: '16px 0',
    caretColor: 'var(--acc)',
  },
  '.cm-content[lang=fa]': { lineHeight: '1.95', fontSize: '17px' },
  '.cm-gutters': { background: 'var(--bg2)', color: 'var(--muted)', border: '0' },
  '.cm-activeLine, .cm-activeLineGutter': {
    background: 'color-mix(in srgb, var(--acc) 7%, transparent)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    background: 'color-mix(in srgb, var(--acc) 30%, transparent) !important',
  },
  // a thicker caret with a glow, so it can be found inside mixed Persian/English text
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--acc)',
    borderLeftWidth: '2px',
    boxShadow: '0 0 6px var(--acc)',
  },
  '.cm-scroller': { overflow: 'auto' },
  // Ctrl+F panel, themed
  '.cm-panels': { background: 'var(--bg)', color: 'var(--fg)', border: '0' },
  '.cm-panels-top': { borderBottom: '1px solid var(--line2)' },
  '.cm-search': {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '8px 8px',
    padding: '10px 40px 10px 12px',
    font: '500 13px var(--sans)',
  },
  '.cm-search br': { display: 'none' },
  '.cm-search .cm-textfield': {
    width: 'auto',
    flex: '1 1 160px',
    minWidth: '120px',
    maxWidth: '280px',
    margin: '0',
    padding: '6px 10px',
    font: '400 14px var(--sans)',
    background: 'var(--bg2)',
    color: 'var(--fg)',
    border: '1px solid var(--line2)',
    borderRadius: '8px',
  },
  '.cm-search .cm-textfield:focus': { outline: '2px solid var(--acc)', outlineOffset: '-1px' },
  '.cm-search .cm-button': {
    backgroundImage: 'none',
    background: 'var(--bg2)',
    color: 'var(--fg)',
    border: '1px solid var(--line2)',
    borderRadius: '8px',
    padding: '5px 12px',
    margin: '0',
    font: '500 13px var(--sans)',
    cursor: 'pointer',
  },
  '.cm-search .cm-button:hover': { borderColor: 'var(--acc)', color: 'var(--acc)' },
  '.cm-search label': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    margin: '0',
    color: 'var(--muted)',
    font: '500 13px var(--sans)',
    fontSize: '13px !important',
    textTransform: 'none',
    letterSpacing: 'normal',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  '.cm-search input[type=checkbox]': {
    width: '15px',
    height: '15px',
    padding: '0',
    margin: '0',
    accentColor: 'var(--acc)',
  },
  '.cm-search button[name=close]': {
    position: 'absolute',
    top: '8px',
    right: '10px',
    background: 'transparent',
    border: '0',
    color: 'var(--muted)',
    fontSize: '18px',
    lineHeight: '1',
    cursor: 'pointer',
  },
  '.cm-search button[name=close]:hover': { color: 'var(--acc)' },
  '.cm-searchMatch': {
    background: 'color-mix(in srgb, var(--acc) 28%, transparent)',
    outline: '1px solid color-mix(in srgb, var(--acc) 55%, transparent)',
    borderRadius: '2px',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    background: 'var(--acc)',
    color: 'var(--on-acc)',
  },
  '.cm-selectionMatch': { background: 'color-mix(in srgb, var(--acc) 16%, transparent)' },
});

export default function MarkdownEditor({
  value,
  onChange,
  dir,
  lang,
  postId,
  onUpload,
  uploadHint,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const latest = useRef({ onChange, onUpload });
  latest.current = { onChange, onUpload };
  /** Rebuilt every render; the editor's key handler (created once) calls it. */
  const shortcut = useRef<(e: KeyboardEvent) => boolean>(() => false);
  const [html, setHtml] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewErr, setPreviewErr] = useState(false);
  const [words, setWords] = useState(0);
  // the preview pane is optional (remembered), and "zen" lays the editor over the whole screen
  const [showPreview, setShowPreview] = useState(() => {
    try {
      return localStorage.getItem('adm-preview') !== '0';
    } catch {
      return true;
    }
  });
  const [zen, setZen] = useState(false);
  // On a narrow screen there is room for one pane: "Preview" swaps the editor for the preview (not remembered,
  // you always come back to writing). On a wide screen it shows or hides the second pane (remembered).
  const [narrow, setNarrow] = useState(
    () => typeof matchMedia === 'function' && matchMedia('(max-width: 900px)').matches,
  );
  useEffect(() => {
    const mq = matchMedia('(max-width: 900px)');
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const [mobilePreview, setMobilePreview] = useState(false);
  const previewOn = narrow ? mobilePreview : showPreview;
  const toggleWide = () =>
    setShowPreview((on) => {
      try {
        localStorage.setItem('adm-preview', on ? '0' : '1');
      } catch {
        /* the choice just isn't remembered */
      }
      return !on;
    });
  const togglePreview = () => (narrow ? setMobilePreview((on) => !on) : toggleWide());
  useEffect(() => {
    if (!zen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) setZen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    view.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [zen]);
  const dirComp = useRef(new Compartment());
  /** The last document the editor itself reported, so the sync effect can tell an outside change from our own typing. */
  const emitted = useRef(value);
  /** Rebuilt every render so the menu always sees the current handlers; read by the CodeMirror event handlers. */
  const menuItems = useRef<() => MenuEntry[]>(() => []);

  const insertAtCursor = (text: string) => {
    const v = view.current;
    if (!v) return;
    const r = v.state.selection.main;
    v.dispatch({
      changes: { from: r.from, to: r.to, insert: text },
      selection: { anchor: r.from + text.length },
    });
    v.focus();
  };

  const uploadAndInsert = async (files: File[]) => {
    const fn = latest.current.onUpload;
    if (!fn || !files.length) return;
    const names = await fn(files);
    insertAtCursor(names.map((n) => `![](img:${n})`).join('\n\n'));
  };

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      doc: value,
      parent: host.current,
      extensions: [
        basicSetup,
        search({ top: true }),
        markdown({ codeLanguages: languages }),
        theme,
        EditorView.lineWrapping,
        codeDirection,
        dirComp.current.of(EditorView.contentAttributes.of({ dir, lang, spellcheck: 'true' })),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            const text = u.state.doc.toString();
            emitted.current = text;
            latest.current.onChange(text);
          }
        }),
        keymap.of([
          {
            key: 'Shift-F10',
            run: (v) => {
              const at = v.coordsAtPos(v.state.selection.main.head);
              showMenu({
                x: at?.left ?? 0,
                y: at?.bottom ?? 0,
                items: menuItems.current(),
                label: 'Editor',
                keyboard: true,
                restoreFocus: v.contentDOM,
              });
              return true;
            },
          },
        ]),
        Prec.highest(
          EditorView.domEventHandlers({
            contextmenu(e) {
              if (e.shiftKey) return false; // Shift+right-click: the browser's own menu (spell-check etc.)
              e.preventDefault();
              showMenu({ x: e.clientX, y: e.clientY, items: menuItems.current(), label: 'Editor' });
              return true;
            },
            keydown(e) {
              if (!(e.metaKey || e.ctrlKey)) return false;
              return shortcut.current(e);
            },
            paste(e) {
              const files = [...(e.clipboardData?.files ?? [])].filter((f) =>
                f.type.startsWith('image/'),
              );
              if (!files.length) return false;
              e.preventDefault();
              void uploadAndInsert(files);
              return true;
            },
            drop(e) {
              const files = [...(e.dataTransfer?.files ?? [])].filter((f) =>
                f.type.startsWith('image/'),
              );
              if (!files.length) return false;
              e.preventDefault();
              void uploadAndInsert(files);
              return true;
            },
          }),
        ),
      ],
    });
    view.current = v;
    return () => v.destroy();
    // the editor is created once per mount; the parent remounts it (key) when switching language/post
  }, []);

  // the document can change from outside (restoring a backup): push it into the editor; normal typing is a no-op here
  useEffect(() => {
    const v = view.current;
    if (v && value !== emitted.current && v.state.doc.toString() !== value) {
      emitted.current = value;
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({
      effects: dirComp.current.reconfigure(
        EditorView.contentAttributes.of({ dir, lang, spellcheck: 'true' }),
      ),
    });
  }, [dir, lang]);

  // live preview through the exact public rendering pipeline
  useEffect(() => {
    const ctl = new AbortController();
    const t = setTimeout(() => {
      // counted with the preview (debounced), not on every keystroke
      setWords(value.trim() ? value.trim().split(/\s+/).length : 0);
      previewMarkdown(value, postId, ctl.signal, lang === 'fa' ? 'fa' : 'en')
        .then((r) => {
          setHtml(r.html);
          setPreviewErr(false);
          // diagrams render in the browser, exactly as on the public site
          requestAnimationFrame(() => {
            const root = previewRef.current;
            if (root?.querySelector('.mermaid-block:not([data-done])'))
              void import('../scripts/mermaid').then((m) => m.renderMermaidIn(root));
          });
        })
        .catch((e) => {
          if ((e as Error).name !== 'AbortError') setPreviewErr(true);
        });
    }, 350);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [value, postId, lang]);

  // Scrolling either pane moves the other to the same place in the text (see scrollSync.ts).
  const align = useRef<() => void>(() => {});
  useEffect(() => {
    const v = view.current;
    const root = previewRef.current;
    const pane = root?.parentElement;
    if (!v || !root || !pane || !previewOn) {
      align.current = () => {};
      return;
    }
    const ed = v.scrollDOM;
    const expect = { ed: -1, pv: -1 };
    const visible = () => pane.clientHeight > 0 && ed.clientHeight > 0;
    const maxOf = (el: HTMLElement) => Math.max(0, el.scrollHeight - el.clientHeight);
    // moves a pane and remembers where it should land, so its own scroll event is not mistaken for the user's
    const move = (el: HTMLElement, key: 'ed' | 'pv', top: number) => {
      const before = el.scrollTop;
      el.scrollTop = Math.max(0, Math.min(top, maxOf(el)));
      if (el.scrollTop !== before) expect[key] = el.scrollTop;
    };
    const lines = () => v.state.doc.lines;
    const editorToPreview = () => {
      if (!visible()) return;
      let target: number;
      if (ed.scrollTop <= 1) target = 0;
      else if (ed.scrollTop >= maxOf(ed) - 1) target = maxOf(pane);
      else {
        const block = v.lineBlockAtHeight(ed.scrollTop);
        const n = v.state.doc.lineAt(block.from).number;
        const L = n + Math.min(1, Math.max(0, (ed.scrollTop - block.top) / (block.height || 1)));
        target = topForLine(collectAnchors(pane, root), L, lines() + 1, pane.scrollHeight);
      }
      move(pane, 'pv', target);
    };
    const previewToEditor = () => {
      if (!visible()) return;
      let target: number;
      if (pane.scrollTop <= 1) target = 0;
      else if (pane.scrollTop >= maxOf(pane) - 1) target = maxOf(ed);
      else {
        const L = lineForTop(
          collectAnchors(pane, root),
          pane.scrollTop,
          lines() + 1,
          pane.scrollHeight,
        );
        const n = Math.min(lines(), Math.max(1, Math.floor(L)));
        const block = v.lineBlockAt(v.state.doc.line(n).from);
        target = block.top + (L - n) * block.height;
      }
      move(ed, 'ed', target);
    };
    const onEd = () => {
      if (expect.ed >= 0 && Math.abs(ed.scrollTop - expect.ed) < 2) {
        expect.ed = -1;
        return;
      }
      expect.ed = -1;
      editorToPreview();
    };
    const onPv = () => {
      if (expect.pv >= 0 && Math.abs(pane.scrollTop - expect.pv) < 2) {
        expect.pv = -1;
        return;
      }
      expect.pv = -1;
      previewToEditor();
    };
    ed.addEventListener('scroll', onEd, { passive: true });
    pane.addEventListener('scroll', onPv, { passive: true });
    align.current = editorToPreview;
    return () => {
      ed.removeEventListener('scroll', onEd);
      pane.removeEventListener('scroll', onPv);
      align.current = () => {};
    };
  }, [previewOn]);
  // a fresh render changes the preview's height: put it back beside the text
  useLayoutEffect(() => {
    if (html) align.current();
  }, [html]);

  const wrap = (before: string, after = before, placeholder = '') => {
    const v = view.current;
    if (!v) return;
    v.dispatch(
      v.state.changeByRange((r) => {
        const sel = v.state.sliceDoc(r.from, r.to) || placeholder;
        return {
          changes: { from: r.from, to: r.to, insert: before + sel + after },
          range: EditorSelection.range(r.from + before.length, r.from + before.length + sel.length),
        };
      }),
    );
    v.focus();
  };
  const linePrefix = (prefix: string) => {
    const v = view.current;
    if (!v) return;
    const line = v.state.doc.lineAt(v.state.selection.main.from);
    v.dispatch({ changes: { from: line.from, insert: prefix } });
    v.focus();
  };

  /** Wrap the selection in `before`/`after`, or take them off again when they are already there. */
  const toggleWrap = (before: string, after = before, placeholder = '') => {
    const v = view.current;
    if (!v) return;
    v.dispatch(
      v.state.changeByRange((r) => {
        const doc = v.state.doc;
        const pre = doc.sliceString(Math.max(0, r.from - before.length), r.from);
        const post = doc.sliceString(r.to, Math.min(doc.length, r.to + after.length));
        const beyond = (at: number, n: number) => doc.sliceString(Math.max(0, at - n), at + n);
        // `*` is also the start of `**`: only a lone one counts as italic
        const lone =
          before !== '*' ||
          (!beyond(r.from, 1).startsWith('**') &&
            !doc.sliceString(r.from - 2, r.from).startsWith('**'));
        if (r.from > 0 && pre === before && post === after && lone && !r.empty) {
          return {
            changes: [
              { from: r.from - before.length, to: r.from, insert: '' },
              { from: r.to, to: r.to + after.length, insert: '' },
            ],
            range: EditorSelection.range(r.from - before.length, r.to - before.length),
          };
        }
        const sel = doc.sliceString(r.from, r.to) || placeholder;
        // the selection itself already carries the markers: take them off
        if (
          !r.empty &&
          sel.length >= before.length + after.length &&
          sel.startsWith(before) &&
          sel.endsWith(after) &&
          (before !== '*' || !sel.startsWith('**'))
        ) {
          const inner = sel.slice(before.length, sel.length - after.length);
          return {
            changes: { from: r.from, to: r.to, insert: inner },
            range: EditorSelection.range(r.from, r.from + inner.length),
          };
        }
        return {
          changes: { from: r.from, to: r.to, insert: before + sel + after },
          range: EditorSelection.range(r.from + before.length, r.from + before.length + sel.length),
        };
      }),
    );
    v.focus();
  };
  /** Add `prefix` to every selected line, or remove it when all of them already have it. `re` matches any prefix of the same kind. */
  const toggleLines = (prefix: string, re: RegExp) => {
    const v = view.current;
    if (!v) return;
    const { from, to } = v.state.selection.main;
    const first = v.state.doc.lineAt(from).number;
    const last = v.state.doc.lineAt(to).number;
    const lines = [];
    for (let n = first; n <= last; n++) lines.push(v.state.doc.line(n));
    const all = lines.every((l) => re.test(l.text) || !l.text.trim());
    v.dispatch({
      changes: lines.map((l, i) => {
        const m = re.exec(l.text);
        if (all && m) return { from: l.from, to: l.from + m[0].length, insert: '' };
        return {
          from: l.from,
          to: l.from + (m ? m[0].length : 0),
          insert: all ? '' : prefix.replace('1.', `${i + 1}.`),
        };
      }),
    });
    v.focus();
  };
  const heading = (level: number) => {
    const v = view.current;
    if (!v) return;
    const line = v.state.doc.lineAt(v.state.selection.main.from);
    const m = /^(#{1,6})\s+/.exec(line.text);
    const same = m?.[1]?.length === level;
    v.dispatch({
      changes: {
        from: line.from,
        to: line.from + (m ? m[0].length : 0),
        insert: same ? '' : `${'#'.repeat(level)} `,
      },
    });
    v.focus();
  };
  const BULLET = /^\s*[-*+]\s+/;
  const ORDERED = /^\s*\d+[.)]\s+/;
  const QUOTE = /^\s*>\s?/;
  /** Ctrl/Cmd shortcuts by physical key, so they work on any keyboard layout (Persian too). */
  shortcut.current = (e) => {
    const run = (f: () => void) => {
      e.preventDefault();
      f();
      return true;
    };
    if (e.code === 'KeyZ' || e.code === 'KeyY') {
      return run(() => {
        const v = view.current;
        if (v) (e.code === 'KeyY' || e.shiftKey ? redo : undo)(v);
      });
    }
    if (e.altKey) {
      if (e.shiftKey) return false;
      if (e.code === 'Digit1') return run(() => heading(1));
      if (e.code === 'Digit2') return run(() => heading(2));
      if (e.code === 'Digit3') return run(() => heading(3));
      if (e.code === 'Digit4') return run(() => heading(4));
      if (e.code === 'KeyC') return run(() => wrap('\n```\n', '\n```\n', 'code'));
      return false;
    }
    if (e.shiftKey) {
      if (e.code === 'Digit8') return run(() => toggleLines('- ', BULLET));
      if (e.code === 'Digit7') return run(() => toggleLines('1. ', ORDERED));
      if (e.code === 'Digit9') return run(() => toggleLines('> ', QUOTE));
      if (e.code === 'KeyX') return run(() => toggleWrap('~~', '~~', 'text'));
      return false;
    }
    if (e.code === 'KeyB') return run(() => toggleWrap('**', '**', 'bold'));
    if (e.code === 'KeyI') return run(() => toggleWrap('*', '*', 'italic'));
    if (e.code === 'KeyE') return run(() => toggleWrap('`', '`', 'code'));
    if (e.code === 'KeyK') return run(() => wrap('[', '](https://)', 'text'));
    return false;
  };

  const selectionText = () => {
    const v = view.current;
    const r = v?.state.selection.main;
    return v && r ? v.state.sliceDoc(r.from, r.to) : '';
  };
  menuItems.current = () => {
    const v = view.current;
    const hasSel = selectionText().length > 0;
    const notReady = !v;
    return [
      {
        id: 'cut',
        label: 'Cut',
        icon: icons.cut,
        shortcut: 'Ctrl+X',
        disabled: notReady || !hasSel,
        onSelect: async () => {
          const text = selectionText();
          await navigator.clipboard.writeText(text);
          const r = v?.state.selection.main;
          if (v && r) v.dispatch({ changes: { from: r.from, to: r.to, insert: '' } });
          v?.focus();
        },
      },
      {
        id: 'copy',
        label: 'Copy',
        icon: icons.copy,
        shortcut: 'Ctrl+C',
        disabled: notReady || !hasSel,
        onSelect: async () => {
          await navigator.clipboard.writeText(selectionText());
          v?.focus();
        },
      },
      {
        id: 'paste',
        label: 'Paste',
        icon: icons.paste,
        shortcut: 'Ctrl+V',
        disabled: notReady,
        onSelect: async () => {
          insertAtCursor(await navigator.clipboard.readText());
        },
      },
      {
        id: 'select-all',
        label: 'Select all',
        icon: icons.select,
        shortcut: 'Ctrl+A',
        disabled: notReady,
        onSelect: () => {
          v?.dispatch({ selection: { anchor: 0, head: v.state.doc.length } });
          v?.focus();
        },
      },
      { type: 'separator' },
      {
        id: 'callout',
        label: 'Callout',
        icon: icons.quote,
        children: ['info', 'note', 'tip', 'success', 'warning', 'danger'].map((k) => ({
          id: `callout-${k}`,
          label: k,
          onSelect: () => wrap(`:::${k}\n`, '\n:::\n', 'text'),
        })),
      },
      {
        id: 'format',
        label: 'Format',
        icon: icons.bold,
        children: [
          {
            id: 'bold',
            label: 'Bold',
            icon: icons.bold,
            shortcut: 'Ctrl+B',
            onSelect: () => toggleWrap('**', '**', 'bold'),
          },
          {
            id: 'italic',
            label: 'Italic',
            icon: icons.italic,
            shortcut: 'Ctrl+I',
            onSelect: () => toggleWrap('*', '*', 'italic'),
          },
          {
            id: 'code',
            label: 'Inline code',
            icon: icons.code,
            shortcut: '`',
            onSelect: () => wrap('`', '`', 'code'),
          },
          {
            id: 'link',
            label: 'Link',
            icon: icons.link,
            onSelect: () => wrap('[', '](https://)', 'text'),
          },
        ],
      },
      {
        id: 'block',
        label: 'Block',
        icon: icons.heading,
        children: [
          {
            id: 'h2',
            label: 'Heading',
            icon: icons.heading,
            shortcut: '##',
            onSelect: () => linePrefix('## '),
          },
          {
            id: 'quote',
            label: 'Quote',
            icon: icons.quote,
            shortcut: '>',
            onSelect: () => linePrefix('> '),
          },
          {
            id: 'list',
            label: 'List item',
            icon: icons.list,
            shortcut: '-',
            onSelect: () => linePrefix('- '),
          },
          {
            id: 'codeblock',
            label: 'Code block',
            icon: icons.code,
            onSelect: () => wrap('\n```ts\n', '\n```\n', 'code'),
          },
          { id: 'footnote', label: 'Footnote', onSelect: () => wrap('[^1]', '', '') },
        ],
      },
      {
        id: 'image',
        label: 'Insert image…',
        icon: icons.image,
        disabled: !onUpload,
        onSelect: () => pickFiles(),
      },
    ];
  };

  const pickFiles = () => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = 'image/*';
    i.multiple = true;
    i.onchange = () => void uploadAndInsert([...(i.files ?? [])]);
    i.click();
  };

  return (
    <div className={`adm-editor${zen ? ' zen' : ''}`}>
      <div className="adm-toolbar" role="toolbar" aria-label="Formatting">
        <button
          type="button"
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          onClick={() => {
            if (!view.current) return;
            undo(view.current);
            view.current.focus();
          }}
        >
          ↶
        </button>
        <button
          type="button"
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
          onClick={() => {
            if (!view.current) return;
            redo(view.current);
            view.current.focus();
          }}
        >
          ↷
        </button>
        <button
          type="button"
          title="Callout"
          onClick={() => wrap(':::info[Title]\n', '\n:::\n', 'text')}
        >
          ▣
        </button>
        <button type="button" title="Heading (Ctrl+Alt+2)" onClick={() => heading(2)}>
          H2
        </button>
        <button type="button" title="Bold (Ctrl+B)" onClick={() => toggleWrap('**', '**', 'bold')}>
          <b>B</b>
        </button>
        <button
          type="button"
          title="Italic (Ctrl+I)"
          onClick={() => toggleWrap('*', '*', 'italic')}
        >
          <i>I</i>
        </button>
        <button
          type="button"
          title="Inline code (Ctrl+E)"
          onClick={() => toggleWrap('`', '`', 'code')}
        >
          {'<>'}
        </button>
        <button
          type="button"
          title="Link (Ctrl+K)"
          onClick={() => wrap('[', '](https://)', 'text')}
        >
          Link
        </button>
        <button type="button" title="Quote (Ctrl+Shift+9)" onClick={() => toggleLines('> ', QUOTE)}>
          ❝
        </button>
        <button
          type="button"
          title="Bulleted list (Ctrl+Shift+8)"
          onClick={() => toggleLines('- ', BULLET)}
        >
          • List
        </button>
        <button
          type="button"
          title="Code block"
          onClick={() => wrap('\n```ts\n', '\n```\n', 'code')}
        >
          {'{ }'}
        </button>
        <button type="button" title="Footnote" onClick={() => wrap('[^1]', '', '')}>
          [^]
        </button>
        <button
          type="button"
          title={
            onUpload ? 'Insert image (or paste / drop one)' : (uploadHint ?? 'Save the post first')
          }
          disabled={!onUpload}
          onClick={pickFiles}
        >
          Image
        </button>
        <span className="grow" />
        <span className="mono muted adm-words">{words} words</span>
        <button
          type="button"
          className={previewOn ? 'on' : ''}
          aria-pressed={previewOn}
          title={previewOn ? (narrow ? 'Back to writing' : 'Hide the preview') : 'Show the preview'}
          onClick={togglePreview}
        >
          Preview
        </button>
        <button
          type="button"
          title="Full screen writing (Esc to leave)"
          onClick={() => setZen(true)}
        >
          Zen
        </button>
      </div>
      {zen && (
        <div className="adm-zen-bar">
          <button type="button" aria-pressed={previewOn} onClick={togglePreview}>
            {previewOn ? (narrow ? 'Back to writing' : 'Hide preview') : 'Show preview'}
          </button>
          <button type="button" onClick={() => setZen(false)}>
            Exit zen
          </button>
        </div>
      )}
      <div
        className={`adm-split${previewOn ? '' : ' no-preview'}${narrow && previewOn ? ' only-preview' : ''}`}
      >
        <div className="adm-pane write" ref={host} />
        <div className="adm-pane preview" hidden={!previewOn}>
          {previewErr && <p className="mono muted">Preview unavailable.</p>}
          {/* HTML comes from our own renderer, which drops raw HTML from the source */}
          <div
            className="prose"
            ref={previewRef}
            dir={dir}
            lang={lang}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}
