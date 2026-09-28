# Verification report

## Completed

Fifteen browser workflow checks passed in headless Microsoft Edge. A separate visual review checked the main workspace and performance dashboard. A save-strip layering defect found during these tests was fixed.

1. Startup leaves existing browser contacts untouched.
2. New prospect defaults to Contact Review Pool.
3. Promotion rejects missing permission.
4. Valid PTC and SOA permit promotion.
5. Expiration calculation handles leap years and invalid dates.
6. Quick call logging updates the contact and dashboard.
7. Carrier saving produces a valid portal link.
8. All three TPMO selections produce their intended output.
9. Fresh Pour resource remains locked until audio ends.
10. Training appointments use UUIDs compatible with the database.
11. JSON backup round trip merges without duplicate records.
12. Expired PTC, DNC, missing SOA, and Call-E eligibility are blocked.
13. A simulated failed cloud save retains contacts and displays an error.
14. The layout fits a 390px viewport; mobile media selection uses width.
15. No browser runtime errors in that workflow run.

Subsequent core tests additionally verify cloud `HH:mm:ss` training times, rejection of newer/invalid backup schemas, preservation of undated legacy contacts, close-event recording, safe portal URL protocols, and JavaScript syntax. Run them with `node tests/core.cjs`.

The September 19 recovery pass also verifies that Lead Desk campaign/referral state and per-table Fresh Pour notes are included in the account snapshot and Supabase profile payload. Lead Desk uses the existing prospect list rather than a separate browser database. Captured contacts stay in Contact Review Pool; phone and email are omitted unless permission is recorded.

The error-report tray catches explicit Supabase account/save failures, uncaught JavaScript errors, and unhandled promise rejections. It redacts Supabase secret keys, bearer authorization values, and JWT-shaped tokens before display or copying; if clipboard access is unavailable, it downloads a text report instead.

The account guard now distinguishes an authenticated workspace from preview mode. Preview changes no longer block account creation or sign-in; after authentication, the preview snapshot is merged into the user’s workspace and saved. The guard tracker is placed after the error tray immediately before `</body>` and records a stack trace if the authenticated-workspace guard is reached. It preserves the browser’s native `Error` constructor.

`node tests/platform.mjs` also passes mocked-storage checks for server-side consent, disabled-provider failure logging, duplicate request handling, cross-owner denial, origin checks, and invalid callback rejection. These tests do not place calls or establish real RLS behavior.

All eight supplied audio/video/resource assets returned HTTP 200 through the local preview, and their served byte lengths matched the original files.

## Link and action destinations

| Action | Destination / result |
|---|---|
| Filters and search | Matching contacts; clear-filter action when none match |
| Add / edit / view | Prospect form; review pool by default |
| Move to New Lead Pool | Consent guard, then pool change |
| Built-in phone | `tel:` handler plus manual Log Call dialog |
| RingCentral | Authorized iframe dialer; otherwise native phone remains available |
| Call-E actions | Agent Rise server endpoint; explicit error and logged attempt if unavailable |
| Log Call | Call history and prospect last-contact/outcome update |
| Training | Saved appointment, Yahoo Calendar form, or downloadable ICS |
| Scripts | Generated text, clipboard copy, or text download; counts needed for TPMO export |
| Fresh Pour | Two supplied audio seminars and their resource downloads; unavailable tables explain their state and allow return |
| Fresh Pour notebook | Saved per seminar in the account workspace, with a plain-text download |
| Info-graph Library | Three supplied infographs and the supplied field guide download |
| Lead Desk | Consent-aware quick capture, review outcomes, source/campaign scoreboard, campaigns and referral tracker |
| Stats | Period activity, lifetime conversion, commission estimates, trends, source performance and call history |
| Carriers | Editable references and validated HTTP(S) portal links |
| Backup | Full JSON or contact CSV download; validated merge import |
| Erase contacts/groups | Exact typed `ERASE` confirmation |
| Account | Supabase password signup/sign-in, email link, password reset, sign-out |
| Retry / Refresh | Retry unsaved data or explicitly reload the account |

## Not yet verified live

- Supabase schema execution, auth email delivery, real persistence, RLS with two accounts, and real concurrent-tab conflicts.
- RingCentral authorization, microphone permissions, live calls and provider event shapes for the registered app.
- The actual Call-E vendor adapter, real outbound calls, webhook delivery, and uncertain/timeout recovery.
- OS native `tel:` handling, which requires a configured calling app/device.
- Yahoo account event submission and agent-entered carrier portal authorization.
- A self-contained binary asset copy. The provided `Copy-Media.ps1` should be run in a normal PowerShell window before distributing the folder; the supervised workspace blocked binary copies during this pass, while the local preview successfully resolves both original source folders.

These distinctions matter: mocked failures and core tests do not establish live provider connectivity or database isolation.
