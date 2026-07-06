// IFEP agent — Vercel serverless funksiyasi (Next.js Route Handler).
//
// Ilgari bu /ws/agent (FastAPI WebSocket, ifep-backend) orqali xizmat qilingan.
// Endi bitta Vercel loyihasi (ifep-web) ichida ishlaydi — alohida backend
// hosting (Render/Railway) shart emas. Oqim (streaming) newline-delimited
// JSON (NDJSON) orqali yuboriladi: har qator bitta {"type": ...} obyekti.
//
// MAXFIYLIK: ANTHROPIC_API_KEY faqat shu yerda (server, Vercel env var) o'qiladi
// — hech qachon NEXT_PUBLIC_* ga yozilmaydi va brauzerga chiqmaydi.

import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";

import { TOOLS, buildPersona, handleTool } from "@/lib/agents";
import { buildContext } from "@/lib/retrieval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Diqqat: ifep-backend/app/main.py dagi qiymat bilan bir xil saqlangan.
// CLAUDE.md loyihada "claude-sonnet-4-6" deb ko'rsatgan, lekin joriy kodda
// "claude-opus-4-8" ishlatilgan — buni o'zgartirmasdan portladik (mavjud
// xatti-harakatni saqlash uchun). Kerak bo'lsa shu yerda almashtiring.
const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 4096;

type HistoryMessage = { role: "user" | "assistant"; content: unknown };

export async function GET() {
  return Response.json({
    status: "ok",
    model: MODEL,
    anthropic_key_configured: Boolean(process.env.ANTHROPIC_API_KEY),
  });
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { type: "error", message: "ANTHROPIC_API_KEY sozlanmagan (Vercel env var)." },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => null);
  const text = String(body?.text ?? "").trim();
  if (!text) {
    return Response.json({ type: "error", message: "Bo'sh xabar." }, { status: 400 });
  }
  const agentId = String(body?.agent_id ?? "yordamchi");
  const lang = String(body?.lang ?? "uz");
  const incomingHistory: HistoryMessage[] = Array.isArray(body?.history) ? body.history : [];

  const client = new Anthropic();

  const context = buildContext(text);
  let system = buildPersona(agentId, lang);
  if (context) system = `${system}\n\n${context}`;

  const history: HistoryMessage[] = [...incomingHistory, { role: "user", content: text }];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      };

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const s = client.messages.stream({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system,
            tools: TOOLS,
            // Adaptive thinking: Claude o'zi qancha "o'ylash"ni hal qiladi
            // (ifep-backend/app/main.py bilan bir xil sozlama).
            thinking: { type: "adaptive" } as unknown as Anthropic.Messages.ThinkingConfigParam,
            messages: history as unknown as Anthropic.Messages.MessageParam[],
          });

          s.on("text", (delta) => send({ type: "delta", text: delta }));

          const final = await s.finalMessage();
          history.push({ role: "assistant", content: final.content });

          if (final.stop_reason !== "tool_use") {
            send({ type: "done", stop_reason: final.stop_reason, history });
            break;
          }

          const toolResults: Array<Record<string, unknown>> = [];
          for (const block of final.content) {
            if (block.type === "tool_use") {
              const [action, result] = handleTool(
                block.name,
                block.input as Record<string, unknown>,
              );
              send(action);
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: result,
              });
            }
          }
          history.push({ role: "user", content: toolResults });
          // Sikl davom etadi — Claude tool natijasidan keyin qisqa tasdiq aytadi.
        }
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
