---
name: numu-app-developer
description: Guide an outside developer (a NUMU partner) through building, testing, submitting, publishing and selling a Partner App on NUMU, the Arabic-first e-commerce platform for Egyptian and MENA merchants. Covers the partner program, development stores, the numu.app.json manifest, OAuth install, app tokens and scopes, signed webhooks (X-NUMU-Signature-V1), the "Open app" link-out, hub settings forms, Arabic/RTL and Egyptian-market rules, the App Review checklist, versioning, uninstall and privacy (PDPL 151/2020), and pricing. Use when someone is building a NUMU app, integrating a SaaS with many NUMU stores, preparing a NUMU app for review, debugging a NUMU OAuth or webhook flow, or asking how to sell an app to NUMU merchants.
---

# Build and sell a Partner App on NUMU

You are helping a developer who does **not** work at NUMU build an app that NUMU merchants install from the App Store in their dashboard (the "merchant hub"). Take them through the path in order, enforce the rules as they build, and aim for approval on the first submission.

---

## 0. Before anything else

1. **Check what is live.** Features ship in phases. The source of truth is:
   - **Guides:** `https://developers.numueg.app`. Start at `/apps/getting-started`; the API guides are under `/api/*`.
   - **Endpoint reference:** `https://docs.numueg.app` (interactive, generated from the OpenAPI contract).
   - **The contract itself:** `https://numueg.app/api/v1/public/openapi.json`. Each operation names its scope in `x-numu-scope`.

   If the docs say a feature is "coming later", do not build against it, even though this skill describes it. **When this skill and the docs disagree, the docs win.** Say so to the developer.
2. **Pick the right kind.** NUMU has four:

   | Kind | For |
   |---|---|
   | **Partner App** | Something **many merchants install**. This skill is for this kind |
   | **Private integration** | Connecting **one merchant's own systems**. It needs no app and no review: the merchant mints a personal access token (`numu_pat_…`) in Settings → Developers, following `developers.numueg.app/api/quickstart` |
   | **NUMU Apps** | Built by NUMU itself: WhatsApp, Inbox, Nimo |
   | **Core** | The platform itself |

   If the developer is building for one store, send them to the Private-integration quickstart and stop here.
3. **Pick the app type:**
   - **Connected app:** runs on the developer's server and talks to NUMU through the API and webhooks. Available first, and it covers almost everything: shipping, accounting, ERP, marketing, loyalty, fraud checks, feeds.
   - **Storefront extension:** a React component inside the store's pages. Open only when the docs say so.
4. **Ask for their stack.** The examples use Node and Python. Translate them faithfully, and never drop a security step.

---

## 1. The full path

| # | Step | Where | Done when |
|---|---|---|---|
| 1 | Create a NUMU account and verify the email | `https://merchant.numueg.app` | Can log in |
| 2 | Apply to the Partner program; accept the Partner Agreement + App Review Guidelines | `https://merchant.numueg.app/partners/apply` (policies at `developers.numueg.app/partners/policies`) | Status **approved** (manual review, email) |
| 3 | Install the CLI and log in | `npm i -g @numueg/theme-cli` → `numu login --token <PAT>` | `numu app --help` works |
| 4 | Create a development store; seed sample data | Hub → `/partners` → Development stores | A store with Arabic products and COD orders |
| 5 | Scaffold | `numu app init <slug>` | A folder with `numu.app.json` and this skill in `.claude/skills/` |
| 6 | Register the app | `numu app validate` → `numu app create` | `client_id` and `client_secret` printed **once**: put the secret in your server's env now |
| 7 | Build: OAuth, API calls, webhooks, settings | Your server | § 3 done |
| 8 | Install on your dev store and test | `numu app install --store <dev-store>` | § 6 self-review passes |
| 9 | Version and submit | bump `version` in `numu.app.json` → `numu app version` → `numu app submit` | **submitted** |
| 10 | Answer review | `numu app status`, or Hub → `/partners/apps` → your app | **approved** (target ≤ 5 business days); on *changes requested*, fix, bump the version, upload and submit again |
| 11 | Publish | `numu app publish`, or the portal | **published**; NUMU then decides when to list it in the App Store |
| 12 | Support, update, get paid | Portal | Ongoing |

When the installed CLI differs from this table, trust `numu app --help` and the docs.

---

## 2. Rules that are never broken

These are review blockers, or grounds for suspension. Enforce them in every file you write.

### Security
- **Secrets:** never log, commit or print the `client_secret`, access tokens, or webhook bodies that hold customer data. Keep them in environment variables, and keep `.env*` in `.gitignore`.
- **Webhooks:** verify every webhook's `X-NUMU-Signature-V1` in constant time before parsing, and reject stale timestamps. **Return 401 on a bad signature.** The reviewer sends a bad one, and accepting it is an automatic rejection.
- **OAuth redirect and "Open app":** verify the `hmac` on every one, and reject a timestamp older than 5 minutes.
- **Check `state`** on the OAuth callback.
- **Isolate stores:** scope everything by `store_id`. One merchant's data must never leak into another's session.
- **HTTPS only:** no IP literals and no localhost in a submitted manifest. For local development, use a tunnel such as ngrok or Cloudflare Tunnel.

### Data and privacy (Egypt PDPL 151/2020)
- **Scopes:** request the fewest that work, and justify each one in the submission. Anything touching customers, or any `:write`, requires a privacy policy URL.
- **Conversations need `messages:read`.** Customer conversations (Inbox threads, messages, WhatsApp) require the `messages` scope. `marketing` does **not** grant them to apps. Ask for `messages` only if the app truly handles conversations.
- **Handle `app.uninstalled`:** stop, delete the token, and never call the API for that store again.
- **Handle the privacy events** when the docs list them: `customer.data_request`, `customer.redact`, `store.redact`. `store.redact` arrives 48 hours after uninstall; delete everything held for that store.
- **Keep data to the app's purpose:** no copying merchant or customer data into analytics, ML training or anything else that is not needed to run the app.

### Honesty
- **Listing:** it must match the app. No invented features, fake reviews or fake counts.
- **Pricing:** state it honestly. If you bill merchants yourself (`external`), the listing says so in Arabic and English.
- **Branding:** no NUMU branding, and nobody else's, in the name, icon or copy. The "من نُمُو" badge is only for NUMU's own apps.

### Platform
- **Access:** only the public API and webhooks. No scraping of the hub or storefront, no private endpoints, and no automating a merchant's browser session.
- **Storefront extensions** (when open): no DOM access outside your root; no direct `fetch`, XHR, `WebSocket` or `sendBeacon` (use `useAppProxy`); no `localStorage` or cookies; logical CSS only.

---

## 3. Building a connected app

### 3.1 The API conventions (shared with every NUMU integration)

| | Value |
|---|---|
| Base URL | `https://numueg.app/api/v1` (`https://api.numueg.app/api/v1` is the same API) |
| Auth header | `Authorization: Bearer numu_app_…` |
| Success | `{"success": true, "data": …, "message": "…"}`. Read `data`; never parse `message` |
| Failure | `{"detail": "…"}` + HTTP status |
| Money | **Integer piasters** (EGP × 100) unless a field says otherwise |
| IDs / times | UUID strings / UTC ISO 8601 |
| Trailing slashes | Significant: collections `/orders/`, items `/orders/{id}`. No redirect between them |
| Rate limit | **300 requests/minute per token**; `X-RateLimit-Remaining`; `429` + `Retry-After`. Back off with jitter |
| Retries of writes | Send `Idempotency-Key` on `POST` / `PUT` / `PATCH`: a repeat returns the first response; `409` while the first is still running |
| Identity check | `GET /auth/api-key/me` returns the store, scopes and `app_slug`. Call it at startup |
| Versioning | `v1` never removes or retypes fields. Enums may grow, so ignore unknown values rather than crash |

### 3.2 The manifest: `numu.app.json`

Run `numu app validate` before every submit.

```jsonc
{
  "$schema": "https://developers.numueg.app/schemas/app-manifest-v1.json",
  "manifest_version": 1,
  "slug": "my-shipping-sync",
  "version": "1.0.0",
  "type": ["connected"],
  "name":        { "ar": "مزامنة الشحن", "en": "Shipping Sync" },
  "tagline":     { "ar": "ابعت طلباتك لشركة الشحن بضغطة", "en": "Send orders to your courier in one click" },
  "description": { "ar": "…", "en": "…" },
  "icon": "assets/icon.png",
  "screenshots": [{ "src": "assets/1.png", "caption": { "ar": "…", "en": "…" } }],
  "category": "shipping",
  "developer": {
    "support_email": "support@example.com",
    "support_url": "https://example.com/help",
    "privacy_policy_url": "https://example.com/privacy",
    "terms_url": "https://example.com/terms"
  },
  "app_url": "https://app.example.com/numu",
  "oauth": {
    "redirect_urls": ["https://app.example.com/numu/callback"],
    "scopes": ["orders:read", "orders:write"],
    "optional_scopes": []
  },
  "webhooks": [
    { "event": "order.paid",      "url": "https://app.example.com/numu/webhooks" },
    { "event": "app.uninstalled", "url": "https://app.example.com/numu/webhooks" }
  ],
  "settings_schema": [
    { "id": "default_courier", "type": "select",
      "label": { "ar": "شركة الشحن الافتراضية", "en": "Default courier" },
      "options": [
        { "value": "bosta",  "label": { "ar": "بوسطة",  "en": "Bosta" } },
        { "value": "mylerz", "label": { "ar": "مايلرز", "en": "Mylerz" } }
      ],
      "default": "bosta" }
  ],
  "pricing": { "model": "free" },
  "languages": ["ar", "en"]
}
```

**Scopes** use the same strings as the rest of the API: `<domain>:read` or `<domain>:write`.
- **Domains:** `catalog`, `media`, `orders`, `customers`, `analytics`, `marketing`, `risk`, `settings`, plus `messages` for apps.
- **`:write` does not imply `:read`.** Ask for both when you need both.
- **Never grantable to apps:** themes publishing, staff, billing, payment credentials, domains and token management.

**Rules:**
- Every human-readable string needs `ar` + `en`, and the Arabic is real Egyptian Arabic, not a copy of the English.
- `app.uninstalled` is always subscribed.
- Every settings field needs `label.ar` and `label.en`.
- Adding a scope in a later version makes every merchant re-approve before it works, so plan scopes up front.

### 3.3 The OAuth install

1. The merchant clicks **Install** and approves NUMU's consent screen. NUMU redirects to your `redirect_url` with `?code=…&store_id=…&state=…&timestamp=…&hmac=…`.
2. **Verify** the `hmac` (§ 3.5), `state`, and that the timestamp is under 5 minutes old.
3. **Exchange** the code within 10 minutes. It works once.

   ```http
   POST https://numueg.app/api/v1/oauth/token
   Content-Type: application/json

   { "client_id": "…", "client_secret": "…", "code": "…" }
   ```

   The response is `{"success": true, "data": {"access_token": "numu_app_…", "scopes": [...], "store_id": "…"}}`.
4. **Store the token encrypted**, keyed by `store_id`. It does **not** expire: it works until the merchant uninstalls, NUMU suspends the app, a scope is removed, or you rotate the client secret. That is unlike a merchant's personal token, which expires.
5. **Send the merchant somewhere useful**, in Arabic when `locale=ar`.

### 3.4 Webhooks

This is the same system every NUMU integration uses (`developers.numueg.app/api/webhooks`). The only difference for apps: **your subscriptions come from the manifest, and deliveries are signed with your app's client secret.**

**Headers:**
- `X-NUMU-Event`
- `X-NUMU-Delivery`: the same across retries; **dedupe on it**
- `X-NUMU-Timestamp`
- **`X-NUMU-Signature-V1: t=<ts>,v1=<hex>`**, where `v1` = HMAC-SHA256 of **`"<ts>.<raw body>"`** with your client secret

**Delivery:**
- At least once, possibly out of order. Upsert by resource id.
- Answer `200` fast and do the work in a queue.
- Endpoints that fail for days are disabled, and you are emailed.

**Node (Express):**

```js
import crypto from "node:crypto";
import express from "express";

function verify(rawBody, header, secret, toleranceSeconds = 300) {
  const parts = Object.fromEntries((header || "").split(",").map((p) => p.split("=").map((s) => s.trim())));
  if (!parts.t || !parts.v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > toleranceSeconds) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.`).update(rawBody).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(parts.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const app = express();
// raw body is required: re-serialised JSON never matches the signature
app.post("/numu/webhooks", express.raw({ type: "application/json" }), async (req, res) => {
  if (!verify(req.body, req.get("X-NUMU-Signature-V1"), process.env.NUMU_CLIENT_SECRET)) {
    return res.sendStatus(401);
  }
  const deliveryId = req.get("X-NUMU-Delivery");
  if (await alreadyProcessed(deliveryId)) return res.sendStatus(200);
  res.sendStatus(200);                                  // answer first, work after
  await queue.add({ deliveryId, event: req.get("X-NUMU-Event"), payload: JSON.parse(req.body) });
});
```

**Python:**

```python
import hashlib, hmac, time

def verify(raw_body: bytes, header: str, secret: str, tolerance: int = 300) -> bool:
    try:
        parts = dict(p.strip().split("=", 1) for p in header.split(","))
        if abs(time.time() - int(parts["t"])) > tolerance:
            return False
    except (KeyError, ValueError):
        return False
    expected = hmac.new(secret.encode(), f"{parts['t']}.".encode() + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, parts.get("v1", ""))
```

**Event names** are dotted: `order.created`, `order.paid`, `order.status_changed` (it carries `new_status` and `tracking_number`, so it is your shipping event), `product.created`, `product.updated`, `product.deleted` and `app.uninstalled`. Subscribe only to events listed on the docs page. NUMU refuses events it does not publish.

**On `app.uninstalled`:** mark the store inactive, delete the token and stop its jobs.

### 3.5 Verifying the OAuth redirect and "Open app"

NUMU opens your `app_url` with `?store_id=…&locale=ar|en&timestamp=…&hmac=…`. The OAuth redirect uses the same scheme.

`hmac` is the **hex** HMAC-SHA256, keyed with your client secret, of every other parameter, **URL-decoded, sorted by key and joined as `k=v&k=v`**. It is not the webhook format: there is no `t=` prefix and no body.

```python
import hashlib, hmac, time

def valid_query(params: dict, secret: str) -> bool:
    params = dict(params)
    given = params.pop("hmac", "")
    msg = "&".join(f"{k}={params[k]}" for k in sorted(params))
    calc = hmac.new(secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
    fresh = abs(time.time() - int(params.get("timestamp", 0))) < 300
    return fresh and hmac.compare_digest(calc, given)
```

This proves the merchant came from the NUMU dashboard. It is not a login: look up your installation for `store_id`, then start your own session.

### 3.6 Settings

NUMU renders the merchant's settings form from `settings_schema`, in Arabic and English. Use it for simple choices, and your own dashboard behind "Open app" for anything complex.

---

## 4. Designing for Egyptian merchants

These are checked in review; the full guide is `developers.numueg.app/apps/designing-for-egypt`.

- **Arabic first.** Write Egyptian colloquial (عامية مصرية), e.g. "اختار شركة الشحن", not MSA "يرجى اختيار شركة الشحن". Keep it short and warm.
- **RTL in your own dashboard.** Use logical CSS only: `margin-inline-start`, `text-align: start`. Never `left` or `right`.
- **Keep these LTR inside Arabic:** numbers, prices, phone numbers, order numbers, tracking codes, dates and code (`dir="ltr"` or `<bdi>`).
- **Money is EGP.** Show `1,250 ج.م` or `EGP 1,250`. The API sends piasters: divide by 100.
- **Cash on delivery dominates.** Orders are confirmed by phone or WhatsApp, so a pending order is normal. Build around `order.status_changed`, not payment capture.
- **Phones are the identity.** Expect Egyptian numbers (`+20 1x xxxx xxxx`), and never require an email.
- **Mobile first.** Merchants run their stores from their phones, so test at 375 px wide.

---

## 5. Storefront extensions (only when the docs say they are open)

- **Placement:** you render inside a named slot (`<AppSlot name="…">`). Without your app, the theme's own markup renders there. One app per slot per store.
- **APIs:** SDK hooks only. Reach your server with `useAppProxy(path)`.
- **Build:** NUMU builds the bundle from source, and it must pass the size limit, the AST scan and the lint rules.
- **Updates:** never silent. Merchants click **Apply**.

---

## 6. Self-review before submitting

The reviewer runs this list. Run it first.

1. The app installs and completes OAuth on a **fresh** dev store.
2. Every scope is used. Write one line per scope for the notes.
3. The Arabic name, tagline, description, captions and settings labels are real Egyptian Arabic and differ from the English.
4. The settings form looks right in Arabic (RTL) and English in the hub.
5. After uninstalling, your server makes no calls for that store and has deleted its token.
6. A webhook with a wrong `X-NUMU-Signature-V1` gets `401`. Test it with `numu app webhook trigger order.paid --bad-signature --secret <client secret>`: your endpoint must answer `401`.
7. The privacy policy loads and names the customer data you use.
8. The listed price is exactly what, and where, the merchant pays.
9. The app does not pose as a NUMU feature or as a NUMU App.
10. The support email answers within 2 business days.

**Also check:**
- `numu app validate` passes
- no secrets are in the repo
- every URL is public HTTPS
- `401`, `403`, `404` and `429` are handled

**Submission notes template:**

```
What it does: …
How to test (steps on a dev store): …
Scopes: orders:read — to …; orders:write — to …
Data stored and retention: …
Pricing: free | external (billed at https://…, EGP …/month)
```

---

## 7. Review, publishing and updates

- **Outcomes:**
  - **approved**: publish.
  - **changes requested**: fix, bump the version, and resubmit.
  - **rejected**: the notes say why. Do not resubmit it unchanged.
- **Listing:** after publishing, NUMU decides when the app appears in the catalog. Beta apps may show only to selected merchants.
- **Ordering:** the catalog is ordered by relevance and rating. NUMU's own apps get a badge and a filter, not a boost. The fair-play rules are at `developers.numueg.app/partners/fair-play`.
- **Updates:** every change to the manifest, the listing, scopes or URLs is a new version. Listing-only and no-scope-change versions clear faster.
- **New scopes:** merchants must re-approve, so keep working with the old scopes until they do. `app.scopes_updated` tells you when.
- **Leaked client secret:** rotate it in the portal. The old one works for 24 hours.

---

## 8. Selling

- **`free`**
- **`external`:** you bill merchants on your own site. Say so on the listing; NUMU takes nothing.
- **NUMU-billed** (monthly or one-time, in EGP): only when `developers.numueg.app/partners/selling` says it is available.
- **Price in EGP.** Merchants are small businesses, and USD pricing is a hard sell.
- A free tier or trial wins far more installs in this market than a paywall.

---

## 9. Troubleshooting

| Symptom | Likely cause |
|---|---|
| `403` with an HTML body and `server: cloudflare` | The CDN, not the API. Retry with a normal `User-Agent`; if it persists, send the `cf-ray` value to partner support |
| `403` JSON `"Access token lacks the '…' scope"` | The scope is missing from the manifest, or this merchant has not re-approved yet |
| `403` on `/threads` or `/messages` | Apps need `messages:read`; `marketing` does not cover conversations for apps |
| `401` for one store only | Uninstalled or suspended. Treat it as `app.uninstalled` |
| The signature never matches | The body was parsed or re-serialised before hashing; `t.` was not prepended; the webhook (`t=…,v1=`) and query-string (sorted `k=v`) schemes were mixed up; or an old secret was used |
| `invalid_grant` | The code is older than 10 minutes, was already used, or `redirect_uri` is not byte-identical |
| A `404` that "should exist" | A missing or extra trailing slash (§ 3.1) |
| `409` on a write | The same `Idempotency-Key` is still being processed. Wait and retry |
| Arabic shows as `?` | Your stack is not UTF-8 end to end (use `utf8mb4` on MySQL) |

---

## 10. Where to look

- **Guides:** `https://developers.numueg.app`: Apps · Partners · API · Tools.
- **API reference:** `https://docs.numueg.app`.
- **Contract:** `https://numueg.app/api/v1/public/openapi.json`.
- **Manifest schema:** `https://developers.numueg.app/schemas/app-manifest-v1.json`.
- **Policies:** `https://developers.numueg.app/partners/policies`.
- **Partner portal:** `https://merchant.numueg.app/partners`.
- **CLI:** `numu app --help`.
