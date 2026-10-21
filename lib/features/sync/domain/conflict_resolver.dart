import 'package:papyrus/features/question_sets/domain/entities/question_set.dart';

class ConflictResolver {
  const ConflictResolver();

  QuestionSet chooseLatest(QuestionSet local, QuestionSet remote) {
    return remote.updatedAt.isAfter(local.updatedAt) ? remote : local;
  }
}
