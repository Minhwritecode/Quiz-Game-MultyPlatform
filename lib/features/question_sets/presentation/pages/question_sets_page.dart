import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:papyrus/features/question_sets/presentation/providers/question_set_providers.dart';

class QuestionSetsPage extends ConsumerWidget {
  const QuestionSetsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sets = ref.watch(questionSetsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Question sets')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/create/scan'),
        icon: const Icon(Icons.add),
        label: const Text('New set'),
      ),
      body: sets.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) =>
            Center(child: Text('Could not load sets: $error')),
        data: (items) => ListView.separated(
          padding: const EdgeInsets.all(20),
          itemCount: items.length,
          separatorBuilder: (_, index) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final set = items[index];
            return Card(
              child: ListTile(
                contentPadding: const EdgeInsets.all(16),
                leading: const CircleAvatar(
                  child: Icon(Icons.menu_book_outlined),
                ),
                title: Text(set.title),
                subtitle: Text(
                  '${set.subject}\n${set.questionCount} questions · ${set.syncStatus.name}',
                ),
                isThreeLine: true,
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.push('/study/${set.id}'),
              ),
            );
          },
        ),
      ),
    );
  }
}
