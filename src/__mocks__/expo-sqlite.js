const createMockDb = () => ({
    getFirstAsync: async () => null,
    getAllAsync: async () => [],
    execAsync: async () => { },
    runAsync: async () => ({ lastInsertRowId: 0, changes: 0 }),
    closeAsync: async () => { },
});

module.exports = {
    openDatabaseAsync: async () => createMockDb(),
};
