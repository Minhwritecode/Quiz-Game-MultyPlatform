import 'package:papyrus/features/question_sets/domain/entities/question_set.dart';
import 'package:papyrus/features/question_sets/domain/repositories/question_set_repository.dart';

class WatchQuestionSets {
  const WatchQuestionSets(this.repository);

  final QuestionSetRepository repository;

  Stream<List<QuestionSet>> call() => repository.watchAll();
}
