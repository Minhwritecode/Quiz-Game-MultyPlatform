import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:papyrus/core/constants/app_constants.dart';
import 'package:papyrus/core/theme/app_tokens.dart';
import 'package:papyrus/core/widgets/papyrus_ui.dart';
import 'package:papyrus/features/question_sets/presentation/providers/question_set_providers.dart';

class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sets = ref.watch(questionSetsProvider);
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar.large(
            title: const Text(AppConstants.appName),
            actions: [
              IconButton(
                onPressed: () => context.push('/settings'),
                icon: const Icon(Icons.account_circle_outlined),
                tooltip: 'Profile and settings',
              ),
              const SizedBox(width: 8),
            ],
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
            sliver: SliverToBoxAdapter(
              child: PapyrusPage(
                padding: EdgeInsets.zero,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      AppConstants.slogan,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: Theme.of(context).colorScheme.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 20),
                    _HeroCard(
                      onCreate: () => context.push('/create/scan'),
                      onBattle: () => context.push('/battle'),
                    ),
                    const SizedBox(height: 28),
                    const PapyrusSectionTitle(title: 'Your learning pulse'),
                    const SizedBox(height: 12),
                    LayoutBuilder(
                      builder: (context, constraints) {
                        final columns = constraints.maxWidth >= 720 ? 3 : 1;
                        return GridView.count(
                          crossAxisCount: columns,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                          childAspectRatio: columns == 1 ? 4.3 : 1.8,
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          children: const [
                            PapyrusStat(
                              value: '7',
                              label: 'sets ready to study',
                              icon: Icons.menu_book_outlined,
                            ),
                            PapyrusStat(
                              value: '82%',
                              label: 'average accuracy',
                              icon: Icons.insights_outlined,
                              tone: PapyrusTagTone.success,
                            ),
                            PapyrusStat(
                              value: '1,240',
                              label: 'battle points',
                              icon: Icons.emoji_events_outlined,
                              tone: PapyrusTagTone.reward,
                            ),
                          ],
                        );
                      },
                    ),
                    const SizedBox(height: 28),
                    PapyrusSectionTitle(
                      title: 'Continue learning',
                      action: TextButton(
                        onPressed: () => context.go('/sets'),
                        child: const Text('View library'),
                      ),
                    ),
                    const SizedBox(height: 12),
                    sets.when(
                      loading: () => const LinearProgressIndicator(),
                      error: (error, stack) => const PapyrusEmptyState(
                        icon: Icons.cloud_off_outlined,
                        title: 'Library unavailable',
                        message: 'Your saved study sets are still available locally. Try again when the connection returns.',
                      ),
                      data: (items) => LayoutBuilder(
                        builder: (context, constraints) {
                          final visible = items.take(3).toList(growable: false);
                          if (visible.isEmpty) {
                            return const PapyrusEmptyState(
                              icon: Icons.auto_stories_outlined,
                              title: 'Your library is waiting',
                              message: 'Scan a handout or paste notes to create your first question set.',
                            );
                          }
                          return GridView.builder(
                            itemCount: visible.length,
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            gridDelegate:
                                SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: constraints.maxWidth >= 720
                                      ? 3
                                      : 1,
                                  crossAxisSpacing: 12,
                                  mainAxisSpacing: 12,
                                  childAspectRatio: constraints.maxWidth >= 720
                                      ? 1.25
                                      : 2.4,
                                ),
                            itemBuilder: (context, index) {
                              final set = visible[index];
                              return _SetPreviewCard(
                                title: set.title,
                                subtitle:
                                    '${set.subject} · ${set.questionCount} questions',
                                syncStatus: set.syncStatus.name,
                                onTap: () => context.push('/study/${set.id}'),
                              );
                            },
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 28),
                    const PapyrusSectionTitle(title: 'Quick actions'),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _QuickAction(
                            icon: Icons.document_scanner_outlined,
                            label: 'Scan material',
                            description: 'Create from paper or photos',
                            onTap: () => context.push('/create/scan'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _QuickAction(
                            icon: Icons.sports_esports_outlined,
                            label: 'Join a battle',
                            description: 'Challenge your study circle',
                            onTap: () => context.push('/battle'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.onCreate, required this.onBattle});

  final VoidCallback onCreate;
  final VoidCallback onBattle;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      color: scheme.primary,
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final compact = constraints.maxWidth < 620;
            final copy = Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const PapyrusTag(
                  'OFFLINE-FIRST LEARNING',
                  icon: Icons.wifi_off_outlined,
                  tone: PapyrusTagTone.primary,
                ),
                const SizedBox(height: 18),
                Text(
                  'Turn your notes into a challenge.',
                  style: Theme.of(context).textTheme.headlineLarge
                      ?.copyWith(color: scheme.onPrimary),
                ),
                const SizedBox(height: 10),
                Text(
                  'Scan, shape and play with questions made for the material you actually need to remember.',
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: scheme.onPrimary.withValues(alpha: 0.86),
                  ),
                ),
                const SizedBox(height: 20),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    FilledButton.icon(
                      onPressed: onCreate,
                      icon: const Icon(Icons.add),
                      label: const Text('Create a set'),
                    ),
                    OutlinedButton.icon(
                      onPressed: onBattle,
                      icon: const Icon(Icons.sports_esports_outlined),
                      label: const Text('Battle friends'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: scheme.onPrimary,
                        side: BorderSide(
                          color: scheme.onPrimary.withValues(alpha: 0.45),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            );
            final art = Container(
              width: compact ? double.infinity : 180,
              height: compact ? 100 : 180,
              decoration: BoxDecoration(
                color: scheme.onPrimary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(PapyrusTokens.radiusMd),
              ),
              child: Icon(
                Icons.auto_stories_rounded,
                size: compact ? 52 : 82,
                color: scheme.onPrimary,
              ),
            );
            return compact
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [copy, const SizedBox(height: 20), art],
                  )
                : Row(
                    children: [
                      Expanded(child: copy),
                      const SizedBox(width: 28),
                      art,
                    ],
                  );
          },
        ),
      ),
    );
  }
}

class _SetPreviewCard extends StatelessWidget {
  const _SetPreviewCard({
    required this.title,
    required this.subtitle,
    required this.syncStatus,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final String syncStatus;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tone = syncStatus == 'synced'
        ? PapyrusTagTone.success
        : PapyrusTagTone.reward;
    return PapyrusCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                child: Icon(
                  Icons.menu_book_outlined,
                  color: Theme.of(context).colorScheme.primary,
                ),
              ),
              const Spacer(),
              PapyrusTag(syncStatus, tone: tone),
            ],
          ),
          const Spacer(),
          Text(
            title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 5),
          Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.icon,
    required this.label,
    required this.description,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String description;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PapyrusCard(
      onTap: onTap,
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: Theme.of(context).colorScheme.primaryContainer,
            foregroundColor: Theme.of(context).colorScheme.primary,
            child: Icon(icon),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: Theme.of(context).textTheme.titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 3),
                Text(description, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          const Icon(Icons.arrow_forward_rounded, size: 20),
        ],
      ),
    );
  }
}
