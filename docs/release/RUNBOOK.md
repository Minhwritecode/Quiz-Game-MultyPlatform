# Papyrus release / operations runbook

Run from the release checkout root. The team's Expo project is linked in source;
signing credentials, native acceptance and store accounts remain separate gates.
See [RUN-ON-PHONE](RUN-ON-PHONE.md) for APK installation and iOS development builds.

## 1. Install and verify

```bash
npm ci
npm run typecheck
npm run lint
npm test -- --ci
npm run test:release
./scripts/check_architecture.sh
npx --no-install expo export --platform web
```

The current lint baseline has warnings; a green lint exit only means no errors.
Compiler checks on inherited route/game files are warnings and the experimental
compiler is disabled. Do not call this the slide's zero-warning acceptance gate.
Jest only discovers Papyrus `src`, excluding copied skills. EAS/Docker exclude all
four reference repos, skills, credentials, local env and generated native folders.

## 2. Accounts and environment setup (when available)

1. Run `npx --no-install eas login`, then `eas project:info` for the group's existing
   project `f4872061-8848-48a7-9d26-a1dbec552c6b`. Do not create a second starter/project.
2. Dynamic config and preflight use the committed UUID in `app.json`. Set
   `EAS_PROJECT_ID` only to intentionally select another authorized project.
3. Configure `development`, `preview`, `production` EAS environments. Use a separate
   Supabase dev/preview project instead of testing against real student data.
4. Create matching GitHub environments. Protect production with required reviewers
   where the repository plan supports it; do not assume a YAML environment enables protection.
5. Set public values below in both EAS environments and corresponding GitHub environment
   variables. Keep `APP_VARIANT` identical to the environment name, including OTA.
6. Configure remote EAS signing interactively once, securely back up the upload key,
   then run non-interactive workflows. Never post credentials to chat or Git.

| Value | Visibility/location | Purpose |
| --- | --- | --- |
| `APP_VARIANT` | development / preview / production | Name, package ID, scheme, diagnostics environment |
| `EAS_PROJECT_ID` | Public UUID, EAS + GitHub vars | Update URL/project identity |
| `EXPO_PUBLIC_SUPABASE_URL` | Public, EAS + GitHub vars | Backend for that environment |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Publishable/anon, EAS + GitHub vars | App key; RLS still required |
| `EXPO_PUBLIC_SENTRY_DSN` | Public DSN, EAS + GitHub vars | Crash ingest, not an administrative token |
| `SENTRY_ORG`, `SENTRY_PROJECT` | EAS + GitHub vars | Symbol destination |
| `SENTRY_AUTH_TOKEN` | EAS secret + GitHub secret | Source-map/symbol uploads only |
| `EXPO_TOKEN` | GitHub secret | Scoped build/update automation identity |
| `EXPO_PUBLIC_PRIVACY_URL` | Public HTTPS | Published reviewed policy |
| `EXPO_PUBLIC_ACCOUNT_DELETION_URL` | Public HTTPS | Web account/data deletion instructions/request channel |
| `EXPO_PUBLIC_SUPPORT_URL` | Public HTTPS | Support/feedback channel |
| `EXPO_PUBLIC_RELEASE_POLICY_URL` | Optional public HTTPS JSON | Platform minimum supported version |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Supabase Function secrets only | Live AI; quota required before public usage |

EAS env `secret` variables cannot be pulled to local machines. Provide the Sentry
upload token separately in the CI job/local process for symbol uploads. Build-time
`EXPO_PUBLIC_*` values are included in the app bundle. They must never contain
service-role keys, database passwords, AI API keys or signing private keys.

## 3. Local backend verification and deployment handoff

Supabase CLI 3.1.0 is local by default. Read command `--help` for hosted flags.

```bash
supabase start
# Fresh disposable stack applies committed migrations, including account cleanup.
for file in supabase/tests/battle_security.sql supabase/tests/battle_lifecycle.sql supabase/tests/account_cleanup.sql; do
  docker exec -i supabase_db_papyrus-local psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$file"
done
supabase functions serve
# In another terminal:
node scripts/test-release-local.mjs
```

`test-release-local.mjs` refuses non-loopback API hosts, creates disposable accounts,
does not invoke Gemini and removes its fixtures. SQL tests rollback their fixtures.
The new migration has been executed directly on the existing local stack during this
task. For that stack, review migration history and record it applied using CLI repair
before a future db push; **do not reset a shared/local database just for a test**.
Fresh CI stacks apply the migration normally.

Deploy order on a designated cloud dev project: verify target → migrations dry run →
migration → `delete-account` and hardened `generate-questions` Functions → API smoke
with disposable dev accounts → app. Do not deploy just the client deletion screen
and assume the endpoint exists. Keep `verify_jwt=true`; the Function additionally
resolves the user through Auth to reject stale/deleted identities.

The cleanup trigger handles rooms referencing a deleted owner's sets even after
host transfer. It executes inside the Auth delete transaction and is not executable
by anon/authenticated clients. Deletion cancels those rooms; show that consequence
in the confirmation. Other users/independent rooms remain. Future Storage buckets,
analytics providers or new foreign keys need corresponding deletion handling/tests.

## 4. Build candidates

| Profile | Package / bundle ID | Scheme | Android artifact |
| --- | --- | --- | --- |
| development | `com.papyrus.quizclash.dev` | `papyrus-dev` | Development client |
| preview | `com.papyrus.quizclash.preview` | `papyrus-preview` | Signed APK for QA |
| production | `com.papyrus.quizclash` | `papyrus` | Signed AAB for store |

```bash
# After environments/signing have been set up:
npx --no-install eas env:exec preview 'node scripts/check-release.cjs'
npx --no-install eas build --platform android --profile preview
npx --no-install eas build --platform ios --profile preview
npx --no-install eas build --platform android --profile production
npx --no-install eas build --platform ios --profile production
```

Preflight is an `eas-build-post-install` hook, so direct EAS builds also validate the
environment. `npm ci` alone does not run this EAS-specific hook. `.env.local` is
excluded from uploads: configure EAS variables, not a developer machine's secrets.
Remote version counters prevent reusing build numbers; user-facing SemVer is in
package.json. Bump app.json version in the same PR for readable static metadata.

Fastlane alternative: use Ruby >=3.2, `bundle install`, commit Gemfile.lock after
resolving on the group's supported Ruby, then `bundle exec fastlane verify` or
`bundle exec fastlane android preview`. The current Mac's Ruby 2.6 only verified
Fastfile syntax; full bundle execution remains pending. EAS owns signing for both
paths, so Fastlane does not also run `match` or generate an unrelated Gradle keystore.

GitHub `Mobile release candidate` supports manual profile/platform selection.
A version tag builds Android production after quality gates, downloads the exact
build artifact with SHA256, and attaches it to a **draft** GitHub Release. Re-running
the same tag's draft step can fail if the release already exists; inspect/reuse the
existing draft rather than publishing a second candidate blindly. No workflow
submits to a public store. Internal/TestFlight upload is explicit:

```bash
bundle exec fastlane android submit build_id:THE_REVIEWED_EAS_BUILD_UUID
bundle exec fastlane ios submit build_id:THE_REVIEWED_EAS_BUILD_UUID
```

Before submit, configure Play service-account credentials through EAS and real iOS
`ascAppId` in eas.json. Android submit defaults to internal/draft. Apple upload is
not App Review approval. Before sharing: verify checksum, `apksigner verify --verbose`
for APK, `jarsigner -verify` for AAB plus expected certificate, and installation/update
on a real phone. An AAB cannot be installed by tapping it; use the preview APK or
Play testing distribution. Artifact ZIP validation is **not** signature verification.

## 5. OTA rollout and rollback

Use the OTA workflow after testing the same native runtime in preview. It downloads
the selected EAS environment, validates config, uses its channel and uploads matching
source maps. Production starts at 10%; preview at 100%. Inspect adoption/errors before
increasing the rollout. Avoid concurrent store and OTA changes while diagnosing.

Native SDK/plugin/permissions/entitlements changes require a new binary. The runtime
fingerprint separates native configurations. OTA startup recovery is limited; do not
assume every runtime error or data migration can be rolled back automatically.

```bash
npx --no-install eas update:list --help
npx --no-install eas update:rollback
# Or choose an exact affected runtime and platform after inspecting the deployment:
npx --no-install eas update:roll-back-to-embedded --channel production --runtime-version THE_AFFECTED_FINGERPRINT --platform android
```

Incident sequence: stop further rollout → identify version/build/update ID → choose
known-good runtime-compatible update/embedded binary → rollback → verify on affected
phone → watch errors → record root cause and regression test. Database migrations
must remain backward compatible; OTA rollback does not restore deleted server data.

Publish `release-policy.example.json` only after replacing store URLs with real ones.
The app reads policy at startup with a 4s timeout. Bad/missing/offline policy fails open
to protect offline learning. This UI gate is not backend API authorization, and is not
an offline kill switch. Raise minimum version only for an actual incompatibility and
after the new version is available in the user's store region.

## 6. Observability and incident ownership

Sentry is inactive without DSN or in debug. Native builds need the Expo Sentry plugin
and upload token; Metro config handles JS source maps. Check one deliberate error on
a dedicated test build and confirm the source file/line, environment, app/build version.
Native dSYM/Android mappings need their own crash drill; do not infer them from JS.

No notes, raw questions, source photos, JWT, email or password should enter diagnostics.
JS events are allowlisted, breadcrumb/log/screenshot/view hierarchy content is omitted.
Review native crash envelopes and third-party SDK collection separately before release.

Suggested internal acceptance targets (not measured results): crash-free sessions
>=99.5%, no reproducible cold-start crash, no data loss, no unresolved high-impact auth
issue. Measure OCR/generation p50/p95 per device/model/input size. Define alert rules
after enough real sessions; do not treat slide percentages as measured Papyrus results.

| Event | Alert / response | Owner to assign |
| --- | --- | --- |
| Startup crash introduced by update | Halt rollout, capture sanitized release metadata, rollback | Release lead |
| Auth/deletion outage | Keep account state/data recoverable, investigate Function/Auth logs | Backend owner |
| AI timeout/invalid result spike | Disable live generation or cap quota; keep manual authoring | AI owner |
| Sync conflict/data loss | Stop affected writes; inspect mutation/revision IDs without notes | Data owner |

AARRR is a future opt-in analytics plan, not an installed tracker. If approved, define
`onboarding_completed`, `source_confirmed`, `set_saved`, `study_completed` with only
app version/platform/outcome and aggregate counts; avoid text, account IDs or filenames.
Document purpose/consent/retention first. Feedback currently opens the configured HTTPS
support channel; an in-app feedback backend is not implemented.

## 7. Device acceptance

Run `maestro test -e APP_ID=com.papyrus.quizclash.preview -e APP_SCHEME=papyrus-preview -e RUN_ID=001 e2e/maestro/core-study.yaml`
on a test installation. Give each run a unique ID. The script creates a manual set,
restarts the app and studies it; it has not run in this task. It does not clear existing
app data. Repeat manually with airplane mode enabled before authoring.

Record actual OS, model, build ID/hash, time and outcome for:

- Android phone + iPhone; tablet; foldable closed/opened while on source/review/study.
- Camera allow/deny/cancel; gallery picker; multilingual OCR with real printed notes.
- Guest/manual offline; restart; low storage/save failure; result persistence.
- Verified email login, password recovery and each enabled OAuth provider on native.
- Slow network, timeout, reconnect; explicit manual sync and conflict choice.
- Disposable account deletion, transferred host, second account remains intact.
- Game owner acceptance: timers, rapid taps, background/foreground, rotation.
- Large text, dark mode, keyboard overlap, touch targets, screen readers.
- OTA install, no-network startup, rollback and required-upgrade link.

Do not mark device tests complete from web export, prebuild or component tests.
