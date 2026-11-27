import { TASK_CATEGORIES as LABELS } from "./planningCategories.ts";
import { admin } from "./common.ts";
import { GoogleCalendarError, googleAccessToken, insertGoogleEvent, type GoogleEventInput } from "./googleCalendar.ts";

const PAGE = 15;


export async function exportGoogleAgenda(userId: string, offset: number, timeZone: string, period?: { start: string; end: string }, known = new Set<string>()) {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new GoogleCalendarError("invalid_offset", 400);
  let date: Intl.DateTimeFormat;
  try {
    date = new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  } catch { throw new GoogleCalendarError("invalid_time_zone", 400); }
  const access = await googleAccessToken(userId);
  if (!access) return null;
  const db = admin();
  const tasks = db.from("tasks").select("id,title,notes,due_at,category,priority,completed_at,remind_minutes_before")
    .eq("user_id", userId).is("deleted_at", null).not("due_at", "is", null);
  const events = db.from("calendar_events").select("id,title,description,starts_at,ends_at,all_day,category,alarm_minutes_before")
    .eq("user_id", userId).is("deleted_at", null).is("google_event_id", null).neq("source", "google");
  if (period) {
    tasks.gte("due_at", period.start).lt("due_at", period.end);
    events.gte("starts_at", period.start).lt("starts_at", period.end);
  }
  const [localTasks, localEvents] = await Promise.all([
    tasks.order("id").range(offset, offset + PAGE - 1),
    events.order("id").range(offset, offset + PAGE - 1),
  ]);
  if (localTasks.error || localEvents.error) throw new GoogleCalendarError("export_query_failed");
  const idFor = (prefix: string, id: string) => prefix + id.replaceAll("-", "");
  const items: GoogleEventInput[] = [
    ...localTasks.data.map((task) => ({
      exportId: idFor("dbt", task.id),
      title: task.title,
      start: task.due_at,
      end: new Date(Date.parse(task.due_at) + 15 * 60_000).toISOString(),
      description: [task.notes, LABELS[task.category] && `Categoria: ${LABELS[task.category]}`,
        task.priority && `Prioridade: ${({ high: "Alta", medium: "Média", low: "Baixa" } as Record<string, string>)[task.priority] ?? task.priority}`,
        task.completed_at ? "Tarefa concluída no Digital Brain" : "Tarefa do Digital Brain"].filter(Boolean).join("\n"),
      category: task.category,
      reminderMinutes: task.completed_at ? null : task.remind_minutes_before,
    })),
    ...localEvents.data.map((event) => ({
      exportId: idFor("dbe", event.id),
      title: event.title,
      start: event.all_day ? date.format(new Date(event.starts_at)) : event.starts_at,
      end: event.all_day && event.ends_at ? date.format(new Date(event.ends_at)) : event.ends_at,
      allDay: event.all_day,
      description: [event.description, LABELS[event.category] && `Categoria: ${LABELS[event.category]}`].filter(Boolean).join("\n"),
      category: event.category,
      reminderMinutes: event.alarm_minutes_before,
    })),
  ];
  let sent = 0;
  let failed = 0;
  const pending = items.filter((item) => !known.has(item.exportId!));
  for (let index = 0; index < pending.length; index += 4) {
    const batch = await Promise.allSettled(pending.slice(index, index + 4).map((item) => insertGoogleEvent(access, item)));
    for (const result of batch) {
      if (result.status === "rejected") {
        if (result.reason instanceof GoogleCalendarError && result.reason.status === 409) throw result.reason;
        failed++;
      } else if (!result.value.existing) sent++;
    }
  }
  return {
    sent,
    failed,
    next: localTasks.data.length === PAGE || localEvents.data.length === PAGE ? offset + PAGE : null,
  };
}
