module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    setupFiles: ['<rootDir>/jest.setup.js'],
    testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts', '**/*.spec.ts'],
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
        '^.+\\.(js|jsx)$': 'babel-jest',
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '^expo-sqlite$': '<rootDir>/__mocks__/expo-sqlite.js',
        '^expo-router$': '<rootDir>/__mocks__/expo-router.js',
        '^@react-native-async-storage/async-storage$': '<rootDir>/__mocks__/async-storage.js',
    },
    transformIgnorePatterns: [ // tells Jest which node_modules to not transform
        "node_modules/(?!(react-native|@react-native|@react-navigation|expo|@expo|expo-sqlite|expo-modules-core)/)"
    ],
    testTimeout: 30000,
};
