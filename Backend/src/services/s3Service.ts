import AWS from "aws-sdk";
import config from "../config/config";
import { createReadStream } from "fs";
import { unlink } from "fs/promises";

export class S3Service {
  private s3: AWS.S3;

  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
      region: config.AWS_REGION,
    });
  }

  /**
   * Upload a file to S3
   */
  async uploadFile(
    localPath: string,
    s3Key: string,
    contentType: string = "video/mp4"
  ): Promise<string> {
    try {
      const fileStream = createReadStream(localPath);

      const params: AWS.S3.PutObjectRequest = {
        Bucket: config.AWS_S3_BUCKET,
        Key: s3Key,
        Body: fileStream,
        ContentType: contentType,
        ACL: "private", // Change to 'public-read' if you want public access
      };

      const result = await this.s3.upload(params).promise();

      // Clean up local file after successful upload
      await unlink(localPath);

      console.log(`File uploaded successfully to S3: ${result.Location}`);
      return result.Location;
    } catch (error) {
      console.error("Error uploading file to S3:", error);
      throw error;
    }
  }

  /**
   * Generate a pre-signed URL for downloading a file
   */
  async getSignedUrl(s3Key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const params = {
        Bucket: config.AWS_S3_BUCKET,
        Key: s3Key,
        Expires: expiresIn, // URL expires in seconds
      };

      const url = await this.s3.getSignedUrlPromise("getObject", params);
      return url;
    } catch (error) {
      console.error("Error generating signed URL:", error);
      throw error;
    }
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(s3Key: string): Promise<void> {
    try {
      const params = {
        Bucket: config.AWS_S3_BUCKET,
        Key: s3Key,
      };

      await this.s3.deleteObject(params).promise();
      console.log(`File deleted successfully from S3: ${s3Key}`);
    } catch (error) {
      console.error("Error deleting file from S3:", error);
      throw error;
    }
  }

  /**
   * List files in S3 bucket with a specific prefix
   */
  async listFiles(prefix: string = ""): Promise<AWS.S3.Object[]> {
    try {
      const params = {
        Bucket: config.AWS_S3_BUCKET,
        Prefix: prefix,
      };

      const result = await this.s3.listObjectsV2(params).promise();
      return result.Contents || [];
    } catch (error) {
      console.error("Error listing files from S3:", error);
      throw error;
    }
  }

  /**
   * Check if file exists in S3
   */
  async fileExists(s3Key: string): Promise<boolean> {
    try {
      const params = {
        Bucket: config.AWS_S3_BUCKET,
        Key: s3Key,
      };

      await this.s3.headObject(params).promise();
      return true;
    } catch (error: any) {
      if (error.code === "NotFound") {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file statistics (size, last modified, etc.)
   */
  async getFileStats(s3Key: string): Promise<{
    size: number;
    lastModified: Date;
    contentType: string;
    etag: string;
  }> {
    try {
      const params = {
        Bucket: config.AWS_S3_BUCKET,
        Key: s3Key,
      };

      const result = await this.s3.headObject(params).promise();

      return {
        size: result.ContentLength || 0,
        lastModified: result.LastModified || new Date(),
        contentType: result.ContentType || "unknown",
        etag: result.ETag || "",
      };
    } catch (error: any) {
      if (error.code === "NotFound") {
        throw new Error(`File not found: ${s3Key}`);
      }
      throw error;
    }
  }
}

export default new S3Service();
