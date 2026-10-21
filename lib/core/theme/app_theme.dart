import 'package:flutter/material.dart';

abstract final class AppTheme {
  static const _seed = Color(0xFF7A4E2D);

  static ThemeData light() => _build(Brightness.light);

  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final scheme = ColorScheme.fromSeed(
      seedColor: _seed,
      brightness: brightness,
    );
    return ThemeData(
      colorScheme: scheme,
      useMaterial3: true,
      scaffoldBackgroundColor: scheme.surface,
      cardTheme: const CardThemeData(margin: EdgeInsets.zero, elevation: 0),
      inputDecorationTheme: const InputDecorationTheme(
        border: OutlineInputBorder(),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 72,
        labelTextStyle: const WidgetStatePropertyAll(TextStyle(fontSize: 12)),
        indicatorColor: scheme.secondaryContainer,
      ),
    );
  }
}
