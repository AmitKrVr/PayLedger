export {
    db,
    pool,
    testConnection,
    closeConnection,
    type Database,
    type Transaction,
    type DatabaseOrTransaction,
} from './client.js';

export * from './schema/index.js';