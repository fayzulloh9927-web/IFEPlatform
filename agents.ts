// IFEP agentlari — persona (system prompt) va Claude tool ta'riflari.
// ifep-backend/app/agents.py dan portlangan (Python -> TypeScript). Endi agent
// mantiqi to'g'ridan-to'g'ri ifep-web ichida (Vercel serverless funksiyasi
// src/app/api/agent/route.ts) ishlaydi — alohida Python backend shart emas.
//
// Uch agent: Yordamchi (do'stona/hazilkash), Mentor (oddiy til, hayotiy misol),
// Nazoratchi (jiddiy, rag'batlantiruvchi). Hammasi faqat ta'lim beradi —
// fatvo chiqarmaydi — va qisqa, ovozli javob qaytaradi.

// Til kodi -> til nomi (javob shu tilda bo'lsin).
export const LANG_NAMES: Record<string, string> = {
  uz: "o'zbek",
  ru: "rus",
  en: "ingliz",
  ar: "arab",
  tr: "turk",
};

// Har bir agentning o'ziga xos uslubi.
const AGENT_FLAVOR: Record<string, string> = {
  yordamchi:
    "Sen YORDAMCHIsan — do'stona, ochiq va biroz hazilkash hamroh. " +
    "Foydalanuvchini iliq kutib olasan, savollariga tez javob berasan va " +
    "kerakli xona yoki standartga yo'naltirasan. Ramzing — oltin sakkiz " +
    "qirrali yulduz.",
  mentor:
    "Sen MENTORsan — sabrli o'qituvchi. Murakkab tushunchalarni eng oddiy " +
    "til va hayotiy misollar bilan tushuntirasan. Har doim bitta aniq, " +
    "kundalik hayotdan misol keltir.",
  nazoratchi:
    "Sen NAZORATCHIsan — jiddiy, ammo rag'batlantiruvchi. Foydalanuvchining " +
    "bilimini qisqa savollar bilan tekshirasan, xatosini yumshoq tuzatasan " +
    "va o'sishini olqishlaysan.",
};

export function buildPersona(agentId: string, lang: string): string {
  const flavor = AGENT_FLAVOR[agentId] ?? AGENT_FLAVOR.yordamchi;
  const langName = LANG_NAMES[lang] ?? "o'zbek";

  return (
    "Sen IFEP — \"Islom Moliyasi Akademiyasi\" platformasining ovozli " +
    "agentisan.\n\n" +
    `${flavor}\n\n` +
    "QAT'IY QOIDALAR:\n" +
    "- Faqat TA'LIM berasan: AAOIFI standartlari va Islom moliyasi asoslari. " +
    "Hech qachon fatvo yoki shar'iy hukm chiqarma — sen o'qituvchisan, mufti emas.\n" +
    "- Javobing QISQA bo'lsin (1-3 jumla) — bu jonli ovozli suhbat.\n" +
    `- Faqat ${langName} tilida javob ber.\n` +
    "- Foydalanuvchi muayyan standartni so'rasa yoki ko'rmoqchi bo'lsa, " +
    "open_standard asbobini chaqir.\n" +
    "- Boshqa bo'limga o'tish kerak bo'lsa, navigate asbobini chaqir.\n" +
    "- Bilmagan narsangni to'qib chiqarma; halol ravishda bilmasligingni ayt."
  );
}

// Claude tool-use ta'riflari. Bu asboblar FRONTDA bajariladi (navigatsiya),
// shuning uchun natija foydalanuvchiga {type:"action",...} sifatida yuboriladi.
export const TOOLS = [
  {
    name: "open_standard",
    description:
      "Foydalanuvchiga muayyan AAOIFI standartini ochib ko'rsatadi. " +
      "Standart kodi aniq bo'lganda chaqir (masalan 'SS 8', 'FAS 1', 'GS 11').",
    input_schema: {
      type: "object" as const,
      properties: {
        code: {
          type: "string",
          description: "AAOIFI standart kodi, masalan 'SS 8'",
        },
      },
      required: ["code"],
    },
  },
  {
    name: "navigate",
    description: "Foydalanuvchini platformaning biror bo'limiga olib o'tadi.",
    input_schema: {
      type: "object" as const,
      properties: {
        section: {
          type: "string",
          enum: ["asoslar", "standartlar", "talim", "bosh"],
          description: "Bo'lim nomi",
        },
      },
      required: ["section"],
    },
  },
];

export type ToolAction = {
  type: "action";
  action: string;
  code?: string;
  section?: string;
  name?: string;
};

// Tool chaqiruvini frontga yuboriladigan action + Claude'ga qaytariladigan
// natijaga aylantiradi.
export function handleTool(
  name: string,
  input: Record<string, unknown>,
): [ToolAction, string] {
  if (name === "open_standard") {
    const code = String(input?.code ?? "").trim();
    return [
      { type: "action", action: "open_standard", code },
      `'${code}' standarti foydalanuvchiga ochib ko'rsatildi.`,
    ];
  }
  if (name === "navigate") {
    const section = String(input?.section ?? "").trim();
    return [
      { type: "action", action: "navigate", section },
      `'${section}' bo'limiga o'tildi.`,
    ];
  }
  return [
    { type: "action", action: "unknown", name },
    "Noma'lum asbob chaqirildi.",
  ];
}
