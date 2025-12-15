// src/network/routes/get/index.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/apiService';
import { isOnline } from '../../services/networkMonitor';
import { getCache, setCache } from '../cache';
import { CacheKeys, CacheTypes } from '../cacheKeys';

type HeadersInit = Record<string, string>;

export const getRequest = async (
  url: string,
  options: {
    headers?: HeadersInit;
    cacheKey?: string;
    cacheType?: string;
    successMessage?: string;
    errorMessage?: string;
    params?: Record<string, any>;
  } = {}
) => {
  try {
    // if (!(await isOnline())) throw new Error('No internet connection.');

    // const token = await resolveBearerToken();
    const token = await AsyncStorage.getItem('access_token');
    const baseHeaders: HeadersInit = {};
    if (token) baseHeaders.Authorization = `Bearer ${token}`;

    const headers = { ...baseHeaders, ...(options.headers ?? {}) };

    const response = await apiService.get(url, headers);
    const responseData = await response.json().catch(() => ({}));

    if (response.ok) {
      if (options.cacheKey) {
        const cType = options.cacheType || CacheTypes.DEFAULT;
        await setCache(cType, options.cacheKey, responseData);
      }
      return { success: true, data: responseData, message: options.successMessage || '' };
    }

    const msg =
      (responseData && (responseData.message || responseData.detail)) ||
      options.errorMessage ||
      'Request failed.';

    return { success: false, message: msg, status: response.status, data: responseData };
  } catch (error: any) {
    return { success: false, message: error?.message || options.errorMessage || 'An error occurred.' };
  }
};
