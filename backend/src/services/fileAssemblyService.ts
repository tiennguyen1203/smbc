import { FileAssemblyJob } from "./queueService";
import { UploadSessionModel } from "../models/UploadSession";
import { VideoModel, CreateVideoData } from "../models/Video";
import { promises as fs } from "fs";
import path from "path";
import queueService from "./queueService";
import cacheService from "./cacheService";

export class FileAssemblyService {
  async assembleFile(job: FileAssemblyJob): Promise<void> {
    console.log(`Starting file assembly for session ${job.sessionId}`);

    try {
      // Get the upload session details
      const session = await UploadSessionModel.findById(job.sessionId);
      if (!session) {
        throw new Error(`Upload session ${job.sessionId} not found`);
      }

      if (session.status !== "completed") {
        throw new Error(
          `Session ${job.sessionId} is not completed (status: ${session.status})`
        );
      }

      // Verify all chunks are uploaded
      if (session.uploaded_chunks.length !== session.total_chunks) {
        throw new Error(
          `Incomplete upload: ${session.uploaded_chunks.length}/${session.total_chunks} chunks`
        );
      }

      // Prepare directories
      const uploadsDir = path.join(__dirname, "../../uploads");
      const chunksDir = path.join(__dirname, "../../chunks");
      const finalFilePath = path.join(uploadsDir, session.filename);

      try {
        await fs.access(uploadsDir);
      } catch {
        await fs.mkdir(uploadsDir, { recursive: true });
      }

      // Assemble the file by concatenating chunks in order
      console.log(
        `Assembling ${session.total_chunks} chunks for ${session.filename}`
      );
      const writeStream = require("fs").createWriteStream(finalFilePath);

      for (let i = 0; i < session.total_chunks; i++) {
        const chunkPath = path.join(chunksDir, `${session.id}_chunk_${i}`);

        try {
          const chunkData = await fs.readFile(chunkPath);
          writeStream.write(chunkData);

          // Clean up the chunk file immediately after use
          await fs.unlink(chunkPath);
          console.log(`Processed and cleaned up chunk ${i}`);
        } catch (error) {
          writeStream.destroy();
          throw new Error(`Error reading/cleaning chunk ${i}: ${error}`);
        }
      }

      writeStream.end();

      // Wait for write stream to finish
      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      // Create video record in database
      const videoData: CreateVideoData = {
        title: session.metadata?.title || session.original_filename,
        description: session.metadata?.description || "",
        filename: session.filename,
        original_filename: session.original_filename,
        file_path: finalFilePath.replace("app/", ""),
        file_size: session.file_size,
        mime_type: session.metadata?.mime_type || "video/mp4",
        tags: session.metadata?.tags || [],
        category: session.metadata?.category || "general",
        user_id: session.user_id
      };

      const video = await VideoModel.create(videoData);
      console.log(`Video record created with ID: ${video.id}`);

      // Trigger video processing
      const videoProcessingJob = {
        videoId: video.id,
        filePath: finalFilePath,
        userId: session.user_id
      };

      const published = await queueService.publishVideoJob(videoProcessingJob);
      if (!published) {
        console.error(
          `Failed to publish video processing job for video: ${video.id}`
        );
        // Don't throw here as the file assembly was successful
      } else {
        console.log(`Video processing job published for video: ${video.id}`);
      }

      // Clean up upload session
      await UploadSessionModel.delete(session.id);

      // Clear video caches
      await cacheService.delPattern("videos:*");
      await cacheService.delPattern("search:*");

      console.log(
        `File assembly completed successfully for session ${job.sessionId}`
      );
      console.log(
        `Final file: ${finalFilePath} (${(
          session.file_size /
          (1024 * 1024)
        ).toFixed(2)}MB)`
      );
    } catch (error) {
      console.error(
        `Error assembling file for session ${job.sessionId}:`,
        error
      );

      // Mark session as failed
      try {
        await UploadSessionModel.updateStatus(job.sessionId, "failed");
      } catch (updateError) {
        console.error(
          `Failed to update session status to failed:`,
          updateError
        );
      }

      throw error;
    }
  }
}

export default new FileAssemblyService();
