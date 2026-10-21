import 'package:flutter_test/flutter_test.dart';

import 'package:papyrus/features/question_sets/domain/entities/question.dart';
import 'package:papyrus/features/quiz_generation/data/parsers/streaming_question_parser.dart';

void main() {
  test('validates a four-option question', () {
    const question = Question(
      id: 'q1',
      content: 'Which option is correct?',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 2,
      explanation: 'C is correct.',
      position: 0,
    );

    expect(question.isValid, isTrue);
  });

  test('drops malformed streamed questions', () {
    final parser = StreamingQuestionParser();
    final questions = parser.addChunk(
      '{"question":"Good","options":["A","B","C","D"],"correct_index":1,"explanation":"Because"}',
    );

    expect(questions, hasLength(1));
    expect(questions.single.correctIndex, 1);
  });
}
