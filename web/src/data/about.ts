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
      text: "Backend and infrastructure for Iran's leading no-code landing page platform: microservices, payment gateways, RabbitMQ, and automated SSL for thousands of custom domains.",
      open: true,
    },
    {
      when: 'Mar 2024',
      title: 'Node.js Developer, Part',
      text: 'Fintech microservices and an API gateway handling tens of thousands of daily transactions. Open-sourced Schematica and taught at Part College.',
    },
    {
      when: 'Jan 2024',
      title: 'Software Engineer, License Market',
      text: 'React and Next.js with a Tailwind design system, Docker CI/CD, and caching that roughly halved API response times.',
    },
    {
      when: 'May 2021',
      title: 'Open source, grammY',
      text: 'Wrote and still maintain the official rate-limiting plugin that protects thousands of Telegram bots from abuse.',
      open: true,
    },
    {
      when: '2014',
      title: 'English Translation, M.A. & B.A.',
      text: 'Ferdowsi University of Mashhad (2014–2021), alongside CS50 and Web Programming from Harvard Extension School.',
    },
  ],
  fa: [
    {
      when: 'ژانویه ۲۰۲۶',
      title: 'تکنیکال لید، لندین',
      text: 'بکاند و زیرساخت پیشروترین پلتفرم ساخت لندینگ‌پیج بدون کد در ایران: میکروسرویس، درگاه‌های پرداخت، RabbitMQ و صدور خودکار SSL برای هزاران دامنه اختصاصی.',
      open: true,
    },
    {
      when: 'مارس ۲۰۲۴',
      title: 'توسعه‌دهنده Node.js، پارت',
      text: 'میکروسرویس‌های فین‌تک و API Gateway با ده‌ها هزار تراکنش روزانه. انتشار متن‌باز Schematica و تدریس در کالج پارت.',
    },
    {
      when: 'ژانویه ۲۰۲۴',
      title: 'مهندس نرم‌افزار، لایسنس مارکت',
      text: 'React و Next.js با سیستم طراحی Tailwind، CI/CD با Docker و کشینگی که زمان پاسخ API را تقریباً نصف کرد.',
    },
    {
      when: 'مه ۲۰۲۱',
      title: 'متن‌باز، grammY',
      text: 'نوشتن و نگهداری Middleware رسمی محدودکننده نرخ درخواست که هزاران بات تلگرام را در برابر سوءاستفاده محافظت می‌کند.',
      open: true,
    },
    {
      when: '۲۰۱۴',
      title: 'مترجمی زبان انگلیسی، کارشناسی ارشد و کارشناسی',
      text: 'دانشگاه فردوسی مشهد (۲۰۱۴ تا ۲۰۲۱) در کنار CS50 و برنامه‌نویسی وب از Harvard Extension School.',
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
