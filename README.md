# Log Analyzer Platform

A React + Vite observability dashboard demo with live log telemetry, incident analysis, and remediation guidance.

## What it does

- Shows service health, alerts, incident status, and error trends.
- Displays live logs with filters for severity and service.
- Provides clickable error log entries that show root cause and suggested fixes.
- Includes AI-style RCA cards and a service dependency map.

## Structure

- `src/App.jsx` — main dashboard UI and demo data
- `src/main.jsx` — React app entry point
- `src/index.css`, `src/App.css` — styling
- `vite.config.js` — build configuration

## How to run

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite.

## Build

```bash
npm run build
npm run preview
```

## Notes

- This is a frontend demo using hard-coded sample data.
- No backend integration is included.
