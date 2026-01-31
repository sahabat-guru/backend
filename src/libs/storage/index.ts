import { Storage } from "@google-cloud/storage";
import { config, logger } from "../config";
import { v4 as uuidv4 } from "uuid";
import path from "path";

// Initialize Google Cloud Storage client
const storage = config.gcs.projectId
	? new Storage({
			projectId: config.gcs.projectId,
			keyFilename: config.gcs.keyFile,
		})
	: null;

const bucket = storage?.bucket(config.gcs.bucketName);

export interface UploadResult {
	url: string;
	filename: string;
	contentType: string;
	size: number;
}

// Upload file to GCS
export async function uploadFile(
	buffer: Buffer,
	originalFilename: string,
	contentType: string,
	folder: string = "uploads",
): Promise<UploadResult> {
	if (!bucket) {
		throw new Error("Google Cloud Storage is not configured");
	}

	const ext = path.extname(originalFilename);
	const filename = `${folder}/${uuidv4()}${ext}`;
	const file = bucket.file(filename);

	await file.save(buffer, {
		metadata: {
			contentType,
		},
	});

	// Make file publicly readable (optional - adjust based on needs)
	await file.makePublic();

	const url = `https://storage.googleapis.com/${config.gcs.bucketName}/${filename}`;

	logger.info(`File uploaded to GCS: ${filename}`);

	return {
		url,
		filename,
		contentType,
		size: buffer.length,
	};
}

// Generate signed URL for private file access
export async function getSignedUrl(
	filename: string,
	expiresInMinutes: number = 60,
): Promise<string> {
	if (!bucket) {
		throw new Error("Google Cloud Storage is not configured");
	}

	const file = bucket.file(filename);
	const [url] = await file.getSignedUrl({
		action: "read",
		expires: Date.now() + expiresInMinutes * 60 * 1000,
	});

	return url;
}

// Delete file from GCS
export async function deleteFile(filename: string): Promise<void> {
	if (!bucket) {
		throw new Error("Google Cloud Storage is not configured");
	}

	const file = bucket.file(filename);
	await file.delete();
	logger.info(`File deleted from GCS: ${filename}`);
}

// Check if file exists
export async function fileExists(filename: string): Promise<boolean> {
	if (!bucket) {
		return false;
	}

	const file = bucket.file(filename);
	const [exists] = await file.exists();
	return exists;
}

// Get file metadata
export async function getFileMetadata(
	filename: string,
): Promise<Record<string, unknown> | null> {
	if (!bucket) {
		return null;
	}

	const file = bucket.file(filename);
	const [metadata] = await file.getMetadata();
	return metadata;
}

// Validate file type
export function isAllowedFileType(
	contentType: string,
	allowedTypes: string[] = [
		"image/jpeg",
		"image/png",
		"image/gif",
		"application/pdf",
	],
): boolean {
	return allowedTypes.includes(contentType);
}

// Validate file size
export function isAllowedFileSize(
	size: number,
	maxSizeMB: number = 10,
): boolean {
	return size <= maxSizeMB * 1024 * 1024;
}
