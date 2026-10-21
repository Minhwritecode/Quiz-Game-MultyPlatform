import 'package:flutter/material.dart';

import 'package:papyrus/core/theme/app_tokens.dart';

abstract final class AppTheme {
  static const _seed = PapyrusTokens.indigo;

  static ThemeData light() => _build(Brightness.light);

  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final scheme = ColorScheme.fromSeed(
      seedColor: _seed,
      brightness: brightness,
    );
    final isDark = brightness == Brightness.dark;
    return ThemeData(
      colorScheme: scheme,
      useMaterial3: true,
      scaffoldBackgroundColor: isDark
          ? PapyrusTokens.night
          : PapyrusTokens.paper,
      canvasColor: isDark ? PapyrusTokens.night : PapyrusTokens.paper,
      textTheme: Typography.material2021().black
          .apply(
            bodyColor: isDark ? Colors.white : PapyrusTokens.ink,
            displayColor: isDark ? Colors.white : PapyrusTokens.ink,
          )
          .copyWith(
            headlineLarge: const TextStyle(
              fontSize: 32,
              height: 1.12,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.7,
            ),
            headlineMedium: const TextStyle(
              fontSize: 26,
              height: 1.18,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.4,
            ),
            titleLarge: const TextStyle(
              fontSize: 20,
              height: 1.25,
              fontWeight: FontWeight.w700,
            ),
            bodyLarge: const TextStyle(fontSize: 16, height: 1.5),
            bodyMedium: const TextStyle(fontSize: 14, height: 1.45),
          ),
      cardTheme: CardThemeData(
        margin: EdgeInsets.zero,
        elevation: 0,
        color: isDark ? PapyrusTokens.nightRaised : PapyrusTokens.paperRaised,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(PapyrusTokens.radiusLg),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isDark
            ? PapyrusTokens.nightRaised
            : PapyrusTokens.paperRaised,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(PapyrusTokens.radiusMd),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(PapyrusTokens.radiusMd),
          borderSide: BorderSide(color: scheme.outlineVariant),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(PapyrusTokens.radiusMd),
          borderSide: BorderSide(color: scheme.primary, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(44, 52),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(PapyrusTokens.radiusMd),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(44, 52),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(PapyrusTokens.radiusMd),
          ),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(minimumSize: const Size(44, 44)),
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: isDark
            ? PapyrusTokens.nightSurface
            : PapyrusTokens.paperRaised,
        indicatorColor: isDark
            ? PapyrusTokens.nightMuted
            : PapyrusTokens.indigoTint,
        minWidth: 84,
        minExtendedWidth: 220,
        selectedLabelTextStyle: TextStyle(
          color: scheme.primary,
          fontWeight: FontWeight.w700,
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 76,
        backgroundColor: isDark
            ? PapyrusTokens.nightSurface
            : PapyrusTokens.paperRaised,
        labelTextStyle: const WidgetStatePropertyAll(
          TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
        ),
        indicatorColor: isDark
            ? PapyrusTokens.nightMuted
            : PapyrusTokens.indigoTint,
      ),
    );
  }
}
