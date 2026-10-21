import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:papyrus/app/router/app_router.dart';
import 'package:papyrus/core/constants/app_constants.dart';
import 'package:papyrus/core/theme/app_theme.dart';

class PapyrusApp extends ConsumerWidget {
  const PapyrusApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: AppConstants.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ThemeMode.system,
      routerConfig: ref.watch(appRouterProvider),
    );
  }
}
