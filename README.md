<p align="center">
  <img src="public/masjid-mark.svg" alt="MUTABA'AH logo" width="72" height="72" />
</p>

<h1 align="center">MUTABA'AH</h1>

<p align="center"><strong>Prayer Attendance and Student Monitoring</strong></p>
<p align="center">A clear, consistent way for pesantren to record and review students' daily worship.</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-App_Router-111111?logo=nextdotjs&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-UI-06B6D4?logo=tailwindcss&logoColor=white" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Database_and_Auth-3FCF8E?logo=supabase&logoColor=white" />
</p>

MUTABA'AH is a web application for Islamic boarding schools (pesantren). It brings student records, prayer attendance, and reporting together in one place. The application interface is in Indonesian.

## Features

- **Dashboard** — Review student, class, and daily attendance summaries.
- **Prayer attendance** — Record attendance by class, date, and prayer, with absence reasons when needed.
- **Student records** — Manage student profiles and statuses, and import or export data using Excel templates.
- **Student history** — View individual attendance calendars and activity records.
- **Classes and advisors** — Organize classes and assign advisors to the students they supervise.
- **Reports** — Review attendance by class and date range, then export reports to Excel, PDF, or Word.
- **Audit history** — Review changes made to attendance records.

## User roles

- **Administrator** — Manages students, classes, advisor accounts, reports, and audit history.
- **Advisor (ustaz)** — Records attendance for assigned classes.

## Technology

Next.js App Router, React, TypeScript, Tailwind CSS, Supabase, ExcelJS, jsPDF, and Recharts.

## Getting started

### Requirements

- Node.js and npm
- A Supabase project

### Install dependencies

```bash
git clone https://github.com/luciaans/mutaba-ah.git
cd mutaba-ah
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Set the values in `.env.local`:

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side service role key. Keep this secret and never expose it in client code. |
| `NEXT_PUBLIC_PESANTREN_NAME` | No | School name used in reports. Defaults to MUTABA'AH or is omitted where appropriate. |
| `NEXT_PUBLIC_APP_TIMEZONE` | No | Application time zone. Defaults to `Asia/Pontianak`. |

### Set up Supabase

1. Create a Supabase project and add its URL and keys to `.env.local`.
2. For a **new, empty project**, run [`supabase/setup.sql`](supabase/setup.sql) once in the Supabase SQL Editor. This bundle applies the schema, row-level security policies, database functions, and storage setup. Do not run it twice.
3. Create the first administrator account:

   ```bash
   npm run create-admin -- admin "use-a-strong-password" "Administrator Name"
   ```

### Run the application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Useful scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local development server. |
| `npm run build` | Create a production build. |
| `npm run start` | Serve the production build locally. |
| `npm run typecheck` | Check TypeScript types. |

For deployment, configure the required environment variables in your hosting provider. Never commit `.env.local` or share the service role key.

---

Created by [luciaans](https://github.com/luciaans).

Copyright © 2026 luciaans. All rights reserved.
