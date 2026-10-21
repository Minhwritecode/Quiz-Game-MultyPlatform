import 'package:papyrus/features/question_sets/domain/entities/question.dart';

enum SyncStatus { synced, pending, failed }

class QuestionSet {
  const QuestionSet({
    required this.id,
    required this.title,
    required this.subject,
    required this.questions,
    required this.updatedAt,
    this.syncStatus = SyncStatus.synced,
  });

  final String id;
  final String title;
  final String subject;
  final List<Question> questions;
  final DateTime updatedAt;
  final SyncStatus syncStatus;

  int get questionCount => questions.length;

  QuestionSet copyWith({
    String? title,
    String? subject,
    List<Question>? questions,
    DateTime? updatedAt,
    SyncStatus? syncStatus,
  }) {
    return QuestionSet(
      id: id,
      title: title ?? this.title,
      subject: subject ?? this.subject,
      questions: questions ?? this.questions,
      updatedAt: updatedAt ?? this.updatedAt,
      syncStatus: syncStatus ?? this.syncStatus,
    );
  }
}
