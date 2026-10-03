export type AgendaEvent = {
  uid: string;
  title: string;
  location: string;
  date: string;
  start: string;
  end: string;
};

function unfold(ics: string) {
  return ics.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

function field(line: string) {
  const splitAt = line.indexOf(":");
  if (splitAt < 0) return null;
  const name = line.slice(0, splitAt).split(";")[0].toUpperCase();
  return { name, value: line.slice(splitAt + 1).trim() };
}

function inSaoPaulo(year: number, month: number, day: number, hour: number, minute: number, utc: boolean) {
  const date = utc
    ? new Date(Date.UTC(year, month - 1, day, hour, minute))
    : new Date(year, month - 1, day, hour, minute);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: utc ? "America/Sao_Paulo" : undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

function parseStamp(value: string) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!match[4]) return { date: `${match[1]}-${match[2]}-${match[3]}`, time: "07:00" };
  if (!value.endsWith("Z")) {
    return { date: `${match[1]}-${match[2]}-${match[3]}`, time: `${match[4]}:${match[5]}` };
  }
  return inSaoPaulo(year, month, day, Number(match[4]), Number(match[5]), true);
}

export function parseIcs(ics: string): AgendaEvent[] {
  const events: AgendaEvent[] = [];
  let current: Record<string, string> | null = null;

  for (const line of unfold(ics).split("\n")) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current?.DTSTART) {
        const start = parseStamp(current.DTSTART);
        const end = current.DTEND ? parseStamp(current.DTEND) : null;
        if (start) {
          events.push({
            uid: current.UID || `${start.date}-${start.time}-${current.SUMMARY ?? ""}`,
            title: (current.SUMMARY ?? "Plantão").replace(/\\n/g, " ").replace(/\\,/g, ","),
            location: (current.LOCATION ?? "").replace(/\\,/g, ","),
            date: start.date,
            start: start.time,
            end: end?.time ?? "19:00",
          });
        }
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const parsed = field(line);
    if (parsed) current[parsed.name] = parsed.value;
  }

  return events;
}
