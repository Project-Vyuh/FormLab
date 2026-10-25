# Backend remediation — 2026-10-25

The latest local completion batch and its evidence are recorded in [LOCAL_ACCEPTANCE.md](LOCAL_ACCEPTANCE.md). It supersedes the remaining-status statements in the historical batches below for durable attachment, offline recovery, lifecycle/retention, startup pairing, usage reservations and local alert visibility. The older exported workbook has not been regraded automatically. Public deployment is still blocked by the gates in that report.

This report covers the implementation in this local worktree. The original spreadsheet is the original audit snapshot; its 83 rows have not all been marked closed. No remote system was deployed or altered.

## Follow-up remediation batch

The current source now includes the changes below. These are local regression results, not a declaration that all 36 remaining findings or the production release gates are closed. The previously exported workbook predates this batch.

| Current finding | Implemented change | Verification and remaining boundary |
| --- | --- | --- |
| R-002 stale worker / capacity | Per-claim UUID, fenced checkpoints and terminal writes, lease-loss abort, active executions retained until settled, shared SQLite claim count | Stale completion, live expired video and two-manager regression tests. Cannot promise physical cancellation of an already running remote provider call or enforce this policy across independent databases. |
| R-003 video retries | Independent consecutive failure counter and successful poll counter | Three incomplete polls followed by 429 now retry to success without restarting the remote video operation. |
| R-004 account-switch saves | Session epoch and abort scope, guards after asynchronous boundaries, immutable queued save snapshot, invalidation on auth transition | Browser-module tests confirm delayed old-account saves and uploads do not execute under a new session. Offline outbox remains separate. |
| R-001 protected image reuse | Same-origin credentialed asset fetch and direct owned asset IDs for saved-image reuse | Trusted/untrusted origin policy regression. No live paid revision/try-on acceptance while provider quota is zero. |
| R-005 result contract | Reject empty images/text, safety rejection, malformed JSON, malformed/oversize image output before success | Regression tests cover missing image, safety block and invalid JSON. Full domain-specific JSON-schema validation remains. |
| R-008 dependency failures | Redacted typed failure codes, persisted provider pause, terminal zero-quota/access rejection, bounded 429/503 retry | Zero-quota regression proves one call, paused queued work and blocked new admission; existing idempotency key remains recoverable. Capability-specific health isolation remains. |
| R-013 memory | Per-job conservative reservation, shared reservation budget, RSS high-water admission pause, sequential media hydration, bounded native image cache/threads | Memory-concurrency test passes. SDK/base64/native buffers still exist; RSS is an admission guard, not an OS hard limit. Target-machine sustained load measurement remains. |
| R-014 uploads | Shared serialized browser upload lane and sequential recursive traversal | Queued upload isolation tested. Durable resumable upload identity and orphan reconciliation remain. |
| R-016 artifact links | Owner-enforced foreign keys in job_assets and asset_references, transactional document/reference and job/output commits, migration/backfill | Cross-owner insertion denied, shared media preserved, migration idempotence tested. Publication state, checksum/media metadata, crash reconciliation and complete retention lifecycle remain. |
| R-023 tracing | Stable HTTP route labels, request ID through admission to job/attempt logs, provider status and redacted error categories | HTTP-to-attempt correlation regression. External trace exporter, provider spans, dashboards and alert delivery remain. |
| R-031 readiness | Writable data directory, disk-space headroom and provider-pause state join SQLite/config checks | Fake-provider readiness regression. This does not prove real provider quota or backup restorability. |
| R-006 request recovery | Owner-scoped job lookup by idempotency key | API isolation test. Persisting logical command identity across browser retries/reloads still remains. |
| Secrets / environment | Credential removed from example, env files ignored, native dotenv loading for .env.local and .env | Never log values. Rotate the key that was present in the example. The user's actual env file was not edited. |

Verification: TypeScript and production build passed, with 36 fake-provider/browser-module/API/worker/backup regressions. Build still warns about large browser bundles and mixed Firebase imports. No new paid provider request is part of this remediation batch. Before upgrading the live local database, an offline DB-plus-media backup was created and checked with integrity_check and both recorded media sizes. After restart, schema version 3 reported integrity_check=ok and zero foreign-key violations.

The backup command also had a destination-creation bug: it created the target and then requested a copy mode that refuses an existing target. This is fixed and covered by a regression that opens the copied SQLite database and verifies every recorded media file. Multi-writer maintenance exclusion and realistic restore/RPO/RTO drills remain open.

Highest remaining focus: durable project-result attachment, DB/filesystem crash recovery, safe retention/GC and complete restore drills, stable browser command identity, full output schema validation, production auth/TLS, provider spend ledger, target-load memory testing, external monitoring/alerts and retirement of deployed legacy services. Do not mark these complete based on the regressions above.

| Original issue area | Change implemented | Evidence / remaining scope |
| --- | --- | --- |
| Browser performs paid backend work | Node owns provider calls, model mapping, policy, token cap and job admission | Browser still composes product prompts; full domain-command/prompt migration remains |
| Fake local identity / unauthenticated API | Real local registration/login, salted scrypt, hashed sessions, cookie rotation/revocation | Integration tests cover login, logout and anonymous denial; external identity lifecycle not included |
| Job and asset ownership | Every read/cancel/delete is scoped to session owner | Cross-user negative tests; body user IDs never choose backend owner |
| CORS and Host handling | Exact Origin allowlist, mutation header, loopback binding, Host validation, same-origin proxy | Tests include hostile origin and Host; HTTPS/production proxy remains deployment work |
| Raw model/safety controls | Model allowlist, normalized input types, bounded media/text/options; policy built server-side | Legacy tool/safety overrides stripped; product prompts still client-side |
| Synchronous long API calls | Content and video endpoints both admit durable jobs and return 202 | Worker poll and UI history integration tested |
| JSON job-store races | SQLite WAL and transactions replace JSON rewrite persistence | Admission concurrency and restart tests; old jobs.json preserved |
| Idempotency | Unique owner/key constraint plus canonical input hash and kind | Five concurrent submissions execute one logical job; changed payload returns 409 |
| Worker concurrency | Bounded claims, leases and heartbeat | Worker concurrency test; global limits across multiple processes remain out of scope |
| Worker restart | Saved video operation resumes; ambiguous content does not rerun blindly | Restart and expired lease tests; remote acceptance/checkpoint gap explicitly remains |
| Retry policy | Explicit 429/503 rejections retry with bounded exponential delay and jitter | Retry and ambiguous-failure tests; broader provider classification needs live contract tests |
| Cancellation / refresh | Cancellation API and persistent generation-history panel | Terminal cancellation tested; no guarantee of remote refund/cancellation |
| Base64 HTTP media | Binary uploads; owned asset IDs in generation requests; output asset URLs | Browser smoke catches actual old-Pro contract mismatch and verifies corrected flow |
| Memory and storage growth | Streaming I/O, body/media limits, upload limit, image pixel limit, user storage cap, metadata cap and paginated lists | Oversize requests tested; peak RSS at target production traffic still unmeasured |
| Asset access / video seeking | Owner-protected reads, correct 404, range responses, private no-store policy | Byte-range and cross-user tests; CDN/signed cloud URLs remain future adapter work |
| Asset reference safety | Reject inline media documents; validate local asset ownership; reject deletion when referenced | API checks and generated-output deletion test; relational reference index and GC not implemented |
| Browser-only project/library/settings persistence | Session-owned SQLite document API with revision checks | UI signup, project/model save and refresh verified; old browser data requires explicit migration |
| Sync timer reliability | Local mode bypasses Firestore timers and persists writes to SQLite; same-tab writes serialize | No offline outbox or multi-device real-time sync; legacy Firebase sync remains outside local acceptance |
| Observability | JSON request/job logs, request IDs, readiness and owner-scoped metrics | No external alert delivery, telemetry backend or monetary provider-usage ledger |
| Budget controls | Daily admission, active-job limits and persistent rate counters | Limits count jobs, not actual currency; retries may incur provider cost |
| Firebase template/temp rules | Owner-only template reads; immutable template owner; separate temp read/delete rules | Source changes only; emulator/deployed verification pending |
| Placeholder callable AI functions | Retired endpoints throw an explicit failure | No false successful generation; optional Functions dependencies are not installed/tested here |
| Legacy upscale queue and Python SSRF/public-media issues | Trigger dispatch removed; Python service returns 410 without Google/model imports | Existing remote container and invoker IAM still require owner action |
| Data backup | Offline copy command and integrity inspection | Smoke dataset backup verified with integrity_check and asset sizes; automated schedule/retention pending |
| Dev runner failures | Unexpected child exits stop the other service; bounded shutdown grace | Browser smoke and process startup/shutdown exercised |

## Verification performed

- Main application TypeScript check and production build.
- API/worker integration tests use temporary directories and never call a paid provider.
- Browser: registered an isolated fixture account, loaded workspace, generated a fixture image, refreshed, and recovered the saved model and job history.
- Stopped the isolated API and created a separate backup. Verified SQLite integrity, three stored documents and both asset files by size.
- Optional Functions compilation was attempted but cannot resolve uninstalled `firebase-functions`/legacy dependencies. No Firebase emulator or live-cloud test was performed.

## Still open before a production claim

1. Move all domain prompt templates and workflows behind versioned server commands; finish capability-based UI rather than provider-shaped compatibility requests.
2. Add a second real provider and shared adapter contract tests. Verify real Gemini image/video calls, account permissions and current model behavior with explicit paid test authorization.
3. Add provider monetary usage ledger, reservations/settlement and spend alerts. Job-count quotas do not establish unit economics.
4. Define retention, implement orphan reconciliation/GC and test restore under realistic datasets. Preserve and explicitly migrate old IndexedDB/localStorage/JSON assets with owner mapping.
5. Add production HTTPS/Secure cookies, account recovery, broader auth policy, secret management, shared DB/object storage and global admission limits before scaling beyond one workstation.
6. Add full video duration/codec validation and sustained load/RSS/disk-failure tests. Current video validation checks the container signature only.
7. Configure actionable alerts, SLOs and an operations dashboard; readiness currently proves DB access/configuration, not a paid provider round trip or disk-free threshold.
8. Remove or redeploy existing legacy cloud services and inspect live invoker IAM/service account permissions. Local source changes cannot retire already-deployed endpoints.
9. Run Firebase emulator rule tests only if that legacy mode is retained. Local mode does not require Firebase and does not initialize its SDK clients.
10. Complete reference-index/cascade semantics, authenticated ETag caching and project-result reconciliation after refresh. Current history permits manual output recovery.

## Design choice

SQLite and filesystem storage avoid Redis and separate database/object-store processes for local testing. Transactions provide durable job ownership and idempotency. This is intentionally a single-workstation deployment; shared-cloud coordination and object storage need separate adapters and operational evidence. Do not interpret a passing fake-provider suite as evidence of live-provider performance or production readiness.
