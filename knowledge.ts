// IFEP bilim bazasi (TS versiyasi) — AAOIFI Shariat standartlari + asoslar.
// Ilgari bu mantiq ifep-backend/app/knowledge.py da edi (Python/FastAPI orqali
// xizmat qilingan). Endi agent to'g'ridan-to'g'ri ifep-web ichida (Vercel
// serverless funksiyasi) ishlaydi, shuning uchun mavjud src/data/aaoifi_shariah.json
// dan (src/lib/standards.ts orqali) qayta foydalanamiz — ma'lumot ikki marta
// saqlanmaydi.

import { STANDARDS } from "@/lib/standards";

const LANG_ORDER = ["uz", "en", "ru", "ar", "tr"] as const;

export type Chunk = {
  id: string;
  title: string; // ko'rsatish uchun
  text: string; // qisqa maqsad
  search: string; // qidiruv blobi (barcha til)
  keywords: string[];
};

function pick(langs: Record<string, Record<string, unknown>> | undefined, field: string): string {
  if (!langs) return "";
  for (const lng of LANG_ORDER) {
    const v = langs[lng]?.[field];
    if (typeof v === "string" && v) return v;
  }
  return "";
}

function loadStandards(): Chunk[] {
  return STANDARDS.map((s) => {
    const langs = (s.langs ?? {}) as Record<string, Record<string, unknown>>;
    const title = pick(langs, "title") || s.term || "";
    const objective = pick(langs, "objective");
    const parts: string[] = [s.term ?? "", s.category ?? ""];
    for (const obj of Object.values(langs)) {
      parts.push(
        String(obj?.title ?? ""),
        String(obj?.objective ?? ""),
        String(obj?.scope ?? ""),
      );
    }
    return {
      id: s.code,
      title: `${s.code} — ${title}`,
      text: (objective || "").slice(0, 400),
      search: parts.filter(Boolean).join(" "),
      keywords: [],
    };
  });
}

// Asosiy tamoyillar (standartlardan tashqari) — RAG uchun foydali.
export const PRINCIPLES: Chunk[] = [
  {
    id: "PRINSIP-RIBA",
    title: "Tamoyil — Riba (foiz) taqiqi",
    text: "Foiz qat'iy man etiladi. Pul puldan o'smaydi; daromad real iqtisodiy faoliyatdan tug'iladi.",
    search: "",
    keywords: ["riba", "foiz", "interest", "sud", "процент"],
  },
  {
    id: "PRINSIP-GHARAR",
    title: "Tamoyil — Gharar (noaniqlik)",
    text: "Haddan ortiq noaniqlik va aldov bo'lgan bitimlar tan olinmaydi.",
    search: "",
    keywords: ["gharar", "noaniqlik", "aldov", "uncertainty", "гарар"],
  },
  {
    id: "PRINSIP-MAYSIR",
    title: "Tamoyil — Maysir (qimor)",
    text: "Qimor va chayqovchilik taqiqlanadi.",
    search: "",
    keywords: ["maysir", "qimor", "chayqovchilik", "gambling", "майсир"],
  },
  {
    id: "PRINSIP-ADOLAT",
    title: "Tamoyil — Adolat va real aktiv",
    text: "Adolat ustuvor; har bir bitim real aktiv yoki xizmatga tayanadi.",
    search: "",
    keywords: ["adolat", "halol", "real aktiv", "asset", "tarozi"],
  },
];

export const KNOWLEDGE: Chunk[] = [...loadStandards(), ...PRINCIPLES];
