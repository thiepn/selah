import { APP_SCHEMA_VERSION, DATA_SCHEMA_VERSION, type SelahMetadata, type SelahSettings } from './types.js';

export function defaultMetadata(now = Date.now()): SelahMetadata {
  return {
    id: 'metadata',
    appSchemaVersion: APP_SCHEMA_VERSION,
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    updatedAt: now,
  };
}

export function defaultSettings(): SelahSettings {
  return {
    id: 'settings',
    theme: 'system',
    primaryTranslationId: 'BSB',
    fontScale: 1,
  };
}
