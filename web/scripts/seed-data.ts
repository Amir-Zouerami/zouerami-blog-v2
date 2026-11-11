export type Lang = 'en' | 'fa';
export type TrSeed = { lang: Lang; title: string; summary: string; body_md: string };
export type PostSeed = {
  slug: string;
  date: string;
  status: 'draft' | 'published';
  tags: string[];
  preview_token?: string;
  tr: TrSeed[];
};

const REBUILT_EN = `Every few years I get the itch to rebuild my blog. This time I wrote down why before touching a single line of code, because the last rewrite taught me that "it would be fun"[^1] is not a requirement.

## The problem with doing too much

A blog is mostly words. For a long time mine shipped a full React runtime to render a paragraph. Pages were fine on my laptop and merely okay on a phone, which is exactly the sort of "okay" that readers quietly bounce from.

> Ship the words first. Everything else is a progressive enhancement.

The interactive bits (likes, bookmarks, comments) still matter, but they are small islands in a sea of static HTML. Here is the shape of one such island:

\`\`\`astro
---
// LikeButton.astro: hydrate only when visible
import LikeButton from '../components/LikeButton.tsx';
---
<LikeButton client:visible postId={post.id} />
\`\`\`

## Keeping what worked

The old design had a dark mode I was proud of. That's a feeling worth keeping, even when the shapes change. What goes is everything that fought the reader.

![Fig. 1: images come from the admin panel, with captions](img:signal-art.svg)

## What I'm deploying

Static-feeling output behind nginx, a tiny PocketBase for the dynamic parts, and a single compose file tying it together:

\`\`\`yaml
services:
  web:
    image: nginx:alpine
  api:
    image: ghcr.io/muchobien/pocketbase
    restart: unless-stopped
\`\`\`

- Fewer moving parts to babysit.
- Pages that load before you finish blinking.
- A design I actually want to write in.

## What's next

Next up: the design system, then the writing. [Browse more posts](/blog) while it cooks.

[^1]: "It would be fun" is a feeling, not a requirement. I keep relearning this.
`;

const REBUILT_FA = `هر چند سال یک‌بار هوس می‌کنم وبلاگم را از نو بسازم. این بار پیش از نوشتن حتی یک خط کد، دلیلش را نوشتم؛ چون بازنویسی قبلی یادم داد که «جالب می‌شود»[^1] یک نیازمندی نیست.

## مشکلِ زیادی‌کاری

وبلاگ بیشتر از هر چیز کلمه است. مدت‌ها وبلاگ من برای نمایش یک پاراگراف، یک runtime کامل React می‌فرستاد. صفحه‌ها روی لپ‌تاپ من خوب بودند و روی گوشی فقط «قابل‌قبول»؛ همان «قابل‌قبولی» که خواننده بی‌صدا ترکش می‌کند.

> اول کلمه‌ها را بفرست. بقیه‌اش بهبود تدریجی است.

بخش‌های تعاملی (لایک، نشانک، دیدگاه) هنوز مهم‌اند، اما جزیره‌های کوچکی در دریایی از HTML ایستا هستند.

## آنچه نگه داشتم

حالت تیره‌ی قبلی حسی داشت که ارزش نگه‌داشتن دارد، حتی اگر شکل‌ها عوض شوند. آنچه می‌رود هر چیزی است که با خواننده می‌جنگد.

- قطعات متحرک کمتر برای مراقبت.
- صفحه‌هایی که زودتر از پلک زدن بالا می‌آیند.
- طراحی‌ای که واقعاً دوست دارم در آن بنویسم.

## قدم بعدی

قدم بعدی: سیستم طراحی، و بعد نوشتن. تا آماده شود [نوشته‌های دیگر](/fa/blog) را ببینید.

[^1]: «جالب می‌شود» یک حس است، نه یک نیازمندی. مدام دوباره یادش می‌گیرم.
`;

const FENCE = '```';
const DEMO_EN = `A demo of everything the writing tools support: heading levels, code and diagrams.

## Diagrams

Hold Ctrl and scroll to zoom, drag to pan, use the buttons for full screen.

${FENCE}mermaid
flowchart LR
  A[Write in Markdown] --> B{Looks right?}
  B -- yes --> C[Publish]
  B -- no --> A
  C --> D[Readers]
${FENCE}

${FENCE}mermaid
sequenceDiagram
  participant W as Writer
  participant S as Site
  W->>S: Save post
  S-->>W: Preview
${FENCE}

## Headings

### Third level

Some text under a level-three heading.

#### Fourth level

Text under level four.

##### Fifth level

###### Sixth level

## Code

${FENCE}ts
export const greet = (name: string): string => 'Hello, ' + name + '!';
${FENCE}
`;

const DEMO_FA = `نمونه‌ای از همه چیزهایی که ابزار نوشتن پشتیبانی می‌کند: سطح‌های تیتر، کد و نمودار.

## نمودارها

با Ctrl و چرخ ماوس بزرگ‌نمایی کنید، با کشیدن جابه‌جا شوید.

${FENCE}mermaid
flowchart LR
  A[نوشتن] --> B{خوب شد؟}
  B -- بله --> C[انتشار]
  B -- نه --> A
${FENCE}

## تیترها

### سطح سوم

متنی زیر تیتر سطح سه.

#### سطح چهارم

##### سطح پنجم

###### سطح ششم
`;

const generic = (
  title: string,
  extra = '',
) => `${title} is the kind of subject that looks small until you try to ship it.

## Where it starts

Start with the smallest thing that could work, then measure. Most of the pain comes from guessing.

\`\`\`ts
export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
\`\`\`

## What I would do differently

Smaller promises, shorter drafts, and permission to be wrong.${extra}

- Write it down.
- Ship it small.
- Revisit in a month.
`;

const genericFa = (title: string) => `${title}؛ موضوعی که کوچک به نظر می‌رسد تا وقتی بخواهی بفرستیش.

## از کجا شروع کنیم

با کوچک‌ترین چیزی که ممکن است کار کند شروع کن و اندازه بگیر. بیشتر دردسرها از حدس زدن می‌آید.

## چه کار دیگری می‌کردم

وعده‌های کوچک‌تر، پیش‌نویس‌های کوتاه‌تر و اجازه‌ی اشتباه کردن.

- بنویسش.
- کوچک منتشرش کن.
- یک ماه بعد دوباره نگاهش کن.
`;

export const posts: PostSeed[] = [
  {
    slug: 'hello-bilingual',
    date: '2026-11-02 12:00:00.000Z',
    status: 'published',
    tags: ['Notes', 'Web'],
    tr: [
      {
        lang: 'en',
        title: 'Why I rebuilt my blog (again)',
        summary: 'Next.js served me well, but a blog is mostly words.',
        body_md: REBUILT_EN,
      },
      {
        lang: 'fa',
        title: 'چرا دوباره وبلاگم را از نو ساختم',
        summary: 'وبلاگ بیشتر از هر چیز کلمه است.',
        body_md: REBUILT_FA,
      },
    ],
  },
  {
    slug: 'english-only',
    date: '2026-10-18 12:00:00.000Z',
    status: 'published',
    tags: ['DevOps', 'Web'],
    tr: [
      {
        lang: 'en',
        title: 'PocketBase in production',
        summary:
          'A single binary, SQLite under the hood, and the sharp edges nobody warns you about.',
        body_md: generic('PocketBase in production'),
      },
    ],
  },
  {
    slug: 'designing-interfaces-that-melt',
    date: '2026-09-27 12:00:00.000Z',
    status: 'published',
    tags: ['Design'],
    tr: [
      {
        lang: 'en',
        title: 'Designing interfaces that melt into each other',
        summary:
          'Concave corners, shared surfaces and the small trick that makes a button part of the card.',
        body_md: generic('Melting interfaces'),
      },
      {
        lang: 'fa',
        title: 'طراحی رابط‌هایی که در هم ذوب می‌شوند',
        summary: 'گوشه‌های مقعر و سطوح مشترک.',
        body_md: genericFa('رابط‌های ذوب‌شونده'),
      },
    ],
  },
  {
    slug: 'astro-islands-less-javascript',
    date: '2026-09-03 12:00:00.000Z',
    status: 'published',
    tags: ['Web'],
    tr: [
      {
        lang: 'en',
        title: 'Astro islands: shipping less JavaScript',
        summary: 'Zero JS by default, hydrate only what moves.',
        body_md: generic('Astro islands'),
      },
    ],
  },
  {
    slug: 'persian-only',
    date: '2026-08-14 12:00:00.000Z',
    status: 'published',
    tags: ['Persian', 'Design'],
    tr: [
      {
        lang: 'fa',
        title: 'تایپوگرافی فارسی در وب',
        summary: 'منطق راست‌به‌چپ، ارقام و باگ‌های bidi که فقط در production پیدا می‌شوند.',
        body_md: genericFa('تایپوگرافی فارسی'),
      },
    ],
  },
  {
    slug: 'docker-nginx-tiny-vps',
    date: '2026-07-21 12:00:00.000Z',
    status: 'published',
    tags: ['DevOps'],
    tr: [
      {
        lang: 'en',
        title: 'Docker + nginx on a tiny VPS',
        summary: 'One compose file, automatic TLS, zero-downtime deploys.',
        body_md: generic('Docker and nginx'),
      },
    ],
  },
  {
    slug: 'writing-in-public',
    date: '2026-06-30 12:00:00.000Z',
    status: 'published',
    tags: ['Notes'],
    tr: [
      {
        lang: 'en',
        title: 'Notes on writing in public',
        summary: 'Smaller promises, shorter drafts, and permission to be wrong.',
        body_md: generic('Writing in public'),
      },
      {
        lang: 'fa',
        title: 'یادداشت‌هایی درباره نوشتن در انظار',
        summary: 'وعده‌های کوچک‌تر و اجازه‌ی اشتباه.',
        body_md: genericFa('نوشتن در انظار'),
      },
    ],
  },
  {
    slug: 'tiny-state-machine-big-form',
    date: '2026-05-12 12:00:00.000Z',
    status: 'published',
    tags: ['Web'],
    tr: [
      {
        lang: 'en',
        title: 'A tiny state machine for a big form',
        summary: 'Forty fields, six steps, and one 60-line reducer.',
        body_md: generic('A form state machine'),
      },
    ],
  },
  {
    slug: 'diagrams-demo',
    date: '2026-04-01 12:00:00.000Z',
    status: 'published',
    tags: ['Notes'],
    tr: [
      {
        lang: 'en',
        title: 'Diagrams, headings and code',
        summary: 'A tour of the writing tools.',
        body_md: DEMO_EN,
      },
      {
        lang: 'fa',
        title: 'نمودار، تیتر و کد',
        summary: 'گشتی در ابزارهای نوشتن.',
        body_md: DEMO_FA,
      },
    ],
  },
  {
    slug: 'draft-post',
    date: '2026-11-09 12:00:00.000Z',
    status: 'draft',
    tags: ['Notes'],
    preview_token: 'dev-preview-token-0001',
    tr: [
      { lang: 'en', title: 'An unfinished draft', summary: 'Not public.', body_md: 'WIP body.' },
    ],
  },
];

export const projects = [
  {
    slug: 'lumen',
    name: 'Lumen',
    year: 2026,
    category: 'Design System',
    stack: ['TypeScript', 'Astro', 'CSS'],
    metric_value: 48,
    sort: 1,
    blurb:
      'A themeable component library with a built-in RTL mode and docs that double as a playground.',
    metric_label: 'components',
  },
  {
    slug: 'tarh',
    name: 'Tarh',
    year: 2026,
    category: 'Web App',
    stack: ['PocketBase', 'Svelte', 'Docker'],
    metric_value: 1200,
    sort: 2,
    blurb:
      'A self-hosted kanban for tiny teams. PocketBase backend, realtime sync, one-command install.',
    metric_label: 'GitHub stars',
  },
  {
    slug: 'parvaz',
    name: 'Parvaz',
    year: 2025,
    category: 'Tool',
    stack: ['Go', 'SQLite'],
    metric_value: 12000,
    sort: 3,
    blurb: 'A flight-price watcher that nudges you when the number finally drops.',
    metric_label: 'checks / day',
  },
  {
    slug: 'quill',
    name: 'Quill',
    year: 2025,
    category: 'Web App',
    stack: ['React', 'CodeMirror'],
    metric_value: 3400,
    sort: 4,
    blurb: 'A distraction-free Markdown editor with vim keys and proper Persian text handling.',
    metric_label: 'weekly users',
  },
  {
    slug: 'zouerami-v1',
    name: 'zouerami.blog v1',
    year: 2024,
    category: 'Open Source',
    stack: ['Next.js', 'PocketBase', 'Tailwind'],
    metric_value: 60,
    sort: 5,
    blurb: 'The first blog: Next.js, PocketBase, comments, bookmarks and a melting dark mode.',
    metric_label: 'posts',
  },
  {
    slug: 'sabz',
    name: 'Sabz',
    year: 2024,
    category: 'Tool',
    stack: ['Node', 'Docker', 'nginx'],
    metric_value: 800,
    sort: 6,
    blurb: 'A CLI that scaffolds Docker + nginx + TLS for any static site in under a minute.',
    metric_label: 'installs',
  },
];

export const projectBody = (name: string) =>
  `## The brief\n\n${name} started as a small itch and grew into something other people use.\n\n## The approach\n\nConstraints first, then the two ideas that lost, then the one that won. Small steps, shipped weekly.\n\n## The outcome\n\nWhat changed for the people using it, and what I would do differently next time.\n`;

export const SIGNAL_ART_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400"><rect width="800" height="400" fill="#111113"/><circle cx="220" cy="200" r="130" fill="#d4ff3a"/><rect x="380" y="90" width="300" height="220" rx="40" fill="#ecece6" opacity=".9"/><circle cx="600" cy="130" r="60" fill="none" stroke="#d4ff3a" stroke-width="14"/></svg>`;
