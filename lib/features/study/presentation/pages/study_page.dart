import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:papyrus/features/question_sets/presentation/providers/question_set_providers.dart';

class StudyPage extends ConsumerStatefulWidget {
  const StudyPage({required this.setId, super.key});

  final String setId;

  @override
  ConsumerState<StudyPage> createState() => _StudyPageState();
}

class _StudyPageState extends ConsumerState<StudyPage> {
  int _index = 0;
  int? _selected;
  bool _revealed = false;

  @override
  Widget build(BuildContext context) {
    final result = ref.watch(questionSetProvider(widget.setId));
    return Scaffold(
      appBar: AppBar(title: const Text('Study mode')),
      body: result.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) =>
            Center(child: Text('Could not load this set: $error')),
        data: (set) {
          if (set == null || set.questions.isEmpty) {
            return const Center(child: Text('This set has no questions yet.'));
          }
          final question = set.questions[_index];
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              LinearProgressIndicator(
                value: (_index + 1) / set.questions.length,
              ),
              const SizedBox(height: 24),
              Text(
                'Question ${_index + 1} of ${set.questions.length}',
                style: Theme.of(context).textTheme.labelLarge,
              ),
              const SizedBox(height: 8),
              Text(
                question.content,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 24),
              ...question.options.asMap().entries.map((entry) {
                final isSelected = _selected == entry.key;
                final isCorrect =
                    _revealed && entry.key == question.correctIndex;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: ChoiceChip(
                    label: Align(
                      alignment: Alignment.centerLeft,
                      child: Text(entry.value),
                    ),
                    selected: isSelected,
                    onSelected: _revealed
                        ? null
                        : (_) => setState(() => _selected = entry.key),
                    avatar: CircleAvatar(
                      child: Text(String.fromCharCode(65 + entry.key)),
                    ),
                    backgroundColor: isCorrect ? Colors.green.shade100 : null,
                  ),
                );
              }),
              if (_revealed) ...[
                const SizedBox(height: 8),
                Text(
                  question.explanation,
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
              ],
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _selected == null
                    ? null
                    : () {
                        if (!_revealed) {
                          setState(() => _revealed = true);
                        } else if (_index < set.questions.length - 1) {
                          setState(() {
                            _index++;
                            _selected = null;
                            _revealed = false;
                          });
                        } else {
                          Navigator.pop(context);
                        }
                      },
                child: Text(
                  _revealed
                      ? (_index == set.questions.length - 1
                            ? 'Finish'
                            : 'Next question')
                      : 'Check answer',
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
