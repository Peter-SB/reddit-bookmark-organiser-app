// SSEChatService.ts
import EventSource from "react-native-sse";

export type StartSSEArgs = {
  endpoint: string;
  payload: any;
  onDelta: (text: string) => void;
  onFinish?: () => void;
  onError?: (err: any) => void;
  apiKey?: string;
  referer?: string;
  appTitle?: string;
};

export function startSSEChat({
  endpoint,
  payload,
  onDelta,
  onFinish,
  onError,
  apiKey,
  referer,
  appTitle,
}: StartSSEArgs) {
  const url = endpoint.replace(/\/+$/, "") + "/chat/completions";

  const body = JSON.stringify({ ...payload, stream: true });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  if (referer) headers["HTTP-Referer"] = referer;
  if (appTitle) headers["X-Title"] = appTitle;

  const es = new EventSource(url, {
    method: "POST",
    headers,
    body,
  });

  es.addEventListener("open", () => {
    console.debug("[SSE] open", url);
  });

  es.addEventListener("message", (event) => {
    const raw = String(event.data ?? "").trim();
    if (!raw) return;

    if (raw === "[DONE]") {
      onFinish?.();
      es.close();
      return;
    }

    // Some servers send multiple "data:" lines in one message; split just in case.
    const frames = raw.split(/\n+/).filter(Boolean);
    for (const f of frames) {
      // Ignore OpenRouter keepalive comments like ": OPENROUTER PROCESSING"
      if (f.startsWith(":")) continue;

      const line = f.replace(/^data:\s*/i, "");
      try {
        const json = JSON.parse(line);

        // Done if usage-only final chunk arrives
        if (json?.usage && (!json.choices || json.choices.length === 0)) {
          onFinish?.();
          es.close();
          continue;
        }

        // Mid-stream error handling
        if (json?.error) {
          console.error("[SSE] stream error:", json.error);
          onError?.(json.error);
          es.close();
          continue;
        }

        const choice = json?.choices?.[0] ?? {};
        const deltaObj = choice.delta ?? {};
        const textDelta =
          deltaObj.content ?? choice.text ?? json.content ?? "";

        if (typeof textDelta === "string" && textDelta.length) {
          onDelta(textDelta);
        }
      } catch {
        console.debug("[SSE] non-JSON frame:", f.slice(0, 80));
      }
    }
  });

  es.addEventListener("error", (event: any) => {
    console.log("[SSE] error:", event?.message || event);
    onError?.(event);
    es.close();
  });

  return es;
}
