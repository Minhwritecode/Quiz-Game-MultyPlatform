# Mobile release UX checkpoint — 12 November 2026

Applied local mobile skills: building-native-ui, expo-animation; accessibility and
layout guidance from ui-ux-pro-max. Existing game source is unchanged.

Implemented in this iteration:
- Settings persist theme, language, haptics preference and reduced-motion preference.
  Only preferences are persisted by this store; account sessions/source documents are excluded.
- System/light/dark appearance controls affect shared surfaces and status bar.
- Editable account display name through authenticated Supabase Auth, with validation,
  saving/error feedback and guest sign-in path. This is Auth metadata, not a complete
  public-profile service or avatar upload system; battle profile-table names still need alignment.
- Local opt-in study reminder at 19:00 device time on Android/iOS, Android channel,
  permission denial feedback, cancellation and system-settings link. No remote push
  tokens, backend campaigns or exact-alarm permission. System power saving may delay delivery.
- Notification tap opens the study library; consumed response is cleared.
- Removed the artificial startup progress/splash delay. Navigation respects system
  Reduce Motion and user preference; shared button press motion respects the preference.
- Keyboard-friendly scrolling and disabled button accessibility state.

Core UI exists: source intake, review/manual question authoring, library, study,
results, account sync, auth, privacy and settings. Existence is not native acceptance.

Still required before a professional public release:
- Measure release startup/frame time/memory on Android and iOS, not web or Jest.
- Run permission allow/deny, scheduled delivery, reboot/timezone/DST, cold/warm tap
  and schedule cancellation tests on physical devices. Native module requires a new build.
- Visually test all new settings/profile layouts at large text sizes and narrow/foldable
  widths. The local browser-control setting previously blocked visual verification.
- Finish VI/EN labels consistently, avatar handling and verified native OAuth/recovery.
- Ensure haptic preference controls every relevant game/action; this iteration preserves
  teammates' game behavior and does not claim those effects are fully wired.
- Virtualize large libraries, profile list/SQLite query performance, remove remaining
  sample metrics from public-release claims and finish cloud-library/study integration.
- Audit inherited lint/security findings and retain all Week 12 external-service gates.

Sources: https://docs.expo.dev/versions/latest/sdk/notifications/
and https://developer.apple.com/design/human-interface-guidelines/notifications
These guide platform behavior, not a claim that every visual trend is appropriate.
