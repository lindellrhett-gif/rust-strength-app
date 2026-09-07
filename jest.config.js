// Milestone 1 tests cover the pure domain logic (recommender, rounding, stats),
// so a plain node environment via ts-jest is all that's needed — no RN runtime.
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
};
