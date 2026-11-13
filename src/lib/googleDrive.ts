export interface DriveUploadResult {
  fileId: string;
  name: string;
  webViewLink: string;
  mimeType: 'image/jpeg' | 'image/png';
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: 'image/jpeg' | 'image/png' } {
  const match = /^data:(image\/(?:jpeg|jpg|png));base64,(.+)$/.exec(dataUrl.trim());
  if (!match) {
    throw new Error('Only JPEG and PNG image formats can be uploaded to Google Drive.');
  }
  const mimeType: 'image/jpeg' | 'image/png' =
    match[1].toLowerCase() === 'image/png' ? 'image/png' : 'image/jpeg';
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return {
    blob: new Blob([bytes], { type: mimeType }),
    mimeType,
  };
}

export async function uploadImageToGoogleDrive(
  accessToken: string,
  options: {
    dataUrl: string;
    filename: string;
  },
): Promise<DriveUploadResult> {
  const { blob, mimeType } = dataUrlToBlob(options.dataUrl);
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const safeBaseName = (options.filename || 'lost-found-item')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim() || 'lost-found-item';
  const uploadName = `QuadFind-${safeBaseName}-${Date.now()}.${ext}`;

  const metadata = {
    name: uploadName,
    mimeType,
    description: 'Item photo uploaded via QuadFind Campus Lost & Found',
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
  );
  form.append('file', blob, uploadName);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,mimeType',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    },
  );

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.id) {
    throw new Error(
      json.error?.message || `Google Drive upload failed (${res.status}).`,
    );
  }

  return {
    fileId: json.id as string,
    name: (json.name as string) || uploadName,
    webViewLink:
      (json.webViewLink as string) ||
      `https://drive.google.com/file/d/${encodeURIComponent(json.id)}/view`,
    mimeType,
  };
}

export async function deleteDriveFile(accessToken: string, fileId: string): Promise<void> {
  const safeId = encodeURIComponent(fileId.trim());
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${safeId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Could not delete file from Google Drive (${res.status}).`);
  }
}
