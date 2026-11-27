import { admin } from "./common.ts";
import { importGoogleAgenda, readCalendars } from "./googleAgendaImport.ts";

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
  exportId?: string;
  calendarId?: string;
}

export interface GoogleEvent {
  id: string;
  htmlLink?: string;
  summary?: string;
  description?: string;
  location?: string;
  calendarId?: string;
  etag?: string;
  status?: string;
  locked?: boolean;
  organizer?: { self?: boolean };
  guestsCanModify?: boolean;
  recurringEventId?: string;
  reminders?: { useDefault?: boolean; overrides?: { method: string; minutes: number }[] };
  iCalUID?: string;
  calendarName?: string;
  calendarColor?: string;
  originalStartTime?: { date?: string; dateTime?: string };
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: { digitalBrainCategory?: string } };
}

export async function createGoogleEvent(userId: string, input: GoogleEventInput) {
  const access = await googleAccessToken(userId);
  if (!access) return null;
  if (input.calendarId !== undefined) {
    const calendars = await readCalendars(access);
    if (!calendars.some((calendar) => calendar.id === input.calendarId && canWriteCalendar(calendar.accessRole))) {
      throw new GoogleCalendarError("invalid_calendar", 400);
    }
  }
  return insertGoogleEvent(access, input);
}

function canWriteCalendar(role?: string) {
  return role === "owner" || role === "writer";
}

export async function listGoogleCalendars(userId: string) {
  const access = await googleAccessToken(userId);
  if (!access) return null;
  return (await readCalendars(access)).map((calendar) => ({
    id: calendar.id, name: calendar.summaryOverride || calendar.summary || "Google Agenda",
    color: calendar.backgroundColor, primary: !!calendar.primary, writable: canWriteCalendar(calendar.accessRole),
  }));
}

function eventSchedule({ start, allDay = false, end: inputEnd }: Pick<GoogleEventInput, "start" | "end" | "allDay">) {
  const startMs = Date.parse(start);
  const end = inputEnd ?? (Number.isFinite(startMs)
    ? new Date(startMs + (allDay ? 86_400_000 : 3_600_000)).toISOString().slice(0, allDay ? 10 : undefined)
    : "");
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  const dateTime = /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i;
  const format = allDay ? dateOnly : dateTime;
  if (typeof start !== "string" || typeof end !== "string"
    || !format.test(start) || !format.test(end) || !(Date.parse(end) > startMs)) {
    throw new GoogleCalendarError("invalid_event", 400);
  }
  return {
    start: allDay ? { date: start } : { dateTime: start },
    end: allDay ? { date: end } : { dateTime: end },
  };
}

function eventTitle(title: string) {
  if (typeof title !== "string" || !title.trim()) throw new GoogleCalendarError("invalid_event", 400);
  return title.trim();
}

function eventReminders(minutes: number | null) {
  if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0 || minutes > 40320)) {
    throw new GoogleCalendarError("invalid_event", 400);
  }
  return { useDefault: false, overrides: minutes ? [{ method: "popup", minutes }] : [] };
}

export async function insertGoogleEvent(access: string, input: GoogleEventInput) {
  const { title, description, category, reminderMinutes = 10 } = input;
  const endpoint = input.calendarId ? EVENTS.replace("/primary/", `/${encodeURIComponent(input.calendarId)}/`) : EVENTS;
  const response = await fetch(endpoint, {
    method: "POST", signal: AbortSignal.timeout(9000),
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: input.exportId,
      summary: eventTitle(title),
      description,
      ...eventSchedule(input),
      extendedProperties: category ? { private: { digitalBrainCategory: category } } : undefined,
      reminders: eventReminders(reminderMinutes),
    }),
  });
  if (response.status === 401 || response.status === 403) throw new GoogleCalendarError("reconnect_required", 409);
  if (response.status === 409 && input.exportId) return { id: input.exportId, existing: true };
  if (!response.ok) throw new GoogleCalendarError("calendar_error");
  const event: GoogleEvent = await response.json();
  return { id: event.id, link: event.htmlLink, existing: false };
}

type GoogleEventRef = { calendarId: string; eventId: string; etag?: string };
type GoogleEventUpdate = Pick<GoogleEventInput, "title" | "description" | "category" | "reminderMinutes">
  & Partial<Pick<GoogleEventInput, "start" | "end" | "allDay">>;

export async function manageGoogleEvent(
  userId: string, event: GoogleEventRef,
  operation: { method: "GET" | "DELETE" } | { method: "PATCH"; input: GoogleEventUpdate },
) {
  const { calendarId, eventId, etag } = event;
  const validSegment = (value: unknown) => typeof value === "string" && value.length > 0
    && value.length <= 1024 && !/^[.]{1,2}$|[\\/]/.test(value);
  if (!validSegment(calendarId) || !validSegment(eventId)) throw new GoogleCalendarError("invalid_event", 400);

  const body = operation.method === "PATCH" ? {
    summary: eventTitle(operation.input.title),
    description: operation.input.description === null ? "" : operation.input.description,
    ...(operation.input.start !== undefined ? eventSchedule({ ...operation.input, start: operation.input.start }) : {}),
    extendedProperties: operation.input.category ? { private: { digitalBrainCategory: operation.input.category } } : undefined,
    reminders: operation.input.reminderMinutes === undefined ? undefined : eventReminders(operation.input.reminderMinutes),
  } : undefined;

  const access = await googleAccessToken(userId);
  if (!access) return null;
  const endpoint = EVENTS.replace("/primary/", `/${encodeURIComponent(calendarId)}/`) + "/" + encodeURIComponent(eventId);
  const headers = new Headers({ Authorization: `Bearer ${access}` });
  if (body) headers.set("Content-Type", "application/json");
  if (operation.method !== "GET" && typeof etag === "string") headers.set("If-Match", etag);
  const response = await fetch(endpoint, {
    method: operation.method, headers, signal: AbortSignal.timeout(9000),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) throw new GoogleCalendarError("reconnect_required", 409);
  if (response.status === 403) {
    const details = await response.json().catch(() => null);
    if (details?.error?.errors?.some((error: { reason?: string }) =>
      error.reason === "insufficientPermissions") || response.headers.get("WWW-Authenticate")?.includes("insufficient_scope")) {
      throw new GoogleCalendarError("reconnect_required", 409);
    }
    throw new GoogleCalendarError("event_forbidden", 403);
  }
  if (response.status === 412) throw new GoogleCalendarError("event_changed", 409);
  if (response.status === 404 || response.status === 410) {
    if (operation.method === "DELETE") return { id: eventId };
    throw new GoogleCalendarError("event_not_found", 404);
  }
  if (!response.ok) throw new GoogleCalendarError("calendar_error");
  if (operation.method === "DELETE") return { id: eventId };
  const result: GoogleEvent = await response.json();
  if (result.status === "cancelled") throw new GoogleCalendarError("event_not_found", 404);
  return { ...result, calendarId };
}

export async function listGoogleEvents(userId: string, start: string, end: string): Promise<{ events: GoogleEvent[]; warnings: string[] }> {
  const duration = Date.parse(end) - Date.parse(start);
  if (!(duration > 0 && duration <= 45 * 86_400_000)) {
    throw new GoogleCalendarError("invalid_period", 400);
  }
  const access = await googleAccessToken(userId);
  return access ? importGoogleAgenda(access, start, end) : { events: [], warnings: [] };
}
