import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3 = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER || 'minioadmin',
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD || 'minioadmin',
  },
  forcePathStyle: true,
})

const BUCKET = process.env.MINIO_BUCKET || 'laiw-uploads'

export async function ensureBucket() {
  const { HeadBucketCommand } = await import('@aws-sdk/client-s3')
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }))
  } catch {
    const { CreateBucketCommand } = await import('@aws-sdk/client-s3')
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }))
  }
}

export async function uploadFile(key: string, body: Buffer, contentType: string): Promise<string> {
  await ensureBucket()
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }))
  return key
}

export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(s3, command, { expiresIn })
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}
