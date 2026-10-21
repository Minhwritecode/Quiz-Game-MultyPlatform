import 'dart:convert';

import 'package:drift/drift.dart';

import 'package:papyrus/core/database/app_database.dart';
import 'package:papyrus/features/question_sets/domain/entities/question.dart'
    as domain;
import 'package:papyrus/features/question_sets/domain/entities/question_set.dart'
    as domain;
import 'package:papyrus/features/question_sets/domain/repositories/question_set_repository.dart';

class DriftQuestionSetRepository implements QuestionSetRepository {
  DriftQuestionSetRepository(this.database);

  final AppDatabase database;

  @override
  Stream<List<domain.QuestionSet>> watchAll() {
    final query = database.select(database.questionSets)
      ..where((row) => row.isDeleted.equals(false))
      ..orderBy([(row) => OrderingTerm.desc(row.updatedAt)]);
    return query.watch().asyncMap(_mapRows);
  }

  @override
  Future<domain.QuestionSet?> findById(String id) async {
    final row =
        await (database.select(database.questionSets)..where(
              (item) => item.id.equals(id) & item.isDeleted.equals(false),
            ))
            .getSingleOrNull();
    if (row == null) return null;
    return _mapRow(row);
  }

  @override
  Future<void> save(domain.QuestionSet questionSet) async {
    await database.transaction(() async {
      await database
          .into(database.questionSets)
          .insertOnConflictUpdate(
            QuestionSetsCompanion.insert(
              id: questionSet.id,
              title: questionSet.title,
              subject: questionSet.subject,
              updatedAt: questionSet.updatedAt,
              syncStatus: Value(questionSet.syncStatus.name),
            ),
          );
      await (database.delete(
        database.questions,
      )..where((row) => row.setId.equals(questionSet.id))).go();
      await database.batch((batch) {
        batch.insertAll(
          database.questions,
          questionSet.questions
              .map(
                (question) => QuestionsCompanion.insert(
                  id: question.id,
                  setId: questionSet.id,
                  content: question.content,
                  optionsJson: jsonEncode(question.options),
                  correctIndex: question.correctIndex,
                  explanation: question.explanation,
                  position: question.position,
                  updatedAt: questionSet.updatedAt,
                ),
              )
              .toList(),
        );
        batch.insert(
          database.syncQueue,
          SyncQueueCompanion.insert(
            entity: 'question_sets',
            entityId: questionSet.id,
            operation: 'upsert',
            payload: jsonEncode({'id': questionSet.id}),
            createdAt: DateTime.now(),
          ),
        );
      });
    });
  }

  @override
  Future<void> delete(String id) async {
    await (database.update(
      database.questionSets,
    )..where((row) => row.id.equals(id))).write(
      QuestionSetsCompanion(
        isDeleted: const Value(true),
        updatedAt: Value(DateTime.now()),
        syncStatus: Value(domain.SyncStatus.pending.name),
      ),
    );
    await database
        .into(database.syncQueue)
        .insert(
          SyncQueueCompanion.insert(
            entity: 'question_sets',
            entityId: id,
            operation: 'delete',
            payload: jsonEncode({'id': id}),
            createdAt: DateTime.now(),
          ),
        );
  }

  Future<List<domain.QuestionSet>> _mapRows(List<QuestionSet> rows) async {
    return Future.wait(rows.map(_mapRow));
  }

  Future<domain.QuestionSet> _mapRow(QuestionSet row) async {
    final questionRows =
        await (database.select(database.questions)
              ..where(
                (item) =>
                    item.setId.equals(row.id) & item.isDeleted.equals(false),
              )
              ..orderBy([(item) => OrderingTerm.asc(item.position)]))
            .get();
    return domain.QuestionSet(
      id: row.id,
      title: row.title,
      subject: row.subject,
      updatedAt: row.updatedAt,
      syncStatus: domain.SyncStatus.values.byName(row.syncStatus),
      questions: questionRows.map(_mapQuestion).toList(growable: false),
    );
  }

  domain.Question _mapQuestion(Question row) {
    final options = (jsonDecode(row.optionsJson) as List<dynamic>)
        .whereType<String>()
        .toList();
    return domain.Question(
      id: row.id,
      content: row.content,
      options: options,
      correctIndex: row.correctIndex,
      explanation: row.explanation,
      position: row.position,
    );
  }
}
