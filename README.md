# Log Analyzer Platform

A React + Vite observability dashboard for a single monitored service.

## What it does

- Displays service health, alert status, incident summary, and error trends.
- Shows live logs with filters and clickable error guidance.
- Includes AI-style root cause analysis cards and a service dependency map.

## Service configuration

Service data is provided from `src/serviceConfig.js`.
Update that file with your service name, URL, health path, metrics, and endpoints.

The dashboard reads this single service configuration and renders the UI from it.

## Structure

- `src/App.jsx` — main dashboard UI
- `src/serviceConfig.js` — service data configuration
- `src/main.jsx` — React entry point
- `src/index.css`, `src/App.css` — styling
- `vite.config.js` — build configuration

## How to run

```bash
npm install
npm run dev
```

Open the local URL shown by Vite.

## Build

```bash
npm run build
npm run preview
```

## Notes

- The dashboard is a frontend demo and uses local configuration only.
- `src/serviceConfig.js` is the single place to update service information.
