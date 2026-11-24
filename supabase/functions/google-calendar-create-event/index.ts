import { corsHeaders, getUser, json } from "../_shared/common.ts";
import { createGoogleEvent, GoogleCalendarError, listGoogleEvents } from "../_shared/googleCalendar.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const user = await getUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const input = await req.json().catch(() => null);
  if (!input || typeof input !== "object") return json({ error: "invalid_body" }, 400);
  try {
    if (input.action === "list") return json({ events: await listGoogleEvents(user.id, input.start, input.end) });
    const event = await createGoogleEvent(user.id, input);
    return event ? json(event) : json({ error: "not_connected" }, 409);
  } catch (error) {
    if (error instanceof GoogleCalendarError) return json({ error: error.message }, error.status);
    console.error("Google Calendar request failed", error instanceof Error ? error.name : "unknown");
    return json({ error: "calendar_error" }, 502);
  }
});
