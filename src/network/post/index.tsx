// src/network/postRequest.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/apiService';
import { isOnline } from '../../services/networkMonitor';
import { getCache, setCache } from '../cache';
import { CacheKeys, CacheTypes } from '../cacheKeys';

type HeadersInit = Record<string, string>;

const sanitizeFileData = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(sanitizeFileData);
  if (obj && typeof obj === 'object') {
    if (obj.uri && obj.name && obj.type) return obj.uri;
    const out: any = {};
    for (const k of Object.keys(obj)) out[k] = sanitizeFileData(obj[k]);
    return out;
  }
  return obj;
};

export const postRequest = async (
  url: string,
  data: any,
  options: {
    headers?: HeadersInit;
    cacheKey?: string;
    cacheType?: string;
    successMessage?: string;
    errorMessage?: string;
  } = {}
) => {
  try {
    if (!(await isOnline())) throw new Error('No internet connection.');

    const token = await AsyncStorage.getItem('access_token');
    const baseHeaders: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) baseHeaders.Authorization = `Bearer ${token}`;

    const headers = { ...baseHeaders, ...(options.headers ?? {}) };
    const sanitizedData = sanitizeFileData(data);

    const response = await apiService.post(url, sanitizedData, headers);
    const responseData = await response.json().catch(() => ({}));

    if (response.ok) {
      if (options.cacheKey) {
        const cType = options.cacheType || CacheTypes.DEFAULT;
        await setCache(cType, options.cacheKey, responseData);
      }
      return { success: true, data: responseData, message: options.successMessage || '' };
    }

    const msg = (responseData && (responseData.message || responseData.detail)) || options.errorMessage || 'Request failed.';
    return { success: false, message: msg, status: response.status, data: responseData };
  } catch (error: any) {
    return { success: false, message: error?.message || options.errorMessage || 'An error occurred.' };
  }
};
