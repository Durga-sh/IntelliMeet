import { createReadStream, promises as fs } from "fs";

export class LocalStorageService {
  /**
   * Mock S3 upload - just returns local file path
   */
  async uploadFile(
    localPath: string,
    s3Key: string,
    contentType: string = "video/mp4"
  ): Promise<string> {
    console.log(`Mock S3 upload: ${localPath} -> ${s3Key}`);
    // Just return the local path as the "S3 URL"
    return `file://${localPath}`;
  }

  /**
   * Mock S3 upload without deleting local file
   */
  async uploadFileWithoutDelete(
    localPath: string,
    s3Key: string,
    contentType: string = "video/mp4"
  ): Promise<string> {
    console.log(`Mock S3 upload (preserve local): ${localPath} -> ${s3Key}`);
    // Just return the local path as the "S3 URL"
    return `file://${localPath}`;
  }

  /**
   * Generate a local file URL for downloading
   */
  async getSignedUrl(s3Key: string, expiresIn: number = 3600): Promise<string> {
    // For local files, just return the file path
    const localPath = s3Key.replace("recordings/", "./recordings/");
    return `file://${localPath}`;
  }

  /**
   * Mock delete file - does nothing for now
   */
  async deleteFile(s3Key: string): Promise<void> {
    console.log(`Mock S3 delete: ${s3Key}`);
    // Don't actually delete anything for now
  }

  /**
   * Mock list files
   */
  async listFiles(prefix: string = ""): Promise<any[]> {
    console.log(`Mock S3 list: ${prefix}`);
    return [];
  }

  /**
   * Mock file exists check
   */
  async fileExists(s3Key: string): Promise<boolean> {
    console.log(`Mock S3 file exists check: ${s3Key}`);
    return false;
  }

  /**
   * Mock file stats
   */
  async getFileStats(s3Key: string): Promise<{
    size: number;
    lastModified: Date;
    contentType: string;
    etag: string;
  }> {
    console.log(`Mock S3 file stats: ${s3Key}`);
    throw new Error(`File not found: ${s3Key}`);
  }
}

export default new LocalStorageService();
