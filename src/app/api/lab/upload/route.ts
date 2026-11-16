import { isAuthorizedRequest } from "@/lib/auth";
import { storeFile } from "@/lib/blocks";
import { err, handle, json } from "@/lib/api";

export const dynamic = "force-dynamic";

/** multipart/form-data with a `file` field → { url }. Max ~4.5 MB per request on Vercel. */
export function POST(req: Request) {
  return handle(async () => {
    if (!isAuthorizedRequest(req)) return err("Unauthorized", 401);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return err("`file` field is required");
    const url = await storeFile(file.name || "upload", file, file.type || undefined);
    return json({ url, name: file.name }, 201);
  });
}
