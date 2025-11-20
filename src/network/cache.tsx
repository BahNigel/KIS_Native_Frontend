// network/cache/cache.ts
import RNFS from 'react-native-fs';
import EncryptedStorage from 'react-native-encrypted-storage';
import { CacheTypes, CacheKeys } from './cacheKeys';

const getBaseDirectoryPath = () => `${RNFS.DocumentDirectoryPath}/com.kis/`;
const getSubDirectoryPath = (type: string) => `${getBaseDirectoryPath()}${type}/`;

const ensureDirectoryExists = async (dirPath: string) => {
  if (!(await RNFS.exists(dirPath))) {
    await RNFS.mkdir(dirPath);
  }
};

const readJson = async (path: string) => {
  if (!(await RNFS.exists(path))) return null;
  return JSON.parse(await RNFS.readFile(path, 'utf8'));
};

const writeJson = async (path: string, data: any) => {
  await RNFS.writeFile(path, JSON.stringify(data), 'utf8');
};

export const getCache = async (type: string, key: string) => {
  return readJson(`${getSubDirectoryPath(type)}${key}.json`);
};

export const setCache = async (type: string, key: string, data: any) => {
  const dir = getSubDirectoryPath(type);
  const file = `${dir}${key}.json`;

  await ensureDirectoryExists(dir);

  const old = (await getCache(type, key)) ?? [];
  const incoming = Array.isArray(data) ? data : [data];

  const map = new Map();
  old.forEach((i: { id: any; }) => map.set(i.id ?? Symbol(), i));
  incoming.forEach((i) => map.set(i.id ?? Symbol(), i));

  const result = Array.from(map.values());
  await writeJson(file, result);
};

export const clearCacheByKey = async (type: string, key: string) => {
  const file = `${getSubDirectoryPath(type)}${key}.json`;
  if (await RNFS.exists(file)) await RNFS.unlink(file);
};

export const clearCacheByType = async (type: string) => {
  const dir = getSubDirectoryPath(type);
  if (await RNFS.exists(dir)) await RNFS.unlink(dir);
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
