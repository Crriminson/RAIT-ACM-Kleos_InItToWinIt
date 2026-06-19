/**
 * Jest configuration for the Expo / React Native app.
 *
 * Uses the official `jest-expo` preset so tests run against the same Babel /
 * TypeScript transform the app itself uses. Tests live in `src/__tests__`.
 */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  // jest-expo ships a sane transformIgnorePatterns; extend it only if a new
  // untranspiled node_module is imported from a test.
  setupFilesAfterEnv: [],
  collectCoverageFrom: [
    'src/data/matching-engine.ts',
    'src/data/parse-gstr2b-csv.ts',
    'src/utils/gst-deadlines.ts',
  ],
};
