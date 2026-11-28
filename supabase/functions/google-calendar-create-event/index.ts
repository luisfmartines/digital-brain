import { exportGoogleAgenda } from "../_shared/googleAgendaExport.ts";
import { corsHeaders, getUser, json } from "../_shared/common.ts";
import { createGoogleEvent, GoogleCalendarError, listGoogleCalendars, listGoogleEvents, manageGoogleEvent } from "../_shared/googleCalendar.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const user = await getUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const input = await req.json().catch(() => null);
  if (!input || typeof input !== "object") return json({ error: "invalid_body" }, 400);
  try {
    if (input.action === "calendars") {
      const calendars = await listGoogleCalendars(user.id);
      return calendars ? json({ calendars }) : json({ error: "not_connected" }, 409);
    }
    if (input.action === "list") {
      const result = await listGoogleEvents(user.id, input.start, input.end);
      if (input.timeZone) {
        try {
          const known = new Set(result.events.map((event) => event.id));
          const sync = await exportGoogleAgenda(user.id, 0, input.timeZone, { start: input.start, end: input.end }, known);
          if (sync?.failed) result.warnings.push("Alguns itens do Hebbian não foram enviados ao Google Agenda.");
          if (sync?.next != null) result.warnings.push("Para enviar o restante do planejamento, use Perfil → Conexões.");
        } catch {
          result.warnings.push("Não foi possível enviar o planejamento ao Google Agenda. Confira a conexão em Perfil.");
        }
      }
      return json(result);
    }
    if (input.action === "sync") {
      const result = await exportGoogleAgenda(user.id, input.offset ?? 0, input.timeZone ?? "America/Sao_Paulo");
      return result ? json(result) : json({ error: "not_connected" }, 409);
    }
    if (input.action === "read" || input.action === "update" || input.action === "delete") {
      const operation = input.action === "update" ? { method: "PATCH" as const, input }
        : { method: input.action === "read" ? "GET" as const : "DELETE" as const };
      const event = await manageGoogleEvent(user.id, input, operation);
      return event ? json(event) : json({ error: "not_connected" }, 409);
    }
    if (input.action !== undefined) return json({ error: "invalid_action" }, 400);
    const event = await createGoogleEvent(user.id, { ...input, exportId: undefined });
    return event ? json(event) : json({ error: "not_connected" }, 409);
  } catch (error) {
    if (error instanceof GoogleCalendarError) return json({ error: error.message }, error.status);
    console.error("Google Calendar request failed", error instanceof Error ? error.name : "unknown");
    return json({ error: "calendar_error" }, 502);
  }
});
