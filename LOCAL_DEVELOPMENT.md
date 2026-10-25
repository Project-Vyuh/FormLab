# Local FormLab without Firebase

## Current implementation

See [LOCAL_ACCEPTANCE.md](LOCAL_ACCEPTANCE.md) for the current startup, schema, recovery, maintenance, test evidence and deployment gates. The sections below describe the original local foundation; this current section supersedes older statements about the port, minimal fake JSON, per-process-only claims, missing outbox/reconciliation and manual-only maintenance exclusion.

- Default paired UI: `http://127.0.0.1:3017`; API: `127.0.0.1:8787`.
- Start fixtures with `npm run dev:fake`. For the existing external key file use `FORMLAB_ENV_FILE=/Users/fci/Flab/FormLab/.env npm run dev`.
- Schema 5 adds staged artifact lifecycle/checksums, durable project deliveries, mutation receipts, history tombstones, upload identities and usage reservations. It remains SQLite plus private filesystem storage.
- Pending mutations and generation request keys survive reload in owner-bound IndexedDB. The recovery panel shows pending/conflicting work. This does not turn the app into a fully offline PWA or bypass revision conflicts.
- Delivered history survives delayed autosaves. Deleting delivered history is an explicit owner-scoped action, not an inferred missing list item.
- `npm run data:cleanup` previews retention; `-- --apply` applies it. Automatic retention is opt-in. Files move to private trash before configured later purge. A kernel-backed runtime lock excludes API writers during backup/recovery/maintenance.
- `npm run test:load -- 60` exercises synthetic binary image load without paid requests. RSS is monitored and admission-limited, not OS-hard-capped.
- Runtime Tailwind CDN execution was replaced with local CSS compilation. Native media decoding uses patched Sharp; remaining dependency advisories are a deployment blocker, not hidden by forced downgrades.
- Auth0/hosted DB/object-storage/public TLS and external alert delivery are intentionally not configured. Local provider profile flags reject unsupported production backends.

## Original foundation notes

Requires Node 22.13+ (Node 24 LTS recommended) and npm. SQLite is supplied by Node. There is no Firebase, Docker, Redis or external identity account required for local mode. Node currently prints an experimental notice for its SQLite API on some supported releases.

From this directory:

```sh
npm ci
npm run dev:fake
```

Open http://127.0.0.1:3000. Select Sign Up and create the first local account using an email-shaped username and a password of at least 12 characters. Local mode does not send email or require Google sign-in. Registration closes after the first account by default. Do not reuse the temporary browser smoke-test account as your own account.

Fake mode exercises the real HTTP API, sessions, SQLite queue, worker, project storage and asset delivery without sending anything to Gemini. The image is a tiny fixture; fake video is only a container-header fixture and is not a playable generated video. Structured garment JSON from fake mode is a minimal fixture, not a simulation of every AI task. The header identifies the test provider.

If another project occupies port 3000:

```sh
FORMLAB_WEB_PORT=3017 FORMLAB_WEB_ORIGINS=http://127.0.0.1:3017 npm run dev:fake
```

## Real Gemini generation

Create `.env.local` from `.env.example` only if it does not already exist. Preserve any existing keys. Set:

```dotenv
VITE_BACKEND_PROVIDER=local
FORMLAB_AI_PROVIDER=gemini
GEMINI_API_KEY=your-key
FORMLAB_VIDEO_ENABLED=false
```

Then run `npm run dev`. Restart after changing server configuration. Enable video with `FORMLAB_VIDEO_ENABLED=true` only when your Gemini account has access to the configured video model. Provider billing and availability remain external requirements. No real paid generation was used during this implementation's tests.

Local browser requests use Vite's same-origin `/api` and generated `/assets/<uuid>` proxies. `VITE_API_BASE_URL` is ignored in local mode to prevent localhost/127.0.0.1 cookie mismatches. The API remains on loopback. A static production frontend needs an equivalent trusted reverse proxy; `vite preview` alone is not the full backend.

## Configuration

Server variables are validated in `server/config.mjs`. Secrets must never have a `VITE_` prefix.

| Variable | Default / purpose |
| --- | --- |
| `FORMLAB_AI_PROVIDER` | `gemini`; `fake` for offline fixtures |
| `FORMLAB_DATA_DIR` | `.formlab`; private directory containing SQLite and media |
| `FORMLAB_API_PORT` | `8787` |
| `FORMLAB_WEB_PORT` | `3000` |
| `FORMLAB_WEB_ORIGINS` | localhost and 127.0.0.1 on port 3000; exact comma-separated allowlist |
| `FORMLAB_WORKERS` | `2`; bounded jobs per process |
| `FORMLAB_ALLOW_REGISTRATION` | `false`; only the first account can register |
| `FORMLAB_DAILY_JOB_LIMIT` | `50` accepted logical jobs per user per rolling 24 hours |
| `FORMLAB_PENDING_JOB_LIMIT` | `10` active/pending jobs per user |
| `FORMLAB_MAX_ASSET_BYTES` | `20971520` binary bytes per media file |
| `FORMLAB_USER_STORAGE_BYTES` | `1073741824` binary storage bytes per user |
| `FORMLAB_TEXT_MODEL` | Server mapping for text capability |
| `FORMLAB_IMAGE_MODEL` | Server mapping for standard image capability |
| `FORMLAB_PRO_MODEL` | Server mapping for Pro image capability |
| `FORMLAB_VIDEO_MODEL` | Server mapping for video capability |

Image options currently permit up to 2K; the legacy UI still exposes 4K, which the server rejects. Search tools, browser-provided safety settings and arbitrary system instructions are not forwarded. Domain prompt composition remains in existing UI services for compatibility; server model, token, concurrency and policy controls are authoritative.

## Data and security

The backend stores accounts, hashed sessions, jobs, projects, libraries and settings in `.formlab/formlab.sqlite`. Media is private under `.formlab/assets` and requires the owning session. Passwords use salted scrypt with N=32768, r=8, p=3, one of the [OWASP recommended baselines](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). The encoding is versioned. Session cookies are HttpOnly and SameSite Strict, with a one-day expiry. HTTP cookies are appropriate only for this loopback development setup; an internet deployment requires HTTPS and Secure cookies plus a deployment security review.

The browser no longer fabricates a local user. Each API operation derives the owner from the session rather than trusting a client user ID. Writes require a custom header and approved browser origin. Host validation limits DNS rebinding. Local mode does not initialize Firebase clients.

Project documents use expected revisions: stale writes fail with 409. Same-tab saves serialize by document. Errors are surfaced rather than silently accepted. This is online-to-localhost persistence, not an offline mutation outbox; save errors require reconnect/reload and retry. Old IndexedDB/localStorage records and the old JSON job store are preserved, not automatically reassigned to the first new account. Back them up before planning an explicit import. They are not shown automatically by the new backend.

Input uploads stream as binary and are bounded. Output images are stored as authorized asset URLs; generated image base64 is not kept in job JSON. Gemini may require internal base64 conversion inside its adapter. Some legacy browser image-editing helpers still decode images for canvas operations. Signature/dimension checks reject unsupported images and animated images. Video container signatures are checked, but full video duration/codec scanning is a remaining hardening task.

## Queue behavior

Long generation requests return 202 with a job ID. SQLite uniquely binds the owner and idempotency key to the normalized input hash. The worker claims jobs transactionally, heartbeats leases, checkpoints video operation IDs and bounds concurrency. Explicit transient rejections retry with jitter and a bounded attempt count. Daily quotas count logical requests, not provider retry costs.

After a crash, queued work is retained and known video operations resume after the lease expires. Content submissions with ambiguous provider acceptance fail for reconciliation instead of automatically spending again. This intentionally does not promise exactly-once provider execution across a crash between remote acceptance and saving its operation ID.

Use the header's local storage button to inspect recent generation history, reopen outputs and cancel active work. A cancellation stops local processing where possible; it cannot guarantee a provider refunds or stops an already accepted operation. The UI's generation wait is bounded. Reloading a page preserves the job but does not automatically attach an unfinished generation result to a project.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

Tests use temporary data directories, fixture accounts and a fake provider. They do not alter your `.formlab` data or call Gemini. Coverage includes authentication, owner isolation, CORS/Host checks, concurrency, idempotency conflicts, streaming and oversize media, image references, revision conflicts, cancellation, restarts, lease recovery and retry/quota rules.

`GET /api/health` is liveness. `GET /api/ready` checks database access and provider configuration. Signed-in `GET /api/metrics` returns owner-scoped job counts, queue age inputs, sampled p95 completion duration, asset bytes and process RSS. Request/job logs contain correlation IDs and omit payloads, passwords, cookies and provider keys. External dashboards, alerts and provider monetary usage accounting are not configured.

## Backup and recovery

Stop **all** API processes using the data directory before backup. Do not point two dev stacks at the same data directory: per-process worker/upload limits are not a multi-instance global limit.

```sh
npm run data:inspect
npm run data:backup -- /absolute/path/to/a-new-backup-directory
```

Backup refuses an existing destination and copies SQLite, WAL and media together while no application writer is running. It checks the configured API port; stopping all writers remains the operator's responsibility. The backup includes password/session hashes and private media. Protect it like the original data. To restore without overwriting anything, set `FORMLAB_DATA_DIR` to the backup copy and start the server. Revoke sessions when using a backup outside its original trusted workstation.

The browser smoke dataset was backed up and checked with SQLite integrity checks and file-size verification. Automated retention and orphan collection are not enabled yet; inspect disk usage and choose a retention policy before long-running or shared use.

## Legacy services and production boundary

Firebase remains a separate legacy compatibility path and is not part of local acceptance. Callable placeholder AI functions and the old Firestore upscale trigger now fail closed. The Python upscaler is retired and returns 410, removing its arbitrary URL fetching and public output logic. Existing remote deployments are unchanged until their owner redeploys or disables them. No cloud IAM was changed.

Before an external paid launch, complete the remaining items in `BACKEND_REMEDIATION.md`, including domain API/prompt migration, provider usage billing, production identity/TLS, retention, larger load tests and a deployed IAM audit. This local implementation does not claim to close every original audit row.
