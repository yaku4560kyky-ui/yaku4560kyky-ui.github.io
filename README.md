# HabitFlow

Simple habit tracker with reminder settings and Google Calendar sync preparation.

Live page:

```text
https://yaku4560kyky-ui.github.io/
```

## Run

Serve this folder locally:

```powershell
node server.mjs
```

Then open:

```text
http://127.0.0.1:3000
```

## Features

- Add and delete habits
- Check in today's scheduled habits
- Store data in `localStorage`
- Configure per-habit reminder time and notification on/off
- Request browser notification permission
- Save global notification settings
- Save Google OAuth Client ID for future API sync
- Export habits as an `.ics` calendar file for Google Calendar import

## Google Calendar Notes

The app currently supports sync settings and `.ics` export. Direct Google Calendar API writes require a Google Cloud OAuth Client ID and the Google Identity Services flow. Once the OAuth client is available, the saved Client ID can be used to add a sign-in button and call the Calendar API's event insert/update endpoints.
