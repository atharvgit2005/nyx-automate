# NYX Automate — standalone setup & cutover

This repo was carved out of the NYX monorepo on **2026-05-14**.

**Done (by the split):** repo carved with full git history, Prisma schema forked
to the 12 Automate-owned models, routes flattened (`/automate/*` → `/*`), config
rewired for `automate.nyxstudio.tech`, marketing/portal dead code pruned, build green.

**Remaining (needs you / your accounts):** provision infra, migrate data, verify,
then strip Automate out of the NYX repo. Steps below.

---

## 1. Commit the split work in this repo

The carve left staged renames + edits. Review and commit:

```bash
cd /Users/atharvpaharia100/Desktop/NYX-Everything/nyx-automate
git status            # sanity-check the changeset
git add -A
git commit -m "chore: standalone Automate app — split from NYX monorepo"
```

## 2. Create the GitHub repo

```bash
gh repo create nyx-automate --private --source=. --remote=origin --push
```

## 3. Provision a new Postgres

Use a fresh database (Neon / Supabase / Vercel Postgres) — **separate** from the
NYX site's DB. Put its connection strings in `.env` (see `.env.example`):

- `DATABASE_URL` — pooled connection
- `DIRECT_URL` — direct (non-pooled) connection, used for schema push

Then create the schema in the new DB:

```bash
npx prisma db push
```

This repo has **no `prisma/migrations/`** folder — it uses `db push`. (If you
later want migration history, run `npx prisma migrate dev --name init` against
an empty DB instead.)

## 4. Migrate the Automate data

The migration script lives in the **NYX repo** (it needs the full schema to read
the source DB). It copies every User that is *not* a BrandPartner/PortalViewer,
plus their Account/Session/Subscription/Script/Video rows, plus the global
Tier/FeatureGate/AuditLog/RevokedToken/LoginAttempt/VerificationToken tables.

```bash
cd /Users/atharvpaharia100/Desktop/NYX-Everything/NYX

# DRY RUN first — prints row counts, writes nothing:
SOURCE_DATABASE_URL="<current NYX prod DB url>" \
TARGET_DATABASE_URL="<new automate DB url>" \
npx tsx scripts/migrate-automate-to-standalone.ts

# Review the counts, then EXECUTE:
SOURCE_DATABASE_URL="<current NYX prod DB url>" \
TARGET_DATABASE_URL="<new automate DB url>" \
npx tsx scripts/migrate-automate-to-standalone.ts --execute
```

The script is idempotent (`createMany skipDuplicates`) — safe to re-run.

## 5. Deploy to Vercel

```bash
cd /Users/atharvpaharia100/Desktop/NYX-Everything/nyx-automate
vercel link            # create a NEW Vercel project (don't reuse the NYX one)
vercel domains add automate.nyxstudio.tech
```

Set **every** var from `.env.example` in the Vercel project settings. Critical:
- `NEXTAUTH_URL=https://automate.nyxstudio.tech` — must be set, missing value breaks Google sign-in
- `DATABASE_URL` / `DIRECT_URL` — the new DB
- `NEXTAUTH_SECRET` — generate a **new** one (`openssl rand -base64 32`), don't reuse NYX's

## 6. Google OAuth

In Google Cloud Console → the OAuth client → Authorized redirect URIs, add:

```
https://automate.nyxstudio.tech/api/auth/callback/google
```

(You can reuse the existing OAuth client or make a new one. If reusing, keep the
NYX URI too until cutover is done.)

## 7. Verify (before touching the NYX repo)

- [ ] `automate.nyxstudio.tech` loads the landing page
- [ ] Sign up / log in works (credentials + Google)
- [ ] `/dashboard` gated correctly, admin reaches `/admin_automate`
- [ ] Migrated users can log in (their rows are in the new DB)
- [ ] Video/voice/script/analyze features work with the API keys set

## 8. Strip Automate out of the NYX repo  ← only after step 7 passes

In the NYX repo:
- Delete `src/app/automate/`, the Automate API routes (`api/{video,voice,tts,scripts,ideas}`,
  `api/user/avatar*`, `api/dashboard/stats`, `api/admin/{audit,gates,subscriptions,tiers,users}`),
  the ~17 Automate-only components, `src/context/{Sidebar,Admin}Context.tsx`,
  Automate libs (`services/{video-gen,ai-analysis}`, `inworld.ts`, `gemini.ts`).
- **Move `src/app/automate/login/LoginClient.tsx` into `src/app/portal/login/`** before
  deleting `automate/` — `portal/login/page.tsx` and `portal/signup` import it.
- Drop `Subscription, Tier, FeatureGate, AuditLog, Script, Video` from NYX's `schema.prisma`,
  then `npx prisma db push`.
- Remove the `/automate/*` redirect rules from `next.config.ts`; instead redirect
  `www.nyxstudio.tech/automate/*` → `https://automate.nyxstudio.tech/*` (flattened).
- Trim `middleware.ts` (drop the `/automate/*` matchers).
- Switch marketing-site `/automate` links to the external `https://automate.nyxstudio.tech`.
- Delete `scripts/migrate-automate-to-standalone.ts` once the migration is confirmed.

## Notes / known follow-ups

- **`.git` is ~320 MB** — heavy binary-asset history carried over. Optional cleanup:
  `git filter-repo --strip-blobs-bigger-than 1M` (do before the first push).
- The Automate admin's old **"Inquiries"** page was removed — it read the marketing
  site's `Contact`/`Lead` tables, which now live only in the NYX DB.
- `src/lib/seo.ts` still carries NYX marketing schema (Organization/WebSite JSON-LD).
  Harmless, but worth rewriting for Automate branding later.
- Root has leftover NYX docs (`PHASE_*.md`, etc.) and `scripts/` test files — prune
  at leisure, none affect the build.
