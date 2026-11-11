import type { ReactNode } from 'react';

export type Lang = 'en' | 'fa';
export const LANGS: Lang[] = ['en', 'fa'];
export const langDir = (l: Lang): 'ltr' | 'rtl' => (l === 'fa' ? 'rtl' : 'ltr');

interface Props {
  active: Lang;
  onChange: (l: Lang) => void;
  /** ● when the language has content, ○ when empty; a trailing * marks unsaved edits. */
  state: (l: Lang) => { filled: boolean; changed?: boolean };
  /** Right-aligned actions (e.g. remove translation). */
  children?: ReactNode;
}

/** English / Persian tab bar shared by the post and project editors. */
export default function LangTabs({ active, onChange, state, children }: Props) {
  return (
    <div className="adm-langtabs" role="tablist">
      {LANGS.map((l) => {
        const s = state(l);
        return (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={active === l}
            className={active === l ? 'on' : ''}
            onClick={() => onChange(l)}
          >
            {l === 'en' ? 'English' : 'فارسی'} {s.filled ? '●' : '○'}
            {s.changed ? ' *' : ''}
          </button>
        );
      })}
      <span className="grow" />
      {children}
    </div>
  );
}
