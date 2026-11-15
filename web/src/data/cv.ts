import type { Locale } from '../i18n';

/** The two CV files, served from public/cv. Replace the PDFs (same names) to update them. */
export const CV_FILES: Record<Locale, string> = {
  en: '/cv/amir-zouerami-cv-en.pdf',
  fa: '/cv/amir-zouerami-cv-fa.pdf',
};
