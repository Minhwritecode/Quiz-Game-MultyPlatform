enum QuestionDifficulty { easy, medium, hard }

class GenerationRequest {
  const GenerationRequest({
    required this.sourceText,
    required this.questionCount,
    required this.difficulty,
    required this.languageCode,
  });

  final String sourceText;
  final int questionCount;
  final QuestionDifficulty difficulty;
  final String languageCode;
}
