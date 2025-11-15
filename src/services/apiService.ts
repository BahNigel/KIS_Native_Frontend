// src/services/apiService.ts
type HeadersInit = Record<string, string>;

const defaultHeaders: HeadersInit = {
  'Content-Type': 'application/json',
};

const withHeaders = (headers?: HeadersInit) => ({
  ...defaultHeaders,
  ...(headers ?? {}),
});

const apiService = {
  get: (url: string, headers?: HeadersInit) =>
    fetch(url, { method: 'GET', headers: withHeaders(headers) }),

  post: (url: string, body?: any, headers?: HeadersInit) =>
    fetch(url, {
      method: 'POST',
      headers: withHeaders(headers),
      body: body != null ? JSON.stringify(body) : undefined,
    }),

  put: (url: string, body?: any, headers?: HeadersInit) =>
    fetch(url, {
      method: 'PUT',
      headers: withHeaders(headers),
      body: body != null ? JSON.stringify(body) : undefined,
    }),

  patch: (url: string, body?: any, headers?: HeadersInit) =>
    fetch(url, {
      method: 'PATCH',
      headers: withHeaders(headers),
      body: body != null ? JSON.stringify(body) : undefined,
    }),

  delete: (url: string, headers?: HeadersInit) =>
    fetch(url, { method: 'DELETE', headers: withHeaders(headers) }),
};

export default apiService;
