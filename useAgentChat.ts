"use client";

import { useCallback, useRef, useState } from "react";

// Agent endi shu Vercel loyihasi ichida (/api/agent, Node.js serverless
// funksiyasi) ishlaydi — alohida backend (Render/Railway) va
// NEXT_PUBLIC_BACKEND_WS shart emas. ANTHROPIC_API_KEY faqat serverda
// (Vercel env var) o'qiladi.
export const BACKEND_CONFIGURED = true;

export type ChatMsg = {
  id: number;
  role: "user" | "assistant" | "error";
  text: string;
};

export type AgentAction = {
  type: "action";
  action: string;
  code?: string;
  section?: string;
};

type Status = "idle" | "connecting" | "open" | "error" | "closed";

// Agent bilan suhbatni boshqaradi: HTTP streaming (NDJSON) ulanish, javob
// (delta), tool action'lari va xatolarni qayta ishlaydi. Suhbat tarixi
// (Anthropic messages formatida) `historyRef` da klient tomonida saqlanadi —
// har so'rovda serverga qaytariladi (server o'zi holatsiz/stateless).
export function useAgentChat(onAction: (a: AgentAction) => void) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [busy, setBusy] = useState(false);

  const idRef = useRef(0);
  const historyRef = useRef<unknown[]>([]);
  // onAction'ni ref orqali ushlaymiz — qayta ulanmasdan eng yangi versiyasi.
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  const append = (role: ChatMsg["role"], text: string) => {
    idRef.current += 1;
    setMessages((p) => [...p, { id: idRef.current, role, text }]);
  };

  // Oxirgi assistant xabariga matn qo'shadi (streaming), yo'q bo'lsa yangi ochadi.
  const appendDelta = (t: string) => {
    setMessages((p) => {
      const last = p[p.length - 1];
      if (last && last.role === "assistant") {
        return [...p.slice(0, -1), { ...last, text: last.text + t }];
      }
      idRef.current += 1;
      return [...p, { id: idRef.current, role: "assistant", text: t }];
    });
  };

  const send = useCallback(
    async (text: string, agentId: string, lang: string) => {
      if (!text.trim() || busy) return;
      append("user", text);
      setBusy(true);
      setStatus("connecting");

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_id: agentId,
            lang,
            text,
            history: historyRef.current,
          }),
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => null);
          append("error", data?.message ?? "AI xizmatiga ulanib bo'lmadi.");
          setStatus("error");
          return;
        }

        setStatus("open");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            let m: { type: string; text?: string; message?: string; history?: unknown[] };
            try {
              m = JSON.parse(line);
            } catch {
              continue;
            }
            if (m.type === "delta") appendDelta(m.text ?? "");
            else if (m.type === "action") onActionRef.current(m as AgentAction);
            else if (m.type === "done") {
              if (m.history) historyRef.current = m.history;
            } else if (m.type === "error") {
              append("error", m.message ?? "Noma'lum xato");
            }
          }
        }
        setStatus("closed");
      } catch {
        append("error", "AI xizmatiga ulanib bo'lmadi. Birozdan so'ng urinib ko'ring.");
        setStatus("error");
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  return { messages, status, busy, send };
}
