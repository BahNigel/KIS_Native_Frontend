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
  onProgress?: (progress: number) => void;
  onStatus?: (status: 'uploading' | 'done' | 'failed') => void;
  conversationId?: string;
  clientId?: string;
}): Promise<AttachmentMeta> {
  const { file, authToken, baseUrl, onProgress, onStatus, conversationId, clientId } = opts;

  const form = new FormData();
  form.append('file', {
    uri: Platform.OS === 'android' ? file.uri : file.uri.replace('file://', ''),
    name: file.name || 'file',
    type: file.type || 'application/octet-stream',
  } as any);

  onStatus?.('uploading');
  onProgress?.(0);

  const qs = new URLSearchParams();
  if (conversationId) qs.set('conversationId', conversationId);
  if (clientId) qs.set('clientId', clientId);
  const url = qs.toString() ? `${baseUrl}/uploads/file?${qs.toString()}` : `${baseUrl}/uploads/file`;

  let json: any;
  try {
    json = await new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (err) {
            reject(err);
          }
          return;
        }
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
      };

      xhr.onerror = () => {
        reject(new Error('Upload failed: network error'));
      };

      if (xhr.upload) {
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          const ratio = event.total ? event.loaded / event.total : 0;
          onProgress?.(Math.min(1, Math.max(0, ratio)));
        };
      }

      xhr.send(form as any);
    });
  } catch (err) {
    onStatus?.('failed');
    throw err;
  }

  onProgress?.(1);
  onStatus?.('done');
  const attachment = json?.attachment ?? json;
  return {
    id: attachment.id ?? attachment.key,
    url: attachment.url,
    originalName: attachment.originalName ?? attachment.name ?? file.name,
    mimeType: attachment.mimeType ?? attachment.mime ?? file.type ?? 'application/octet-stream',
    size: attachment.size ?? file.size ?? 0,
    kind: attachment.kind ?? 'other',
    width: attachment.width,
    height: attachment.height,
    durationMs: attachment.durationMs,
  } as AttachmentMeta;
}
