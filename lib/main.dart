import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:papyrus/app/app.dart';
import 'package:papyrus/app/di/providers.dart';
import 'package:papyrus/core/config/app_config.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final config = AppConfig.fromEnvironment();
  if (config.isSupabaseConfigured) {
    await Supabase.initialize(
      url: config.supabaseUrl,
      publishableKey: config.supabaseAnonKey,
    );
  }

  runApp(
    ProviderScope(
      overrides: [appConfigProvider.overrideWithValue(config)],
      child: const PapyrusApp(),
    ),
  );
}
