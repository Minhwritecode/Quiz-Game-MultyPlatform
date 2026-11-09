module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  modulePathIgnorePatterns: [
    '<rootDir>/(QuizPulse-main|StudyWars-master|buzrr-main|dev-quiz-battle-main)/',
  ],
  watchPathIgnorePatterns: [
    '<rootDir>/(QuizPulse-main|StudyWars-master|buzrr-main|dev-quiz-battle-main)/',
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/app/**'],
};
