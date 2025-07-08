module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
    },
};
