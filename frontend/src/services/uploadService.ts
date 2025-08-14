import api from "./api";

export interface UploadSession {
  sessionId: string;
  filename: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  status: "pending" | "uploading" | "completed" | "failed";
  progress: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface InitializeUploadData {
  filename: string;
  fileSize: number;
  chunkSize: number;
  metadata?: {
    title?: string;
    description?: string;
    tags?: string[];
    category?: string;
    mime_type?: string;
  };
}

export interface ChunkUploadResponse {
  sessionId: string;
  chunkIndex: number;
  uploadedChunks: number[];
  totalChunks: number;
  status: string;
  progress: number;
}

export interface UploadProgress {
  sessionId: string;
  progress: number;
  uploadedChunks: number;
  totalChunks: number;
  status: string;
  currentChunk?: number;
  speed?: number;
  timeRemaining?: number;
}

export class ChunkedUploadService {
  private static readonly DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  private static readonly MAX_CONCURRENT_UPLOADS = 2; // Reduced from 3 to 2
  private static readonly RETRY_ATTEMPTS = 3;
  private static readonly RETRY_DELAY = 1000; // 1 second
  private static readonly CHUNK_UPLOAD_DELAY = 500; // 500ms delay between chunks
  private static readonly RATE_LIMIT_DELAY = 2000; // 2 second delay when hitting rate limits
  private static lastChunkUploadTime = 0;

  static async initializeUpload(
    data: InitializeUploadData
  ): Promise<UploadSession> {
    try {
      const response = await api.post("api/upload/initialize", data);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.log(
          "Rate limit hit on upload initialization, implementing backoff"
        );
        await new Promise(resolve =>
          setTimeout(resolve, this.RATE_LIMIT_DELAY)
        );
        throw new Error(
          "Rate limit exceeded on upload initialization. Please wait and try again."
        );
      }
      throw error;
    }
  }

  static async uploadChunk(
    sessionId: string,
    chunkIndex: number,
    chunkData: Blob,
    onProgress?: (progress: number) => void
  ): Promise<ChunkUploadResponse> {
    const now = Date.now();
    const timeSinceLastUpload = now - this.lastChunkUploadTime;
    if (timeSinceLastUpload < this.CHUNK_UPLOAD_DELAY) {
      await new Promise(resolve =>
        setTimeout(resolve, this.CHUNK_UPLOAD_DELAY - timeSinceLastUpload)
      );
    }
    this.lastChunkUploadTime = Date.now();

    const formData = new FormData();
    formData.append("chunk", chunkData);
    formData.append("sessionId", sessionId);
    formData.append("chunkIndex", chunkIndex.toString());

    try {
      const response = await api.post("api/upload/chunk", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        },
        onUploadProgress: progressEvent => {
          if (onProgress && progressEvent.total) {
            const progress = (progressEvent.loaded / progressEvent.total) * 100;
            onProgress(progress);
          }
        }
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.log(
          `Rate limit hit for chunk ${chunkIndex}, implementing backoff`
        );
        await new Promise(resolve =>
          setTimeout(resolve, this.RATE_LIMIT_DELAY)
        );
        throw new Error(`Rate limit exceeded for chunk ${chunkIndex}`);
      }
      throw error;
    }
  }

  static async getUploadStatus(sessionId: string): Promise<UploadSession> {
    try {
      const response = await api.get(`api/upload/status/${sessionId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 429) {
        await new Promise(resolve =>
          setTimeout(resolve, this.RATE_LIMIT_DELAY)
        );
        throw new Error(
          "Rate limit exceeded. Please wait before checking status again."
        );
      }
      throw error;
    }
  }

  static async resumeUpload(sessionId: string): Promise<UploadSession> {
    try {
      const response = await api.post(`api/upload/resume/${sessionId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 429) {
        await new Promise(resolve =>
          setTimeout(resolve, this.RATE_LIMIT_DELAY)
        );
        throw new Error(
          "Rate limit exceeded. Please wait before resuming upload."
        );
      }
      throw error;
    }
  }

  static async cancelUpload(sessionId: string): Promise<void> {
    try {
      await api.delete(`api/upload/cancel/${sessionId}`);
    } catch (error: any) {
      if (error.response?.status === 429) {
        await new Promise(resolve =>
          setTimeout(resolve, this.RATE_LIMIT_DELAY)
        );
        throw new Error(
          "Rate limit exceeded. Please wait before cancelling upload."
        );
      }
      throw error;
    }
  }

  static async listUploadSessions(
    page: number = 1,
    limit: number = 10
  ): Promise<{
    sessions: UploadSession[];
    page: number;
    limit: number;
  }> {
    const response = await api.get(
      `api/upload/sessions?page=${page}&limit=${limit}`
    );
    return response.data;
  }

  static async uploadFileInChunks(
    file: File,
    metadata: InitializeUploadData["metadata"],
    onProgress?: (progress: UploadProgress) => void,
    onChunkProgress?: (chunkIndex: number, progress: number) => void,
    chunkSize: number = this.DEFAULT_CHUNK_SIZE
  ): Promise<string> {
    const startTime = Date.now();
    let uploadedBytes = 0;

    try {
      const session = await this.initializeUpload({
        filename: file.name,
        fileSize: file.size,
        chunkSize,
        metadata: {
          ...metadata,
          mime_type: file.type
        }
      });

      const { sessionId, totalChunks } = session;
      const chunks: Blob[] = [];

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        chunks.push(file.slice(start, end));
      }

      const updateProgress = (chunkIndex?: number) => {
        const now = Date.now();
        const elapsed = (now - startTime) / 1000; // seconds
        const speed = uploadedBytes / elapsed; // bytes per second
        const remainingBytes = file.size - uploadedBytes;
        const timeRemaining = speed > 0 ? remainingBytes / speed : 0;

        onProgress?.({
          sessionId,
          progress: (uploadedBytes / file.size) * 100,
          uploadedChunks: Math.floor(uploadedBytes / chunkSize),
          totalChunks,
          status: "uploading",
          currentChunk: chunkIndex,
          speed,
          timeRemaining
        });
      };

      const uploadQueue: Promise<void>[] = [];
      let activeUploads = 0;
      let completedChunks = 0;

      const uploadChunkWithRetry = async (
        chunkIndex: number
      ): Promise<void> => {
        let attempts = 0;

        while (attempts < this.RETRY_ATTEMPTS) {
          try {
            activeUploads++;

            await this.uploadChunk(
              sessionId,
              chunkIndex,
              chunks[chunkIndex],
              progress => {
                onChunkProgress?.(chunkIndex, progress);
              }
            );

            uploadedBytes += chunks[chunkIndex].size;
            completedChunks++;
            updateProgress(chunkIndex);

            activeUploads--;
            return;
          } catch (error: any) {
            attempts++;
            activeUploads--;

            if (attempts >= this.RETRY_ATTEMPTS) {
              throw new Error(
                `Failed to upload chunk ${chunkIndex} after ${this.RETRY_ATTEMPTS} attempts: ${error}`
              );
            }

            let retryDelay = this.RETRY_DELAY * Math.pow(2, attempts - 1);

            if (
              error.message?.includes("Rate limit exceeded") ||
              error.response?.status === 429
            ) {
              retryDelay = this.RATE_LIMIT_DELAY * Math.pow(2, attempts - 1);
              console.log(
                `Rate limit retry for chunk ${chunkIndex}, waiting ${retryDelay}ms (attempt ${attempts})`
              );
            }

            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
      };

      for (let i = 0; i < totalChunks; i++) {
        while (activeUploads >= this.MAX_CONCURRENT_UPLOADS) {
          await new Promise(resolve => setTimeout(resolve, 200)); // Increased wait time
        }

        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 300)); // 300ms delay between chunk starts
        }

        uploadQueue.push(uploadChunkWithRetry(i));
      }

      await Promise.all(uploadQueue);

      onProgress?.({
        sessionId,
        progress: 100,
        uploadedChunks: totalChunks,
        totalChunks,
        status: "completed"
      });

      return sessionId;
    } catch (error) {
      console.error("Chunked upload failed:", error);
      throw error;
    }
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  static formatTime(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600)
      return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.round(seconds / 3600)}h ${Math.round(
      (seconds % 3600) / 60
    )}m`;
  }

  static formatSpeed(bytesPerSecond: number): string {
    return `${this.formatFileSize(bytesPerSecond)}/s`;
  }
}
