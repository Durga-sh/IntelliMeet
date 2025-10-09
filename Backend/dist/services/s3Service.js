"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3Service = void 0;
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const config_1 = __importDefault(require("../config/config"));
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
class S3Service {
    constructor() {
        this.s3 = new aws_sdk_1.default.S3({
            accessKeyId: config_1.default.AWS_ACCESS_KEY_ID,
            secretAccessKey: config_1.default.AWS_SECRET_ACCESS_KEY,
            region: config_1.default.AWS_REGION,
        });
    }
    /**
     * Upload a file to S3
     */
    async uploadFile(localPath, s3Key, contentType = "video/mp4") {
        try {
            const fileStream = (0, fs_1.createReadStream)(localPath);
            const params = {
                Bucket: config_1.default.AWS_S3_BUCKET,
                Key: s3Key,
                Body: fileStream,
                ContentType: contentType,
                ACL: "private", // Change to 'public-read' if you want public access
            };
            const result = await this.s3.upload(params).promise();
            // Clean up local file after successful upload
            await (0, promises_1.unlink)(localPath);
            console.log(`File uploaded successfully to S3: ${result.Location}`);
            return result.Location;
        }
        catch (error) {
            console.error("Error uploading file to S3:", error);
            throw error;
        }
    }
    /**
     * Generate a pre-signed URL for downloading a file
     */
    async getSignedUrl(s3Key, expiresIn = 3600) {
        try {
            const params = {
                Bucket: config_1.default.AWS_S3_BUCKET,
                Key: s3Key,
                Expires: expiresIn, // URL expires in seconds
            };
            const url = await this.s3.getSignedUrlPromise("getObject", params);
            return url;
        }
        catch (error) {
            console.error("Error generating signed URL:", error);
            throw error;
        }
    }
    /**
     * Delete a file from S3
     */
    async deleteFile(s3Key) {
        try {
            const params = {
                Bucket: config_1.default.AWS_S3_BUCKET,
                Key: s3Key,
            };
            await this.s3.deleteObject(params).promise();
            console.log(`File deleted successfully from S3: ${s3Key}`);
        }
        catch (error) {
            console.error("Error deleting file from S3:", error);
            throw error;
        }
    }
    /**
     * List files in S3 bucket with a specific prefix
     */
    async listFiles(prefix = "") {
        try {
            const params = {
                Bucket: config_1.default.AWS_S3_BUCKET,
                Prefix: prefix,
            };
            const result = await this.s3.listObjectsV2(params).promise();
            return result.Contents || [];
        }
        catch (error) {
            console.error("Error listing files from S3:", error);
            throw error;
        }
    }
    /**
     * Check if file exists in S3
     */
    async fileExists(s3Key) {
        try {
            const params = {
                Bucket: config_1.default.AWS_S3_BUCKET,
                Key: s3Key,
            };
            await this.s3.headObject(params).promise();
            return true;
        }
        catch (error) {
            if (error.code === "NotFound") {
                return false;
            }
            throw error;
        }
    }
    /**
     * Get file statistics (size, last modified, etc.)
     */
    async getFileStats(s3Key) {
        try {
            const params = {
                Bucket: config_1.default.AWS_S3_BUCKET,
                Key: s3Key,
            };
            const result = await this.s3.headObject(params).promise();
            return {
                size: result.ContentLength || 0,
                lastModified: result.LastModified || new Date(),
                contentType: result.ContentType || "unknown",
                etag: result.ETag || "",
            };
        }
        catch (error) {
            if (error.code === "NotFound") {
                throw new Error(`File not found: ${s3Key}`);
            }
            throw error;
        }
    }
}
exports.S3Service = S3Service;
exports.default = new S3Service();
