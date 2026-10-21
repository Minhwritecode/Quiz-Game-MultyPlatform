import 'package:papyrus/features/question_sets/domain/entities/question_set.dart';

abstract interface class QuestionSetRepository {
  Stream<List<QuestionSet>> watchAll();

  Future<QuestionSet?> findById(String id);

  Future<void> save(QuestionSet questionSet);

  Future<void> delete(String id);
}
