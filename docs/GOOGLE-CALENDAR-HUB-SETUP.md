# Google Calendar Hub Setup (Apple Calendar + Gutter)

If you want Apple Calendar compatibility **without** relying on Apple-only calendars, use Google Calendar as your sync hub.

This gives you:
- Multiple calendars (Work, Family, JW, Personal, etc.)
- Visibility in Apple Calendar (macOS + iOS)
- A cleaner path for future Docker/server deployments

---

## Architecture

```text
Gutter -> Apple Calendar app (via accli) -> Google account calendars
                                      -> iPhone/iPad Apple Calendar sync
```

Key point: once your Google account is added to Apple Calendar on macOS, those Google calendars appear as normal Apple Calendar sources. `accli` can target them by name.

---

## 1) Create Google calendars

In Google Calendar, create the calendars you want Gutter to use, for example:

- `Gutter - Work`
- `Gutter - Family`
- `Gutter - JW`
- `Gutter - Personal`

Keep names exact and stable; Gutter references calendar names literally.

---

## 2) Add Google account to Apple Calendar

On macOS:
1. Open **System Settings** → **Internet Accounts**
2. Add your **Google** account
3. Enable **Calendars** for that account
4. Open Apple Calendar and verify all Google calendars appear

Optional on iPhone/iPad:
- Settings → Calendar → Accounts → Add Account → Google

---

## 3) Verify `accli` can see the calendars

```bash
npx @joargp/accli calendars list
```

Confirm your Google calendar names are listed exactly as expected.

---

## 4) Configure Gutter

In `.env`:

```env
CALENDAR_ENABLED=true
ACCLI_CMD=accli

# Comma-separated, exact names from `accli calendars list`
CALENDARS=Gutter - Work,Gutter - Family,Gutter - JW,Gutter - Personal

# Default target when a command doesn’t specify a calendar
CALENDAR_DEFAULT_NAME=Gutter - Personal
```

Restart Gutter after changing env values.

---

## 5) Map friendly names (optional)

If you use commands like “add this to work calendar”, ensure aliases in `lib/calendar.ts` map to your real calendar names.

Example alias mapping:

- `work` -> `Gutter - Work`
- `family` -> `Gutter - Family`
- `jw` -> `Gutter - JW`
- `personal` -> `Gutter - Personal`

---

## 6) Quick validation

1. Create an appointment in Gutter (or via command mode)
2. Confirm it appears in the target Google calendar in Apple Calendar
3. Confirm the same event appears in Google Calendar web
4. Confirm it syncs to iPhone/iPad Apple Calendar

---

## Notes / limitations

- Sync timing between providers can be delayed a bit (normal).
- This setup is best when running Gutter on macOS with Calendar access.
- If you fully containerize on Linux, direct `accli` access is unavailable; use a separate provider-native integration path for server-side calendar writes.
