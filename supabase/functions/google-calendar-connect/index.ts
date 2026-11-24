import {
  corsHeaders, getUser, json, makeState, REDIRECT_URI,
} from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const params = new URLSearchParams({
    client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    state: await makeState(user.id),
  });

  return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});