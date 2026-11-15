import { getLog } from './log';
import { warmMarkdownEngine } from './markdown';

/**
 * Creates the Shiki highlighter at startup, before the first reader asks for a post. Fire and forget: a failure only
 * means the first reader pays for it.
 */
export function warmMarkdown(): void {
  const started = performance.now();
  warmMarkdownEngine()
    .then(() =>
      getLog().info({ ms: Math.round(performance.now() - started) }, 'markdown renderer warmed up'),
    )
    .catch((err) => getLog().warn({ err }, 'markdown warm-up failed'));
}
