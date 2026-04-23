// Minimal ICS (RFC 5545) parser for class schedule import.
// Supports: VEVENT with DTSTART/DTEND/SUMMARY/LOCATION/UID/RRULE (FREQ=WEEKLY only).
// Folded lines (CRLF + space/tab) are unfolded. Recurring weekly events are
// expanded into individual sessions up to a configurable horizon.

export interface ParsedEvent {
  uid: string | null;
  summary: string;
  location: string | null;
  starts_at: Date;
  ends_at: Date;
}

interface RawEvent {
  uid: string | null;
  summary: string;
  location: string | null;
  dtstart: string | null;
  dtend: string | null;
  rrule: string | null;
}

const unfold = (raw: string) =>
  raw.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");

// Parse "20260415T143000Z" or "20260415T143000" (floating local) or "20260415" (date)
const parseIcsDate = (val: string): Date | null => {
  if (!val) return null;
  // Strip TZID prefix like "TZID=Europe/Stockholm:20260415T143000"
  // Note: we treat TZID-tagged times as local — good enough for class schedules
  const cleaned = val.includes(":") ? val.split(":").pop()! : val;
  const m = cleaned.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/);
  if (!m) return null;
  const [, y, mo, d, hh, mm, ss, z] = m;
  if (!hh) {
    // All-day event — use local midnight
    return new Date(Number(y), Number(mo) - 1, Number(d));
  }
  if (z === "Z") {
    return new Date(
      Date.UTC(
        Number(y),
        Number(mo) - 1,
        Number(d),
        Number(hh),
        Number(mm),
        Number(ss),
      ),
    );
  }
  return new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(hh),
    Number(mm),
    Number(ss),
  );
};

// Unescape ICS text (\, , \; , \n , \\)
const unescapeText = (s: string) =>
  s.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");

const parseRRule = (val: string) => {
  const out: Record<string, string> = {};
  for (const part of val.split(";")) {
    const [k, v] = part.split("=");
    if (k && v) out[k.toUpperCase()] = v;
  }
  return out;
};

// Map BYDAY tokens (MO,TU,WE,TH,FR,SA,SU) to JS day-of-week (Sun=0)
const DAY_TO_JS: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

export const parseIcs = (
  raw: string,
  options: { horizonDays?: number } = {},
): ParsedEvent[] => {
  const horizonDays = options.horizonDays ?? 180;
  const text = unfold(raw);
  const lines = text.split("\n");

  const events: RawEvent[] = [];
  let current: RawEvent | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      current = { uid: null, summary: "Class", location: null, dtstart: null, dtend: null, rrule: null };
    } else if (trimmed === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
    } else if (current) {
      // Property name may include params like DTSTART;TZID=...:value
      const colon = trimmed.indexOf(":");
      if (colon < 0) continue;
      const head = trimmed.slice(0, colon);
      const value = trimmed.slice(colon + 1);
      const propName = head.split(";")[0].toUpperCase();
      switch (propName) {
        case "UID":
          current.uid = value;
          break;
        case "SUMMARY":
          current.summary = unescapeText(value);
          break;
        case "LOCATION":
          current.location = unescapeText(value);
          break;
        case "DTSTART":
          current.dtstart = head.includes(";") ? `${head.split(";").slice(1).join(";")}:${value}` : value;
          break;
        case "DTEND":
          current.dtend = head.includes(";") ? `${head.split(";").slice(1).join(";")}:${value}` : value;
          break;
        case "RRULE":
          current.rrule = value;
          break;
      }
    }
  }

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + horizonDays);
  const past = new Date();
  past.setDate(past.getDate() - 14); // include last 2 weeks for context

  const out: ParsedEvent[] = [];

  for (const ev of events) {
    if (!ev.dtstart || !ev.dtend) continue;
    const start = parseIcsDate(ev.dtstart);
    const end = parseIcsDate(ev.dtend);
    if (!start || !end || end <= start) continue;

    const duration = end.getTime() - start.getTime();

    if (!ev.rrule) {
      if (start >= past && start <= horizon) {
        out.push({
          uid: ev.uid,
          summary: ev.summary,
          location: ev.location,
          starts_at: start,
          ends_at: end,
        });
      }
      continue;
    }

    const rule = parseRRule(ev.rrule);
    if (rule.FREQ !== "WEEKLY") {
      // Skip non-weekly recurrences for v1 — still include the first occurrence
      if (start >= past && start <= horizon) {
        out.push({
          uid: ev.uid,
          summary: ev.summary,
          location: ev.location,
          starts_at: start,
          ends_at: end,
        });
      }
      continue;
    }

    const interval = Math.max(1, parseInt(rule.INTERVAL ?? "1", 10));
    const until = rule.UNTIL ? parseIcsDate(rule.UNTIL) : null;
    const count = rule.COUNT ? parseInt(rule.COUNT, 10) : null;
    const byDays = rule.BYDAY
      ? rule.BYDAY.split(",")
          .map((d) => DAY_TO_JS[d.toUpperCase().slice(-2)])
          .filter((d) => d !== undefined)
      : [start.getDay()];

    const stopAt = until && until < horizon ? until : horizon;

    let occurrencesEmitted = 0;
    // Anchor: start of the week containing DTSTART
    const weekAnchor = new Date(start);
    weekAnchor.setDate(start.getDate() - start.getDay()); // Sunday of that week
    weekAnchor.setHours(0, 0, 0, 0);

    let weekOffset = 0;
    while (true) {
      const weekStart = new Date(weekAnchor);
      weekStart.setDate(weekAnchor.getDate() + weekOffset * 7 * interval);
      if (weekStart > stopAt) break;

      for (const dow of byDays) {
        const occ = new Date(weekStart);
        occ.setDate(weekStart.getDate() + dow);
        occ.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);

        if (occ < start) continue; // skip occurrences before DTSTART
        if (occ > stopAt) continue;
        if (count !== null && occurrencesEmitted >= count) break;

        if (occ >= past) {
          out.push({
            uid: ev.uid,
            summary: ev.summary,
            location: ev.location,
            starts_at: new Date(occ),
            ends_at: new Date(occ.getTime() + duration),
          });
        }
        occurrencesEmitted++;
      }

      if (count !== null && occurrencesEmitted >= count) break;
      weekOffset++;
      if (weekOffset > 520) break; // safety: max 10 years
    }
  }

  return out;
};
