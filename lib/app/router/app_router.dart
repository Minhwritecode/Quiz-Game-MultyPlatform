import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:papyrus/features/auth/presentation/pages/auth_page.dart';
import 'package:papyrus/features/home/presentation/pages/home_page.dart';
import 'package:papyrus/features/leaderboard/presentation/pages/leaderboard_page.dart';
import 'package:papyrus/features/question_sets/presentation/pages/question_sets_page.dart';
import 'package:papyrus/features/quiz_generation/presentation/pages/generation_page.dart';
import 'package:papyrus/features/room_battle/presentation/pages/room_lobby_page.dart';
import 'package:papyrus/features/scan_ocr/presentation/pages/scan_page.dart';
import 'package:papyrus/features/settings/presentation/pages/settings_page.dart';
import 'package:papyrus/features/study/presentation/pages/study_page.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      ShellRoute(
        builder: (context, state, child) => AppShell(child: child),
        routes: [
          GoRoute(path: '/', builder: (context, state) => const HomePage()),
          GoRoute(path: '/auth', builder: (context, state) => const AuthPage()),
          GoRoute(
            path: '/create/scan',
            builder: (context, state) => const ScanPage(),
          ),
          GoRoute(
            path: '/create/generate',
            builder: (context, state) => const GenerationPage(),
          ),
          GoRoute(
            path: '/sets',
            builder: (context, state) => const QuestionSetsPage(),
          ),
          GoRoute(
            path: '/battle',
            builder: (context, state) => const RoomLobbyPage(),
          ),
          GoRoute(
            path: '/leaderboard',
            builder: (context, state) => const LeaderboardPage(),
          ),
          GoRoute(
            path: '/settings',
            builder: (context, state) => const SettingsPage(),
          ),
          GoRoute(
            path: '/study/:setId',
            builder: (context, state) =>
                StudyPage(setId: state.pathParameters['setId']!),
          ),
        ],
      ),
    ],
  );
});

class AppShell extends StatelessWidget {
  const AppShell({required this.child, super.key});

  final Widget child;

  static const _locations = [
    '/',
    '/sets',
    '/battle',
    '/leaderboard',
    '/settings',
  ];

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).uri.path;
    final currentIndex = _locations.indexWhere(
      (item) => item == location || (item != '/' && location.startsWith(item)),
    );
    final selectedIndex = currentIndex < 0 ? 0 : currentIndex;
    const destinations = [
      (Icons.home_outlined, Icons.home, 'Home'),
      (Icons.library_books_outlined, Icons.library_books, 'Library'),
      (Icons.sports_esports_outlined, Icons.sports_esports, 'Battle'),
      (Icons.emoji_events_outlined, Icons.emoji_events, 'Rank'),
      (Icons.settings_outlined, Icons.settings, 'Settings'),
    ];
    final isWide = MediaQuery.sizeOf(context).width >= 900;
    final navigation = isWide
        ? NavigationRail(
            selectedIndex: selectedIndex,
            onDestinationSelected: (index) => context.go(_locations[index]),
            labelType: NavigationRailLabelType.all,
            leading: Padding(
              padding: const EdgeInsets.fromLTRB(0, 24, 0, 32),
              child: Tooltip(
                message: 'Papyrus',
                child: Icon(
                  Icons.auto_stories_rounded,
                  color: Theme.of(context).colorScheme.primary,
                  size: 30,
                ),
              ),
            ),
            destinations: [
              for (final item in destinations)
                NavigationRailDestination(
                  icon: Icon(item.$1),
                  selectedIcon: Icon(item.$2),
                  label: Text(item.$3),
                ),
            ],
          )
        : NavigationBar(
            selectedIndex: selectedIndex,
            onDestinationSelected: (index) => context.go(_locations[index]),
            destinations: [
              for (final item in destinations)
                NavigationDestination(
                  icon: Icon(item.$1),
                  selectedIcon: Icon(item.$2),
                  label: item.$3,
                ),
            ],
          );
    return Scaffold(
      body: SafeArea(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (isWide) navigation,
            Expanded(child: child),
          ],
        ),
      ),
      bottomNavigationBar: isWide ? null : navigation,
    );
  }
}
