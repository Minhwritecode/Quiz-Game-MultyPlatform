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
    return Scaffold(
      body: SafeArea(child: child),
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex < 0 ? 0 : currentIndex,
        onDestinationSelected: (index) => context.go(_locations[index]),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.library_books_outlined),
            selectedIcon: Icon(Icons.library_books),
            label: 'Library',
          ),
          NavigationDestination(
            icon: Icon(Icons.sports_esports_outlined),
            selectedIcon: Icon(Icons.sports_esports),
            label: 'Battle',
          ),
          NavigationDestination(
            icon: Icon(Icons.emoji_events_outlined),
            selectedIcon: Icon(Icons.emoji_events),
            label: 'Rank',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: 'Settings',
          ),
        ],
      ),
    );
  }
}
