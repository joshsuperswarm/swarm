import {
  ResponsesApiPayload,
  ParsedCitation,
  ResponseOutputItem,
} from "./types";

export function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === "string") return payload.output_text;

  const texts: string[] = [];
  for (const item of payload?.output ?? []) {
    if (item?.type === "message" && Array.isArray(item.content)) {
      for (const c of item.content) {
        if (c?.type === "output_text" && typeof c?.text === "string") {
          texts.push(c.text);
        }
      }
    }
  }
  return texts.join("\n\n").trim();
}

export function extractWebSearchCitations(payload: any): ParsedCitation[] {
  const out: ParsedCitation[] = [];

  const output: ResponseOutputItem[] = payload?.output ?? [];
  for (const item of output) {
    if (item?.type !== "message" || !Array.isArray(item.content)) continue;

    for (const c of item.content) {
      if (c?.type !== "output_text") continue;
      const ann = Array.isArray((c as any).annotations)
        ? (c as any).annotations
        : [];
      for (const a of ann) {
        if (a?.type === "url_citation" && typeof a?.url === "string") {
          try {
            const u = new URL(a.url);
            out.push({
              url: a.url,
              domain: u.hostname.replace(/^www\./, ""),
              title: a.title ?? null,
              index: a.index ?? null,
            });
          } catch {
            // ignore malformed URLs
          }
        }
      }
    }
  }

  const seen = new Set<string>();
  return out.filter((c) => {
    if (seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });
}