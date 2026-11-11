import type { Locale } from '../i18n';

export interface TimelineItem {
  when: string;
  title: string;
  text: string;
  open?: boolean;
}

export const timeline: Record<Locale, TimelineItem[]> = {
  en: [
    {
      when: '2026',
      title: 'Rebuilding everything on Astro',
      text: 'New blog, new design system, same stubbornness.',
      open: true,
    },
    {
      when: '2025',
      title: 'Senior front-end engineer',
      text: 'Led the design-system effort and a very long RTL migration.',
    },
    {
      when: '2023',
      title: 'Full-stack developer',
      text: 'Shipped products end to end: schema to pixels to deploy.',
    },
    {
      when: '2021',
      title: 'Front-end developer',
      text: 'First team job. Learned that naming things really is hard.',
    },
    {
      when: '2018',
      title: 'Started building for the web',
      text: 'View-source on a Friday night and never looked back.',
    },
  ],
  fa: [
    {
      when: '۲۰۲۶',
      title: 'بازسازی همه‌چیز با Astro',
      text: 'وبلاگ تازه، سیستم طراحی تازه، همان لجاجت.',
      open: true,
    },
    {
      when: '۲۰۲۵',
      title: 'مهندس ارشد فرانت‌اند',
      text: 'پیشبرد سیستم طراحی و یک مهاجرت بسیار طولانی به RTL.',
    },
    {
      when: '۲۰۲۳',
      title: 'توسعه‌دهنده فول‌استک',
      text: 'تحویل محصول از ابتدا تا انتها: از اسکیما تا پیکسل تا استقرار.',
    },
    {
      when: '۲۰۲۱',
      title: 'توسعه‌دهنده فرانت‌اند',
      text: 'اولین کار تیمی. فهمیدم اسم‌گذاری واقعاً سخت است.',
    },
    {
      when: '۲۰۱۸',
      title: 'شروع ساخت برای وب',
      text: 'یک شب جمعه view-source زدم و دیگر برنگشتم.',
    },
  ],
};

export const uses = [
  'Neovim',
  'Linux',
  'Figma',
  'Docker',
  'TypeScript',
  'Astro',
  'PocketBase',
  'Arc',
];
export const stack = [
  'TypeScript',
  'Astro',
  'React / Svelte',
  'Node / Go',
  'PocketBase',
  'PostgreSQL',
  'Docker',
  'nginx',
];
