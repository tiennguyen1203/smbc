import ffmpeg from "fluent-ffmpeg";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { VideoModel } from "../models/Video";
import cacheService from "./cacheService";

interface ProcessingResult {
  duration: number;
  thumbnailPath: string;
  success: boolean;
  error?: string;
  fileSize?: number;
  bitrate?: number;
  resolution?: string;
  codec?: string;
}

class VideoProcessingService {
  private uploadsDir = path.join(__dirname, "../../uploads");
  private processedDir = path.join(__dirname, "../../processed");
  private thumbnailsDir = path.join(__dirname, "../../thumbnails");

  constructor() {
    this.ensureDirectories();
    this.checkFFmpegAvailability();
  }

  private async ensureDirectories() {
    try {
      console.log("Creating directories:");
      console.log("Uploads dir:", this.uploadsDir);
      console.log("Processed dir:", this.processedDir);
      console.log("Thumbnails dir:", this.thumbnailsDir);

      await fs.mkdir(this.uploadsDir, { recursive: true });
      await fs.mkdir(this.processedDir, { recursive: true });
      await fs.mkdir(this.thumbnailsDir, { recursive: true });

      console.log("Directories created successfully");
    } catch (error) {
      console.error("Error creating directories:", error);
    }
  }

  private checkFFmpegAvailability() {
    try {
      ffmpeg.getAvailableCodecs((err, codecs) => {
        if (err) {
          console.error("FFmpeg codecs check failed:", err);
          console.error("FFmpeg may not be properly installed or accessible");
        } else {
          console.log(
            "FFmpeg is available with codecs:",
            Object.keys(codecs || {}).length
          );
        }
      });
    } catch (error) {
      console.error("FFmpeg availability check failed:", error);
      console.error("FFmpeg may not be properly installed or accessible");
    }
  }

  async processVideo(
    videoId: string,
    filePath: string
  ): Promise<ProcessingResult> {
    try {
      console.log(`Starting video processing for: ${videoId}`);

      const stats = await fs.stat(filePath);
      const fileSizeGB = stats.size / (1024 * 1024 * 1024);
      console.log(`Processing video of size: ${fileSizeGB.toFixed(2)}GB`);

      const result = await this.extractMetadata(filePath);

      if (result.success) {
        if (fileSizeGB > 1) {
          console.log(`Using optimized processing for large file: ${videoId}`);
          await this.generateOptimizedThumbnail(filePath, videoId);
        } else {
          await this.generateThumbnail(filePath, videoId);
        }

        await this.updateVideoStatus(videoId, "ready", result);
        await this.clearVideoCaches(videoId);
        console.log(`Video processing completed for: ${videoId}`);
      } else {
        await this.updateVideoStatus(videoId, "failed", result);
        console.error(`Video processing failed for: ${videoId}:`, result.error);
      }

      return result;
    } catch (error) {
      console.error(`Error processing video ${videoId}:`, error);
      const errorResult: ProcessingResult = {
        duration: 0,
        thumbnailPath: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };

      await this.updateVideoStatus(videoId, "failed", errorResult);
      return errorResult;
    }
  }

  private async extractMetadata(filePath: string): Promise<ProcessingResult> {
    return new Promise(resolve => {
      try {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
          if (err) {
            console.error(`FFprobe error for ${filePath}:`, err);
            resolve({
              duration: 0,
              thumbnailPath: "",
              success: false,
              error: `FFprobe error: ${err.message}`
            });
            return;
          }

          const duration = Math.round(metadata.format.duration || 0);
          const fileSize = metadata.format.size || 0;
          const bitrate = metadata.format.bit_rate || 0;

          const videoStream = metadata.streams.find(
            stream => stream.codec_type === "video"
          );
          const resolution = videoStream
            ? `${videoStream.width}x${videoStream.height}`
            : "unknown";
          const codec = videoStream?.codec_name || "unknown";

          console.log(
            `Video metadata extracted - Duration: ${duration}s, Size: ${(
              fileSize /
              (1024 * 1024)
            ).toFixed(2)}MB, Resolution: ${resolution}, Codec: ${codec}`
          );

          resolve({
            duration,
            thumbnailPath: "",
            success: true,
            fileSize,
            bitrate,
            resolution,
            codec
          });
        });
      } catch (error) {
        console.error(`FFprobe execution error for ${filePath}:`, error);
        resolve({
          duration: 0,
          thumbnailPath: "",
          success: false,
          error: `FFprobe execution error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        });
      }
    });
  }

  public async generateThumbnail(
    filePath: string,
    videoId: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const thumbnailPath = path.join(this.thumbnailsDir, `${videoId}.jpg`);

        ffmpeg(filePath)
          .screenshots({
            timestamps: ["50%"],
            filename: `${videoId}.jpg`,
            folder: this.thumbnailsDir,
            size: "320x240"
          })
          .on("start", commandLine => {
            console.log(`FFmpeg command started: ${commandLine}`);
          })
          .on("end", () => {
            console.log(`Thumbnail generated successfully for ${videoId}`);
            resolve(thumbnailPath);
          })
          .on("error", err => {
            console.error(
              `FFmpeg error generating thumbnail for ${videoId}:`,
              err
            );
            reject(new Error(`FFmpeg error: ${err.message}`));
          })
          .on("stderr", stderrLine => {
            console.log(`FFmpeg stderr: ${stderrLine}`);
          });
      } catch (error) {
        console.error(`FFmpeg execution error for ${videoId}:`, error);
        reject(
          new Error(
            `FFmpeg execution error: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          )
        );
      }
    });
  }

  public async generateOptimizedThumbnail(
    filePath: string,
    videoId: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const thumbnailPath = path.join(this.thumbnailsDir, `${videoId}.jpg`);

        // For large files, use more efficient thumbnail generation
        // - Seek to a specific time instead of percentage to avoid reading entire file
        // - Use lower quality settings for faster processing
        // - Add timeout to prevent hanging on very large files
        ffmpeg(filePath)
          .seekInput(30) // Seek to 30 seconds instead of percentage
          .frames(1)
          .size("320x240")
          .format("image2")
          .outputOptions([
            "-q:v 5", // Lower quality for faster processing
            "-vf scale=320:240:force_original_aspect_ratio=decrease,pad=320:240:(ow-iw)/2:(oh-ih)/2",
            "-y" // Overwrite output file
          ])
          .output(thumbnailPath)
          .on("start", commandLine => {
            console.log(`FFmpeg optimized command started: ${commandLine}`);
          })
          .on("end", () => {
            console.log(
              `Optimized thumbnail generated successfully for ${videoId}`
            );
            resolve(thumbnailPath);
          })
          .on("error", err => {
            console.error(
              `FFmpeg error generating optimized thumbnail for ${videoId}:`,
              err
            );
            // Fallback to regular thumbnail generation
            console.log(
              `Falling back to regular thumbnail generation for ${videoId}`
            );
            this.generateThumbnail(filePath, videoId)
              .then(resolve)
              .catch(reject);
          })
          .on("stderr", stderrLine => {
            console.log(`FFmpeg stderr: ${stderrLine}`);
          })
          .run();

        // Set a timeout for very large files
        setTimeout(() => {
          console.log(
            `Thumbnail generation timeout for ${videoId}, falling back to regular method`
          );
          this.generateThumbnail(filePath, videoId).then(resolve).catch(reject);
        }, 60000); // 60 second timeout
      } catch (error) {
        console.error(`FFmpeg execution error for ${videoId}:`, error);
        this.generateThumbnail(filePath, videoId).then(resolve).catch(reject);
      }
    });
  }

  private async updateVideoStatus(
    videoId: string,
    status: "ready" | "failed",
    result: ProcessingResult
  ) {
    try {
      const updateData: any = { status };

      if (result.success) {
        updateData.duration = result.duration;
        updateData.thumbnail_path = `/thumbnail/${videoId}.jpg`;
      }

      await VideoModel.update(videoId, updateData);
    } catch (error) {
      console.error(`Error updating video status for ${videoId}:`, error);
    }
  }

  private async clearVideoCaches(videoId: string) {
    try {
      await cacheService.del(`video:${videoId}`);
      await cacheService.delPattern("videos:*");
      await cacheService.delPattern("search:*");
      console.log(`Cache cleared for video: ${videoId}`);
    } catch (error) {
      console.error(`Error clearing cache for video ${videoId}:`, error);
    }
  }

  async getVideoStreamPath(videoId: string): Promise<string | null> {
    try {
      const video = await VideoModel.findById(videoId);
      if (!video || video.status !== "ready") {
        return null;
      }

      return video.file_path;
    } catch (error) {
      console.error(`Error getting video stream path for ${videoId}:`, error);
      return null;
    }
  }

  async cleanupTempFiles(videoId: string) {
    try {
      const tempFiles = [
        path.join(this.uploadsDir, `${videoId}.*`),
        path.join(this.processedDir, `${videoId}.*`)
      ];

      for (const pattern of tempFiles) {
        const files = await fs.readdir(path.dirname(pattern));
        const matchingFiles = files.filter(file => file.startsWith(videoId));

        for (const file of matchingFiles) {
          await fs.unlink(path.join(path.dirname(pattern), file));
        }
      }
    } catch (error) {
      console.error(`Error cleaning up temp files for ${videoId}:`, error);
    }
  }
}

export default new VideoProcessingService();
