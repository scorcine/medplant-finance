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

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const MAX_OCCURRENCES = 3000;
const HORIZON_DAYS = 730;

function utcDay(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function dayKey(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  return dayKey(utcDay(date) + days * 86_400_000);
}

function weekday(date: string) {
  return new Date(utcDay(date)).getUTCDay();
}

function monthDate(year: number, month: number, day: number) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const resolved = day < 0 ? last + day + 1 : day;
  if (resolved < 1 || resolved > last) return null;
  return dayKey(Date.UTC(year, month - 1, resolved));
}

function weekdaysInMonth(year: number, month: number, token: string) {
  const match = token.match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/);
  if (!match) return [];
  const target = DAY_CODES.indexOf(match[2]);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const all: string[] = [];
  for (let day = 1; day <= last; day += 1) {
    const date = monthDate(year, month, day);
    if (date && weekday(date) === target) all.push(date);
  }
  if (!match[1]) return all;
  const nth = Number(match[1]);
  const picked = nth > 0 ? all[nth - 1] : all[all.length + nth];
  return picked ? [picked] : [];
}

function daysInMonth(year: number, month: number, rule: Record<string, string>, fallbackDay: number) {
  if (rule.BYDAY) return rule.BYDAY.split(",").flatMap((token) => weekdaysInMonth(year, month, token));
  const days = rule.BYMONTHDAY ? rule.BYMONTHDAY.split(",").map(Number) : [fallbackDay];
  return days.map((day) => monthDate(year, month, day)).filter((date): date is string => Boolean(date));
}

function periodDates(startDate: string, rule: Record<string, string>, period: number, interval: number) {
  const [year, month, day] = startDate.split("-").map(Number);
  const step = period * interval;
  switch (rule.FREQ) {
    case "DAILY":
      return [addDays(startDate, step)];
    case "WEEKLY": {
      const monday = addDays(startDate, -((weekday(startDate) + 6) % 7) + step * 7);
      const codes = rule.BYDAY ? rule.BYDAY.split(",").map((token) => token.slice(-2)) : [DAY_CODES[weekday(startDate)]];
      return codes.map((code) => addDays(monday, (DAY_CODES.indexOf(code) + 6) % 7));
    }
    case "MONTHLY": {
      const index = year * 12 + (month - 1) + step;
      return daysInMonth(Math.floor(index / 12), (index % 12) + 1, rule, day);
    }
    case "YEARLY": {
      const months = rule.BYMONTH ? rule.BYMONTH.split(",").map(Number) : [month];
      return months.flatMap((item) =>
        rule.BYDAY || rule.BYMONTHDAY ? daysInMonth(year + step, item, rule, day) : [monthDate(year + step, item, day)].filter((date): date is string => Boolean(date)),
      );
    }
    default:
      return [];
  }
}

export function expandRule(startDate: string, rrule: string, horizon: string) {
  const rule = Object.fromEntries(
    rrule.split(";").map((part) => {
      const [key, value = ""] = part.split("=");
      return [key.toUpperCase(), value.toUpperCase()];
    }),
  );
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(rule.FREQ)) return [startDate];
  const interval = Math.max(1, Number(rule.INTERVAL) || 1);
  const count = rule.COUNT ? Number(rule.COUNT) : Infinity;
  const until = rule.UNTIL ? parseStamp(rule.UNTIL)?.date : undefined;
  const dates: string[] = [startDate];
  for (let period = 0; period < 5000 && dates.length < Math.min(count, MAX_OCCURRENCES); period += 1) {
    const candidates = periodDates(startDate, rule, period, interval).sort();
    if (candidates.length === 0 && rule.FREQ !== "MONTHLY" && rule.FREQ !== "YEARLY") break;
    let stop = false;
    for (const date of candidates) {
      if (date <= startDate) continue;
      if ((until && date > until) || date > horizon) {
        stop = true;
        break;
      }
      dates.push(date);
      if (dates.length >= count) break;
    }
    if (stop) break;
  }
  return dates;
}

function cleanText(value: string | undefined, fallback = "") {
  return (value ?? fallback).replace(/\\n/g, " ").replace(/\\,/g, ",").replace(/\\;/g, ";");
}

export function parseIcs(ics: string, today = new Date().toISOString().slice(0, 10)): AgendaEvent[] {
  const raw: Record<string, string>[] = [];
  let current: Record<string, string> | null = null;

  for (const line of unfold(ics).split("\n")) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current?.DTSTART) raw.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    const parsed = field(line);
    if (!parsed) continue;
    if (parsed.name === "EXDATE" && current.EXDATE) current.EXDATE += `,${parsed.value}`;
    else current[parsed.name] = parsed.value;
  }

  const overridden = new Set(
    raw
      .filter((item) => item["RECURRENCE-ID"])
      .map((item) => `${item.UID}|${parseStamp(item["RECURRENCE-ID"])?.date}`),
  );
  const horizon = addDays(today, HORIZON_DAYS);
  const events: AgendaEvent[] = [];

  for (const item of raw) {
    const start = parseStamp(item.DTSTART);
    if (!start) continue;
    const end = item.DTEND ? parseStamp(item.DTEND) : null;
    const uid = item.UID || `${start.date}-${start.time}-${item.SUMMARY ?? ""}`;
    const base = {
      title: cleanText(item.SUMMARY, "Plantão"),
      location: cleanText(item.LOCATION),
      start: start.time,
      end: end?.time ?? "19:00",
    };
    const cancelled = item.STATUS?.toUpperCase() === "CANCELLED";

    if (item["RECURRENCE-ID"]) {
      const original = parseStamp(item["RECURRENCE-ID"])?.date ?? start.date;
      if (!cancelled) events.push({ ...base, uid: `${uid}-${original}`, date: start.date });
      continue;
    }
    if (cancelled) continue;
    if (!item.RRULE) {
      events.push({ ...base, uid, date: start.date });
      continue;
    }
    const excluded = new Set(
      (item.EXDATE ?? "")
        .split(",")
        .map((value) => parseStamp(value.trim())?.date)
        .filter(Boolean),
    );
    for (const date of expandRule(start.date, item.RRULE, horizon)) {
      if (excluded.has(date) || overridden.has(`${uid}|${date}`)) continue;
      events.push({ ...base, uid: `${uid}-${date}`, date });
    }
  }

  return events;
}
