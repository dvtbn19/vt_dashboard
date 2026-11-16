import { put } from "@vercel/blob";
import type { Block } from "./db";

const hasBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export async function storeFile(name: string, data: Buffer | Blob, contentType?: string) {
  if (!hasBlob()) throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  const res = await put(`lab/${Date.now()}-${name.replace(/[^\w.\-]+/g, "_")}`, data, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });
  return res.url;
}

type RawBlock = Record<string, unknown> & { type?: string };

/**
 * Validate agent-supplied blocks. Images/files may arrive as base64 (`data`) and are moved
 * to Vercel Blob when it is configured; otherwise small images stay inline as data URIs.
 */
export async function normalizeBlocks(input: unknown): Promise<Block[]> {
  if (!Array.isArray(input)) return [];
  const out: Block[] = [];
  for (const raw of input as RawBlock[]) {
    if (!raw || typeof raw !== "object") continue;
    const type = String(raw.type ?? "");
    const caption = typeof raw.caption === "string" ? raw.caption : undefined;
    switch (type) {
      case "markdown":
      case "text":
        out.push({ type: "markdown", content: String(raw.content ?? raw.text ?? "") });
        break;
      case "log":
        out.push({ type: "log", content: String(raw.content ?? "") });
        break;
      case "code":
        out.push({ type: "code", language: raw.language ? String(raw.language) : undefined, content: String(raw.content ?? "") });
        break;
      case "metrics": {
        let items = raw.items as { label: string; value: string | number; delta?: string }[] | Record<string, unknown>;
        if (items && !Array.isArray(items)) {
          items = Object.entries(items).map(([label, value]) => ({ label, value: value as string | number }));
        }
        out.push({
          type: "metrics",
          items: ((items as unknown[]) ?? []).map((i) => {
            const it = i as Record<string, unknown>;
            return { label: String(it.label), value: (it.value ?? "") as string | number, delta: it.delta ? String(it.delta) : undefined };
          }),
        });
        break;
      }
      case "table": {
        let columns = (raw.columns as string[]) ?? [];
        let rows = (raw.rows as (string | number | null)[][]) ?? [];
        // Accept pandas `df.to_dict(orient="records")`
        if (Array.isArray(raw.records)) {
          const recs = raw.records as Record<string, string | number | null>[];
          columns = recs.length ? Object.keys(recs[0]) : [];
          rows = recs.map((r) => columns.map((c) => r[c] ?? null));
        }
        out.push({ type: "table", columns: columns.map(String), rows: rows.slice(0, 2000), caption });
        break;
      }
      case "plotly": {
        let fig = raw.figure as unknown;
        if (typeof fig === "string") fig = JSON.parse(fig); // allow fig.to_json()
        const f = fig as { data?: unknown[]; layout?: Record<string, unknown> };
        out.push({ type: "plotly", figure: { data: f?.data ?? [], layout: f?.layout ?? {} }, caption });
        break;
      }
      case "image": {
        let url = typeof raw.url === "string" ? raw.url : "";
        if (!url && typeof raw.data === "string") {
          const mime = typeof raw.mime === "string" ? raw.mime : "image/png";
          const b64 = raw.data.replace(/^data:[^;]+;base64,/, "");
          if (hasBlob()) {
            url = await storeFile(`${String(raw.name ?? "image")}.${mime.split("/")[1] ?? "png"}`, Buffer.from(b64, "base64"), mime);
          } else {
            url = `data:${mime};base64,${b64}`;
          }
        }
        if (url) out.push({ type: "image", url, caption });
        break;
      }
      case "file": {
        let url = typeof raw.url === "string" ? raw.url : "";
        const name = String(raw.name ?? "file");
        if (!url && typeof raw.data === "string") {
          url = await storeFile(name, Buffer.from(raw.data, "base64"), typeof raw.mime === "string" ? raw.mime : undefined);
        }
        if (url) out.push({ type: "file", url, name });
        break;
      }
      default:
        out.push({ type: "code", language: "json", content: JSON.stringify(raw, null, 2) });
    }
  }
  return out;
}
