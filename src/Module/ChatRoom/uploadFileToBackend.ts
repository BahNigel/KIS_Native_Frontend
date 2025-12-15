// src/screens/chat/uploadFileToBackend.ts
import { Platform } from 'react-native';

export type AttachmentKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'other';

export type AttachmentMeta = {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
  kind: AttachmentKind;
  width?: number;
  height?: number;
  durationMs?: number;
};

export async function uploadFileToBackend(opts: {
  file: { uri: string; name: string; type: string | null; size?: number | null };
  authToken: string;
  baseUrl: string; // e.g. https://your-api.com
}): Promise<AttachmentMeta> {
  const { file, authToken, baseUrl } = opts;

  const form = new FormData();
  form.append('file', {
    uri: Platform.OS === 'android' ? file.uri : file.uri.replace('file://', ''),
    name: file.name || 'file',
    type: file.type || 'application/octet-stream',
  } as any);

  const res = await fetch(`${baseUrl}/uploads/file`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'multipart/form-data',
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  return json as AttachmentMeta;
}
