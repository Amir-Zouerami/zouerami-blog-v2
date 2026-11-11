/** Regenerates pocketbase/pb_hooks/emails/*.{html,txt} from the design: `bun run build:emails`. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EMAIL_KINDS, renderEmail, renderText } from './design';

export const OUT_DIR = join(import.meta.dirname, '../../../pocketbase/pb_hooks/emails');

mkdirSync(OUT_DIR, { recursive: true });
for (const kind of EMAIL_KINDS) {
  writeFileSync(join(OUT_DIR, `${kind}.html`), renderEmail(kind));
  writeFileSync(join(OUT_DIR, `${kind}.txt`), renderText(kind));
}
console.log(`wrote ${EMAIL_KINDS.length * 2} files to ${OUT_DIR}`);
