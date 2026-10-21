import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:papyrus/core/database/app_database.dart'
    hide Question, QuestionSet;
import 'package:papyrus/features/question_sets/data/repositories/drift_question_set_repository.dart';
import 'package:papyrus/features/question_sets/domain/entities/question.dart';
import 'package:papyrus/features/question_sets/domain/entities/question_set.dart';

void main() {
  late AppDatabase database;
  late DriftQuestionSetRepository repository;

  setUp(() {
    database = AppDatabase(NativeDatabase.memory());
    repository = DriftQuestionSetRepository(database);
  });

  tearDown(() async {
    await database.close();
  });

  test('saves a set, questions and an outbox item transactionally', () async {
    final set = QuestionSet(
      id: 'set-1',
      title: 'Architecture',
      subject: 'Mobile',
      updatedAt: DateTime(2026, 10, 21),
      questions: const [
        Question(
          id: 'question-1',
          content: 'What does the domain layer contain?',
          options: ['Business rules', 'Pixels', 'SQL only', 'Secrets'],
          correctIndex: 0,
          explanation: 'Domain owns framework-independent rules.',
          position: 0,
        ),
      ],
    );

    await repository.save(set);
    final result = await repository.findById(set.id);

    expect(result?.title, 'Architecture');
    expect(result?.questions.single.correctIndex, 0);
    expect(await database.select(database.syncQueue).get(), hasLength(1));
  });
}
