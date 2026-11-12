import { useRef, useState } from 'react';
import { Button } from './Button';

/** File chooser with our button instead of the browser's; the real <input type="file"> stays in the DOM (hidden) so forms and tests work. */
export function FilePicker({
  accept,
  label = 'Choose file…',
  onChange,
}: {
  accept?: string;
  label?: string;
  onChange: (file: File | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  return (
    <span className="ui-file">
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setName(f?.name ?? '');
          onChange(f);
        }}
      />
      <Button onClick={() => input.current?.click()}>{label}</Button>
      <span className="mono muted ui-file-name">{name || 'No file chosen'}</span>
    </span>
  );
}
