import 'package:flutter_test/flutter_test.dart';

import 'package:papyrus/features/room_battle/domain/scoring/speed_score_calculator.dart';

void main() {
  const calculator = SpeedScoreCalculator();

  test('awards base score plus capped speed bonus', () {
    expect(
      calculator.calculate(
        isCorrect: true,
        remaining: const Duration(seconds: 60),
      ),
      1500,
    );
  });

  test('returns zero for incorrect answers', () {
    expect(
      calculator.calculate(
        isCorrect: false,
        remaining: const Duration(seconds: 20),
      ),
      0,
    );
  });
}
