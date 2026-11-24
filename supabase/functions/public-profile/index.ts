import { admin, corsHeaders, getUser, json } from "../_shared/common.ts";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const user = await getUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);
  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "invalid_input" }, 400);
  const db = admin();
  if (body.action === "copy" && typeof body.id === "string" && uuid.test(body.id)) {
    const { data, error } = await db.rpc("copy_shared_routine", { viewer: user.id, source_routine: body.id });
    if (error) return json({ error: "copy_failed" }, 500);
    return data ? json({ id: data }) : json({ error: "routine_unavailable" }, 404);
  }
  if (body.action === "read" && typeof body.id === "string" && uuid.test(body.id)) {
    const { data, error } = await db.rpc("read_shared_profile", { target: body.id });
    if (error) return json({ error: "profile_failed" }, 500);
    return data ? json(data) : json({ error: "profile_unavailable" }, 404);
  }
  return json({ error: "invalid_input" }, 400);
});
