import { type Dict, en } from './en';
import { fa } from './fa';
import type { Locale } from './locale';

export type { Dict } from './en';
export { faDigits, formatDate, formatNumber } from './format';
export {
  dirOf,
  LANG_NAMES,
  LOCALES,
  type Locale,
  localeFromPath,
  localePath,
  stripLocale,
  switchPath,
} from './locale';

export const ui: Record<Locale, Dict> = { en, fa };
export const t = (locale: Locale): Dict => ui[locale];
