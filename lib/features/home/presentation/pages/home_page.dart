import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:papyrus/core/constants/app_constants.dart';
import 'package:papyrus/features/question_sets/presentation/providers/question_set_providers.dart';

class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sets = ref.watch(questionSetsProvider);
    return CustomScrollView(
      slivers: [
        SliverAppBar.large(
          title: const Text(AppConstants.appName),
          actions: [
            IconButton(
              onPressed: () => context.push('/settings'),
              icon: const Icon(Icons.account_circle_outlined),
              tooltip: 'Profile and settings',
            ),
          ],
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              Text(
                AppConstants.slogan,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 20),
              _HeroCard(onCreate: () => context.push('/sets')),
              const SizedBox(height: 24),
              Text(
                'Continue learning',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              sets.when(
                loading: () => const LinearProgressIndicator(),
                error: (error, stack) =>
                    Text('Unable to load your library: $error'),
                data: (items) => Column(
                  children: items.take(2).map((set) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _SetPreviewCard(
                        title: set.title,
                        subtitle:
                            '${set.subject} · ${set.questionCount} questions',
                        syncStatus: set.syncStatus.name,
                        onTap: () => context.push('/study/${set.id}'),
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Quick actions',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _QuickAction(
                      icon: Icons.document_scanner_outlined,
                      label: 'Scan material',
                      onTap: () => context.push('/create/scan'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _QuickAction(
                      icon: Icons.sports_esports_outlined,
                      label: 'Join a battle',
                      onTap: () => context.push('/battle'),
                    ),
                  ),
                ],
              ),
            ]),
          ),
        ),
      ],
    );
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.onCreate});

  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      color: scheme.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              Icons.auto_stories_outlined,
              size: 34,
              color: scheme.onPrimaryContainer,
            ),
            const SizedBox(height: 16),
            Text(
              'Turn your notes into a challenge.',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                color: scheme.onPrimaryContainer,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Scan or paste study material, review generated questions, then practice offline or battle friends.',
              style: Theme.of(context).textTheme.bodyMedium
                  ?.copyWith(color: scheme.onPrimaryContainer),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onCreate,
              icon: const Icon(Icons.add),
              label: const Text('Create a question set'),
            ),
          ],
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
    return Card(
      child: ListTile(
        onTap: onTap,
        leading: const CircleAvatar(child: Icon(Icons.menu_book_outlined)),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: Chip(label: Text(syncStatus)),
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon),
      label: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Text(label),
      ),
    );
  }
}
