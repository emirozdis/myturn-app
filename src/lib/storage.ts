import { Platform } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const LEGACY_STORAGE_ID = 'myturn-app-storage';
const ENCRYPTED_STORAGE_ID = 'myturn-app-storage-v2';
const ENCRYPTION_KEY_NAME = 'myturn.mmkv.encryption-key.v2';
const MIGRATION_MARKER = 'myturn_storage_migrated_v2';
const KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function createEncryptionKey(): string {
  // react-native-mmkv v3 permits at most 16 bytes. Mapping 16 random bytes
  // into a 64-character alphabet provides a 16-byte, 96-bit key.
  return Array.from(
    Crypto.getRandomBytes(16),
    (byte) => KEY_ALPHABET[byte & 63],
  ).join('');
}

function copyLegacyValue(legacy: MMKV, encrypted: MMKV, key: string): boolean {
  const stringValue = legacy.getString(key);
  if (stringValue !== undefined) {
    encrypted.set(key, stringValue);
    return true;
  }

  const booleanValue = legacy.getBoolean(key);
  if (booleanValue !== undefined) {
    encrypted.set(key, booleanValue);
    return true;
  }

  const numberValue = legacy.getNumber(key);
  if (numberValue !== undefined) {
    encrypted.set(key, numberValue);
    return true;
  }

  const bufferValue = legacy.getBuffer(key);
  if (bufferValue !== undefined) {
    encrypted.set(key, bufferValue as ArrayBuffer);
    return true;
  }

  return false;
}

function createMobileStorage(): MMKV {
  let encryptionKey = SecureStore.getItem(ENCRYPTION_KEY_NAME);
  if (!encryptionKey) {
    encryptionKey = createEncryptionKey();
    SecureStore.setItem(ENCRYPTION_KEY_NAME, encryptionKey, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  const encrypted = new MMKV({
    id: ENCRYPTED_STORAGE_ID,
    encryptionKey,
  });

  if (!encrypted.getBoolean(MIGRATION_MARKER)) {
    const legacy = new MMKV({ id: LEGACY_STORAGE_ID });
    for (const key of legacy.getAllKeys()) {
      if (copyLegacyValue(legacy, encrypted, key)) {
        legacy.delete(key);
      }
    }
    encrypted.set(MIGRATION_MARKER, true);
    legacy.trim();
  }

  return encrypted;
}

// MMKV encryption and SecureStore are native-only. Web retains a separate
// storage namespace and must never receive a mobile session cookie.
export const storage = Platform.OS === 'web'
  ? new MMKV({ id: `${LEGACY_STORAGE_ID}-web` })
  : createMobileStorage();

export const mmkvStorage = {
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  getItem: (key: string) => {
    return storage.getString(key) ?? null;
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
};
