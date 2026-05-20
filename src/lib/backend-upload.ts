import { API_URL, authHeaders } from "@/lib/api";

export const MEDIA_UPLOAD_DISABLED_MESSAGE =
  "Media upload requires an admin login and a running backend server.";

class MediaUploadDisabledError extends Error {
  constructor(message = MEDIA_UPLOAD_DISABLED_MESSAGE) {
    super(message);
    this.name = "MediaUploadError";
  }
}

export function isMediaUploadDisabledError(error: unknown) {
  return error instanceof MediaUploadDisabledError;
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "application/pdf": "pdf",
};

export type UploadedMediaPayload = {
  success: boolean;
  url: string;
  fileUrl?: string;
  webmUrl?: string;
  mediaType?: "image" | "document" | "short_video_upload" | "youtube_video";
  file?: {
    name?: string;
    type?: string;
    size?: number;
    durationSeconds?: number | null;
    folder?: string;
  };
};

export function safeUploadName(name: string) {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "media";
}

function uploadFolder(prefix: string) {
  const safePrefix = prefix
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/\/+/g, "/");
  return safePrefix || "uploads";
}

function fileNameForDataUrl(sourceName: string, contentType: string) {
  const extension = EXTENSION_BY_TYPE[contentType] || "bin";
  const baseName = safeUploadName(sourceName).replace(/\.[a-z0-9]+$/i, "") || "image";
  return `${baseName}.${extension}`;
}

async function uploadMedia(
  prefix: string,
  media: Blob | File,
  name: string,
  contentType: string,
): Promise<UploadedMediaPayload> {
  const token = localStorage.getItem("loyola_token");
  if (!token) {
    throw new MediaUploadDisabledError("Please log in before uploading media.");
  }

  const file = media instanceof File ? media : new File([media], name, { type: contentType });
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${API_URL}/api/uploads?folder=${encodeURIComponent(uploadFolder(prefix))}`,
    {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    },
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || "Media upload failed.");
  }

  return payload as UploadedMediaPayload;
}

// Kept for backward compatibility with existing components.
// The implementation now uploads to the Node.js/MySQL backend, the backend.
export async function uploadFileToBackend(prefix: string, file: File) {
  const payload = await uploadMedia(prefix, file, file.name, file.type);
  return payload.url;
}

export async function uploadFileToBackendInfo(prefix: string, file: File) {
  return uploadMedia(prefix, file, file.name, file.type);
}

export async function uploadDataUrlToBackend(prefix: string, dataUrl: string, sourceName: string) {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error("Could not prepare media for upload.");

  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const media = await response.blob();
  const payload = await uploadMedia(
    prefix,
    media,
    fileNameForDataUrl(sourceName, contentType),
    contentType,
  );
  return payload.url;
}

export async function deleteBackendFileByUrl(_url: string) {
  // File removal is intentionally not exposed from the browser yet.
  // Keep uploaded media until a protected backend delete endpoint is added.
}
