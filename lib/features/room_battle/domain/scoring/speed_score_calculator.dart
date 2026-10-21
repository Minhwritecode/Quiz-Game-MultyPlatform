class SpeedScoreCalculator {
  const SpeedScoreCalculator();

  int calculate({required bool isCorrect, required Duration remaining}) {
    if (!isCorrect) return 0;
    final speedBonus = (remaining.inMilliseconds ~/ 100).clamp(0, 500);
    return 1000 + speedBonus;
  }
}
