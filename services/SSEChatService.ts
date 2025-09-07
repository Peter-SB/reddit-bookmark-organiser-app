// SSEChatService.ts
import EventSource from "react-native-sse";

export type StartSSEArgs = {
  endpoint: string;
  payload: any;
  onDelta: (text: string) => void;
  onFinish?: () => void;
  onError?: (err: any) => void;
};

export function startSSEChat({
  endpoint,
  payload,
  onDelta,
  onFinish,
  onError,
}: StartSSEArgs) {
  const url = endpoint.replace(/\/+$/, "") + "/chat/completions";

  const body = JSON.stringify({ ...payload, stream: true });

  const es = new EventSource(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body,
  });

  es.addEventListener("open", () => {
    console.debug("[SSE] open", url);
  });

  es.addEventListener("message", (event) => {
    const raw = String(event.data ?? "").trim();
    console.debug("[SSE] message raw:", raw.slice(0, 120));
    if (!raw) return;
    if (raw === "[DONE]") {
      console.debug("[SSE] done");
      onFinish?.();
      es.close();
      return;
    }
    // Some servers send multiple "data:" lines in one message; split just in case.
    const frames = raw.split(/\n+/).filter(Boolean);
    for (const f of frames) {
      const line = f.replace(/^data:\s*/i, ""); // strip leading "data: "
      try {
        const json = JSON.parse(line);
        const choice = json?.choices?.[0] ?? {};
        const deltaObj = choice.delta ?? {};
        const textDelta =
          deltaObj.content ??
          choice.text ??
          json.content ??
          "";
        if (typeof textDelta === "string" && textDelta.length) onDelta(textDelta);
        if (choice.finish_reason) {
          // do nothing; [DONE] will still arrive
        }
      } catch {
        console.debug("[SSE] non-JSON frame:", f.slice(0, 80));
      }
    }
  });

  es.addEventListener("error", (event: any) => {
    console.error("[SSE] error:", event?.message || event);
    onError?.(event);
    es.close();
  });

  return es;
}
