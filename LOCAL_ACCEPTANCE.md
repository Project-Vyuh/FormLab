# Local acceptance and deployment handoff — 2026-10-25

The hardened checkout is `/Users/fci/Documents/ChatGPT/Formlabs/FormLab-local`. Do not start the older `/Users/fci/Flab/FormLab` frontend: its Vite configuration injects provider credentials into browser code. That older frontend process was stopped. Rotate the previously exposed key.

## Current decision

The local implementation has passed the checks described below. It is suitable for continued local development and the next integration phase. This is **not public-production release approval**. Real Gemini generation is still externally blocked by the previously observed zero quota, and the dependency/security gates below remain open.

| Requested work | Local implementation and evidence | Remaining boundary |
| --- | --- | --- |
| Gemini quota/billing | Key stays server-side. Quota/access errors are classified and pause provider work instead of repeatedly submitting. Fake mode requires no key. | Google project billing/quota must be enabled by the account owner. No paid request was made in this implementation batch. |
| Durable project attachment | Job success, owned asset references, project history and the generated-model library record commit transactionally. Model generation/revision, local single-pass try-on, composite and video delivery have explicit project targets. | Provider acceptance before operation checkpoint can still be ambiguous. No exactly-once promise for a remote model API. |
| Autosave correctness | Server-delivered history cannot be erased by an older ordinary autosave. Explicit history deletion uses owner-scoped tombstones and an API command. | Independent user edits still use optimistic revisions; conflicts need review instead of an automatic merge. |
| Storage crash recovery | Staging/ready/deleting/missing states, SHA-256 metadata, bounded streaming, recoverable publication and deletion, quarantine of unknown/partial files. Startup reconciliation runs before workers. | Complete power-loss/hardware-fault testing and production object-storage consistency remain separate deployment exercises. |
| Cleanup/retention | Dry-run maintenance command and opt-in scheduler. Shared and active references survive. Eligible files move to private trash before later purge. Active-project delivery records are retained with their projects. | Automatic cleanup is intentionally disabled on existing user data until its dry run and retention policy are approved. |
| Browser retry identity | Owner-bound IndexedDB command journal, atomic command creation, stable request keys, owner-scoped lookup after an ambiguous response and reload. Upload digests reuse owned media. | Device/browser storage can be cleared by the user or evicted. This is not a multi-device offline-sync system. |
| Offline-save recovery | Durable owner-bound mutation records retain their base revision and media Blobs. Server receipts make lost acknowledgments safe to replay. Reconnect/session events and a bounded retry timer reconcile pending work. | Unknown base revisions and 409 conflicts remain visible; they never silently overwrite current server state. This is not a fully offline PWA. |
| Memory/load | Shared reservations, RSS admission guard, sequential media handling, bounded native image cache/threads. Sustained load profile below passed. | SDK/base64 buffers still exist. RSS sampling and Node old-space limits are not an OS/container hard RSS ceiling. Maximum-sized real-provider load remains unverified. |
| Capability alignment | Capability endpoint drives 1K/2K choices. Local 4K actions are disabled. Video uses server capability/configuration and never asks for a browser API key. | No real-provider image-size or video access certification until quota is available. Fake video is a header fixture, not a playable video. |
| Local auth/security | Salted scrypt passwords, hashed HttpOnly/SameSite sessions, owner checks, exact origins, loopback binding and account-bound async operations. Only local provider profiles are accepted. | Auth0/OIDC, recovery/MFA, HTTPS/Secure cookies, public proxy policy and production identity lifecycle are not installed. |
| Spend and observability | Persisted per-attempt unit reservations, returned provider usage, unknown-outcome accounting, stable route/request/job/attempt logs, `/api/usage` and `/api/alerts`, plus visible local recovery/alert status. | Units are admission weights, **not currency or invoices**. Provider price reconciliation, telemetry export, on-call routing and external alerts require the deployment phase. |

## Verification

- TypeScript and production build pass. **53 regression tests pass**, covering API/worker/storage/IndexedDB/configuration behavior; run `npm run check` to reproduce.
- Browser fixture: local signup, initial project creation, model generation, saved-model selection and refresh. The history and selected result survived refresh. This test caught and led to a regression for the delayed-autosave race.
- Before migration, local data was backed up. Database and artifact migration are additive. The final startup must report the current schema version with `integrity_check=ok` and no foreign-key violations.
- Storage tests exercise complete staged publication, partial/orphan quarantine, interrupted deletion, missing media, dry-run/apply retention, shared/active references and exclusive runtime/maintenance locking.
- Fixture backup test reopens the copied SQLite database and verifies every recorded media file.

### Sustained synthetic profile

60 seconds, four users, two configured workers, 788,425-byte 512×512 RGB PNG references and output fixtures. The provider adapter hydrates real binary references; no external model is called.

| Measurement | Result |
| --- | ---: |
| Successful image jobs | 60 |
| Failed / rejected jobs | 0 / 0 |
| p95 completion | 1,256 ms |
| Peak API RSS | 146.27 MiB |
| Final API RSS | 118.81 MiB |
| Memory reservation budget | 128 MiB |
| RSS admission threshold | 256 MiB |
| Node old-space limit | 192 MiB |

Reproduce with `npm run test:load -- 60`. This is evidence for this local profile, not Gemini latency, all-day endurance or maximum-input production capacity.

## Run the matching local pair

```sh
cd /Users/fci/Documents/ChatGPT/Formlabs/FormLab-local
npm ci
# Fixture mode, no external accounts or keys:
npm run dev:fake
# Real provider mode using the existing private env file:
FORMLAB_ENV_FILE=/Users/fci/Flab/FormLab/.env npm run dev
```

Run one mode at a time. Open `http://127.0.0.1:3017`; the API is on `127.0.0.1:8787`. The dev runner loads server configuration before starting either process, selects matching origins and fails if either child exits. It does not print secrets. Stop the pair with Ctrl-C before changing modes. `.env.local` or `.env` in this checkout also works; OS environment wins. Never prefix provider secrets with `VITE_`.

## Maintenance

Stop the dev pair first. API startup, backup and maintenance acquire the same OS-backed SQLite lock file. The kernel releases that lock on a crash; a second process cannot bypass it by selecting a different API port.

```sh
npm run data:inspect
npm run data:backup -- /absolute/path/to/a-new-private-backup
npm run data:recover
npm run data:cleanup                 # Preview only
npm run data:cleanup -- --apply       # Applies configured retention
```

Default policy: terminal unlinked jobs after 30 days; unreferenced assets after 7 days; private trash after another 7 days. Active-project delivery provenance and referenced media are retained. Applying cleanup removes eligible old job metadata and moves eligible files to trash. Purging expired trash is irreversible unless a separate backup exists. Backups include account/session hashes and private media; protect them accordingly. Restore into a separate data directory and verify it before changing the active path.

The scheduler requires `FORMLAB_RETENTION_ENABLED=true`. Other policy variables are listed in `.env.example`. Do not enable it before reviewing a dry run on your data. Crash recovery does not assign unknown files to users; it quarantines them.

## Deployment gates still open

1. Rotate the key previously present in the example/older frontend, enable Google quota, then perform explicitly authorized real image, revision, try-on and video contract tests.
2. Resolve dependency advisories with compatible upgrades and relevant feature tests. The latest audit after compatible updates reports **17 advisories: 6 high and 11 moderate**. Remaining chains include legacy Firebase/gRPC, background-removal/Zod, Firebase Admin/UUID and Tailwind selector parsing. The server image decoder was upgraded to patched `sharp@0.35.5`; no forced legacy downgrade was used to make the audit count look clean.
3. Select and implement production database/object-storage/auth adapters, with migration, owner mapping, rollback and restore tests. The current store/worker uses SQLite-specific SQL; replacing it is an implementation task, not changing one environment variable. Unsupported provider profiles fail closed.
4. Configure HTTPS/Secure cookies, identity recovery/revocation, trusted public proxy, secrets management and least-privilege service access. Local HTTP sessions are not an internet deployment profile.
5. Enforce OS/container memory/CPU/disk limits and run realistic maximum-input and long-duration tests. Add independent API/worker deployment and shared coordination before horizontal scaling.
6. Attach external metrics/tracing, dashboards, alert delivery and ownership. Connect the usage ledger to actual provider prices/invoices and financial reconciliation.
7. Verify full video duration/codec validation, feature/browser acceptance beyond fixture flows, large-bundle performance and any retained legacy-cloud IAM/services. Browser prompt composition is still a compatibility layer, not a complete versioned domain-API migration.

Auth0, hosted DBs, object stores and hosting have not been provisioned. No cloud IAM, billing setting or public deployment was changed. The older audit workbook predates this implementation; this report and current tests are the handoff for this batch.
