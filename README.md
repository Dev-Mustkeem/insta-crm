# Insta CRM

Insta CRM is split into two independently runnable applications while sharing one Neon backend:

- `insta-crm-fe`: Next.js 14 frontend on port 3000.
- `insta-crm-be`: NestJS API on port 4000, Prisma, Neon PostgreSQL, and private Neon Object Storage.

The application does not require Docker or Redis. Scheduled maintenance runs inside the API process and all durable application state is stored in PostgreSQL. Original lead-import files are stored in the private `insta-crm` Neon bucket.

## Prerequisites

- Node.js 20 or 22
- npm 10+
- Neon account access to project `long-violet-30802223`

## Install and run

```bash
npm install
npm run db:deploy
npm run dev --workspace insta-crm-be
```

In a second terminal:

```bash
npm run dev --workspace insta-crm-fe
```

Open `http://localhost:3000`. The API health endpoint is `http://localhost:4000/api/health`.

## Neon infrastructure

The root `neon.ts` declares a private object-storage bucket named `insta-crm`. The project link and generated storage credentials are local-only and excluded from version control.

```bash
neon login
neon link --project-id long-violet-30802223 --branch production -y
neon config init
neon deploy
```

`neon deploy` writes the branch-specific database and S3-compatible object-storage credentials to the local environment. The API reads its private application settings from `insta-crm-be/.env` and Neon-generated values from the root `.env.local`.

## Validation

```bash
npm run typecheck
npm run build
```

## Branding

All legacy MCCIA and SahayakCRM names and images have been removed. A theme-compatible text mark is used until the official Insta ICT Solutions logo is added.
