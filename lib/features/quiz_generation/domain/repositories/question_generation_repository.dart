import 'package:papyrus/features/question_sets/domain/entities/question.dart';
import 'package:papyrus/features/quiz_generation/domain/entities/generation_request.dart';

abstract interface class QuestionGenerationRepository {
  Stream<Question> generate(GenerationRequest request);
}
