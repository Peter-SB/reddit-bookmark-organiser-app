module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
        '^.+\\.(js|jsx)$': 'babel-jest',
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '^expo-sqlite$': '<rootDir>/__mocks__/expo-sqlite.js',
    },
    transformIgnorePatterns: [ // tells Jest which node_modules to not transform
        "node_modules/(?!(react-native|@react-native|@react-navigation|expo|@expo|expo-sqlite|expo-modules-core)/)"
    ],
};
