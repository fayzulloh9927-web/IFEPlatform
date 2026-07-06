import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // DIQQAT: "output: export" olib tashlandi. AI agent endi /api/agent
  // (Node.js serverless funksiya, src/app/api/agent/route.ts) orqali ishlaydi —
  // bu esa server component/runtime talab qiladi, statik eksportda mumkin emas.
  // Sayt endi Vercel'da (yoki Next.js'ni qo'llab-quvvatlaydigan boshqa Node
  // hostda) SSR sifatida deploy qilinishi kerak — Netlify Drop / GitHub Pages
  // kabi sof statik xostlarga endi to'g'ridan-to'g'ri "papka" sifatida
  // yuklab bo'lmaydi.
};

export default nextConfig;
