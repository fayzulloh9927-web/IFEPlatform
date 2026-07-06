// Leksik (kalit so'z) retriever — RAG ning kredit/DB talab qilmaydigan versiyasi.
// ifep-backend/app/retrieval.py dan portlangan (Python -> TypeScript), xatti-harakati
// aynan bir xil bo'lishi uchun.

import { KNOWLEDGE, type Chunk } from "@/lib/knowledge";

// O'zbek apostrof variantlarini tozalash uchun.
const APOS_RE = /[ʻʼ'`’]/g;

function norm(s: string): string {
  let out = s.toLowerCase().replace(APOS_RE, "");
  // \p{L}\p{N} lotin/kirill/arab harflar + raqamlarni qamraydi (Python \w ekvivalenti).
  out = out.replace(/[^\p{L}\p{N}\s]/gu, " ");
  return out.replace(/\s+/g, " ").trim();
}

function tokens(s: string): string[] {
  return norm(s)
    .split(" ")
    .filter((t) => t.length >= 3);
}

// Token mosligi — transliteratsiya farqi uchun prefiks ham hisobga olinadi
// (murabaha↔murabahah, ijara↔ijarah, mudaraba↔mudarabah).
function matchTok(tok: string, toks: Set<string>): boolean {
  if (toks.has(tok)) return true;
  if (tok.length < 4) return false;
  for (const t of toks) {
    if (t.length >= 4 && (t.startsWith(tok) || tok.startsWith(t))) return true;
  }
  return false;
}

export function retrieve(query: string, k = 3): Chunk[] {
  const qTokens = new Set(tokens(query));
  if (qTokens.size === 0) return [];

  const scored: Array<[number, Chunk]> = [];
  for (const c of KNOWLEDGE) {
    const titleToks = new Set(tokens(c.title));
    const searchToks = c.search ? new Set(tokens(c.search)) : new Set<string>();
    const textToks = new Set(tokens(c.text));
    const kwN = c.keywords.map(norm);

    let score = 0;
    for (const tok of qTokens) {
      if (kwN.some((kw) => kw && (tok.includes(kw) || kw.includes(tok)))) score += 3;
      else if (matchTok(tok, titleToks)) score += 2;
      else if (matchTok(tok, searchToks) || matchTok(tok, textToks)) score += 1;
    }
    if (score > 0) scored.push([score, c]);
  }

  scored.sort((a, b) => b[0] - a[0]);
  return scored.slice(0, k).map(([, c]) => c);
}

// Topilgan bo'laklardan Claude uchun manba bloki tuzadi (bo'sh bo'lsa "").
export function buildContext(query: string, k = 3): string {
  const chunks = retrieve(query, k);
  if (chunks.length === 0) return "";
  const lines = chunks.map((c) => `- ${c.title}: ${c.text}`);
  return (
    "Quyidagi AAOIFI manbalariga asoslan (faqat tegishli bo'lsa ishlat, " +
    "manba kodini eslatib o'tishing mumkin):\n" +
    lines.join("\n")
  );
}
