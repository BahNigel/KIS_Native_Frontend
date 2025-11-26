// network/cache/cache.ts
import RNFS from 'react-native-fs';
import EncryptedStorage from 'react-native-encrypted-storage';
import { CacheTypes, CacheKeys } from './cacheKeys';

const getBaseDirectoryPath = () => `${RNFS.DocumentDirectoryPath}/com.kis/`;
const getSubDirectoryPath = (type: string) => `${getBaseDirectoryPath()}${type}/`;

const ensureDirectoryExists = async (dirPath: string) => {
  const exists = await RNFS.exists(dirPath);
  if (!exists) {
    await RNFS.mkdir(dirPath);
  }
};

const readJson = async (path: string) => {
  const exists = await RNFS.exists(path);
  if (!exists) return null;

  const content = await RNFS.readFile(path, 'utf8');
  try {
    return JSON.parse(content);
  } catch (e) {
    // If something went wrong with the previous file, just drop it.
    return null;
  }
};

const writeJson = async (path: string, data: any) => {
  await RNFS.writeFile(path, JSON.stringify(data), 'utf8');
};

const isPaginated = (value: any) =>
  value &&
  typeof value === 'object' &&
  'meta' in value &&
  Array.isArray(value.results);

const toPaginatedShape = (value: any): { meta?: any; results: any[] } => {
  if (!value) {
    return { meta: undefined, results: [] };
  }

  // Already in paginated form
  if (isPaginated(value)) {
    return { meta: value.meta, results: value.results || [] };
  }

  // Array of items
  if (Array.isArray(value)) {
    return { meta: undefined, results: value };
  }

  // Single item
  return { meta: undefined, results: [value] };
};

export const getCache = async (type: string, key: string) => {
  const file = `${getSubDirectoryPath(type)}${key}.json`;
  return readJson(file);
};

export const setCache = async (type: string, key: string, data: any) => {
  const dir = getSubDirectoryPath(type);
  const file = `${dir}${key}.json`;

  await ensureDirectoryExists(dir);

  const oldValue = await getCache(type, key);

  // --- Case 1: paginated responses { meta, results: [] } ---
  if (isPaginated(oldValue) || isPaginated(data)) {
    const { meta: oldMeta, results: oldResults } = toPaginatedShape(oldValue);
    const { meta: newMeta, results: newResults } = toPaginatedShape(data);

    const map = new Map<any, any>();

    const addToMap = (item: any) => {
      if (item == null) return;
      const id = typeof item === 'object' && item.id != null ? item.id : Symbol();
      map.set(id, item);
    };

    oldResults.forEach(addToMap);
    newResults.forEach(addToMap);

    const results = Array.from(map.values());

    const meta = {
      ...(oldMeta || {}),
      ...(newMeta || {}),
      count: results.length,
    };

    await writeJson(file, { meta, results });
    return;
  }

  // --- Case 2: generic arrays of items (no meta/results wrapper) ---
  if (Array.isArray(oldValue) || Array.isArray(data)) {
    const oldArr = Array.isArray(oldValue)
      ? oldValue
      : oldValue != null
      ? [oldValue]
      : [];
    const newArr = Array.isArray(data) ? data : data != null ? [data] : [];

    const map = new Map<any, any>();

    const addToMap = (item: any) => {
      if (item == null) return;
      if (typeof item === 'object') {
        const id = item.id != null ? item.id : Symbol();
        map.set(id, item);
      } else {
        // primitive value
        map.set(Symbol(), item);
      }
    };

    oldArr.forEach(addToMap);
    newArr.forEach(addToMap);

    const result = Array.from(map.values());
    await writeJson(file, result);
    return;
  }

  // --- Case 3: simple object or primitive – just overwrite ---
  await writeJson(file, data);
};

export const clearCacheByKey = async (type: string, key: string) => {
  const file = `${getSubDirectoryPath(type)}${key}.json`;
  const exists = await RNFS.exists(file);
  if (exists) {
    await RNFS.unlink(file);
  }
};

export const clearCacheByType = async (type: string) => {
  const dir = getSubDirectoryPath(type);
  const exists = await RNFS.exists(dir);
  if (exists) {
    await RNFS.unlink(dir);
  }
};

export const getUserData = async () => ({
  user: await getCache(CacheTypes.USER_CACHE, CacheKeys.USER_PROFILE),
  token: await getCache(CacheTypes.AUTH_CACHE, CacheKeys.USER_TOKEN),
});

export const setUserData = async (user: any, token: any) => {
  await setCache(CacheTypes.USER_CACHE, CacheKeys.USER_PROFILE, user);
  await setCache(CacheTypes.AUTH_CACHE, CacheKeys.USER_TOKEN, token);
};

export const clearUserData = async () => {
  await clearCacheByType(CacheTypes.USER_CACHE);
  await clearCacheByType(CacheTypes.AUTH_CACHE);
};

// Secure private key storage
export const savePrivateKey = async (key: string, value: string) => {
  await EncryptedStorage.setItem(key, value);
};

export const getPrivateKey = async (key: string) => {
  return EncryptedStorage.getItem(key);
};

export const deletePrivateKey = async (key: string) => {
  await EncryptedStorage.removeItem(key);
};
