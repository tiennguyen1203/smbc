import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { promisify } from "util";
import {
  UploadSessionModel,
  CreateUploadSessionData
} from "../models/UploadSession";
import queueService, { ChunkProcessingJob } from "../services/queueService";

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);
const unlink = promisify(fs.unlink);
const rename = promisify(fs.rename);

const chunkStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const chunksDir = path.join(__dirname, "../../chunks");
    try {
      await access(chunksDir);
    } catch {
      await mkdir(chunksDir, { recursive: true });
    }
    cb(null, chunksDir);
  },
  filename: (req, file, cb) => {
    const tempFilename = `temp_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2)}`;
    cb(null, tempFilename);
  }
});

const chunkUpload = multer({
  storage: chunkStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  }
});

export class UploadController {
  async initializeUpload(req: AuthRequest, res: Response) {
    try {
      const { filename, fileSize, chunkSize, metadata } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      if (!filename || !fileSize || !chunkSize) {
        return res.status(400).json({
          error: "Missing required fields: filename, fileSize, chunkSize"
        });
      }

      if (fileSize > 5 * 1024 * 1024 * 1024) {
        return res.status(400).json({
          error: "File size exceeds maximum limit of 5GB"
        });
      }

      const totalChunks = Math.ceil(fileSize / chunkSize);
      const sessionFilename = `${uuidv4()}${path.extname(filename)}`;

      const sessionData: CreateUploadSessionData = {
        user_id: userId,
        filename: sessionFilename,
        original_filename: filename,
        file_size: fileSize,
        chunk_size: chunkSize,
        total_chunks: totalChunks,
        metadata: metadata || {}
      };

      const session = await UploadSessionModel.create(sessionData);

      res.status(201).json({
        sessionId: session.id,
        filename: session.filename,
        totalChunks: session.total_chunks,
        chunkSize: session.chunk_size,
        uploadedChunks: session.uploaded_chunks
      });
    } catch (error) {
      console.error("Error initializing upload:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async uploadChunk(req: AuthRequest, res: Response) {
    try {
      chunkUpload.single("chunk")(req as any, res as any, async (err: any) => {
        if (err) {
          return res.status(400).json({ error: err.message });
        }

        if (!req.file) {
          return res.status(400).json({ error: "No chunk file provided" });
        }

        const { sessionId, chunkIndex } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
          return res.status(401).json({ error: "User not authenticated" });
        }

        if (!sessionId || chunkIndex === undefined) {
          return res.status(400).json({
            error: "Missing required fields: sessionId, chunkIndex"
          });
        }

        const session = await UploadSessionModel.findById(sessionId);
        if (!session) {
          return res.status(404).json({ error: "Upload session not found" });
        }

        if (session.user_id !== userId) {
          return res
            .status(403)
            .json({ error: "Not authorized for this upload session" });
        }

        if (session.status === "completed") {
          return res
            .status(400)
            .json({ error: "Upload session already completed" });
        }

        if (session.status === "failed") {
          return res.status(400).json({ error: "Upload session failed" });
        }

        const chunkIndexNum = parseInt(chunkIndex);
        if (chunkIndexNum < 0 || chunkIndexNum >= session.total_chunks) {
          return res.status(400).json({ error: "Invalid chunk index" });
        }

        // Queue the chunk for async processing instead of processing synchronously
        const chunkJob: ChunkProcessingJob = {
          sessionId,
          chunkIndex: chunkIndexNum,
          chunkFilePath: path.join(
            __dirname,
            "../../chunks",
            `${sessionId}_chunk_${chunkIndexNum}`
          ),
          userId,
          tempFilePath: req.file.path
        };

        const jobQueued = await queueService.publishChunkJob(chunkJob);
        if (!jobQueued) {
          // If queue failed, clean up temp file and return error
          try {
            await unlink(req.file.path);
          } catch (cleanupError) {
            console.error(
              `Error cleaning up temp file after queue failure: ${cleanupError}`
            );
          }
          return res.status(500).json({
            error: "Failed to queue chunk for processing. Please try again."
          });
        }

        console.log(
          `Chunk ${chunkIndexNum} queued for async processing (session: ${sessionId})`
        );

        // Return immediate response - client doesn't wait for processing
        res.json({
          sessionId,
          chunkIndex: chunkIndexNum,
          status: "queued",
          message: "Chunk received and queued for processing",
          queuePosition: "processing"
        });
      });
    } catch (error) {
      console.error("Error uploading chunk:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getUploadStatus(req: AuthRequest, res: Response) {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const session = await UploadSessionModel.findById(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Upload session not found" });
      }

      if (session.user_id !== userId) {
        return res
          .status(403)
          .json({ error: "Not authorized for this upload session" });
      }

      res.json({
        sessionId: session.id,
        filename: session.original_filename,
        fileSize: session.file_size,
        uploadedChunks: session.uploaded_chunks,
        totalChunks: session.total_chunks,
        status: session.status,
        progress: (session.uploaded_chunks.length / session.total_chunks) * 100,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        expiresAt: session.expires_at
      });
    } catch (error) {
      console.error("Error getting upload status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async resumeUpload(req: AuthRequest, res: Response) {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const session = await UploadSessionModel.findById(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Upload session not found" });
      }

      if (session.user_id !== userId) {
        return res
          .status(403)
          .json({ error: "Not authorized for this upload session" });
      }

      if (session.status === "completed") {
        return res.status(400).json({ error: "Upload already completed" });
      }

      if (session.status === "failed") {
        await UploadSessionModel.updateStatus(sessionId, "pending");
      }

      const missingChunks = [];
      for (let i = 0; i < session.total_chunks; i++) {
        if (!session.uploaded_chunks.includes(i)) {
          missingChunks.push(i);
        }
      }

      res.json({
        sessionId: session.id,
        filename: session.original_filename,
        fileSize: session.file_size,
        chunkSize: session.chunk_size,
        totalChunks: session.total_chunks,
        uploadedChunks: session.uploaded_chunks,
        missingChunks,
        status: session.status,
        progress: (session.uploaded_chunks.length / session.total_chunks) * 100
      });
    } catch (error) {
      console.error("Error resuming upload:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async cancelUpload(req: AuthRequest, res: Response) {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const session = await UploadSessionModel.findById(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Upload session not found" });
      }

      if (session.user_id !== userId) {
        return res
          .status(403)
          .json({ error: "Not authorized for this upload session" });
      }

      await this.cleanupChunks(session.id);
      await UploadSessionModel.delete(sessionId);

      res.json({ message: "Upload cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling upload:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async listUploadSessions(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { page = "1", limit = "10" } = req.query;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const sessions = await UploadSessionModel.findByUserId(
        userId,
        limitNum,
        offset
      );

      res.json({
        sessions: sessions.map(session => ({
          sessionId: session.id,
          filename: session.original_filename,
          fileSize: session.file_size,
          status: session.status,
          progress:
            (session.uploaded_chunks.length / session.total_chunks) * 100,
          createdAt: session.created_at,
          updatedAt: session.updated_at,
          expiresAt: session.expires_at
        })),
        page: pageNum,
        limit: limitNum
      });
    } catch (error) {
      console.error("Error listing upload sessions:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  private async cleanupChunks(sessionId: string) {
    try {
      const chunksDir = path.join(__dirname, "../../chunks");
      const fs = require("fs").promises;

      const files = await fs.readdir(chunksDir);

      const sessionChunks = files.filter((file: string) =>
        file.startsWith(`${sessionId}_chunk_`)
      );

      for (const chunk of sessionChunks) {
        const chunkPath = path.join(chunksDir, chunk);
        try {
          await unlink(chunkPath);
        } catch (error) {
          console.error(`Error deleting chunk ${chunk}:`, error);
        }
      }

      await this.cleanupOldTempFiles();
    } catch (error) {
      console.error("Error cleaning up chunks:", error);
    }
  }

  private async cleanupOldTempFiles() {
    try {
      const chunksDir = path.join(__dirname, "../../chunks");
      const fs = require("fs").promises;

      const files = await fs.readdir(chunksDir);
      const tempFiles = files.filter((file: string) =>
        file.startsWith("temp_")
      );
      const oneHourAgo = Date.now() - 60 * 60 * 1000; // 1 hour ago

      for (const tempFile of tempFiles) {
        const tempFilePath = path.join(chunksDir, tempFile);
        try {
          const stats = await fs.stat(tempFilePath);
          if (stats.mtime.getTime() < oneHourAgo) {
            await unlink(tempFilePath);
            console.log(`Cleaned up old temp file: ${tempFile}`);
          }
        } catch (error) {
          console.error(
            `Error checking/deleting temp file ${tempFile}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error("Error cleaning up old temp files:", error);
    }
  }

  async cleanupExpiredSessions(req: Request, res: Response) {
    try {
      const expiredSessions = await UploadSessionModel.findExpiredSessions();

      for (const session of expiredSessions) {
        await this.cleanupChunks(session.id);
        await UploadSessionModel.delete(session.id);
      }

      res.json({
        message: `Cleaned up ${expiredSessions.length} expired upload sessions`,
        cleanedSessions: expiredSessions.length
      });
    } catch (error) {
      console.error("Error cleaning up expired sessions:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
