import { PutObjectCommand } from '@aws-sdk/client-s3';
import { createS3Client, getBucketConfig } from './aws-config';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';

const region = process.env.AWS_REGION ?? 'us-east-1';

function publicUrl(key: string): string {
  const { bucketName } = getBucketConfig();
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Upload a raw buffer to the public area of the bucket and return a permanent
 * public URL. `keyHint` is used only to build a readable key + extension.
 */
export async function uploadPublicBuffer(
  buffer: Buffer,
  keyHint: string,
  contentType: string,
): Promise<string> {
  const { bucketName, folderPrefix } = getBucketConfig();
  const client = createS3Client();
  const safe = keyHint.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `${folderPrefix}public/generated/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
  return publicUrl(key);
}

/**
 * Upload a string (e.g. an .ass subtitle file) to public storage.
 */
export async function uploadPublicText(
  text: string,
  keyHint: string,
  contentType = 'text/plain',
): Promise<string> {
  return uploadPublicBuffer(Buffer.from(text, 'utf-8'), keyHint, contentType);
}

/**
 * Ensure a file that ships inside /public is available at a stable PUBLIC S3
 * URL (so the FFmpeg API workers can fetch it). The key is content-hashed so a
 * given file is only uploaded once and reused across reels.
 */
const localCache = new Map<string, string>();
export async function ensurePublicLocalAsset(publicRelPath: string, contentType: string): Promise<string> {
  const rel = publicRelPath.replace(/^\/+/, '');
  if (localCache.has(rel)) return localCache.get(rel)!;
  const abs = path.join(process.cwd(), 'public', rel);
  const data = await readFile(abs);
  const hash = createHash('sha1').update(data).digest('hex').slice(0, 16);
  const { bucketName, folderPrefix } = getBucketConfig();
  const client = createS3Client();
  const ext = path.extname(rel) || '';
  const key = `${folderPrefix}public/library/${hash}${ext}`;
  await client.send(
    new PutObjectCommand({ Bucket: bucketName, Key: key, Body: data, ContentType: contentType }),
  );
  const url = publicUrl(key);
  localCache.set(rel, url);
  return url;
}

/** Download a remote URL into a Buffer (used to re-host data-URL images, etc.). */
export function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; contentType: string } {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error('Invalid data URL');
  return { contentType: m[1], buffer: Buffer.from(m[2], 'base64') };
}
