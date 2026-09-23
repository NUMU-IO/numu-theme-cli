---
name: numu-app-developer
description: Guide an outside developer (a NUMU partner) through building, testing, submitting and publishing a Partner App for NUMU, the Arabic-first e-commerce platform for Egyptian and MENA merchants. A Partner App is third-party software on the developer's own server that merchants install from the NUMU App Store. Covers the partner program, development stores, registering an app in the partner portal or with the `numu` CLI, the numu.app.json manifest, scopes, the OAuth install and numu_app_ tokens, signed links (install redirect, Open app), webhooks signed with X-NUMU-Signature-V1, uninstall and store.redact (PDPL 151/2020), Arabic/RTL and Egyptian-market rules, the ten review checks, publishing, pricing and troubleshooting. Use when someone builds a NUMU app, connects a SaaS to many NUMU stores, prepares a NUMU app for review, or debugs a NUMU OAuth or webhook flow. Not for NUMU's own first-party apps.
---

# Build a NUMU Partner App

You are helping a developer who does **not** work at NUMU. They are building an app that NUMU merchants install from the App Store in their dashboard. Take them through the path in order. Enforce the rules in every file you write, and aim for approval on the first submission.

---

## 0. Before anything else

1. **The docs win.** The source of truth is the developer docs at **https://docs.numueg.app/-partner-apps-2440012m0**, together with the rest of **https://docs.numueg.app**. When this skill and the docs disagree, follow the docs and say so. The machine-readable contract is `https://numueg.app/api/v1/public/openapi.json`, and each operation names its scope in `x-numu-scope`.
2. **Check the status notes on the docs pages before relying on these two:**
   - **The partner program is a private beta, by invitation.** While it is closed, `/partners` says "The Partner program isn't open yet" and the partner API answers `404`. Invitations: engineering@numueg.app.
   - **The `numu` CLI ships in `@numueg/theme-cli` 0.9.1 and later.** If `npm view @numueg/theme-cli version` shows an older version, use the partner portal for every step.
3. **Pick the right kind of integration:**

   | Building | Use |
   |---|---|
   | Something for **one** store: their own shop, an ERP sync, an internal tool | A personal access token (`numu_pat_…`), with no app and no review. Send them to https://docs.numueg.app/authentication-2433451m0 and stop here |
   | Something **many** merchants install | A Partner App: this skill |

   NUMU's own apps (WhatsApp, Inbox and others) are built inside NUMU. They are not open to outside developers.
4. **Only connected apps exist.** The app runs on the developer's server and talks to NUMU through the API and webhooks: `"type": ["connected"]`. Storefront extensions (code inside the shop's pages) are not open.
5. **Ask for their stack.** The examples here use Node and Python. Translate them faithfully, and never drop a security step.

---

## 1. The path

| # | Step | Where | Done when |
|---|---|---|---|
| 1 | Create a NUMU account and verify the email | `https://merchant.numueg.app` → **Create Account** | They can sign in |
| 2 | Apply to the partner program | `https://merchant.numueg.app/partners` | **You're a NUMU partner** |
| 3 | Create a development store | Portal → **Development stores** | A store at `<subdomain>.numueg.app` |
| 4 | Register the app | Portal → **Your apps** → **New app**, or `numu app create` | `client_id` (`numu_ci_…`) and `client_secret` (`numu_cs_…`) in the server's environment |
| 5 | Write and upload `numu.app.json` | Portal → **Upload a version**, or `numu app version` | A **Draft** version |
| 6 | Build: OAuth callback, API calls, webhooks | Their server | § 4 to § 7 done |
| 7 | Install on the development store and test | A consent link (§ 4.6) | § 10 self-review passes |
| 8 | Submit | **Submit for review**, or `numu app submit` | **Submitted**, then **In review** |
| 9 | Answer review | The portal, or `numu app status` | **Approved: ready to publish** |
| 10 | Publish | **Publish**, or `numu app publish` | **Live**. NUMU then lists it in the App Store |

Step-by-step with every portal label: https://docs.numueg.app/register-your-app-2440014m0.

---

## 2. Rules that are never broken

These block approval, or get an app suspended.

### Security
- **Secrets:** never log, commit or print the client secret, access tokens, or webhook bodies that hold customer data. Keep them in environment variables, and keep `.env*` in `.gitignore`.
- **Webhooks:** verify `X-NUMU-Signature-V1` in constant time, on the raw body, before parsing, and reject stale timestamps. **Answer `401` to a bad signature.** The reviewer sends one.
- **Signed links:** verify the `hmac` on the install redirect and on **Open app**, and reject a `timestamp` older than 5 minutes.
- **Store isolation:** key everything by `store_id`. One merchant's data must never reach another merchant's session.
- **HTTPS only:** every URL in the manifest is public `https://`. No IP literals, no `localhost`, no `.local`. For local development, use a tunnel such as ngrok or Cloudflare Tunnel.

### Data and privacy (Egypt PDPL 151/2020)
- **Scopes:** request the fewest that work, and justify each one. Any `:write` scope, and `customers:read`, `orders:read`, `risk:read` or `messages:read`, requires `developer.privacy_policy_url`.
- **Conversations need `messages`.** The inbox, messages, channels and WhatsApp need `messages:read` or `messages:write`. For apps, `marketing` does not cover them.
- **On `app.uninstalled`:** stop, delete the token, and never call the API for that store again.
- **On `store.redact`:** delete everything held about that store and its customers. It arrives 48 hours after an uninstall, and only if the manifest lists it: always list it.
- **Purpose only:** don't copy merchant or customer data into analytics, ML training, or anything the app does not need to run.

### Honesty
- **Listing:** it must match the app. No invented features, fake reviews or fake counts.
- **Pricing:** state it exactly. With `external` pricing, the listing says what the merchant pays and where.
- **Branding:** no NUMU branding, and nobody else's. Never pose as a NUMU feature.

### Platform
- **Access:** only the public API and webhooks. No scraping the dashboard or the storefront, no private endpoints, no automating a merchant's browser.

---

## 3. The manifest: `numu.app.json`

Full reference: https://docs.numueg.app/app-manifest-2440015m0. Unknown fields are refused. Check with `numu app validate`, or by uploading.

```json
{
  "manifest_version": 1,
  "slug": "shipping-sync",
  "version": "1.0.0",
  "type": ["connected"],
  "name": { "ar": "مزامنة الشحن", "en": "Shipping Sync" },
  "tagline": { "ar": "ابعت طلباتك لشركة الشحن بضغطة واحدة", "en": "Send orders to your courier in one click" },
  "description": {
    "ar": "كل طلب جديد بيوصل لشركة الشحن لوحده، من غير ما تكتب العنوان تاني. وتقدر تتابع كل شحنة من مكان واحد.",
    "en": "Every new order goes to your courier on its own, with no retyping. Track every shipment in one place."
  },
  "icon": "https://cdn.example.com/shipping-sync/icon-512.png",
  "screenshots": [
    { "src": "https://cdn.example.com/shipping-sync/shipments.png",
      "caption": { "ar": "كل الشحنات قدامك في صفحة واحدة", "en": "Every shipment on one page" } }
  ],
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
    "optional_scopes": ["catalog:read"]
  },
  "webhooks": [
    { "event": "order.paid", "url": "https://app.example.com/numu/webhooks" },
    { "event": "order.status_changed", "url": "https://app.example.com/numu/webhooks" },
    { "event": "app.uninstalled", "url": "https://app.example.com/numu/webhooks" },
    { "event": "store.redact", "url": "https://app.example.com/numu/webhooks" }
  ],
  "settings_schema": [
    { "id": "auto_send", "type": "checkbox", "default": true,
      "locales": { "ar": { "label": "ابعت الطلبات أوتوماتيك" }, "en": { "label": "Send orders automatically" } } }
  ],
  "pricing": { "model": "free" },
  "languages": ["ar", "en"]
}
```

**Rules the API enforces:**
- **`slug`** matches `^[a-z][a-z0-9-]{2,40}$`, is the one registered, and never changes.
- **`version`** is `MAJOR.MINOR.PATCH`, and every upload is higher than the last.
- **`name`, `tagline` and `description`** each have `ar` and `en`, and **the two must differ**: a copy of the English in `ar` is refused. A tagline is at most 80 characters and a description at most 4,000, in each language.
- **`icon`** and every screenshot `src` are `https://` URLs, not file paths. There are at most 8 screenshots.
- **`category`** is one of `shipping`, `marketing`, `sales`, `customer_support`, `inventory`, `analytics`, `payments`, `store_design`, `productivity` or `other`.
- **`oauth.redirect_urls`** holds 1 to 10 URLs. The App Store's **Install** uses the **first**. `oauth.scopes` has at least one scope.
- **`webhooks`** must include `app.uninstalled`. Every `order.*` event needs `orders:read`, and every `product.*` event needs `catalog:read`, in `scopes` or `optional_scopes`.
- **`settings_schema`** fields:
  - A field needs `locales.ar.label` and `locales.en.label`. It is **not** `label: {ar, en}`.
  - `header` and `paragraph` need `locales.<lang>.content` and have no `id`.
  - Ids match `^[a-z][a-z0-9_]{0,40}$`.
  - Types: `text`, `textarea`, `number`, `range`, `color`, `checkbox`, `select`, `radio`, `url`, `header` and `paragraph`.
  - `select` and `radio` need `options`: `{ "value": "bosta", "label": "Bosta", "locales": { "ar": { "label": "بوسطة" } } }`.
- **`pricing.model`** is `free`, or `external` (the partner bills the merchant; `pricing.label` in both languages is required). `recurring` (NUMU billing) is **not open**: a manifest with it is refused.

**Scopes for apps:**
- **Allowed:** `catalog`, `media`, `orders`, `customers`, `analytics`, `marketing` and `messages`, each `:read` or `:write`, plus `themes:read` and `risk:read`.
- **Never grantable:** `settings:read`, `settings:write`, `themes:write` and `risk:write`. That means no store settings, locations, shipping settings, payments, invoices, billing, or the store's other apps.
- **`:write` does not imply `:read`.**
- Adding a scope in a later version makes every merchant approve again, so plan scopes up front.

**The settings form is display-only for the app.** The dashboard shows it to merchants and saves their answers, but no API returns the values to an app token. Put any setting your server needs on your own page behind **Open app**.

---

## 4. The OAuth install

Reference: https://docs.numueg.app/oauth-and-app-tokens-2440016m0.

### 4.1 The flow
1. The merchant clicks **Install** in the App Store. Only the store owner can approve. The consent screen lists the scopes as plain sentences.
2. NUMU redirects to the callback: `?code=numu_code_…&store_id=…&state=…&timestamp=…&hmac=…`. If the merchant cancels, the callback gets `?error=access_denied&state=…`, with no code and no signature.
3. **Verify** the `hmac` and the timestamp (§ 4.2). The app checks `state` only on flows it started itself (§ 4.5). On an App Store install, NUMU chose `state`, and the `hmac` is the proof.
4. **Exchange** the code, from the server, within 10 minutes. A code works once.

   ```http
   POST https://numueg.app/api/v1/oauth/token
   Content-Type: application/json

   { "client_id": "numu_ci_…", "client_secret": "numu_cs_…", "code": "numu_code_…" }
   ```

   The response is `{"success": true, "data": {"access_token": "numu_app_…", "scopes": [...], "store_id": "…"}}`. There is no `redirect_uri` field and no refresh token.
5. **Store the token encrypted**, keyed by `store_id`. Send the merchant to the app, in Arabic unless they chose English.

### 4.2 Verifying signed links (the install redirect and **Open app**)
1. Take every query parameter except `hmac`, URL-decoded.
2. Sort them by name and join them as `k=v&k=v`.
3. Compute HMAC-SHA256 with the client secret, as lowercase hex.
4. Compare in constant time, and reject a `timestamp` older than 300 seconds.

This is **not** the webhook scheme: there is no `t=` prefix and no body.

```python
import hashlib, hmac, time
from urllib.parse import parse_qsl

def verify_signed_query(query_string: str, secret: str, max_age: int = 300) -> bool:
    params = dict(parse_qsl(query_string, keep_blank_values=True))
    given = params.pop("hmac", "")
    message = "&".join(f"{k}={params[k]}" for k in sorted(params))
    expected = hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()
    try:
        fresh = abs(time.time() - int(params["timestamp"])) <= max_age
    except (KeyError, ValueError):
        return False
    return fresh and hmac.compare_digest(expected, given)
```

Keep `state` to letters, digits, `-` and `_`. Give `app_url` no query string of its own: NUMU signs only the parameters it adds.

### 4.3 Exchange errors
Errors come in the envelope `{"success": false, "error": {"code": "HTTP_ERROR", "message": "…"}}`.

| Status | Message | Fix |
|---|---|---|
| `401` | `invalid client credentials` | Wrong id or secret, or a rotated secret |
| `400` | `invalid, expired or already used code` | Codes last 10 minutes and work once. Install again |
| `400` | `grant_type must be authorization_code` | Omit `grant_type`, or send `authorization_code` |

### 4.4 The token
- It works for **one store**, within the granted scopes, on every merchant plan, and it **does not expire**.
- It dies with `401 Invalid or revoked app token` when:
  - the merchant uninstalls or disables the app;
  - NUMU suspends the app, or pauses all partner apps;
  - a newer code is exchanged for the same store, after a 24-hour overlap;
  - the app revokes it with `POST /oauth/revoke {client_id, client_secret, token}`.
- **Rotating the client secret does not affect tokens.**
- A `401` on one store means that store is gone: stop its jobs and delete the token.

### 4.5 Asking for more scopes, or reconnecting
Send the merchant to:

```
https://merchant.numueg.app/oauth/authorize?client_id=…&store_id=…&redirect_uri=<exactly one redirect_url, URL-encoded>&scope=<every required scope plus any optional ones, space-separated>&state=<random>
```

Check `state` on return. The new token replaces the old one, and the old one keeps working for 24 hours.

### 4.6 Testing before publishing
The App Store lists only published apps. An unpublished app installs only on the partner's own development stores, through the § 4.5 link opened by the partner.

The portal does not show store ids. To get one:
1. Open the development store in the dashboard.
2. Go to **Settings → API & webhooks**, create a key with one read scope, and call `GET https://numueg.app/api/v1/auth/api-key/me`. It returns `data.store_id`.
3. Delete the key.

The portal's **Install on a development store** adds the app with no token, so it does not test the server.

---

## 5. Calling the API

| | Value |
|---|---|
| Base URL | `https://numueg.app/api/v1` (`https://api.numueg.app/api/v1` is the same API) |
| Auth | `Authorization: Bearer numu_app_…` |
| Store routes | `/stores/{store_id}/…`. Any other store answers `403 Access token is bound to a different store` |
| Success | `{"success": true, "data": …, "message": …}`. Read `data`; never parse `message` |
| Failure | `{"success": false, "error": {"code": …, "message": …}}`. Validation errors add `error.details: [{field, message, type}]` |
| Money | Integer piasters (EGP × 100), unless a field says otherwise |
| IDs and times | UUID strings, and UTC ISO 8601 |
| Trailing slashes | Collections end in `/` (`/orders/`), items don't (`/orders/{id}`). There is no redirect between them |
| Rate limit | 300 requests a minute per token. On `429`, wait `Retry-After`, then back off with jitter |
| Writes | Send `Idempotency-Key` on `POST`, `PUT` and `PATCH`. A repeat returns the first response; `409` means the first is still running |
| Identity | `GET /auth/api-key/me` returns `app_slug`, `store_id`, `store_name`, `subdomain`, `currency`, `default_language` and `scopes`. Call it at startup |
| Versioning | `v1` never removes or retypes fields. Enums grow, so ignore unknown values |

Scope errors: `403 Access token lacks the '<scope>' scope` means the scope was not granted. `403 Access token does not permit this operation` means apps can never reach that route.

---

## 6. Webhooks

Reference: https://docs.numueg.app/app-webhooks-2440017m0. The manifest is the subscription: when a merchant approves, NUMU subscribes the manifest's URLs to the events whose read scope was granted. An app token cannot call the webhooks API.

**Headers:**
- `X-NUMU-Event`
- `X-NUMU-Delivery`: the same across retries. **Dedupe on it.**
- `X-NUMU-Timestamp`
- `X-NUMU-Signature-V1: t=<ts>,v1=<hex>`, where `v1` is HMAC-SHA256 of `"<ts>.<raw body>"` keyed with the **client secret**
- `X-NUMU-Signature: sha256=…`, a legacy body-only signature. Prefer V1.

**Body:** `{"event": "order.paid", "timestamp": "…", "data": {"store_id": "…", …}}`.

**Events:**
- `order.created`, `order.paid`, `order.status_changed`: need `orders:read`. `order.status_changed` carries `new_status` and `tracking_number`, so it is the shipping event.
- `product.created`, `product.updated`, `product.deleted`: need `catalog:read`.
- `app.uninstalled` (required) and `store.redact`: need no scope.

**Which store:** every delivery carries `data.store_id`. One URL receives every store's events, so route by it.

**Delivery:**
- Reply `2xx` within **10 seconds**; queue the work.
- Deliveries are at least once, not in order. Upsert by resource id.
- A failure is retried 5 times: after 10 seconds, 30 seconds, 2 minutes, 10 minutes and 30 minutes. After the last attempt NUMU switches off that store's subscription and notifies the merchant. It comes back only when the merchant approves again (§ 4.5), because the token exchange recreates the subscriptions.
- `410 Gone` switches the subscription off at once.
- `app.uninstalled` and `store.redact` get **one attempt, no retry**. Also treat a `401` as an uninstall, and run a cleanup 48 hours later.
- While the app is disabled on a store, suspended or paused, don't count on that store's events arriving later: re-read what changed from the API when it comes back.

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
// The raw body is required: re-serialised JSON never matches the signature.
app.post("/numu/webhooks", express.raw({ type: "application/json" }), async (req, res) => {
  if (!verify(req.body, req.get("X-NUMU-Signature-V1"), process.env.NUMU_CLIENT_SECRET)) {
    return res.sendStatus(401);
  }
  const deliveryId = req.get("X-NUMU-Delivery");
  if (await alreadyProcessed(deliveryId)) return res.sendStatus(200);
  res.sendStatus(200); // answer first, work after
  await queue.add({ deliveryId, event: req.get("X-NUMU-Event"), payload: JSON.parse(req.body) });
});
```

Test the endpoint with `numu app webhook trigger order.paid --secret "$NUMU_CLIENT_SECRET"`. Add `--bad-signature` to check that it answers `401`.

---

## 7. Open app

The merchant's app page in the dashboard has a button that opens `app_url?store_id=…&locale=ar|en&timestamp=…&hmac=…`. Verify it like § 4.2. It proves the merchant came from the dashboard. It is not a login: look up the installation by `store_id` and start the app's own session. Render Arabic when `locale=ar`.

---

## 8. Designing for Egyptian merchants

Reviewers check these.
- **Arabic first:** write Egyptian colloquial (عامية مصرية), for example "اختار شركة الشحن", not the formal "يرجى اختيار شركة الشحن". Keep it short and warm.
- **RTL in the app's own pages:** use logical CSS only (`margin-inline-start`, `text-align: start`), never `left` or `right`.
- **Keep these LTR inside Arabic:** numbers, prices, phone numbers, order numbers, tracking codes, dates and code. Use `dir="ltr"` or `<bdi>`.
- **Money is EGP:** show `1,250 ج.م` or `EGP 1,250`. The API sends piasters, so divide by 100.
- **Cash on delivery dominates:** orders are confirmed by phone or WhatsApp, so a pending order is normal. Build around `order.created` and `order.status_changed`, not only `order.paid`.
- **Phones are the identity:** expect Egyptian numbers (`+20 1x xxxx xxxx`), and never require an email.
- **Mobile first:** merchants run their stores from their phones. Test at 375 px wide.

---

## 9. Registering, submitting and publishing

- **Sign in to the CLI:** `numu login` asks for the email and password. Accounts with 2FA cannot use the CLI yet, and a personal access token does not work for partner commands, so use the portal.
- **Commands:**
  - `numu app init <slug>` scaffolds the manifest and this skill.
  - `numu app validate` checks the manifest.
  - `numu app create` prints the client secret **once**.
  - `numu app version` uploads a draft; `--notes-ar` and `--notes-en` add release notes.
  - `numu app submit`, `numu app status`, `numu app publish`.
  - `numu app install --store <id>` installs without a token.
  - `numu app webhook trigger <event>` sends a signed test delivery.
- **Submit:**
  - Only a draft, or a version NUMU asked you to change, can be submitted.
  - Only one version per app can be in review at a time.
  - At submit, NUMU resolves every manifest URL and refuses private addresses.
  - A newer upload replaces older drafts.
- **Decisions:**
  - **Approved: ready to publish** means publish when ready.
  - **Changes requested** means fix, then submit again. Upload a higher version if the manifest changed.
  - **Rejected** means read the notes, and don't resubmit it unchanged.
- **Publish:** only an approved version can be published, and it must be newer than the live one. The app then shows **Not listed yet** until NUMU lists it in the App Store.
- **Updates:** every manifest change is a new reviewed version. Merchants approve new scopes one store at a time (§ 4.5).
- **Leaked secret:** rotate it on the app's page under **Credentials → Rotate secret**. The old secret stops working at once; tokens keep working.
- **Suspension:** NUMU can suspend an app. Its tokens and webhooks stop at once.

---

## 10. Self-review: the ten checks reviewers run

Approval needs all ten:
1. It installs and completes OAuth on a clean development store.
2. Every scope is used and justified.
3. The Arabic listing is real Egyptian Arabic, not formal Arabic and not a copy of the English.
4. The settings form works right-to-left, in both languages.
5. Uninstall is clean: the token is dead and `app.uninstalled` is handled.
6. The webhook endpoint rejects a bad `X-NUMU-Signature-V1` (`numu app webhook trigger <event> --bad-signature`).
7. The privacy policy covers the customer data requested.
8. The listing price equals what is charged.
9. The app does not misleadingly duplicate a core NUMU feature.
10. Support answers within 2 business days.

Also check that `numu app validate` passes, no secrets are in the repo, every URL is public `https://`, and `401`, `403`, `404`, `409` and `429` are handled.

**Release notes for the reviewer:**

```
What it does: …
How to test on a development store: …
Scopes: orders:read, to …; orders:write, to …
Data stored and how long: …
Pricing: free | external (billed at https://…, EGP …/month)
```

---

## 11. Troubleshooting

| Symptom | Cause |
|---|---|
| `401 Invalid or revoked app token` | Uninstalled, disabled, suspended, paused, replaced more than 24 hours ago, or revoked. Treat it as an uninstall |
| `403 Access token lacks the '…' scope` | Not granted. Add it in a new version and ask the merchant to approve (§ 4.5) |
| `403 Access token does not permit this operation` | A route apps can never reach, such as anything under `settings` |
| `403` with an HTML body and `server: cloudflare` | The CDN, not the API. Send a normal `User-Agent`. If it persists, report the `cf-ray` value |
| Consent: `redirect_uri does not match the app's registered redirect URLs` | It must match one of `redirect_urls` byte for byte |
| Consent: `missing required scopes: …` or `scope not declared by the app: …` | The `scope` parameter must hold every required scope, plus only declared optional ones |
| Consent: `This app is not published yet.` | Unpublished apps install only on the partner's own development stores |
| Consent: `This store's plan allows N Partner Apps.` | The store reached its plan's app limit |
| The signature never matches | The body was re-serialised before hashing, the `t.` was missing, the webhook and query schemes were mixed up, `app_url` has its own query string, or an old secret is deployed |
| A `404` that should exist | A missing or extra trailing slash |
| CLI: `not found. Are you an approved NUMU partner, and is the Partner program open?` | The account is not approved yet, or the program is closed |
| `pricing.model: recurring is not available yet …` | Use `free` or `external` |
| Arabic shows as `?` | The stack is not UTF-8 end to end (use `utf8mb4` on MySQL) |

---

## 12. Where to look

- **Partner apps guide:** https://docs.numueg.app/-partner-apps-2440012m0
- **Every page:** https://docs.numueg.app, with endpoint pages and code snippets
- **Contract:** https://numueg.app/api/v1/public/openapi.json
- **Partner portal:** https://merchant.numueg.app/partners
- **CLI:** `numu app --help`
