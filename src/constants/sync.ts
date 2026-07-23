export const SYNC_SERVER_URL_KEY = 'SYNC_SERVER_URL';
// Storage key kept as 'SYNC_TABLE_NAME' so existing installs' saved value carries over as the library id.
export const SYNC_LIBRARY_ID_KEY = 'SYNC_TABLE_NAME';

export const DEFAULT_LIBRARY_ID = 'main';
export const DEFAULT_SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export const LIBRARY_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

// Force export/resync configuration
export const FORCE_EXPORT_BATCH_SIZE = 10;
export const FORCE_EXPORT_CONCURRENCY = 1;
