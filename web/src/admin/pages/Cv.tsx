import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../ui/Button';
import { FilePicker } from '../../ui/FilePicker';
import { errText, pb, type Rec } from '../api';
import { Confirm, fmtDate, useToast } from '../ui';

const LANGS = [
  ['en', 'English CV'],
  ['fa', 'Persian CV (فارسی)'],
] as const;

type Lang = (typeof LANGS)[number][0];

/** One upload slot per language: choose a PDF, upload, and /cv shows it straight away. */
function Slot({
  lang,
  label,
  row,
  onDone,
}: {
  lang: Lang;
  label: string;
  row?: Rec;
  onDone: () => void;
}) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickerKey, setPickerKey] = useState(0);

  const upload = async () => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))
      return toast('That is not a PDF file', 'err');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('lang', lang);
      fd.append('file', file);
      if (row) await pb.collection('cv_files').update(row.id, fd);
      else await pb.collection('cv_files').create(fd);
      toast(`${label} uploaded`);
      setFile(null);
      setPickerKey((k) => k + 1);
      onDone();
    } catch (e) {
      toast(errText(e), 'err');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!row) return;
    try {
      await pb.collection('cv_files').delete(row.id);
      toast(`${label} removed`);
      onDone();
    } catch (e) {
      toast(errText(e), 'err');
    }
  };
  const href = row ? `/pb/api/files/cv_files/${row.id}/${encodeURIComponent(row.file)}` : '';

  return (
    <section className="cv-slot" data-cv-slot={lang}>
      <h2>{label}</h2>
      {row ? (
        <p className="muted">
          <strong>Live now:</strong>{' '}
          <a href={href} target="_blank" rel="noopener noreferrer">
            {row.file}
          </a>{' '}
          · uploaded {fmtDate(row.updated)}
        </p>
      ) : (
        <p className="muted">Nothing uploaded yet: the site shows a placeholder.</p>
      )}
      <div className="row-inline">
        <FilePicker
          key={pickerKey}
          accept="application/pdf"
          label={row ? 'Choose a new PDF…' : 'Choose PDF…'}
          onChange={setFile}
        />
        <Button variant="solid" disabled={!file || busy} onClick={() => void upload()}>
          {busy ? 'Uploading…' : row ? 'Replace' : 'Upload'}
        </Button>
        {row && <Confirm message={`Remove the ${label}?`} onYes={() => void remove()} />}
      </div>
    </section>
  );
}

export default function Cv() {
  const toast = useToast();
  const [rows, setRows] = useState<Rec[] | null>(null);
  const load = useCallback(() => {
    pb.collection('cv_files')
      .getFullList()
      .then(setRows)
      .catch((e) => toast(errText(e), 'err'));
  }, [toast]);
  useEffect(load, [load]);

  return (
    <>
      <div className="adm-bar">
        <h1>CV</h1>
        <span className="grow" />
        <Button href="/cv" target="_blank" rel="noopener">
          View /cv
        </Button>
      </div>
      <p className="muted" style={{ marginBottom: 18 }}>
        PDF only, up to 20 MB. Visitors see the file matching their site language and can switch.
      </p>
      {!rows ? (
        <p className="mono muted">Loading…</p>
      ) : (
        <div className="cv-slots">
          {LANGS.map(([lang, label]) => (
            <Slot
              key={lang}
              lang={lang}
              label={label}
              row={rows.find((r) => r.lang === lang)}
              onDone={load}
            />
          ))}
        </div>
      )}
    </>
  );
}
