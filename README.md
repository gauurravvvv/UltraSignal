# UltraSignalAPI-Repo

Backend API for UltraSignal — Express + TypeScript on Node.js 20, TypeORM with PostgreSQL, JWT auth, per-organisation database isolation.

Current focus: **Auth** (login, forgot password, reset password, set password) and **User Management** (Roles, Groups, Users) with transactional email.

## Prerequisites

- Node.js **20+**, npm **10+**
- A running **PostgreSQL** instance (this is the master DB)
- SMTP credentials if you want email flows to actually deliver

## Setup

```bash
npm install
cp .env.example .env
# fill in DB credentials, JWT_SECRET_KEY, ULTRASIGNAL_MASTER_KEY, SMTP_*
```

Generate the master encryption key:

```bash
openssl rand -base64 32
```

Paste the result into `.env` as `ULTRASIGNAL_MASTER_KEY`. The app refuses to start without it.

See `.env.example` for the full list of variables, each with an inline comment explaining what it does.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server (nodemon + ts-node, watches `src/**/*.ts`) |
| `npm run dev:sync` | Dev server with TypeORM `synchronize: true` — DDL on boot |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Build, then run `dist/src/app.js` |
| `npm run start:cluster` | PM2 cluster mode (one worker per CPU) |
| `npm run stop` / `reload` / `logs` | PM2 process control |
| `npm run deploy` | Pull → build → PM2 reload |
| `npm run typeorm` | TypeORM CLI |
| `npm run clean` | Remove `dist/` |
| `npx tsc --noEmit` | Type-check without emitting |

## Project layout

Domain-first under `src/modules/<domain>/`; cross-cutting code under `src/shared/`. See `CLAUDE.md` for the request flow, response conventions, and patterns each module is expected to follow.
