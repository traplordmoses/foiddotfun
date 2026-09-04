"use client";

// "remind me daily" (audit G4). Web push needs a push service the site does
// not have yet; a recurring calendar event is the reminder every phone
// already honours. The .ics is generated on the client, 8pm local time,
// daily, with the prayer link in the description.
import { useMemo } from "react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function PrayerReminderLink({ className = "" }: { className?: string }) {
  const href = useMemo(() => {
    if (typeof window === "undefined") return "#";
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0);
    if (start < now) start.setDate(start.getDate() + 1);
    const local = (d: Date) =>
      `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//FOID//pray//EN",
      "BEGIN:VEVENT",
      `UID:foid-daily-prayer-${stamp}@foid.fun`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${local(start)}`,
      "DURATION:PT5M",
      "RRULE:FREQ=DAILY",
      "SUMMARY:pray with foid mommy",
      "DESCRIPTION:one prayer a day keeps the streak. https://foid.fun/pray",
      "URL:https://foid.fun/pray",
      "BEGIN:VALARM",
      "TRIGGER:PT0M",
      "ACTION:DISPLAY",
      "DESCRIPTION:pray with foid mommy",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  }, []);

  return (
    <a
      href={href}
      download="foid-daily-prayer.ics"
      className={`pray-reminder-link ${className}`}
      aria-label="Add a daily prayer reminder to your calendar"
    >
      <span aria-hidden="true">⏰</span> daily reminder
    </a>
  );
}
