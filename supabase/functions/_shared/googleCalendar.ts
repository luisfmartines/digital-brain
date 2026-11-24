import { admin } from "./common.ts";

const EVENTS = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export class GoogleCalendarError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export async function googleAccessToken(userId: string): Promise<string | null> {
  const { data, error } = await admin().from("google_tokens").select("refresh_token")
    .eq("user_id", userId).maybeSingle();
  if (error) throw new GoogleCalendarError("connection_lookup_failed");
  if (!data?.refresh_token) return null;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: data.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const token = await response.json();
  if (token.error === "invalid_grant" || token.error === "invalid_token") {
    throw new GoogleCalendarError("reconnect_required", 409);
  }
  if (!response.ok || !token.access_token) throw new GoogleCalendarError("token_error");
  return token.access_token;
}

export interface GoogleEventInput {
  title: string;
  start: string;
  end?: string | null;
  allDay?: boolean;
  description?: string | null;
  category?: string;
  reminderMinutes?: number | null;
}

export interface GoogleEvent {
  id: string;
  htmlLink?: string;
  summary?: string;
  description?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: { digitalBrainCategory?: string } };
}

export async function createGoogleEvent(userId: string, input: GoogleEventInput) {
  const { title, start, allDay = false, description, category, reminderMinutes = 10 } = input;
  const startMs = Date.parse(start);
  const end = input.end ?? (Number.isFinite(startMs)
    ? new Date(startMs + (allDay ? 86_400_000 : 3_600_000)).toISOString().slice(0, allDay ? 10 : undefined)
    : "");
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  const dateTime = /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i;
  const format = allDay ? dateOnly : dateTime;
  if (typeof title !== "string" || !title.trim() || typeof start !== "string" || typeof end !== "string"
    || !format.test(start) || !format.test(end) || !(Date.parse(end) > startMs)
    || (reminderMinutes !== null && (!Number.isInteger(reminderMinutes) || reminderMinutes < 0 || reminderMinutes > 40320))) {
    throw new GoogleCalendarError("invalid_event", 400);
  }
  const access = await googleAccessToken(userId);
  if (!access) return null;
  const response = await fetch(EVENTS, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: title.trim(),
      description,
      start: allDay ? { date: start } : { dateTime: start },
      end: allDay ? { date: end } : { dateTime: end },
      extendedProperties: category ? { private: { digitalBrainCategory: category } } : undefined,
      reminders: { useDefault: false, overrides: reminderMinutes ? [{ method: "popup", minutes: reminderMinutes }] : [] },
    }),
  });
  if (response.status === 401 || response.status === 403) throw new GoogleCalendarError("reconnect_required", 409);
  if (!response.ok) throw new GoogleCalendarError("calendar_error");
  const event: GoogleEvent = await response.json();
  return { id: event.id, link: event.htmlLink };
}

export async function listGoogleEvents(userId: string, start: string, end: string) {
  const duration = Date.parse(end) - Date.parse(start);
  if (!(duration > 0 && duration <= 45 * 86_400_000)) throw new GoogleCalendarError("invalid_period", 400);
  const access = await googleAccessToken(userId);
  if (!access) return [];
  const params = new URLSearchParams({
    timeMin: new Date(start).toISOString(), timeMax: new Date(end).toISOString(),
    singleEvents: "true", orderBy: "startTime", maxResults: "250",
    fields: "nextPageToken,items(id,htmlLink,summary,description,start,end,extendedProperties/private)",
  });
  const items: GoogleEvent[] = [];
  let nextPageToken: string | undefined;
  do {
    const response = await fetch(`${EVENTS}?${params}`, { headers: { Authorization: `Bearer ${access}` } });
    if (response.status === 401 || response.status === 403) throw new GoogleCalendarError("reconnect_required", 409);
    if (!response.ok) throw new GoogleCalendarError("calendar_error");
    const result: { items?: GoogleEvent[]; nextPageToken?: string } = await response.json();
    items.push(...(result.items ?? []));
    nextPageToken = result.nextPageToken;
    if (nextPageToken) params.set("pageToken", nextPageToken);
  } while (nextPageToken);
  return items;
}
