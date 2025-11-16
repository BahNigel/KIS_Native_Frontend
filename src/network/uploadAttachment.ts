// network/uploadAttachment.ts
import { CHAT_UPLOAD_URL } from './routes';

export type UploadedAttachment = {
  id: string;
  url: string;
  name: string;
  mime: string;
  size: number;
};

type UploadParams = {
  uri: string;
  filename: string;
  mime: string;
};

export async function uploadAttachment({
  uri,
  filename,
  mime,
}: UploadParams): Promise<UploadedAttachment> {
  const form = new FormData();

  form.append('file', {
    uri,
    name: filename,
    type: mime,
  } as any);

  const res = await fetch(CHAT_UPLOAD_URL, {
    method: 'POST',
    headers: {
      // RN will set proper boundaries for multipart/form-data
      'Content-Type': 'multipart/form-data',
    },
    body: form,
  });

  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error || 'Upload failed');
  }

  return json.attachment as UploadedAttachment;
}
