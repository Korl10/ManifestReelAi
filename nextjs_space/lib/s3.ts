import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createS3Client, getBucketConfig } from "./aws-config";

const region = process.env.AWS_REGION ?? "us-east-1";

export async function generatePresignedUploadUrl(
  fileName: string,
  contentType: string,
  isPublic = false
): Promise<{ uploadUrl: string; cloud_storage_path: string }> {
  const { bucketName, folderPrefix } = getBucketConfig();
  const client = createS3Client();
  const cloud_storage_path = isPublic
    ? `${folderPrefix}public/uploads/${Date.now()}-${fileName}`
    : `${folderPrefix}uploads/${Date.now()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    ContentType: contentType,
    ContentDisposition: isPublic ? "attachment" : undefined,
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
  return { uploadUrl, cloud_storage_path };
}

export function getPublicUrl(cloud_storage_path: string): string {
  const { bucketName } = getBucketConfig();
  return `https://${bucketName}.s3.${region}.amazonaws.com/${cloud_storage_path}`;
}

export async function getSignedDownloadUrl(
  cloud_storage_path: string,
  expiresIn = 3600
): Promise<string> {
  const { bucketName } = getBucketConfig();
  const client = createS3Client();
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
  });
  return getSignedUrl(client, command, { expiresIn });
}

export async function getFileUrl(
  cloud_storage_path: string,
  isPublic: boolean
): Promise<string> {
  if (isPublic) return getPublicUrl(cloud_storage_path);
  return getSignedDownloadUrl(cloud_storage_path);
}

export async function deleteFile(cloud_storage_path: string): Promise<void> {
  const { bucketName } = getBucketConfig();
  const client = createS3Client();
  await client.send(
    new DeleteObjectCommand({ Bucket: bucketName, Key: cloud_storage_path })
  );
}
