// Edge Function "neural" — o cérebro do assistente Neural do Digital Brain.
// Recebe a conversa, chama o Gemini (com reserva em outros modelos e no Groq),
// executa as ferramentas (gravando no banco COMO o usuário logado, respeitando o RLS)
// e devolve a resposta + "cards" das ações feitas.
//
// Segredos necessários (Supabase > Edge Functions > Secrets):
//   GEMINI_API_KEY   (obrigatório)
//   GROQ_API_KEY     (opcional, última reserva)
//   NEURAL_MODELS    (opcional) lista separada por vírgula, ex.: gemini-3.1-flash-lite,gemini-3.5-flash-lite
//   GROQ_MODEL       (opcional) padrão: llama-3.3-70b-versatile

import { createClient } from "npm:@supabase/supabase-js@2";
import { createGoogleEvent, GoogleCalendarError } from "../_shared/googleCalendar.ts";
import { findExercises, type Exercise } from "./exerciseSearch.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Ordem da fila: os "Lite" primeiro (500 pedidos/dia no plano grátis), depois os maiores.
const DEFAULT_MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-2.5-flash-lite"];
const MODELS = (Deno.env.get("NEURAL_MODELS") ?? DEFAULT_MODELS.join(","))
  .split(",").map((s) => s.trim()).filter(Boolean);
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") ?? "llama-3.3-70b-versatile";

// Modelo que acabou de dar 429: pula por alguns minutos (vale enquanto a instância da função viver)
const cooldown = new Map<string, number>();
const COOLDOWN_MS = 3 * 60_000;

/* ------------------------------------------------------------------ */
/* Ferramentas (o que o Neural pode fazer)                             */
/* ------------------------------------------------------------------ */

const CATEGORIAS = ["Alimentação", "Transporte", "Lazer", "Moradia", "Saúde", "Educação", "Compras", "Assinaturas", "Trabalho", "Outros"];

const EXERCISE_SEARCH = {
  name: "buscar_exercicios",
  description: "Busca exercícios da ExerciseDB e do usuário para sugerir ou montar um treino. Use antes de escolher exercícios.",
  parameters: {
    type: "object",
    properties: {
      grupos: { type: "array", items: { type: "string" }, description: "Grupos do catálogo, ex.: chest, back, shoulders, biceps, triceps, quads, hamstrings, glutes, calves, core. Omita para buscar qualquer grupo." },
      equipamentos: { type: "array", items: { type: "string" }, description: "Equipamentos permitidos em inglês, ex.: dumbbell, barbell, cable, bodyweight, resistance band, leverage machine. Omita se o usuário não restringir." },
      busca: { type: "string", description: "Termos opcionais para priorizar movimentos específicos, em português ou inglês." },
    },
  },
};

const TOOLS = [
  EXERCISE_SEARCH,
  {
    name: "registrar_transacao",
    description: "Registra um gasto (despesa) ou uma entrada de dinheiro (receita) nas finanças do usuário.",
    parameters: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["despesa", "receita"] },
        valor: { type: "number", description: "Valor em reais, positivo. Ex.: 50 ou 12.9" },
        descricao: { type: "string", description: "Onde/o quê. Ex.: McDonald's, Uber, Salário" },
        categoria: { type: "string", enum: CATEGORIAS },
        natureza: {
          type: "string",
          enum: ["fixo", "extra", "lazer", "assinatura", "salario", "outro"],
          description: "fixo = conta recorrente (aluguel, luz); lazer = diversão/comida fora; assinatura = streaming etc.; salario = só para receita de salário",
        },
        data: { type: "string", description: "AAAA-MM-DD. Se omitido, é hoje." },
      },
      required: ["tipo", "valor", "descricao"],
    },
  },
  {
    name: "criar_evento",
    description: "Cria um compromisso no calendário do app (reunião, consulta, aniversário...).",
    parameters: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        inicio: { type: "string", description: "Data e hora de início em ISO 8601 com fuso. Ex.: 2026-11-24T15:00:00-03:00" },
        fim: { type: "string", description: "Fim em ISO 8601 com fuso (opcional)" },
        categoria: { type: "string", enum: ["work", "meeting", "health", "personal"], description: "work=trabalho, meeting=reunião, health=saúde, personal=pessoal" },
        lembrete_minutos: { type: "integer", description: "Minutos de antecedência do alarme. Padrão 10." },
        descricao: { type: "string" },
      },
      required: ["titulo", "inicio"],
    },
  },
  {
    name: "criar_tarefa",
    description: "Cria uma tarefa (to-do) com prazo opcional.",
    parameters: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        prazo: { type: "string", description: "ISO 8601 com fuso (opcional)" },
        prioridade: { type: "string", enum: ["low", "medium", "high"] },
        categoria: { type: "string", enum: ["work", "personal", "fitness", "mindset"] },
        lembrete_minutos: { type: "integer" },
        notas: { type: "string" },
      },
      required: ["titulo"],
    },
  },
  {
    name: "marcar_habito",
    description: "Marca um hábito do usuário como concluído HOJE (ex.: leitura, meditação). Use o nome do hábito.",
    parameters: {
      type: "object",
      properties: { nome: { type: "string", description: "Nome (ou parte do nome) do hábito" } },
      required: ["nome"],
    },
  },
  {
    name: "registrar_agua",
    description: "Soma água bebida hoje, em mililitros.",
    parameters: {
      type: "object",
      properties: { ml: { type: "integer", description: "Ex.: copo = 250, garrafa pequena = 500, 1 litro = 1000" } },
      required: ["ml"],
    },
  },
  {
    name: "criar_treino",
    description: "Cria uma rotina de treino salva no app. Use SOMENTE exercícios retornados pela busca, pelo id.",
    parameters: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Ex.: Treino A — Peito e Tríceps" },
        foco: { type: "string", description: "Ex.: Peito, Pernas, Full body" },
        observacoes: { type: "string" },
        exercicios: {
          type: "array",
          description: "De 3 a 8 exercícios, na ordem de execução",
          items: {
            type: "object",
            properties: {
              exercicio_id: { type: "string", description: "id da lista de exercícios" },
              series: { type: "integer" },
              repeticoes: { type: "integer" },
              descanso_segundos: { type: "integer" },
            },
            required: ["exercicio_id", "series", "repeticoes"],
          },
        },
      },
      required: ["nome", "exercicios"],
    },
  },
];

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

type Msg = { role: "user" | "assistant"; text: string };
type Call = { name: string; args: Record<string, unknown> };
type Undo =
  | { table: "transactions" | "calendar_events" | "tasks" | "workout_routines"; id: string }
  | { table: "habit_logs"; habit_id: string; log_date: string }
  | { table: "water_logs"; id: string; log_date: string };
type Action = {
  kind: "transaction" | "event" | "task" | "habit" | "water" | "routine";
  title: string;
  subtitle?: string;
  amount?: string;
  badge?: string;
  link?: string;
  undo?: Undo;
};

class UserError extends Error {}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pad = (n: number) => String(n).padStart(2, "0");
const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

function tzInfo(tzOffsetMinutes: number) {
  const off = Math.max(-840, Math.min(840, Math.round(tzOffsetMinutes || 0)));
  const local = new Date(Date.now() - off * 60_000); // "relógio de parede" do usuário (lido com getUTC*)
  const sign = off <= 0 ? "+" : "-";
  const abs = Math.abs(off);
  const offStr = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  const date = `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
  const time = `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
  return { off, offStr, date, time, weekday: DIAS[local.getUTCDay()] };
}

function parseWhen(value: unknown, offStr: string): Date {
  if (typeof value !== "string" || !value.trim()) throw new UserError("Não entendi a data e a hora. Pode repetir?");
  let s = value.trim();
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) s = `${s.length === 16 ? s + ":00" : s}${offStr}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new UserError("Não entendi a data e a hora. Pode repetir?");
  return d;
}

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const str = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/* ------------------------------------------------------------------ */
/* Execução das ferramentas                                            */
/* ------------------------------------------------------------------ */

function sessionClient(auth: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
}

type Ctx = {
  db: ReturnType<typeof sessionClient>;
  tz: ReturnType<typeof tzInfo>;
  exercises: Map<string, Exercise>;
  userId: string;
  habits: { id: string; name: string }[];
};

const KIND: Record<string, string> = {
  fixo: "fixed", extra: "extra", lazer: "leisure", assinatura: "subscription", salario: "salary", outro: "other",
};

async function runTool(call: Call, ctx: Ctx): Promise<Action> {
  const a = call.args ?? {};
  const { db, tz } = ctx;

  switch (call.name) {
    case "registrar_transacao": {
      const valor = Number(a.valor);
      if (!Number.isFinite(valor) || valor <= 0 || valor > 1_000_000_000) throw new UserError("Qual foi o valor?");
      const isIncome = a.tipo === "receita";
      let kind = KIND[str(a.natureza, 20)] ?? (isIncome ? "extra" : "other");
      if (isIncome && !["salary", "extra", "other"].includes(kind)) kind = "extra";
      if (!isIncome && kind === "salary") kind = "other";
      const descricao = str(a.descricao) || (isIncome ? "Receita" : "Despesa");
      const categoria = CATEGORIAS.includes(str(a.categoria, 30)) ? str(a.categoria, 30) : "Outros";
      const dataStr = /^\d{4}-\d{2}-\d{2}$/.test(str(a.data, 10)) ? str(a.data, 10) : tz.date;

      const { data, error } = await db.from("transactions").insert({
        type: isIncome ? "income" : "expense", kind, amount: valor, description: descricao,
        category: categoria, occurred_on: dataStr, is_recurring: false, source: "chatbot",
      }).select("id").single();
      if (error) throw error;
      return {
        kind: "transaction", title: descricao, subtitle: categoria,
        amount: `${isIncome ? "+" : "-"} ${brl(valor)}`, badge: isIncome ? "Receita" : "Despesa",
        link: "/finance", undo: { table: "transactions", id: data.id },
      };
    }

    case "criar_evento": {
      const start = parseWhen(a.inicio, tz.offStr);
      const end = a.fim ? parseWhen(a.fim, tz.offStr) : null;
      if (end && end <= start) throw new UserError("O fim do evento precisa ser depois do início.");
      const cat = ["work", "meeting", "health", "personal"].includes(str(a.categoria, 10)) ? str(a.categoria, 10) : "personal";
      const alarm = a.lembrete_minutos === undefined ? 10 : clampInt(a.lembrete_minutos, 0, 10080, 10);
      const titulo = str(a.titulo) || "Compromisso";
      let googleEvent;
      try {
        googleEvent = await createGoogleEvent(ctx.userId, {
          title: titulo, description: str(a.descricao, 500) || null, start: start.toISOString(),
          end: end?.toISOString(), category: cat, reminderMinutes: alarm || null,
        });
      } catch (error) {
        if (error instanceof GoogleCalendarError && error.message === "reconnect_required") {
          throw new UserError("Reconecte o Google Agenda em Perfil → Conexões e tente novamente.");
        }
        throw new UserError("Não consegui salvar o evento no Google Agenda. Tente novamente.");
      }
      const when = new Date(start.getTime() - tz.off * 60_000);
      const date = `${when.getUTCFullYear()}-${pad(when.getUTCMonth() + 1)}-${pad(when.getUTCDate())}`;
      const link = `/calendar?view=day&date=${date}`;
      if (googleEvent) {
        return { kind: "event", title: titulo, subtitle: `${date} às ${pad(when.getUTCHours())}:${pad(when.getUTCMinutes())}`,
          badge: "Google Agenda", link };
      }
      const { data, error } = await db.from("calendar_events").insert({
        title: titulo, description: str(a.descricao, 500) || null, starts_at: start.toISOString(),
        ends_at: end ? end.toISOString() : null, all_day: false,
        alarm_minutes_before: alarm > 0 ? alarm : null, source: "chatbot", category: cat,
      }).select("id").single();
      if (error) throw error;
      const label = `${DIAS[when.getUTCDay()]}, ${pad(when.getUTCDate())}/${pad(when.getUTCMonth() + 1)} às ${pad(when.getUTCHours())}:${pad(when.getUTCMinutes())}`;
      return {
        kind: "event", title: titulo, subtitle: label,
        badge: alarm > 0 ? `Alarme ${alarm} min antes` : undefined,
        link: `/calendar?view=day&date=${when.getUTCFullYear()}-${pad(when.getUTCMonth() + 1)}-${pad(when.getUTCDate())}`, undo: { table: "calendar_events", id: data.id },
      };
    }

    case "criar_tarefa": {
      const due = a.prazo ? parseWhen(a.prazo, tz.offStr) : null;
      const prio = ["low", "medium", "high"].includes(str(a.prioridade, 10)) ? str(a.prioridade, 10) : "medium";
      const cat = ["work", "personal", "fitness", "mindset"].includes(str(a.categoria, 10)) ? str(a.categoria, 10) : "personal";
      const titulo = str(a.titulo) || "Tarefa";
      const { data, error } = await db.from("tasks").insert({
        title: titulo, notes: str(a.notas, 500) || null, due_at: due ? due.toISOString() : null,
        category: cat, priority: prio,
        remind_minutes_before: due && a.lembrete_minutos !== undefined ? clampInt(a.lembrete_minutos, 0, 10080, 10) : null,
      }).select("id").single();
      if (error) throw error;
      let sub = "Sem prazo";
      if (due) {
        const w = new Date(due.getTime() - tz.off * 60_000);
        sub = `${pad(w.getUTCDate())}/${pad(w.getUTCMonth() + 1)} às ${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}`;
      }
      return { kind: "task", title: titulo, subtitle: sub, badge: "Tarefa", link: "/routine?tab=tasks", undo: { table: "tasks", id: data.id } };
    }

    case "marcar_habito": {
      const alvo = norm(str(a.nome, 80));
      if (!alvo) throw new UserError("Qual hábito você quer marcar?");
      const hit = ctx.habits.find((h) => norm(h.name) === alvo) ?? ctx.habits.find((h) => norm(h.name).includes(alvo) || alvo.includes(norm(h.name)));
      if (!hit) {
        const lista = ctx.habits.slice(0, 6).map((h) => h.name).join(", ");
        throw new UserError(`Não achei o hábito “${str(a.nome, 40)}”.${lista ? ` Seus hábitos: ${lista}.` : " Você ainda não tem hábitos cadastrados."}`);
      }
      const { data: ja } = await db.from("habit_logs").select("habit_id").eq("habit_id", hit.id).eq("log_date", tz.date).limit(1);
      if (ja && ja.length) throw new UserError(`“${hit.name}” já estava marcado hoje. ✅`);
      const { error } = await db.from("habit_logs").insert({ habit_id: hit.id, log_date: tz.date });
      if (error) throw error;
      return { kind: "habit", title: hit.name, subtitle: "Concluído hoje", badge: "Hábito", link: "/routine?tab=habits", undo: { table: "habit_logs", habit_id: hit.id, log_date: tz.date } };
    }

    case "registrar_agua": {
      const ml = clampInt(a.ml, 1, 5000, 0);
      if (!ml) throw new UserError("Quantos ml você bebeu?");
      const { data, error } = await db.from("water_logs").insert({ log_date: tz.date, ml }).select("id").single();
      if (error) throw error;
      // Mesma regra do app: bateu a meta do dia => conclui o hábito de água
      const [{ data: logs }, { data: st }, { data: wh }] = await Promise.all([
        db.from("water_logs").select("ml").eq("log_date", tz.date),
        db.from("user_settings").select("water_goal_ml").maybeSingle(),
        db.from("habits").select("id").eq("icon", "water").is("deleted_at", null).is("archived_at", null).order("created_at").limit(1),
      ]);
      const total = (logs ?? []).reduce((s: number, l: { ml: number }) => s + l.ml, 0);
      const meta = Number(st?.water_goal_ml ?? 2500);
      const habitId = wh?.[0]?.id as string | undefined;
      if (habitId && total >= meta) {
        const { data: j } = await db.from("habit_logs").select("habit_id").eq("habit_id", habitId).eq("log_date", tz.date).limit(1);
        if (!j?.length) await db.from("habit_logs").insert({ habit_id: habitId, log_date: tz.date });
      }
      const fmt = (n: number) => `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L`;
      return { kind: "water", title: `+${ml} ml de água`, subtitle: `Hoje: ${fmt(total)} de ${fmt(meta)}`, badge: "Água", undo: { table: "water_logs", id: data.id, log_date: tz.date } };
    }

    case "criar_treino": {
      const lista = Array.isArray(a.exercicios) ? (a.exercicios as Record<string, unknown>[]) : [];
      const ids = lista.map((item) => String(item?.exercicio_id ?? ""));
      if (!ids.length || ids.length > 8 || ids.some((id) => !ctx.exercises.has(id)) || new Set(ids).size !== ids.length) {
        throw new UserError("Não consegui validar os exercícios do treino. Pode pedir para eu montar novamente?");
      }
      const rows = lista.map((e, i) => {
        return {
          exercise_id: ids[i], position: i,
          target_sets: clampInt(e.series, 1, 10, 3),
          target_reps: clampInt(e.repeticoes, 1, 60, 12),
          rest_seconds: clampInt(e.descanso_segundos, 15, 600, 90),
        };
      });
      const imports = ids.map((id) => ctx.exercises.get(id)!).filter((exercise) => exercise.external_id);
      if (imports.length) {
        const { error: importError } = await db.from("exercises").upsert(imports.map((exercise) => ({
          id: exercise.id, user_id: ctx.userId, name: exercise.name,
          muscle_group: exercise.muscle_group, equipment: exercise.equipment,
        })), { onConflict: "id", ignoreDuplicates: true });
        if (importError) throw importError;
        const { error: mediaError } = await db.from("exercise_media_links").upsert(imports.map((exercise) => ({
          user_id: ctx.userId, exercise_id: exercise.id, external_id: exercise.external_id,
        })), { onConflict: "user_id,exercise_id", ignoreDuplicates: true });
        if (mediaError) throw mediaError;
      }
      const nome = str(a.nome, 80) || "Treino do Neural";
      const { data: r, error } = await db.from("workout_routines").insert({
        name: nome, focus: str(a.foco, 60) || null, notes: str(a.observacoes, 500) || null, tags: ["neural"],
      }).select("id").single();
      if (error) throw error;
      const { error: e2 } = await db.from("routine_exercises").insert(rows.map((x) => ({ ...x, routine_id: r.id })));
      if (e2) {
        await db.from("workout_routines").update({ deleted_at: new Date().toISOString() }).eq("id", r.id);
        throw e2;
      }
      const nomes = rows.map((x) => ctx.exercises.get(x.exercise_id)!.name).slice(0, 4).join(", ");
      return {
        kind: "routine", title: nome, subtitle: `${rows.length} exercícios: ${nomes}${rows.length > 4 ? "…" : ""}`,
        badge: "Treino", link: "/workouts", undo: { table: "workout_routines", id: r.id },
      };
    }

    default:
      throw new UserError("Ainda não sei fazer isso.");
  }
}

/* ------------------------------------------------------------------ */
/* Chamada dos modelos (Gemini em fila + Groq de reserva)              */
/* ------------------------------------------------------------------ */

type LlmResult = { text: string; calls: Call[]; model: string };
type GeminiPart = { text?: string; thought?: boolean; functionCall?: { name: string; args?: Call["args"] } };
type GroqCall = { function: { name: string; arguments?: string } };

async function callGemini(model: string, system: string, msgs: Msg[], tools: typeof TOOLS): Promise<LlmResult> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY não configurada");
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: system }] },
    contents: msgs.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.text }] })),
    tools: [{ functionDeclarations: tools }],
    toolConfig: { functionCallingConfig: { mode: "AUTO" } },
    generationConfig: { temperature: 0.3, maxOutputTokens: 1200 },
  };
  const thinking = Deno.env.get("NEURAL_THINKING"); // opcional: "low" | "medium" | "high"
  if (thinking) (body.generationConfig as Record<string, unknown>).thinkingConfig = { thinkingLevel: thinking };

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 429) cooldown.set(model, Date.now() + COOLDOWN_MS);
    throw new Error(`${model} HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const parts: GeminiPart[] = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text).join("").trim();
  const calls = parts.flatMap(({ functionCall }) => functionCall ? [{ name: functionCall.name, args: functionCall.args ?? {} }] : []);
  if (!text && !calls.length) throw new Error(`${model} respondeu vazio`);
  return { text, calls, model };
}

async function callGroq(system: string, msgs: Msg[], tools: typeof TOOLS): Promise<LlmResult> {
  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) throw new Error("GROQ_API_KEY não configurada");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: GROQ_MODEL, temperature: 0.3, max_tokens: 1200,
      messages: [{ role: "system", content: system }, ...msgs.map((m) => ({ role: m.role, content: m.text }))],
      tools: tools.map((t) => ({ type: "function", function: t })),
      tool_choice: "auto",
    }),
  });
  if (!res.ok) throw new Error(`groq HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const msg = (await res.json())?.choices?.[0]?.message ?? {};
  const calls: Call[] = (msg.tool_calls ?? []).map((c: GroqCall) => {
    let args = {};
    try { args = JSON.parse(c.function.arguments || "{}"); } catch { /* argumentos inválidos: ferramenta vai pedir o dado */ }
    return { name: c.function.name, args };
  });
  const text = String(msg.content ?? "").trim();
  if (!text && !calls.length) throw new Error("groq respondeu vazio");
  return { text, calls, model: `groq:${GROQ_MODEL}` };
}

async function askModels(system: string, msgs: Msg[], tools: typeof TOOLS): Promise<LlmResult> {
  const erros: string[] = [];
  for (const m of MODELS) {
    if ((cooldown.get(m) ?? 0) > Date.now()) continue;
    try { return await callGemini(m, system, msgs, tools); } catch (e) { erros.push(String((e as Error).message)); }
  }
  if (Deno.env.get("GROQ_API_KEY")) {
    try { return await callGroq(system, msgs, tools); } catch (e) { erros.push(String((e as Error).message)); }
  }
  console.error("Todos os modelos falharam:", erros.join(" | "));
  throw new Error("Todos os modelos estão indisponíveis agora.");
}

/* ------------------------------------------------------------------ */
/* Servidor                                                            */
/* ------------------------------------------------------------------ */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  // 1) Quem é o usuário? (o app manda o token da sessão; o RLS do banco faz o resto)
  const auth = req.headers.get("Authorization") ?? "";
  const db = sessionClient(auth);
  const { data: u, error: authError } = await db.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (authError || !u?.user) return json({ error: "Faça login para falar com o Neural." }, 401);

  // 2) Entrada
  let input: { messages?: Msg[]; tzOffsetMinutes?: number };
  try { input = await req.json(); } catch { return json({ error: "Pedido inválido." }, 400); }
  const msgs = (Array.isArray(input.messages) ? input.messages : [])
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.text === "string" && m.text.trim())
    .slice(-10)
    .map((m) => ({ role: m.role, text: m.text.trim().slice(0, 1000) })) as Msg[];
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return json({ error: "Mensagem vazia." }, 400);

  const tz = tzInfo(Number(input.tzOffsetMinutes));
  const hb = await db.from("habits").select("id, name").is("deleted_at", null).is("archived_at", null).limit(60);
  const ctx: Ctx = { db, tz, userId: u.user.id, exercises: new Map(), habits: hb.data ?? [] };

  const system = `Você é o Neural, o assistente de IA do app Digital Brain (um "segundo cérebro" com finanças, calendário, tarefas, hábitos, água e treinos). Fale SEMPRE em português do Brasil, de forma simpática, curta e direta (no máximo 2 frases).

Agora: ${tz.weekday}, ${tz.date} ${tz.time} (fuso ${tz.offStr}).

REGRAS
- Quando o usuário pedir para registrar ou criar algo, USE as ferramentas. Nunca diga que fez algo sem chamar a ferramenta.
- Uma mensagem pode ter várias ações: chame todas as ferramentas necessárias.
- Dinheiro em reais. "gastei/paguei/comprei" = despesa; "recebi/ganhei/caiu na conta" = receita.
- Converta "hoje", "amanhã", "sexta", "às 18h" usando a data e hora de agora e envie datas em ISO 8601 com o fuso ${tz.offStr}.
- Se faltar um dado essencial (valor do gasto, horário do evento), faça UMA pergunta curta em vez de chutar.
- Alarme padrão de evento: 10 minutos antes, a menos que o usuário peça outro.
- Para sugerir ou montar um treino, chame buscar_exercicios com os grupos musculares e equipamentos adequados ao pedido. Faça buscas separadas se o usuário combinar focos diferentes.
- Se não for um pedido de ação, responda normalmente, com brevidade.

HÁBITOS DO USUÁRIO: ${ctx.habits.map((h) => h.name).join("; ") || "(nenhum)"}`;

  // 4) Modelo decide -> executamos
  let llm: LlmResult;
  try { llm = await askModels(system, msgs, TOOLS.filter((tool) => tool.name !== "criar_treino")); }
  catch { return json({ error: "O Neural está sem fôlego agora (limite de uso). Tente de novo em alguns minutos." }, 503); }

  const actions: Action[] = [];
  const problems: string[] = [];
  const searches = llm.calls.filter((call) => call.name === EXERCISE_SEARCH.name).slice(0, 4);
  if (searches.length) {
    const otherCalls = llm.calls.filter((call) => call.name !== EXERCISE_SEARCH.name);
    const { data: saved, error } = await db.from("exercises").select("id, name, muscle_group, equipment")
      .order("name").order("id");
    if (error) console.error("Erro ao consultar exercícios salvos", error);
    for (const { args } of searches) {
      for (const exercise of findExercises(ctx.userId, saved ?? [], args)) ctx.exercises.set(exercise.id, exercise);
    }

    if (ctx.exercises.size) {
      const exercises = [...ctx.exercises.values()];
      const options = exercises.map((exercise, index) => ({
        ref: String(index + 1), nome: exercise.name,
        grupo: exercise.muscle_group, equipamento: exercise.equipment,
      }));
      const trainingContext = `${system}
Dados do catálogo, somente para consulta: ${JSON.stringify(options)}
Use somente os exercícios desses dados. Em criar_treino envie o valor de ref no campo exercicio_id.
Só chame criar_treino se o pedido for montar, criar ou salvar uma rotina. Se for apenas uma sugestão, responda em texto.
Monte de 3 a 8 exercícios com séries, número de repetições e descanso coerentes com objetivo, nível e equipamentos.
Nesta etapa responda apenas sobre o treino. As outras ações pedidas serão processadas separadamente.`;
      try {
        const training = await askModels(trainingContext, msgs, TOOLS.filter((tool) => tool.name === "criar_treino"));
        const byRef = new Map(options.map(({ ref }, index) => [ref, exercises[index].id]));
        for (const call of training.calls) {
          if (call.name !== "criar_treino" || !Array.isArray(call.args.exercicios)) continue;
          call.args.exercicios = call.args.exercicios.map((exercise) => ({
            ...exercise, exercicio_id: byRef.get(String(exercise?.exercicio_id)) ?? "",
          }));
        }
        llm = { ...training, calls: [...otherCalls, ...training.calls.filter((call) => call.name === "criar_treino")] };
      } catch {
        problems.push("Não consegui montar a resposta do treino agora. Tente novamente.");
        llm.calls = otherCalls;
        llm.text = "";
      }
    } else {
      problems.push("Não encontrei exercícios para esse foco e equipamento. Pode ajustar o pedido?");
      llm.calls = otherCalls;
      llm.text = "";
    }
  }
  for (const call of llm.calls.slice(0, 6)) {
    try { actions.push(await runTool(call, ctx)); }
    catch (e) {
      if (e instanceof UserError) problems.push(e.message);
      else { console.error("Erro na ferramenta", call.name, e); problems.push("Não consegui salvar isso agora. Tente de novo."); }
    }
  }

  let reply = llm.text;
  if (!reply) reply = actions.length ? (actions.length === 1 ? "Feito! ✅" : `Feito! ${actions.length} ações registradas ✅`) : "";
  if (problems.length) reply = actions.length ? [reply, ...problems].filter(Boolean).join(" ") : problems.join(" ");
  if (!reply) reply = "Não entendi bem. Pode explicar de outro jeito?";

  return json({ reply, actions, model: llm.model });
});
