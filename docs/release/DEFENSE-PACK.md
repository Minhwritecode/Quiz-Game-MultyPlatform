# Week 13 defense handoff

Preparation outline from Week 12 pages 55–59. This is not Report 4 PDF, a finished
slide deck, a release binary or a demo video. Attach actual artifacts only after validation.

## Five deliverables

| Deliverable | Required evidence | Current state |
| --- | --- | --- |
| Report 4, 25–40 page PDF | Official template chapters 1–6, measured results | Pending template-specific final report |
| Defense PDF, 10–12 slides | 12–15 minute presentation | Outline below |
| Signed APK/AAB (v1.0.0 when ready) | Checksum, certificate, phone installation | EAS preparation only |
| Clean source repository | README, workflows, Fastfile, commit history | Branch prepared; merge/team changes require review |
| Phone video 3–5 minutes, 1080p | Real device, visible actions, backup file | Not recorded |

## Report chapter evidence map

1. Problem / user / scope: Report 1 and scoped Week 12 core flow.
2. Requirements / UI: Report 1, Figma, implemented routes; distinguish demos from live data.
3. Architecture / data: Report 2, migrations, composition, Domain/Data dependencies; list violations.
4. Implementation: manual/source/AI/study/sync/battle and each teammate's real contribution.
5. Evaluation: Report 3 plus new tests, physical-device AI/FPS/size metrics, limitations.
6. Conclusion / deployment / future work: release gates, signed artifacts, backlog and source attribution.

Adapt labels/ordering to the instructor's actual Report 4 template. Don't expand a
progress note to 25 pages with invented metrics. Preserve license/source acknowledgments
and disclose tool assistance according to the course's policy.

## Twelve slide outline

| Slide | Content | Time |
| --- | --- | --- |
| 1 | Papyrus, slogan, team and exact contribution | 0:00–0:30 |
| 2 | Learner problem and one concrete scenario | 0:30–1:20 |
| 3 | Release scope and exclusions | 1:20–2:00 |
| 4 | Presentation → Domain ← Data, real source examples | 2:00–3:00 |
| 5 | Supabase schema/RLS and local outbox revisions | 3:00–4:00 |
| 6 | CI/EAS/signing/OTA and rollback | 4:00–5:00 |
| 7 | Physical demo: source, OCR, review | 5:00–6:45 |
| 8 | Physical demo: save/study/result, then offline | 6:45–8:30 |
| 9 | Reconnect + explicit sync; optional existing game | 8:30–10:00 |
| 10 | Measured tests/AI latency/FPS/binary size | 10:00–11:15 |
| 11 | Limitations and release readiness | 11:15–12:00 |
| 12 | Q&A; links and code navigation | 12:00–15:00 |

## Demo script and contingency

Prepare a real phone, USB cable, printed study notes, a dedicated account and a second
device only if demonstrating battle. Mirror Android via scrcpy or iOS via QuickTime.

1. Cold start the signed build; show app version and install source.
2. Capture a short note; correct OCR text. If AI is configured/tested, generate and edit.
   Otherwise demonstrate manual authoring and clearly say AI acceptance is pending.
3. Save the set; enable airplane mode; study a few questions and open saved results.
4. Restart while offline and show persistence. Reconnect, press Sync and show confirmed
   server changes; **do not claim automatic sync when a button is required**.
5. If time permits, show the existing game without rewriting its behavior for the demo.
6. Use only a disposable account for deletion; explain permanent effects before live testing.

Record a 3–5 minute 1080p backup video locally, prepare an offline MP4 player and spare
cable. Never show .env, signing keys, provider tokens or real account passwords on screen.

## Questions each member should answer

- Why does Domain not import Supabase/React Native? Show one actual port and adapter.
- What is atomic in the outbox? How does a duplicate mutation or revision conflict behave?
- What does the server validate before awarding battle points or deleting an account?
- Where does source text leave the device? Which evidence shows that behavior?
- What can OTA change, which runtime is eligible and how do we roll it back?
- Which metrics were measured on release hardware versus mocked/unit tests?
- Which features came from reference ideas, what is independently implemented, what remains?
