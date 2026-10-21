class Question {
  const Question({
    required this.id,
    required this.content,
    required this.options,
    required this.correctIndex,
    required this.explanation,
    required this.position,
  });

  final String id;
  final String content;
  final List<String> options;
  final int correctIndex;
  final String explanation;
  final int position;

  bool get isValid =>
      content.trim().isNotEmpty &&
      options.length == 4 &&
      options.every((option) => option.trim().isNotEmpty) &&
      options.toSet().length == 4 &&
      correctIndex >= 0 &&
      correctIndex < options.length;
}
