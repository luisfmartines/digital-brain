import { admin, corsHeaders, getUser, json } from "../_shared/common.ts";

const profileColumns = "id, display_name, username, avatar_url";
const pageSize = 40;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

async function readConnections(db: ReturnType<typeof admin>, id: string, direction: "followers" | "following", cursor: string | null) {
  const filter = direction === "followers" ? "following_id" : "follower_id";
  const order = direction === "followers" ? "follower_id" : "following_id";
  const query = db.from("follows").select("follower_id, following_id")
    .eq(filter, id).order(order).limit(pageSize + 1);

  // PostgREST orders UUIDs consistently, so the last delivered row is the cursor.
  if (cursor) query.gt(order, cursor);

  const [profile, follows] = await Promise.all([
    db.from("profiles").select(profileColumns).eq("id", id).maybeSingle(),
    query,
  ]);
  if (profile.error || follows.error) return json({ error: "connections_failed" }, 500);
  if (!profile.data) return json({ error: "profile_unavailable" }, 404);

  const ids = follows.data.slice(0, pageSize).map((row) => row[order]);
  const next = follows.data.length > pageSize ? ids.at(-1) : null;
  if (!ids.length) return json({ profile: profile.data, profiles: [], next });

  const { data, error } = await db.from("profiles").select(profileColumns).in("id", ids);
  if (error) return json({ error: "connections_failed" }, 500);
  const profiles = data.sort((first, second) =>
    (first.display_name ?? first.username ?? "").localeCompare(second.display_name ?? second.username ?? "", "pt-BR"));
  return json({ profile: profile.data, profiles, next });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const user = await getUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);
  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "invalid_input" }, 400);
  const db = admin();
  if (body.action === "connections") {
    const { id, direction, cursor } = body;
    if (typeof id !== "string" || !uuid.test(id) || (direction !== "followers" && direction !== "following")
      || (cursor != null && (typeof cursor !== "string" || !uuid.test(cursor)))) {
      return json({ error: "invalid_input" }, 400);
    }
    return readConnections(db, id, direction, cursor ?? null);
  }
  if (body.action === "activity" && typeof body.id === "string" && uuid.test(body.id)) {
    const { data, error } = await db.rpc("read_profile_activity", { viewer: user.id, target: body.id });
    if (error) return json({ error: "activity_failed" }, 500);
    return data ? json(data) : json({ error: "profile_unavailable" }, 404);
  }
  if (body.action === "copy_workout" && typeof body.id === "string" && uuid.test(body.id)) {
    const { data, error } = await db.rpc("copy_profile_workout", { viewer: user.id, source_workout: body.id });
    if (error) return json({ error: "copy_failed" }, 500);
    return data ? json({ id: data }) : json({ error: "workout_unavailable" }, 404);
  }
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
