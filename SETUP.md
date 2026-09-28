# Agent Rise pilot revision — setup

## What is ready

The app revision is ready for local review. Your supplied builds were not modified. This directory uses the September 19 build as the interface and feature baseline, with the completed storage, consent, reporting, RingCentral, and Call-E work layered into it.

The recovered features now use the same account workspace as Client Journey: Lead Desk capture writes to Contact Review Pool, campaigns and referral tracking save with the profile, the Info-graph Library uses the supplied September 19 files, and Fresh Pour notebook entries save per seminar table.

**This is not yet a verified live pilot.** No Supabase project or RingCentral configuration was supplied, and the Call-E vendor/API was not identified. Their real account and provider flows still need configuration and testing.

## Open the app

Run `START-PREVIEW.cmd`, or run `node preview.cjs` from this directory and open `http://127.0.0.1:8766/Agent-Rise.html`.

Choose **Explore without saving** to review the interface. Preview contacts live only in memory; export a JSON backup if you want to retain them. No sample contacts are added automatically.

### Assets and media

`Copy-Media.ps1` collects the supplied `assets` and `media` files from both source builds beside `Agent-Rise.html`. Run it from a normal PowerShell window before moving or publishing the folder. The local preview can also read a missing file from either original folder without changing it. If the originals move, pass their paths to `Copy-Media.ps1` or set `AGENT_RISE_ORIGINAL_FOLDER` before starting the preview. Missing files produce visible fallback messages.

Only the Final Expense and Medicare Advantage audio seminars were provided. The other Fresh Pour tables explicitly explain that their audio is not included in the pilot and offer a return path. No recordings have been invented.

## Supabase: storage and authentication

1. Open your Supabase project’s SQL Editor.
2. Paste and run `supabase/install.sql` once. It repairs the existing partial `agents` table and installs the complete schema, RLS policies, account trigger, workspace RPCs, and automation result function. It is safe to rerun after a successful or interrupted installation.
3. Enable email/password authentication. Configure email confirmation and delivery for signup, magic links, and password reset. Add your exact Agent Rise app URL to the Auth redirect allowlist. Add the localhost preview URL only if you want local auth testing.
4. Put the project URL and **publishable/anon key** into `config.js`, or enter them in Account. Never put a service-role or provider secret into the browser.
5. Sign in, save a test contact, reload, and confirm it returns. Create a second test account and verify it cannot read or change the first account's contacts, groups, training, calls, carriers, or activity.
6. Test simultaneous tabs. A stale save must report a conflict instead of overwriting newer data. Export pending work, choose Refresh account, explicitly discard the pending copy, then import the backup if needed.

Data is persisted in the requested normalized tables. Additional `carriers`, `activity_events`, and `automation_jobs` tables support the requested features. A `data` JSON column preserves extra legacy fields. Snapshot RPCs wrap saves in a transaction and check an account revision, so contact edits, group memberships, calls, and profile data save together. This uses Supabase RPCs rather than unrelated table writes that could leave a partial save.

RLS is enabled on every table. Normal users can access only their own data. Composite foreign keys prevent joining one user's contacts to another user's groups or calls. Automation jobs expose read-only ownership-filtered access; provider writes occur on the Agent Rise server.

No live database was changed or tested during this build. The SQL and policies still require execution and two-account verification in your project.

### Existing browser data

After first account login, the app offers to import existing browser contacts. Import and decline both leave the original localStorage data untouched. The old startup-reset routine is removed. Metadata uses schema version 2, and old record IDs are migrated to UUIDs.

The existing browser data must be on the same browser **origin**. A file opened directly from disk, another hostname, and localhost on a different port may have different storage. Use a JSON backup transfer when changing origin. Do not reopen the old app merely to migrate data without first accounting for its destructive reset routine.

JSON backups include contacts, groups, training, calls, carriers, activity, profile, Lead Desk campaigns/referrals, and Fresh Pour notes. CSV export includes every contact field; CSV restoration imports contact data but intentionally omits group memberships. Use JSON for complete recovery. Imports merge by ID and do not erase unrelated records.

## RingCentral

1. Register an Embeddable-compatible RingCentral app with the appropriate calling permissions and redirect URL.
2. Enter its public client ID and exact registered redirect URI in Account → Calling connections.
3. Open RingCentral and authorize inside the widget. Use Browser calling mode for the implemented web-phone events.
4. Confirm that an authorized, ready widget exposes the RingCentral call button, opens the correct number, and presents Log Call after a real call ends. Test incoming calls and busy/no-answer calls too.

The adapter uses the documented iframe/postMessage API, with strict origin and frame-source checks. Call IDs and remote phone numbers are used to match the contact instead of whichever card happens to be open. Unknown callers receive an instruction to select the correct contact manually. Desktop/native calling support depends on the user's OS calling handler. No call was placed during testing.

## Call-E: Agent Rise platform service

The app calls your Agent Rise API, which validates the Supabase session, checks the contact's ownership and consent again on the server, then invokes Call-E. Supabase stores data; it does not host the calling application logic.

1. Deploy `platform/server.mjs` on your Agent Rise backend behind HTTPS. It listens on localhost, port 8787 by default, for a reverse proxy. Run it with Node 20+.
2. Set the variables shown in `platform/.env.example` in your server's secret manager/environment. Do not serve that file or the platform directory as static web assets.
3. Adapt `platform/provider-adapter.mjs` to your actual Call-E vendor documentation. The supplied adapter defines an explicit gateway contract; it is **disabled by default** and is not claimed to match an unidentified vendor.
4. Configure `callEEndpoint` as your HTTPS `/api/call-e` URL. The browser sends only the contact ID, requested task, and an idempotency ID. The server reads the authorized contact from storage.
5. The provider/gateway must POST results to the supplied callback URL, using the per-job bearer token. Supported outcomes are `confirmed`, `rescheduled`, `declined`, `no_answer`, `voicemail`, and `callback`. Reschedule/callback results must include `next_follow_up` as `YYYY-MM-DD`. Optional fields are `duration` (seconds) and `notes`.
6. Verify request acceptance, failures, delayed results, and duplicate callback handling before enabling real calls. Refresh account to retrieve completed results. Failed attempts are excluded from calls-logged metrics.

Provider credentials never enter the browser. Callback tokens are hashed in storage, and the result transaction is idempotent. Provider-specific retry/uncertain-submission behavior must be verified against the actual API before enabling production automation.

## Dashboard definitions

- Week begins Monday; month begins on day 1, using the browser's local calendar.
- Calls exclude failed automation attempts. Reached contacts include explicit reached, appointment, callback, application, decline and reschedule outcomes; no-answer/voicemail do not count as reached.
- Appointment and application events come from normal prospect edits and call logging. Training sessions do not count as client sales appointments.
- A change to Client records a close. Existing Client/Active-policy records contribute to the current book; dated legacy closes can contribute to period counts. Undated legacy leads are not falsely counted as newly added.
- Efficiency ratios use lifetime nested cohorts. Period activity uses dated events. These are labeled separately.
- Commissions use matching carrier name, writing number, and agent-entered rate. Missing rates are counted and excluded from totals. Renewal income uses active policies. One prospect currently represents one tracked policy, matching the supplied data model.

## Reference corrections

The supplied spec's general exemption for personal appointments was replaced with a more accurate disclosure note. The app retains the requested consent guards as a product rule; those controls alone do not certify compliance.

- [Current TPMO disclosure requirements](https://www.ecfr.gov/current/title-42/section-422.2267)
- [CMS agent/broker compensation data](https://www.cms.gov/medicare/health-drug-plans/managed-care-marketing/medicare-marketing-guidelines/agent-broker-compensation)
- [CMS June 18, 2025 memo containing the 2026 national and regional rates](https://22041182.fs1.hubspotusercontent-na1.net/hubfs/22041182/3_Miscellaneous/Official_CMS_Documents/memo-agent-broker-compensation-and-training-and-testing-requirements-cy2026.pdf)
- [RingCentral Embeddable API](https://ringcentral.github.io/ringcentral-embeddable/docs/integration/api/)
- [RingCentral call events](https://ringcentral.github.io/ringcentral-embeddable/docs/integration/events/)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Tests

Run `node tests/core.cjs`. See `VERIFICATION.md` for the completed browser checks and remaining live acceptance checks.
