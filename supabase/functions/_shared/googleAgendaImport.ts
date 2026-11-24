import { GoogleCalendarError, type GoogleEvent } from "./googleCalendar.ts";

const CALENDAR = "https://www.googleapis.com/calendar/v3";

export async function readGooglePages<T>(
  url: string, access: string, params: URLSearchParams, field: "items",
): Promise<T[]> {
  const rows: T[] = [];
  let nextPageToken: string | undefined;
  do {
    const response = await fetch(`${url}?${params}`, {
      headers: { Authorization: `Bearer ${access}` }, signal: AbortSignal.timeout(9000),
    });
    if (response.status === 401 || response.status === 403) throw new GoogleCalendarError("reconnect_required", 409);
    if (!response.ok) throw new GoogleCalendarError("calendar_error");
    const page: { items?: T[]; nextPageToken?: string } = await response.json();
    rows.push(...(page[field] ?? []));
    nextPageToken = page.nextPageToken;
    if (nextPageToken) params.set("pageToken", nextPageToken);
  } while (nextPageToken);
  return rows;
}

export type Calendar = { id: string; summary?: string; summaryOverride?: string; backgroundColor?: string; accessRole?: string; primary?: boolean };

export function readCalendars(access: string) {
  return readGooglePages<Calendar>(`${CALENDAR}/users/me/calendarList`, access,
    new URLSearchParams({ showHidden: "true", maxResults: "250" }), "items");
}

export async function importGoogleAgenda(access: string, start: string, end: string) {
  const warnings: string[] = [];
  let calendars: Calendar[];
  try {
    calendars = await readCalendars(access);
  } catch (error) {
    if (!(error instanceof GoogleCalendarError) || error.message !== "reconnect_required") throw error;
    calendars = [{ id: "primary", summary: "Google Agenda", primary: true }];
    warnings.push("Reconecte o Google Agenda para incluir os outros calendários da conta.");
  }
  calendars.sort((a, b) => Number(!!b.primary) - Number(!!a.primary));
  const results = await Promise.allSettled(calendars.map(async (calendar) => {
    const events = await readGooglePages<GoogleEvent>(
      `${CALENDAR}/calendars/${encodeURIComponent(calendar.id)}/events`, access,
      new URLSearchParams({
        timeMin: new Date(start).toISOString(), timeMax: new Date(end).toISOString(),
        singleEvents: "true", orderBy: "startTime", maxResults: "250",
        fields: "nextPageToken,items(id,iCalUID,originalStartTime,htmlLink,summary,description,location,start,end,extendedProperties/private)",
      }), "items");
    return events.map((event) => ({
      ...event,
      calendarName: calendar.summaryOverride || calendar.summary || "Google Agenda",
      calendarColor: calendar.backgroundColor,
    }));
  }));
  const imports = new Map<string, GoogleEvent>();
  for (const result of results) {
    if (result.status === "rejected") {
      warnings.push("Não foi possível ler alguns calendários do Google.");
      continue;
    }
    for (const event of result.value) {
      const slot = event.originalStartTime ?? event.start;
      const key = event.iCalUID ? `${event.iCalUID}:${slot?.dateTime || slot?.date || ""}` : event.id;
      if (!imports.has(key)) imports.set(key, event);
    }
  }
  if (results.length && results.every((result) => result.status === "rejected")) {
    warnings.push("Se a autorização expirou, reconecte a conta em Perfil → Conexões.");
  }

  return { events: [...imports.values()], warnings: [...new Set(warnings)] };
}
