import { redo, undo } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { Compartment, EditorSelection } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { basicSetup, EditorView } from 'codemirror';
import { useEffect, useRef, useState } from 'react';
import { icons, type MenuEntry, showMenu } from '../lib/context-menu';
import { previewMarkdown } from './api';

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
  onSave?: () => void;
}

const theme = EditorView.theme({
  '&': { height: '100%', background: 'var(--bg2)', color: 'var(--fg)', fontSize: '16px' },
  '.cm-content': { fontFamily: 'var(--code)', padding: '16px 0', caretColor: 'var(--acc)' },
  '.cm-gutters': { background: 'var(--bg2)', color: 'var(--muted)', border: '0' },
  '.cm-activeLine, .cm-activeLineGutter': {
    background: 'color-mix(in srgb, var(--acc) 7%, transparent)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    background: 'color-mix(in srgb, var(--acc) 30%, transparent) !important',
  },
  '.cm-cursor': { borderLeftColor: 'var(--acc)' },
  '.cm-scroller': { overflow: 'auto' },
});

export default function MarkdownEditor({
  value,
  onChange,
  dir,
  lang,
  postId,
  onUpload,
  uploadHint,
  onSave,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const latest = useRef({ onChange, onUpload, onSave });
  latest.current = { onChange, onUpload, onSave };
  const [html, setHtml] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewErr, setPreviewErr] = useState(false);
  const [words, setWords] = useState(0);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit'); // narrow screens
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
        markdown({ codeLanguages: languages }),
        theme,
        EditorView.lineWrapping,
        dirComp.current.of(EditorView.contentAttributes.of({ dir, lang })),
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
        EditorView.domEventHandlers({
          contextmenu(e) {
            if (e.shiftKey) return false; // Shift+right-click: the browser's own menu (spell-check etc.)
            e.preventDefault();
            showMenu({ x: e.clientX, y: e.clientY, items: menuItems.current(), label: 'Editor' });
            return true;
          },
          keydown(e) {
            if (!(e.metaKey || e.ctrlKey) || e.altKey) return false;
            // by physical key (e.code) so shortcuts work on any keyboard layout, e.g. Persian
            if (e.code === 'KeyS') {
              e.preventDefault();
              latest.current.onSave?.();
              return true;
            }
            if (e.code === 'KeyZ' || e.code === 'KeyY') {
              e.preventDefault();
              const v = view.current;
              if (v) (e.code === 'KeyY' || e.shiftKey ? redo : undo)(v);
              return true;
            }
            return false;
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
      effects: dirComp.current.reconfigure(EditorView.contentAttributes.of({ dir, lang })),
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
            shortcut: '**',
            onSelect: () => wrap('**', '**', 'bold'),
          },
          {
            id: 'italic',
            label: 'Italic',
            icon: icons.italic,
            shortcut: '*',
            onSelect: () => wrap('*', '*', 'italic'),
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
    <div className="adm-editor">
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
        <button type="button" title="Heading (## )" onClick={() => linePrefix('## ')}>
          H2
        </button>
        <button type="button" title="Bold" onClick={() => wrap('**', '**', 'bold')}>
          <b>B</b>
        </button>
        <button type="button" title="Italic" onClick={() => wrap('*', '*', 'italic')}>
          <i>I</i>
        </button>
        <button type="button" title="Inline code" onClick={() => wrap('`', '`', 'code')}>
          {'<>'}
        </button>
        <button type="button" title="Link" onClick={() => wrap('[', '](https://)', 'text')}>
          Link
        </button>
        <button type="button" title="Quote" onClick={() => linePrefix('> ')}>
          ❝
        </button>
        <button type="button" title="List" onClick={() => linePrefix('- ')}>
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
        <span className="mono muted">{words} words</span>
        <span className="adm-tabs-narrow">
          <button
            type="button"
            className={tab === 'edit' ? 'on' : ''}
            onClick={() => setTab('edit')}
          >
            Write
          </button>
          <button
            type="button"
            className={tab === 'preview' ? 'on' : ''}
            onClick={() => setTab('preview')}
          >
            Preview
          </button>
        </span>
      </div>
      <div className={`adm-split show-${tab}`}>
        <div className="adm-pane write" ref={host} />
        <div className="adm-pane preview">
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
