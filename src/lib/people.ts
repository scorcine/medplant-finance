export type PersonRole = "titular" | "familiar";

export type Person = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  papel: PersonRole;
};

export type FamilyMember = {
  personId: string;
  parentesco: string;
};

export type FamilyGroup = {
  nomeFamilia: string;
  divisao: "igual" | "proporcional" | "titular";
  membros: FamilyMember[];
};

export const PEOPLE_KEY = "medplant-pessoas";
export const FAMILY_KEY = "medplant-familia";

export function loadPeople(): Person[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(PEOPLE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<Partial<Person> & { papel?: string }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((person) => person.id && person.nome)
      .map((person) => ({
        id: person.id as string,
        nome: person.nome as string,
        email: person.email ?? "",
        telefone: person.telefone ?? "",
        papel: person.papel === "familiar" ? "familiar" : "titular",
      }));
  } catch {
    return [];
  }
}

export function savePeople(people: Person[]) {
  localStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
}

export function loadFamily(): FamilyGroup {
  const empty: FamilyGroup = { nomeFamilia: "", divisao: "igual", membros: [] };
  if (typeof window === "undefined") return empty;
  const raw = localStorage.getItem(FAMILY_KEY);
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw) as FamilyGroup;
    return {
      nomeFamilia: parsed.nomeFamilia ?? "",
      divisao: parsed.divisao ?? "igual",
      membros: Array.isArray(parsed.membros) ? parsed.membros : [],
    };
  } catch {
    return empty;
  }
}

export function saveFamily(group: FamilyGroup) {
  localStorage.setItem(FAMILY_KEY, JSON.stringify(group));
}
