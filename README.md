This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Lead pipeline (sources → scoring → verification → portal)

An internal lead-gen tool under `/dashboard/leads`. End-to-end flow:

1. **Connect a database first.** Auth is DB-free, but leads need Postgres. Put real
   `DATABASE_URL` / `DIRECT_URL` (Supabase/Neon) in `.env`, then run:
   `npx prisma migrate dev` and `npx prisma generate`.
2. **Create a query** at `/dashboard/leads/queries` (text, region, sources). Sources:
   `google_places` (needs `GOOGLE_PLACES_KEY`, skipped if unset) and `csv` (import-driven).
3. **Get leads** two ways:
   - **Run now** → `POST /api/scrape/trigger` runs the query's live sources inline (hard cap
     50 results), scores each lead, and upserts by `@@unique([source, sourceId])`. A
     `ScrapeRun` row tracks status + lead count. If `N8N_WEBHOOK_URL` is set, the job is
     handed to n8n (202) instead of running inline.
   - **Import CSV** → upload a file (headers: name, website, email, phone, instagram,
     contactName, contactTitle, category, address). Re-imports dedupe by website domain.
4. **Work the board** at `/dashboard/leads`: server-side filter (status/source/min-score/
   has-email/search), sort by score, inline status changes, and a detail drawer showing the
   `signals[]` pitch rationale.
5. **Verify emails** → select leads → "Verify selected" → `POST /api/leads/verify`. Free
   MX-record check by default; set `EMAIL_VERIFY_PROVIDER=zerobounce` + `EMAIL_VERIFY_KEY`
   for paid verification (falls back to MX on failure). `new` leads become `verified` (valid)
   or `dead` (invalid); other statuses are left alone.
6. **Export** the current filtered set as CSV (`GET /api/leads/export`, streamed).

All routes are server-side and session-guarded (Google + admin allowlist). No secret reaches
the browser. No endpoint loads the full leads table into memory.
