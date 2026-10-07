# SCMan — Seixal Clube 1925

Gestão de eventos e inscrições do clube. The frontend is Solid, Tailwind v4 and Vite, with Capacitor for the native apps. The backend is Fastify with SQLite (better-sqlite3).

## Layout

```
src/                     frontend
  lib/                   api client, session, dates, event helpers, push, calendar export
  components/ui/         design system primitives (Button, Field, Dialog, Badge…)
  components/layout/     AppShell (top bar + mobile tab bar), route guards
  features/events/       event list, detail dialog, answer controls, event form, uploads
  features/admin/        invites, users, events administration
  pages/                 Home, Calendar, Login, SetPassword (activate / reset)
backend/
  index.js               entry point
  src/db.js              schema (kept compatible with production) + all SQL
  src/routes/            REST API
  src/services/          push (FCM), PayPal, file storage, scheduled jobs
  scripts/               create-user, check-db, seed-dev
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

Push notifications are disabled when `backend/serviceAccountKey.json` is missing. See `.env.example` and `backend/.env.example` for the other settings. Online payments are hidden unless `VITE_ENABLE_PAYMENTS=1`.

## Checks

```sh
yarn check          # lint, typecheck, unit tests, backend tests, build
yarn e2e            # Playwright, starts its own backend on a throwaway database
```

CI runs the same steps on every pull request.

## Production database

The schema in `backend/src/db.js` must stay compatible with the live database. Only ever add new `create … if not exists` objects. Before deploying, check a **copy** of the production database:

```sh
cp /srv/sc1925_backend/database.db /tmp/prod-copy.db
yarn --cwd backend check-db /tmp/prod-copy.db
```

`install.sh` backs up the database before installing. The frontend and backend must be deployed together. To create the first admin directly in a database, run `DB_PATH=… yarn --cwd backend create-user`.
