import 'dart:async';

import 'package:papyrus/features/question_sets/domain/entities/question.dart';
import 'package:papyrus/features/question_sets/domain/entities/question_set.dart';
import 'package:papyrus/features/question_sets/domain/repositories/question_set_repository.dart';

class InMemoryQuestionSetRepository implements QuestionSetRepository {
  InMemoryQuestionSetRepository(List<QuestionSet> seed)
    : _items = [...seed],
      _controller = StreamController<List<QuestionSet>>.broadcast();

  factory InMemoryQuestionSetRepository.seeded() {
    return InMemoryQuestionSetRepository([
      QuestionSet(
        id: 'demo-flutter',
        title: 'Flutter Foundations',
        subject: 'Mobile Development',
        updatedAt: DateTime(2026, 10, 17),
        syncStatus: SyncStatus.synced,
        questions: const [
          Question(
            id: 'q-1',
            content: 'Which widget is commonly used for a Material 3 app root?',
            options: ['MaterialApp', 'Container', 'Stack', 'Builder'],
            correctIndex: 0,
            explanation:
                'MaterialApp provides app-level Material configuration.',
            position: 0,
          ),
          Question(
            id: 'q-2',
            content: 'What is the primary goal of offline-first design?',
            options: [
              'Keep the UI useful without a network',
              'Remove all databases',
              'Disable synchronization',
              'Require a VPN',
            ],
            correctIndex: 0,
            explanation:
                'Local data is the source of truth for the responsive UI.',
            position: 1,
          ),
        ],
      ),
      QuestionSet(
        id: 'demo-architecture',
        title: 'Clean Architecture Quick Review',
        subject: 'Software Engineering',
        updatedAt: DateTime(2026, 10, 18),
        syncStatus: SyncStatus.pending,
        questions: const [],
      ),
    ]);
  }

  final List<QuestionSet> _items;
  final StreamController<List<QuestionSet>> _controller;

  @override
  Stream<List<QuestionSet>> watchAll() async* {
    yield List.unmodifiable(_items);
    yield* _controller.stream;
  }

  @override
  Future<QuestionSet?> findById(String id) async {
    for (final item in _items) {
      if (item.id == id) return item;
    }
    return null;
  }

  @override
  Future<void> save(QuestionSet questionSet) async {
    final index = _items.indexWhere((item) => item.id == questionSet.id);
    if (index == -1) {
      _items.add(questionSet);
    } else {
      _items[index] = questionSet;
    }
    _controller.add(List.unmodifiable(_items));
  }

  @override
  Future<void> delete(String id) async {
    _items.removeWhere((item) => item.id == id);
    _controller.add(List.unmodifiable(_items));
  }
}
