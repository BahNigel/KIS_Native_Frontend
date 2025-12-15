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
    if ((obj as any).uri && (obj as any).name && (obj as any).type) return (obj as any).uri;
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
    // if (!(await isOnline())) throw new Error('No internet connection.');

    const token = await AsyncStorage.getItem('access_token');

    // 🔑 Robust FormData detection for React Native
    const isFormData =
      typeof FormData !== 'undefined' &&
      (data instanceof FormData ||
        // RN FormData polyfill check
        (data &&
          typeof data === 'object' &&
          typeof (data as any).append === 'function' &&
          Array.isArray((data as any)._parts)));

    const baseHeaders: HeadersInit = {};
    // ❗ Only set JSON content-type if NOT FormData
    if (!isFormData) {
      baseHeaders['Content-Type'] = 'application/json';
    }
    if (token) baseHeaders.Authorization = `Bearer ${token}`;

    const headers = { ...baseHeaders, ...(options.headers ?? {}) };

    // ❗ Do NOT sanitize FormData or convert it
    const payload = isFormData ? data : sanitizeFileData(data);

    const response = await apiService.post(url, payload, headers);
    const responseData = await response.json().catch(() => ({}));

    if (response.ok) {
      if (options.cacheKey) {
        const cType = options.cacheType || CacheTypes.DEFAULT;
        await setCache(cType, options.cacheKey, responseData);
      }
      return {
        success: true,
        data: responseData,
        message: options.successMessage || '',
      };
    }

    const msg =
      (responseData && (responseData.message || responseData.detail)) ||
      options.errorMessage ||
      'Request failed.';
    return {
      success: false,
      message: msg,
      status: response.status,
      data: responseData,
    };
  } catch (error: any) {
    return {
      success: false,
      message:
        error?.message || options.errorMessage || 'An error occurred.',
    };
  }
};
