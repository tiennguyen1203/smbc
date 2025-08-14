import { ChunkProcessingJob } from "./queueService";
import { UploadSessionModel } from "../models/UploadSession";
import { promises as fs } from "fs";
import path from "path";
import queueService from "./queueService";

export class ChunkProcessingService {
  async processChunk(job: ChunkProcessingJob): Promise<void> {
    console.log(
      `Processing chunk ${job.chunkIndex} for session ${job.sessionId}`
    );

    try {
      // Rename temporary file to proper chunk filename
      const chunksDir = path.join(__dirname, "../../chunks");
      const properFilename = `${job.sessionId}_chunk_${job.chunkIndex}`;
      const properFilePath = path.join(chunksDir, properFilename);

      try {
        await fs.rename(job.tempFilePath, properFilePath);
        console.log(
          `Chunk file renamed: ${job.tempFilePath} -> ${properFilePath}`
        );
      } catch (renameError) {
        console.error(`Error renaming chunk file: ${renameError}`);
        // Clean up temp file if rename failed
        try {
          await fs.unlink(job.tempFilePath);
        } catch (cleanupError) {
          console.error(`Error cleaning up temp file: ${cleanupError}`);
        }
        throw new Error(`Failed to process chunk file: ${renameError}`);
      }

      // Update chunk status in Redis and PostgreSQL
      const updatedSession = await UploadSessionModel.updateChunkUploaded(
        job.sessionId,
        job.chunkIndex
      );

      if (!updatedSession) {
        throw new Error("Failed to update upload session");
      }

      console.log(
        `Chunk ${job.chunkIndex} processed successfully for session ${job.sessionId}. ` +
          `Progress: ${updatedSession.uploaded_chunks.length}/${updatedSession.total_chunks}`
      );

      // If upload is completed, trigger file assembly
      if (updatedSession.status === "completed") {
        console.log(
          `All chunks uploaded for session ${job.sessionId}, triggering file assembly`
        );

        const assemblyJob = {
          sessionId: job.sessionId,
          userId: job.userId
        };

        const published = await queueService.publishFileAssemblyJob(
          assemblyJob
        );
        if (!published) {
          console.error(
            `Failed to publish file assembly job for session ${job.sessionId}`
          );
          // Don't throw here as the chunk was processed successfully
          // File assembly can be retried later
        }
      }
    } catch (error) {
      console.error(
        `Error processing chunk ${job.chunkIndex} for session ${job.sessionId}:`,
        error
      );
      throw error;
    }
  }
}

export default new ChunkProcessingService();
