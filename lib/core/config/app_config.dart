class AppConfig {
  const AppConfig({
    required this.supabaseUrl,
    required this.supabaseAnonKey,
    required this.environment,
  });

  factory AppConfig.fromEnvironment() {
    return const AppConfig(
      supabaseUrl: String.fromEnvironment('SUPABASE_URL'),
      supabaseAnonKey: String.fromEnvironment('SUPABASE_ANON_KEY'),
      environment: String.fromEnvironment(
        'APP_ENV',
        defaultValue: 'development',
      ),
    );
  }

  final String supabaseUrl;
  final String supabaseAnonKey;
  final String environment;

  bool get isSupabaseConfigured =>
      supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;
}
