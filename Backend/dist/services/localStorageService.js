"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalStorageService = void 0;
class LocalStorageService {
    /**
     * Mock S3 upload - just returns local file path
     */
    async uploadFile(localPath, s3Key, contentType = "video/mp4") {
        console.log(`Mock S3 upload: ${localPath} -> ${s3Key}`);
        // Just return the local path as the "S3 URL"
        return `file://${localPath}`;
    }
    /**
     * Mock S3 upload without deleting local file
     */
    async uploadFileWithoutDelete(localPath, s3Key, contentType = "video/mp4") {
        console.log(`Mock S3 upload (preserve local): ${localPath} -> ${s3Key}`);
        // Just return the local path as the "S3 URL"
        return `file://${localPath}`;
    }
    /**
     * Generate a local file URL for downloading
     */
    async getSignedUrl(s3Key, expiresIn = 3600) {
        // For local files, just return the file path
        const localPath = s3Key.replace("recordings/", "./recordings/");
        return `file://${localPath}`;
    }
    /**
     * Mock delete file - does nothing for now
     */
    async deleteFile(s3Key) {
        console.log(`Mock S3 delete: ${s3Key}`);
        // Don't actually delete anything for now
    }
    /**
     * Mock list files
     */
    async listFiles(prefix = "") {
        console.log(`Mock S3 list: ${prefix}`);
        return [];
    }
    /**
     * Mock file exists check
     */
    async fileExists(s3Key) {
        console.log(`Mock S3 file exists check: ${s3Key}`);
        return false;
    }
    /**
     * Mock file stats
     */
    async getFileStats(s3Key) {
        console.log(`Mock S3 file stats: ${s3Key}`);
        throw new Error(`File not found: ${s3Key}`);
    }
}
exports.LocalStorageService = LocalStorageService;
exports.default = new LocalStorageService();
