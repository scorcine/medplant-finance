import type { Shift, ShiftLocation } from "@/lib/types";
import { parseIcs, type AgendaEvent } from "@/lib/ics";
import { readList, writeList } from "@/lib/records";
import { loadFamily, loadPeople, type Person } from "@/lib/people";

const IMPORTED_KEY = "medplant-agenda-shifts";
const URL_KEY = "medplant-agenda-url";

export type AgendaCalendar = {
  id: string;
  name: string;
  email: string;
  color: string;
  url: string;
};

export const MEMBER_COLORS = ["#7c3aed", "#f97316", "#3b9eff", "#34d399", "#f43f5e"];
const SECRETS_KEY = "medplant-calendar-secret";

export function icalUrlFromEmail(email: string) {
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(email.trim().toLowerCase())}/public/basic.ics`;
}

function memberLabel(person: Person, members: Person[]) {
  const titulares = members.filter((item) => item.papel === "titular");
  if (person.papel === "titular" && titulares.length === 1) return "Meu";
  return person.nome.trim().split(/\s+/)[0] || person.nome;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsTerm(haystack: string, term: string) {
  const needle = normalize(term).trim().replace(/\s+/g, " ");
  if (!needle) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle)}([^a-z0-9]|$)`).test(haystack);
}

export function matchLocation(text: string, list: ShiftLocation[]) {
  const haystack = normalize(text).replace(/\s+/g, " ");
  let best: { location: ShiftLocation; size: number } | undefined;
  for (const location of list) {
    for (const term of [...(location.codes ?? []), location.name]) {
      if (containsTerm(haystack, term) && (!best || term.length > best.size)) {
        best = { location, size: term.length };
      }
    }
  }
  return best?.location;
}

export function rematchImportedShifts(list: ShiftLocation[]) {
  const next = loadImportedShifts().map((shift) => {
    if (!shift.id.startsWith("gcal-")) return shift;
    if (shift.manualLocation && list.some((location) => location.id === shift.locationId)) return shift;
    const location = matchLocation(`${shift.where ?? ""} ${shift.title ?? ""}`, list);
    return { ...shift, locationId: location?.id ?? "", manualLocation: false };
  });
  saveImportedShifts(next);
  return next;
}

export function countMatches(location: ShiftLocation) {
  return loadImportedShifts().filter((shift) => shift.locationId === location.id).length;
}

export function eventsToShifts(
  events: AgendaEvent[],
  list: ShiftLocation[],
  owner?: Pick<AgendaCalendar, "id" | "name" | "color">,
): Shift[] {
  return events.map((event) => {
    const location = matchLocation(`${event.location} ${event.title}`, list);
    return {
      id: owner ? `gcal-${owner.id}-${event.uid}` : `gcal-${event.uid}`,
      date: event.date,
      locationId: location?.id ?? "",
      start: event.start,
      end: event.end,
      paid: false,
      title: event.title,
      where: event.location,
      calendarId: owner?.id,
      ownerName: owner?.name,
      color: owner?.color,
    };
  });
}

export function loadSecretUrls(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(SECRETS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveSecretUrl(personId: string, url: string) {
  const next = { ...loadSecretUrls(), [personId]: url };
  localStorage.setItem(SECRETS_KEY, JSON.stringify(next));
}

export function loadCalendars(): AgendaCalendar[] {
  const people = loadPeople();
  const family = loadFamily();
  const secrets = loadSecretUrls();
  const members = family.membros
    .map((member) => people.find((person) => person.id === member.personId))
    .filter((person): person is Person => Boolean(person?.email));
  return members.map((person, index) => ({
    id: person.id,
    name: memberLabel(person, members),
    email: person.email,
    color: MEMBER_COLORS[index % MEMBER_COLORS.length],
    url: secrets[person.id] ?? "",
  }));
}

const HIDDEN_KEY = "medplant-agenda-ocultos";
const DEFAULT_HIDDEN = ["POSTE ITALIANE"];

export function loadHiddenTitles(): string[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(HIDDEN_KEY);
  if (raw === null) return DEFAULT_HIDDEN;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function saveHiddenTitles(list: string[]) {
  localStorage.setItem(HIDDEN_KEY, JSON.stringify(list));
}

export function isHiddenShift(shift: Pick<Shift, "title" | "where">, hidden = loadHiddenTitles()) {
  if (!shift.title && !shift.where) return false;
  const haystack = normalize(`${shift.title ?? ""} ${shift.where ?? ""}`).replace(/\s+/g, " ");
  return hidden.some((term) => containsTerm(haystack, term));
}

export function hideTitle(title: string) {
  const term = title.trim();
  if (!term) return;
  const current = loadHiddenTitles();
  if (!current.some((item) => normalize(item) === normalize(term))) saveHiddenTitles([...current, term]);
}

export function unhideTitle(title: string) {
  saveHiddenTitles(loadHiddenTitles().filter((item) => normalize(item) !== normalize(title)));
}

export function loadImportedShifts(): Shift[] {
  const hidden = loadHiddenTitles();
  return readList<Shift>(IMPORTED_KEY).filter((shift) => !isHiddenShift(shift, hidden));
}

export function saveImportedShifts(list: Shift[]) {
  writeList(IMPORTED_KEY, list);
}

export function loadAgendaUrl() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(URL_KEY) ?? "";
}

export function saveAgendaUrl(url: string) {
  localStorage.setItem(URL_KEY, url);
}

export function replaceCalendarShifts(calendarId: string, imported: Shift[]) {
  const prefix = `gcal-${calendarId}-`;
  const current = loadImportedShifts();
  const manual = new Map(
    current
      .filter((shift) => shift.id.startsWith(prefix) && shift.manualLocation && shift.locationId)
      .map((shift) => [shift.id, shift.locationId]),
  );
  const rest = current.filter((shift) => !shift.id.startsWith(prefix));
  const merged = imported.map((shift) =>
    manual.has(shift.id) ? { ...shift, locationId: manual.get(shift.id) ?? "", manualLocation: true } : shift,
  );
  const next = [...rest, ...merged];
  saveImportedShifts(next);
  return next;
}

export function keepManualAndReplaceImported(imported: Shift[]) {
  const manual = loadImportedShifts().filter((shift) => !shift.id.startsWith("gcal-"));
  const next = [...manual, ...imported];
  saveImportedShifts(next);
  return next;
}

export function addShift(shift: Shift) {
  const next = [...loadImportedShifts(), shift];
  saveImportedShifts(next);
  return next;
}

export function mergeShifts(list: Shift[]) {
  return [...list].sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
}

export function shiftsFromIcs(
  ics: string,
  list: ShiftLocation[],
  owner?: Pick<AgendaCalendar, "id" | "name" | "color">,
) {
  return eventsToShifts(parseIcs(ics), list, owner);
}
