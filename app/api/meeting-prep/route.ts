import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink } from 'fs/promises';
import { randomBytes } from 'crypto';
import { getDb } from '@/lib/db';

const execAsync = promisify(exec);

import { getCalendarNames } from '@/lib/calendars';

const CALENDARS = getCalendarNames();

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// GET: Fetch upcoming meetings, join with DB prep data
export async function GET() {
  try {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);

    const fromStr = formatDate(now);
    const toStr = formatDate(futureDate);

    // Fetch calendar events (accli pipe bug workaround: redirect to file)
    const allEventsPromises = CALENDARS.map(async (calendarName) => {
      const tmpFile = `/tmp/accli-${randomBytes(4).toString('hex')}.json`;
      try {
        await execAsync(
          `npx @joargp/accli events "${calendarName}" --from "${fromStr}" --to "${toStr}" --max 50 --json > "${tmpFile}"`,
          { maxBuffer: 5 * 1024 * 1024, shell: "/bin/sh" }
        );
        const raw = await readFile(tmpFile, 'utf-8');
        const data = JSON.parse(raw);
        return (data.events || []).map((e: any) => ({
          ...e,
          calendarSource: calendarName,
        }));
      } catch (err) {
        console.error(`Failed to fetch ${calendarName}:`, err);
        return [];
      } finally {
        try { await unlink(tmpFile); } catch {}
      }
    });

    const allEventsArrays = await Promise.all(allEventsPromises);
    const allEvents = allEventsArrays.flat().filter((e: any) => !e.allDay);

    // Deduplicate by event ID
    const seenIds = new Set<string>();
    const uniqueEvents = allEvents.filter((event: any) => {
      if (seenIds.has(event.id)) return false;
      seenIds.add(event.id);
      return true;
    });

    // Get all prep data from DB
    const db = getDb();
    const prepRows = db.prepare('SELECT * FROM meeting_prep').all() as any[];
    // Key prep by event_id + occurrence_date for recurring meeting support
    const prepByKey = new Map(prepRows.map((r: any) => {
      const key = r.occurrence_date ? `${r.event_id}::${r.occurrence_date}` : r.event_id;
      return [key, r];
    }));

    // Merge calendar events with prep data
    // ONLY match by event_id + occurrence_date — never fall back to event_id alone
    // Recurring meetings share the same event_id, so matching without date shows prep on every occurrence
    const meetings = uniqueEvents.map((event: any, index: number) => {
      const eventDate = event.startISO ? event.startISO.split('T')[0] : '';
      const prep = prepByKey.get(`${event.id}::${eventDate}`);
      let actionItems: string[] | null = null;
      if (prep?.action_items) {
        try { actionItems = JSON.parse(prep.action_items); } catch {}
      }

      return {
        id: prep?.id || `cal:${event.id}:${index}`,
        eventId: event.id,
        title: event.summary,
        time: event.startISO,
        calendar: event.calendar || event.calendarSource,
        occurrenceDate: eventDate,
        prepNotes: prep?.prep_notes || null,
        prepStatus: prep?.prep_status || 'none',
        transcript: prep?.transcript || null,
        summary: prep?.summary || null,
        actionItems,
      };
    });

    // Also include past meetings that have prep data (not just future calendar events)
    const allPrepRows = db.prepare(
      "SELECT * FROM meeting_prep WHERE prep_status != 'none' OR prep_notes IS NOT NULL OR transcript IS NOT NULL"
    ).all() as any[];

    // Dedup by event_id + occurrence_date (not just event_id, for recurring meetings)
    const includedKeys = new Set(meetings.map((m: any) => `${m.eventId}::${m.occurrenceDate}`));

    for (const prep of allPrepRows) {
      const prepDate = prep.occurrence_date || (prep.time ? prep.time.split('T')[0] : '');
      const key = `${prep.event_id}::${prepDate}`;
      if (includedKeys.has(key)) continue;
      includedKeys.add(key);

      let actionItems: string[] | null = null;
      if (prep.action_items) {
        try { actionItems = JSON.parse(prep.action_items); } catch {}
      }

      meetings.push({
        id: prep.id,
        eventId: prep.event_id,
        title: prep.title,
        time: prep.time,
        calendar: prep.calendar,
        occurrenceDate: prepDate,
        prepNotes: prep.prep_notes || null,
        prepStatus: prep.prep_status || 'none',
        transcript: prep.transcript || null,
        summary: prep.summary || null,
        actionItems,
      });
    }

    meetings.sort((a: any, b: any) =>
      new Date(a.time).getTime() - new Date(b.time).getTime()
    );

    return Response.json({ meetings });
  } catch (error) {
    console.error('Meeting prep fetch error:', error);
    return Response.json({ error: 'Failed to fetch meetings' }, { status: 500 });
  }
}
