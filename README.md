# SCMan — Seixal Clube 1925

Gestão de eventos e inscrições do clube. The frontend is Solid, Tailwind v4 and Vite, shipped as an installable web app (PWA). The backend is Fastify with SQLite (better-sqlite3). Notifications use standard Web Push.

## Layout

```
src/                     frontend
  lib/                   api client, session, dates, event helpers, push, PWA, weather, calendar export
  components/ui/         design system primitives (Button, Field, Dialog, Badge…)
  components/layout/     AppShell (top bar + mobile tab bar), route guards
  features/events/       event list (one-tap answers), detail dialog, forms, weather, calendar feed
  features/account/      notifications toggle, change password
  features/admin/        invites, users, events administration, statistics
  pages/                 Home, Calendar, Login, SetPassword (activate / reset)
backend/
  index.js               entry point
  src/db.js              schema (kept compatible with production) + all SQL
  src/routes/            REST API
  src/services/          Web Push, PayPal, file storage, scheduled jobs
  scripts/               create-user, check-db, seed-dev, vapid-keys
public/sw.js             service worker: install, offline page, push notifications
  test/                  node:test suite
e2e/                     Playwright tests (desktop + mobile)
```

## Development

```sh
yarn install && yarn --cwd backend install
yarn --cwd backend seed-dev /tmp/dev.db          # users admin / f.rider / c.rider, password "password123"
DB_PATH=/tmp/dev.db yarn --cwd backend dev       # API on :4200
yarn dev                                         # app on :3000 (proxies /api)
```

See `.env.example` and `backend/.env.example` for settings. Online payments are hidden unless `VITE_ENABLE_PAYMENTS=1`.

## Notifications (Web Push)

Notifications are sent with standard Web Push, to browsers and the installed app. They are disabled until the backend has VAPID keys:

```sh
yarn --cwd backend vapid-keys >> backend/.env   # VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
```

Keep the keys stable: new keys invalidate every existing subscription (users then turn notifications on again). Athletes enable notifications in the account menu or from the card on the home page. Browser support:

- Chrome, Edge, Firefox (desktop and Android): in the browser or the installed app.
- iPhone / iPad (iOS 16.4+): only after *Partilhar → Adicionar ao ecrã principal*, from the installed app.

Production needs HTTPS (localhost works without it for development).

## Calendar subscription and weather

Each user gets a personal, secret calendar link (`/api/calendar/<token>.ics`, Calendário → Subscrever) that Google, Apple and Outlook calendars poll. The event detail shows a forecast from [Open-Meteo](https://open-meteo.com/) (free, no key) for events in the next 16 days.

## Checks

```sh
yarn check          # lint, typecheck, unit tests, backend tests, build
yarn e2e            # Playwright, starts its own backend on a throwaway database
```

CI runs the same steps on every pull request. The PWA tests (`e2e/pwa.spec.ts`) run on the full Chromium build, because Playwright's default headless shell has no notification support. Real delivery through a browser's push service can't run headless: check it manually with *Conta → Notificações → Enviar teste*.

## Production database

The schema in `backend/src/db.js` must stay compatible with the live database. Only ever add new `create … if not exists` objects. Before deploying, check a **copy** of the production database:

```sh
cp /srv/sc1925_backend/database.db /tmp/prod-copy.db
yarn --cwd backend check-db /tmp/prod-copy.db
```

New releases may add tables (e.g. `webpush_subscriptions`, `calendar_feeds`); `check-db` lists them as "will be created" and the backend creates them on start. `install.sh` backs up the database before installing. The frontend and backend must be deployed together. To create the first admin directly in a database, run `DB_PATH=… yarn --cwd backend create-user`.
