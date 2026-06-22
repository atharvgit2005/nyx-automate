# NYX lead pipeline — n8n (you own it)

The lead-gathering runs in **your own n8n**. The app only triggers it and stores
the results. You can edit the whole workflow.

```
App  ──(Run now)──▶  n8n webhook  ──gather/enrich──▶  POST /api/leads/ingest  ──▶  app scores + stores
```

## Files
- `nyx-lead-pipeline.json` — importable workflow:
  Webhook → **Gather (Nominatim + Overpass)** (one Code node: geocodes the city to a
  bounding box, then queries OpenStreetMap by bbox) → map to leads → POST to the app's
  ingest endpoint. (No per-site Instagram enrichment yet — see "Extend" below.)

  > Why a Code node does the HTTP: n8n's built-in HTTP node was getting `406` from
  > Overpass, and the area-name Overpass query is unreliable. Geocoding to a bbox first
  > (mirroring the app's own `src/lib/leads/sources/openStreetMap.ts`) is what works.

## One-time setup
1. **Import** `nyx-lead-pipeline.json` into n8n (Workflows → Import from File).
2. **Create the ingest auth credential** (this is how n8n authenticates to the app —
   n8n blocks `$env` in nodes by default, so we use a proper credential):
   - n8n left sidebar → **Credentials** → **Add credential** → search **"Header Auth"**.
   - **Name** (the header field): `x-engine-token`
   - **Value**: your `ENGINE_TOKEN` (the long random string, same as the app's `.env`).
   - Save it (e.g. name it "NYX ingest token").
3. Open the workflow → **"POST to app ingest"** node → it's already set to
   Authentication = *Generic Credential Type*, Generic Auth Type = *Header Auth* →
   just **select** the credential you just made → Save.
4. In the app's env (local `.env` + Vercel), set:
   - `ENGINE_TOKEN=<same value you put in the credential>`
   - `N8N_WEBHOOK_URL=<the Production URL of the Webhook node>` (n8n shows it on the node)
5. Open the workflow → **Activate** it.
6. In the app, go to **Leads → Queries**, write e.g. `cafes in Mumbai`, and hit **Run**.
   - The app POSTs the job to your n8n webhook.
   - n8n gathers from OpenStreetMap and POSTs the leads back to `/api/leads/ingest`.
   - The app scores them and they appear on the Leads board.

> The ingest URL in the workflow is `http://host.docker.internal:2005/api/leads/ingest`
> (Docker n8n → app on the host at port 2005). For the live app use
> `https://nyx-automate.vercel.app/api/leads/ingest` — but note a localhost Docker n8n
> can't be reached *by* Vercel; expose n8n via a tunnel for the app→n8n trigger.

## Instagram enrichment — reuse YOUR built-in scraper
The app already has your Node scraper at `POST /api/scrape/instagram` (multi-strategy:
Instagram hidden API + Picuki mirror). It takes a **handle** and returns name, bio, follower
count, and recent posts. It's now token-guarded — n8n calls it with the same `ENGINE_TOKEN`.

Recommended chain in n8n (after "To leads"):
1. **Split In Batches** over the leads.
2. **HTTP Request** GET `{{ $json.website }}` (skip if no website).
3. **HTML Extract** → grab the first `a[href*="instagram.com"]` → that's the handle.
4. **HTTP Request** POST `https://nyx-automate.vercel.app/api/scrape/instagram`
   header `x-engine-token: {{ $env.ENGINE_TOKEN }}`, body `{ "username": "<handle>" }`
   → returns `{ data: { followersCount, biography, ... } }`.
5. Merge the handle (+ follower count into a signal) back onto the lead, then POST to ingest.

So the discovery is OSM/website, and the **Instagram detail comes from your own scraper** —
nothing external or paid. (For hashtag/location IG *discovery*, swap step 1–3 for an Apify actor.)

## Extend (this is the part you own)
- **Instagram + email enrichment:** after "To leads", add a **Split In Batches** node →
  **HTTP Request** (GET `{{ $json.website }}`) → **HTML Extract** (pull `a[href*="instagram.com"]`
  and `mailto:` links) → merge back. Then the leads arrive with Instagram handles.
- **Instagram by hashtag/location:** swap the Overpass node for an **Apify** Instagram actor
  (HTTP Request to Apify's run-sync endpoint with your Apify token), then map its output to the
  same `leads[]` shape. This is the paid path for true IG prospecting.
- **Schedule it:** add a **Schedule Trigger** alongside the Webhook to run queries automatically.

## Notes
- This starter was authored without a live n8n to test against — on import you may need to
  re-pick the Code/HTTP node versions or re-paste the webhook URL. Tell me any error and I'll fix it.
- Keep `ENGINE_TOKEN` secret. The ingest endpoint rejects any request without it.

---

# Instagram Audience Intelligence — n8n (`nyx-instagram-intelligence.json`)

Scrapes Instagram posts + comments (Apify), runs sentiment, and writes a row into the
**Audience Intelligence** Airtable. Triggered from the **Automations** table when a record with
`Social Channel = Instagram` is ticked **Run Automation**.

```
Airtable (Run Automation ✓) ──▶ Webhook ──▶ Get record ──▶ Status: Running ──▶ If Instagram
   └▶ Search Inputs ──▶ Format ──▶ Apify hashtag + profile scrapers ──▶ Merge ──▶ Filter URLs
        └▶ Comment scraper ──▶ Assemble (join comments to posts) ──▶ Sentiment ──▶ Create row ──▶ Status: Completed
```

## ✅ Internet check — verified & upgraded (June 2026)
This workflow was matched against the live Apify / OpenAI / n8n docs before shipping. What changed
vs. the original spec:

| Area | Original spec | Verified state (2026) | Action taken |
|---|---|---|---|
| Apify actor IDs | `apify/instagram-{hashtag,post,comment}-scraper` | still valid | kept |
| `run-sync-get-dataset-items` | used | still valid | kept |
| **Comment scraper `isNewestComments`** | sent in body | **field removed from schema** | **dropped** |
| **Group-by key** | `postURL` (Summarize) | real output key is **`postUrl`** (lowercase) | rewrote as a Code join on `postUrl` |
| **`numPosts`** | referenced but never produced | n/a | now resolved from `Quantity to Scrape` in **Format Inputs** |
| Apify token | in the URL `?token=` | — | moved to a **Header Auth** credential (`Authorization: Bearer …`) |
| Sentiment model | `gpt-4o` | **GPT‑4o retired Feb 2026** | set to `gpt-5.1-mini` (change in the Sentiment node) |
| Pricing | $2.30 / 1k results | now **~$1.00 / 1k, pay‑per‑event** | doc only |
| Post scraper | basic | new `onlyPostsNewerThan`, `dataDetailLevel` | available to add (see below) |

Two of these were real breakages (`isNewestComments`, the `postURL`/`postUrl` mismatch) plus one
dead reference (`numPosts`) — the original would have failed or silently dropped all comments.

## Why the comment-join was rewritten
The original chained **Summarize (split by `postURL`)** → sentiment → Create, and read post fields
via `$('Merge1').item` (index pairing). That breaks two ways: the key is actually `postUrl`, and
Summarize's output order doesn't line up with the post records by index. The upgrade joins comments
onto each post in a single **Code** node (`comment.postUrl === post.url`), so every downstream item
carries its own post fields **and** comments — sentiment then runs 1:1 per post, making the index
pairing safe.

## One-time setup
1. **Import** `nyx-instagram-intelligence.json` (Workflows → Import from File).
2. **Set the Airtable base/table IDs** — every Airtable node has placeholders
   (`appREPLACE_INSTIG8`, `tblREPLACE_AUTOMATIONS`, `tblREPLACE_INPUTS`, `tblREPLACE_AUDIENCE_INTEL`).
   Open each node and pick the real base/table from the dropdown, and attach your Airtable credential.
3. **Apify credential** — Credentials → Add → **Header Auth**: name `Authorization`, value
   `Bearer <your APIFY_TOKEN>`. Select it on all three **Apify:** HTTP nodes.
4. **OpenAI credential** — Credentials → Add → **Header Auth**: name `Authorization`, value
   `Bearer <your OPENAI_API_KEY>`. Select it on **Sentiment Analysis (OpenAI)**.
   - Model is `gpt-5.1-mini` in the node body — swap to whatever you have access to. (If you prefer
     Claude, point the node at `https://api.anthropic.com/v1/messages` instead and adjust the body.)
5. Copy the Webhook **Production URL** and have Airtable's automation POST to it with
   `?recordId={{ record id }}`.
6. **Activate** the workflow.

## Tunables
- **Fresh posts only:** add `onlyPostsNewerThan: '14 days'` to the **Apify: Profile Post Scraper**
  body (the hashtag scraper has no date filter; use `resultsType: 'reels'` there if you want reels).
- **Comments per post:** `resultsLimit` (default 15) in **Apify: Comment Scraper**.
- **Status update runs per row** (once per created record). Harmless — it just re-stamps Completed.
  If you scrape many posts and want it once, move it onto a separate branch off the `If` node.

> Authored without a live n8n to test against — on import you may need to re-pick a node version or
> re-attach a credential. Send me any import error and I'll fix the node.

---

# Instagram Audience Intelligence — FREE version (`nyx-instagram-intelligence-free.json`)

Same flow as above, but **zero paid services**. The three Apify actors are replaced by **your own
scraper** (`/api/scrape/instagram`), and the OpenAI sentiment node is replaced by your **free LLM
chain** (`/api/insights/sentiment` → Groq → Gemini → OpenAI).

```
… Format Inputs ──▶ App: Discover posts ──▶ Split ──▶ Filter URLs
      └▶ App: Comments ──▶ App: Sentiment (free) ──▶ Create row ──▶ Status: Completed
```

## What was added to the app
| Piece | File | Notes |
|---|---|---|
| `scrapeHashtagPosts` / `scrapeProfilePosts` / `discoverInstagramPosts` | `src/lib/services/instagram-scraper.ts` | Discovery via IG's hidden web API; output normalized to Apify-like keys |
| `scrapePostComments` | same file | Top comments for one post |
| `action: 'discover' \| 'comments'` | `src/app/api/scrape/instagram/route.ts` | Same route, ENGINE_TOKEN-guarded |
| Free sentiment | `src/app/api/insights/sentiment/route.ts` | Reuses `generateText()` (Groq→Gemini→OpenAI) |

## ⚠️ The one real limitation — read this
Instagram gates **hashtag feeds** and **comments** behind a logged-in cookie. So:
- **Works with no login:** profile posts, captions, likes/views/metrics, media URLs.
- **Needs `IG_SESSIONID`:** hashtag discovery and comment text.

Set `IG_SESSIONID` to the `sessionid` cookie from a **throwaway** Instagram account (DevTools →
Application → Cookies → `instagram.com` → `sessionid`). Add it to `.env.local` and Vercel.
Without it, the workflow still runs — it just analyzes **captions instead of comments**
(`/api/scrape/instagram` reports `hasSession: false`, and the comment scrape returns `authed: false`).

> Cookies expire and Instagram rate-limits hard. Treat the free path as best-effort: great for light,
> occasional runs; the paid Apify version (`nyx-instagram-intelligence.json`) is the choice for volume
> or reliability. They share the same Airtable mapping, so you can keep both and switch per run.

## Setup (free)
1. **Import** `nyx-instagram-intelligence-free.json`.
2. Set the same **Airtable** base/table IDs + credential on every Airtable node (see the paid section).
3. The three **App:** HTTP nodes use **Header Auth** `x-engine-token` = your `ENGINE_TOKEN`
   (the same credential the lead pipeline uses — reuse it).
4. Set the app URL on the three **App:** nodes — `http://host.docker.internal:2005` for a local
   Docker n8n, or `https://nyx-automate.vercel.app` for prod.
5. In the app env (`.env.local` + Vercel): `ENGINE_TOKEN=…`, and for comments/hashtags `IG_SESSIONID=…`.
6. **Activate** and trigger from Airtable exactly like the paid version.

## Cost: ₹0 / $0
No Apify, no OpenAI. Groq + Gemini free tiers cover the sentiment; the scraping is your own code.
