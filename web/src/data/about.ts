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
      when: 'Jan 2026',
      title: 'Technical Lead, Landin',
      text: 'Leading backend architecture for a multi-tenant SaaS platform: event-driven microservices, message queues and automated infrastructure.',
      open: true,
    },
    {
      when: 'Mar 2024',
      title: 'Node.js Developer, Part',
      text: 'Built high-throughput financial services behind an API gateway, with queues and strict data consistency.',
    },
    {
      when: 'Jan 2024',
      title: 'Software Engineer, License Market',
      text: 'Full-stack work on a web marketplace: component design system, CI/CD pipelines and caching.',
    },
    {
      when: 'May 2021',
      title: 'Open source, grammY',
      text: 'Maintaining a widely used rate-limiting library in the Telegram bot ecosystem.',
      open: true,
    },
    {
      when: '2014',
      title: 'English Translation, M.A. & B.A.',
      text: 'Studied translation at Ferdowsi University of Mashhad, then computer science through Harvard Extension School.',
    },
  ],
  fa: [
    {
      when: 'ژانویه ۲۰۲۶',
      title: 'تکنیکال لید، لندین',
      text: 'طراحی معماری بک‌اند یک پلتفرم SaaS چندمستاجری: میکروسرویس‌های رویدادمحور، صف پیام و زیرساخت خودکار.',
      open: true,
    },
    {
      when: 'مارس ۲۰۲۴',
      title: 'توسعه‌دهنده Node.js، پارت',
      text: 'ساخت سرویس‌های مالی پرترافیک پشت API Gateway، با صف پیام و سخت‌گیری روی سازگاری داده.',
    },
    {
      when: 'ژانویه ۲۰۲۴',
      title: 'مهندس نرم‌افزار، لایسنس مارکت',
      text: 'کار فول‌استک روی یک مارکت‌پلیس وب: سیستم طراحی کامپوننتی، پایپ‌لاین CI/CD و کشینگ.',
    },
    {
      when: 'مه ۲۰۲۱',
      title: 'متن‌باز، grammY',
      text: 'نگهداری یک کتابخانه پرکاربرد محدودسازی نرخ درخواست در اکوسیستم بات‌های تلگرام.',
      open: true,
    },
    {
      when: '۲۰۱۴',
      title: 'مترجمی زبان انگلیسی، کارشناسی ارشد و کارشناسی',
      text: 'تحصیل ترجمه در دانشگاه فردوسی مشهد و سپس علوم کامپیوتر از طریق Harvard Extension School.',
    },
  ],
};
export const uses = [
  'TypeScript',
  'Bun',
  'Node.js',
  'PostgreSQL',
  'Redis',
  'RabbitMQ',
  'Docker',
  'Nginx',
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
