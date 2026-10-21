import 'dart:convert';

import 'package:papyrus/features/question_sets/domain/entities/question.dart';

class StreamingQuestionParser {
  String _buffer = '';

  List<Question> addChunk(String chunk) {
    _buffer += chunk;
    final questions = <Question>[];
    const decoder = JsonDecoder();

    while (_buffer.trim().isNotEmpty) {
      final start = _buffer.indexOf('{');
      if (start < 0) {
        _buffer = '';
        break;
      }
      if (start > 0) _buffer = _buffer.substring(start);

      try {
        final result = decoder.convert(_buffer);
        if (result is Map<String, dynamic>) {
          final question = _toQuestion(result, questions.length);
          if (question != null) questions.add(question);
          _buffer = '';
        }
      } on FormatException {
        break;
      }
    }
    return questions;
  }

  Question? _toQuestion(Map<String, dynamic> json, int fallbackPosition) {
    final options = (json['options'] as List<dynamic>?)
        ?.whereType<String>()
        .toList();
    final question = Question(
      id: json['id'] as String? ?? 'stream-$fallbackPosition',
      content: json['question'] as String? ?? '',
      options: options ?? const [],
      correctIndex: json['correct_index'] as int? ?? -1,
      explanation: json['explanation'] as String? ?? '',
      position: json['position'] as int? ?? fallbackPosition,
    );
    return question.isValid ? question : null;
  }
}
