import 'package:papyrus/features/question_sets/domain/entities/question.dart';

class ValidateQuestion {
  const ValidateQuestion();

  bool call(Question question) => question.isValid;
}
