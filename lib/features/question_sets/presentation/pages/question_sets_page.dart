import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:papyrus/core/widgets/papyrus_ui.dart';
import 'package:papyrus/features/question_sets/presentation/providers/question_set_providers.dart';

class QuestionSetsPage extends ConsumerStatefulWidget {
  const QuestionSetsPage({super.key});

  @override
  ConsumerState<QuestionSetsPage> createState() => _QuestionSetsPageState();
}

class _QuestionSetsPageState extends ConsumerState<QuestionSetsPage> {
  final _searchController = TextEditingController();
  String _filter = 'All';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sets = ref.watch(questionSetsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Library'),
        actions: [
          IconButton(
            onPressed: () {},
            icon: const Icon(Icons.tune_outlined),
            tooltip: 'Filter library',
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/create/scan'),
        icon: const Icon(Icons.add),
        label: const Text('New set'),
      ),
      body: LayoutBuilder(
        builder: (context, constraints) => SizedBox(
          height: constraints.maxHeight,
          child: PapyrusPage(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const PapyrusHeader(
                  eyebrow: 'Your study shelf',
                  title: 'Make progress visible',
                  subtitle: 'Every set stays ready for offline practice.',
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: _searchController,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    labelText: 'Search your library',
                    prefixIcon: Icon(Icons.search),
                    suffixIcon: Icon(Icons.mic_none_outlined),
                  ),
                ),
                const SizedBox(height: 16),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'All', label: Text('All')),
                    ButtonSegment(value: 'Recent', label: Text('Recent')),
                    ButtonSegment(value: 'Pending', label: Text('Pending')),
                  ],
                  selected: {_filter},
                  onSelectionChanged: (selection) =>
                      setState(() => _filter = selection.first),
                ),
                const SizedBox(height: 20),
                Expanded(
                  child: sets.when(
                    loading: () =>
                        const Center(child: CircularProgressIndicator()),
                    error: (error, stack) => const PapyrusEmptyState(
                      icon: Icons.cloud_off_outlined,
                      title: 'Could not load your shelf',
                      message: 'Your local cache is safe. Try again when the connection is stable.',
                    ),
                    data: (items) {
                      final query = _searchController.text.trim().toLowerCase();
                      final filtered = items
                          .where((set) {
                            final matchesQuery =
                                query.isEmpty ||
                                set.title.toLowerCase().contains(query) ||
                                set.subject.toLowerCase().contains(query);
                            final matchesFilter =
                                _filter == 'All' ||
                                (_filter == 'Pending' &&
                                    set.syncStatus.name != 'synced') ||
                                (_filter == 'Recent' &&
                                    set.updatedAt.isAfter(
                                      DateTime.now().subtract(
                                        const Duration(days: 14),
                                      ),
                                    ));
                            return matchesQuery && matchesFilter;
                          })
                          .toList(growable: false);
                      if (filtered.isEmpty) {
                        return PapyrusEmptyState(
                          icon: Icons.menu_book_outlined,
                          title: query.isEmpty
                              ? 'No sets in this view'
                              : 'No matches found',
                          message: query.isEmpty
                              ? 'Create a set from a scan, gallery image or pasted notes.'
                              : 'Try a different title or subject.',
                          action: PapyrusPrimaryButton(
                            label: 'Create a question set',
                            onPressed: () => context.push('/create/scan'),
                            expand: false,
                          ),
                        );
                      }
                      return ListView.separated(
                        itemCount: filtered.length,
                        separatorBuilder: (_, index) =>
                            const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final set = filtered[index];
                          return PapyrusCard(
                            onTap: () => context.push('/study/${set.id}'),
                            child: Row(
                              children: [
                                CircleAvatar(
                                  radius: 26,
                                  backgroundColor: Theme.of(context)
                                      .colorScheme
                                      .primaryContainer,
                                  foregroundColor: Theme.of(context)
                                      .colorScheme
                                      .primary,
                                  child: const Icon(Icons.menu_book_outlined),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        set.title,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleMedium
                                            ?.copyWith(
                                              fontWeight: FontWeight.w700,
                                            ),
                                      ),
                                      const SizedBox(height: 5),
                                      Text(
                                        '${set.subject} · ${set.questionCount} questions',
                                        style: Theme.of(context)
                                            .textTheme
                                            .bodySmall,
                                      ),
                                      const SizedBox(height: 7),
                                      Row(
                                        children: [
                                          PapyrusTag(
                                            set.syncStatus.name,
                                            icon:
                                                set.syncStatus.name == 'synced'
                                                ? Icons.cloud_done_outlined
                                                : Icons.sync_outlined,
                                            tone:
                                                set.syncStatus.name == 'synced'
                                                ? PapyrusTagTone.success
                                                : PapyrusTagTone.reward,
                                          ),
                                          const SizedBox(width: 8),
                                          Text(
                                            'Updated ${set.updatedAt.day}/${set.updatedAt.month}',
                                            style: Theme.of(context)
                                                .textTheme
                                                .labelMedium,
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                                const Icon(Icons.chevron_right_rounded),
                              ],
                            ),
                          );
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
