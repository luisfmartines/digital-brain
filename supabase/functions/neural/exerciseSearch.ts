import catalog from "./exercise-catalog.json" with { type: "json" };

export interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string | null;
  external_id?: string;
}

const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const indexed = catalog.map((exercise) => ({
  ...exercise,
  terms: fold(`${exercise.name} ${exercise.original}`),
}));
const externalIds = new Set(indexed.map(({ external_id }) => external_id));

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, 10).map(fold) : [];
}

export function findExercises(userId: string, saved: Exercise[], filters: Record<string, unknown>) {
  const groups = strings(filters.grupos);
  const equipment = strings(filters.equipamentos).map((item) => item === "band" ? "resistance band" : item);
  const terms = typeof filters.busca === "string" ? fold(filters.busca).slice(0, 100).split(/\s+/).filter((term) => term.length > 2) : [];
  const savedIds = new Set(saved.map(({ id }) => id));
  const candidates = [
    ...saved.map((exercise) => {
      const prefix = `${userId}:`;
      const externalId = exercise.id.startsWith(prefix) ? exercise.id.slice(prefix.length) : "";
      return {
        ...exercise, terms: fold(exercise.name), saved: true,
        external_id: externalIds.has(externalId) ? externalId : undefined,
      };
    }),
    ...indexed.map((exercise) => ({ ...exercise, id: `${userId}:${exercise.external_id}`, saved: false }))
      .filter(({ id }) => !savedIds.has(id)),
  ];
  const matches = candidates
    .filter((exercise) => !groups.length || groups.includes(fold(exercise.muscle_group)))
    .filter((exercise) => !equipment.length || (exercise.equipment ?? "").split(",").map(fold)
      .every((item) => equipment.includes(item)))
    .map((exercise) => ({
      exercise,
      score: terms.filter((term) => exercise.terms.includes(term)).length * 10
        + Number(exercise.saved) * 2 - exercise.name.length / 120,
    }))
    .sort((a, b) => b.score - a.score);

  // Reserve space for each muscle group when the request covers multiple groups.
  const byGroup = new Map<string, Exercise[]>();
  for (const { exercise } of matches) {
    const group = byGroup.get(exercise.muscle_group) ?? [];
    if (!byGroup.has(exercise.muscle_group)) byGroup.set(exercise.muscle_group, group);
    group.push(exercise);
  }
  const result: Exercise[] = [];
  for (let i = 0; i < 10 && result.length < 48; i++) {
    for (const group of byGroup.values()) {
      if (group[i]) result.push(group[i]);
      if (result.length === 48) break;
    }
  }
  return result;
}
