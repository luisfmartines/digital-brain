import { GoogleCalendarError, type GoogleEvent } from "./googleCalendar.ts";

const CALENDAR = "https://www.googleapis.com/calendar/v3";
const TASKS = "https://tasks.googleapis.com/tasks/v1";

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

type Calendar = { id: string; summary?: string; summaryOverride?: string; backgroundColor?: string; accessRole?: string; primary?: boolean };
type TaskList = { id: string; title: string };
type GoogleTask = { id: string; title?: string; notes?: string; due?: string; status?: string; deleted?: boolean };

export async function importGoogleAgenda(access: string, start: string, end: string, firstDay: string, untilDay: string) {
  const warnings: string[] = [];
  let calendars: Calendar[];
  try {
    calendars = await readGooglePages<Calendar>(`${CALENDAR}/users/me/calendarList`, access,
      new URLSearchParams({ showHidden: "true", maxResults: "250" }), "items");
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

  const tasks: GoogleEvent[] = [];
  try {
    const lists = await readGooglePages<TaskList>(`${TASKS}/users/@me/lists`, access, new URLSearchParams(), "items");
    for (const list of lists) {
      const entries = await readGooglePages<GoogleTask>(`${TASKS}/lists/${encodeURIComponent(list.id)}/tasks`, access,
        new URLSearchParams({ dueMin: `${firstDay}T00:00:00Z`, dueMax: `${untilDay}T00:00:00Z`, showCompleted: "true", showHidden: "true" }), "items");
      for (const task of entries) {
        const date = task.due?.slice(0, 10);
        if (!date || date < firstDay || date >= untilDay || task.deleted) continue;
        tasks.push({ id: `task:${list.id}:${task.id}`, summary: task.title, description: task.notes,
          start: { date }, calendarName: list.title, googleTask: true, completed: task.status === "completed" });
      }
    }
  } catch {
    warnings.push("As listas do Google Tasks não puderam ser lidas. Confira a autorização e a Google Tasks API.");
  }
  return { events: [...imports.values(), ...tasks], warnings: [...new Set(warnings)] };
}
