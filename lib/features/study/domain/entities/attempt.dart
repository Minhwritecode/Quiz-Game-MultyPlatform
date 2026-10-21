class Attempt {
  const Attempt({
    required this.id,
    required this.questionSetId,
    required this.score,
    required this.total,
    required this.startedAt,
    this.finishedAt,
  });

  final String id;
  final String questionSetId;
  final int score;
  final int total;
  final DateTime startedAt;
  final DateTime? finishedAt;
}
