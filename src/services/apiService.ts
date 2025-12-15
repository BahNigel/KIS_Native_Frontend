// src/services/apiService.ts
type HeadersInit = Record<string, string>;

// Default headers that apply when we're sending JSON
const defaultJsonHeaders: HeadersInit = {
  'Content-Type': 'application/json',
};

/**
 * Merge headers, but only apply default JSON headers if we're not
 * sending FormData. For FormData, Content-Type must be omitted so
 * fetch can set the correct multipart boundary.
 */
const withHeaders = (headers: HeadersInit | undefined, isFormData: boolean) => {
  const base: HeadersInit = isFormData ? {} : defaultJsonHeaders;
  return {
    ...base,
    ...(headers ?? {}),
  };
};

/**
 * Robust FormData detection for React Native
 */
const isFormDataLike = (body: any): boolean => {
  return (
    typeof FormData !== 'undefined' &&
    (body instanceof FormData ||
      (body &&
        typeof body === 'object' &&
        typeof (body as any).append === 'function' &&
        Array.isArray((body as any)._parts)))
  );
};

const apiService = {
  get: (url: string, headers?: HeadersInit) =>
    fetch(url, {
      method: 'GET',
      // GET has no body, so treat as JSON-style headers (no body anyway)
      headers: withHeaders(headers, false),
    }),

  post: (url: string, body?: any, headers?: HeadersInit) => {
    const isFormData = isFormDataLike(body);

    return fetch(url, {
      method: 'POST',
      headers: withHeaders(headers, isFormData),
      body: isFormData
        ? body
        : body != null
        ? JSON.stringify(body)
        : undefined,
    });
  },

  put: (url: string, body?: any, headers?: HeadersInit) => {
    const isFormData = isFormDataLike(body);

    return fetch(url, {
      method: 'PUT',
      headers: withHeaders(headers, isFormData),
      body: isFormData
        ? body
        : body != null
        ? JSON.stringify(body)
        : undefined,
    });
  },

  patch: (url: string, body?: any, headers?: HeadersInit) => {
    const isFormData = isFormDataLike(body);

    return fetch(url, {
      method: 'PATCH',
      headers: withHeaders(headers, isFormData),
      body: isFormData
        ? body
        : body != null
        ? JSON.stringify(body)
        : undefined,
    });
  },

  delete: (url: string, headers?: HeadersInit) =>
    fetch(url, {
      method: 'DELETE',
      headers: withHeaders(headers, false),
    }),
};

export default apiService;
