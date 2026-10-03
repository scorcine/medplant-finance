import { locations, shifts as sampleShifts, type Shift, type ShiftLocation } from "@/lib/mock-data";
import { parseIcs, type AgendaEvent } from "@/lib/ics";

const IMPORTED_KEY = "medplant-agenda-shifts";
const URL_KEY = "medplant-agenda-url";
const CALENDARS_KEY = "medplant-calendarios";

export type AgendaCalendar = {
  id: string;
  name: string;
  color: string;
  url: string;
};

const DEFAULT_CALENDARS: AgendaCalendar[] = [
  { id: "eu", name: "Meu calendário", color: "#7c3aed", url: "" },
  { id: "esposa", name: "Esposa", color: "#f97316", url: "" },
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function matchLocation(text: string, list: ShiftLocation[] = locations) {
  const haystack = normalize(text);
  return list.find((location) => {
    const name = normalize(location.name);
    if (haystack.includes(name)) return true;
    const words = name.split(/\s+/).filter((word) => word.length > 3);
    return words.length > 0 && words.every((word) => haystack.includes(word));
  });
}

export function eventsToShifts(
  events: AgendaEvent[],
  list: ShiftLocation[] = locations,
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
      calendarId: owner?.id,
      ownerName: owner?.name,
      color: owner?.color,
    };
  });
}

export function loadCalendars(): AgendaCalendar[] {
  if (typeof window === "undefined") return DEFAULT_CALENDARS;
  const raw = localStorage.getItem(CALENDARS_KEY);
  const savedUrl = localStorage.getItem(URL_KEY) ?? "";
  if (!raw) {
    const initial = DEFAULT_CALENDARS.map((calendar) =>
      calendar.id === "eu" && savedUrl ? { ...calendar, url: savedUrl } : calendar,
    );
    localStorage.setItem(CALENDARS_KEY, JSON.stringify(initial));
    return initial;
  }
  try {
    const parsed = JSON.parse(raw) as AgendaCalendar[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CALENDARS;
  } catch {
    return DEFAULT_CALENDARS;
  }
}

export function saveCalendars(list: AgendaCalendar[]) {
  localStorage.setItem(CALENDARS_KEY, JSON.stringify(list));
}

export function loadImportedShifts(): Shift[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(IMPORTED_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Shift[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveImportedShifts(list: Shift[]) {
  localStorage.setItem(IMPORTED_KEY, JSON.stringify(list));
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
  const rest = loadImportedShifts().filter((shift) => !shift.id.startsWith(prefix));
  const next = [...rest, ...imported];
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

export function mergeShifts(imported: Shift[]) {
  const importedIds = new Set(imported.map((shift) => shift.id));
  return [...sampleShifts.filter((shift) => !importedIds.has(shift.id)), ...imported].sort((a, b) =>
    `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`),
  );
}

export function shiftsFromIcs(
  ics: string,
  list?: ShiftLocation[],
  owner?: Pick<AgendaCalendar, "id" | "name" | "color">,
) {
  return eventsToShifts(parseIcs(ics), list, owner);
}
