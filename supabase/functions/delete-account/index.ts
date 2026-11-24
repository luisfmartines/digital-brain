import { admin, corsHeaders, getUser, json } from "../_shared/common.ts";

async function clearFolder(bucket: ReturnType<ReturnType<typeof admin>["storage"]["from"]>, folder: string) {
  const files: string[] = [];
  // Discover one folder before deleting its direct children so pagination remains stable.
  const folders: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await bucket.list(folder, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    for (const entry of data) {
      const path = folder + "/" + entry.name;
      if (entry.id) files.push(path);
      else folders.push(path);
    }
    if (data.length < 100) break;
  }
  for (const path of folders) await clearFolder(bucket, path);
  for (let offset = 0; offset < files.length; offset += 100) {
    const removed = await bucket.remove(files.slice(offset, offset + 100));
    if (removed.error) throw removed.error;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const user = await getUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);
  const request = await req.json().catch(() => null);
  if (request?.confirmation !== "EXCLUIR") return json({ error: "confirmation_required" }, 400);

  const db = admin();
  try {
    for (const bucket of ["avatars", "post-media", "exercise-photos"]) {
      await clearFolder(db.storage.from(bucket), user.id);
    }
    const deleted = await db.auth.admin.deleteUser(user.id);
    if (deleted.error) throw deleted.error;
    return json({ deleted: true });
  } catch (error) {
    console.error("Account deletion failed", error);
    return json({ error: "deletion_failed" }, 500);
  }
});
