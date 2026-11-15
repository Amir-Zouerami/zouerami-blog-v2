import type PocketBase from 'pocketbase';
import { CV_FILES } from '../data/cv';
import type { Locale } from '../i18n';
import { getPb } from './pb';

export interface CvFile {
  url: string;
  /** True when it is the file uploaded in the back office, false for the bundled placeholder. */
  uploaded: boolean;
}

/** PDF URL per language: the back-office upload when there is one, else the placeholder shipped in public/cv. */
export async function loadCv(pb: PocketBase = getPb()): Promise<Record<Locale, CvFile>> {
  const out: Record<Locale, CvFile> = {
    en: { url: CV_FILES.en, uploaded: false },
    fa: { url: CV_FILES.fa, uploaded: false },
  };
  try {
    const rows = await pb.collection('cv_files').getFullList({ fields: 'id,lang,file,updated' });
    for (const r of rows) {
      const lang = r.lang as Locale;
      if ((lang === 'en' || lang === 'fa') && r.file)
        out[lang] = {
          url: `/pb/api/files/cv_files/${r.id}/${encodeURIComponent(String(r.file))}?v=${encodeURIComponent(String(r.updated ?? ''))}`,
          uploaded: true,
        };
    }
  } catch {
    /* PocketBase unavailable: the page still works with the bundled files */
  }
  return out;
}
