import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { Compartment, EditorSelection } from '@codemirror/state';
import { basicSetup, EditorView } from 'codemirror';
import { useEffect, useRef, useState } from 'react';
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
  const [previewErr, setPreviewErr] = useState(false);
  const [words, setWords] = useState(0);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit'); // narrow screens
  const dirComp = useRef(new Compartment());

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
          if (u.docChanged) latest.current.onChange(u.state.doc.toString());
        }),
        EditorView.domEventHandlers({
          keydown(e) {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
              e.preventDefault();
              latest.current.onSave?.();
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

  useEffect(() => {
    view.current?.dispatch({
      effects: dirComp.current.reconfigure(EditorView.contentAttributes.of({ dir, lang })),
    });
  }, [dir, lang]);

  // live preview through the exact public rendering pipeline
  useEffect(() => {
    setWords(value.trim() ? value.trim().split(/\s+/).length : 0);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      previewMarkdown(value, postId, ctl.signal)
        .then((r) => {
          setHtml(r.html);
          setPreviewErr(false);
        })
        .catch((e) => {
          if ((e as Error).name !== 'AbortError') setPreviewErr(true);
        });
    }, 350);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [value, postId]);

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
          <div className="prose" dir={dir} lang={lang} dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </div>
  );
}
