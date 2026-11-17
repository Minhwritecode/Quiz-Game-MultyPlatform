module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  modulePathIgnorePatterns: [
    '<rootDir>/src/skills/',
    '<rootDir>/(QuizPulse-main|StudyWars-master|buzrr-main|dev-quiz-battle-main)/',
  ],
  watchPathIgnorePatterns: [
    '<rootDir>/(QuizPulse-main|StudyWars-master|buzrr-main|dev-quiz-battle-main)/',
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/app/**', '!src/skills/**'],
};
