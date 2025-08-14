import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { VideoModel, CreateVideoData } from "../models/Video";
import { CommentModel } from "../models/Comment";
import cacheService from "../services/cacheService";
import queueService from "../services/queueService";
import videoProcessingService from "../services/videoProcessingService";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../uploads"));
  },
  filename: (req, file, cb) => {
    const videoId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${videoId}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["video/mp4", "video/avi", "video/mov", "video/wmv"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only video files are allowed."));
    }
  }
});

export class VideoController {
  private transformVideoData(video: any) {
    if (!video) return video;

    return {
      ...video,
      video_url: `/stream/${video.filename}`,
      thumbnail_url: video.thumbnail_path || null
    };
  }

  private transformVideosData(videos: any[]) {
    return videos.map(video => this.transformVideoData(video));
  }

  async uploadVideo(req: AuthRequest, res: Response) {
    try {
      upload.single("video")(req as any, res as any, async (err: any) => {
        if (err) {
          return res.status(400).json({ error: err.message });
        }

        if (!req.file) {
          return res.status(400).json({ error: "No video file provided" });
        }

        const { title, description, tags, category } = req.body;
        const userId = req.user?.userId;

        if (!userId) {
          return res.status(401).json({ error: "User not authenticated" });
        }

        if (!title) {
          return res.status(400).json({ error: "Title is required" });
        }

        const videoData: CreateVideoData = {
          title,
          description: description || "",
          filename: req.file.filename,
          original_filename: req.file.originalname,
          file_path: req.file.path.replace("app/", ""),
          file_size: req.file.size,
          mime_type: req.file.mimetype,
          tags: tags ? tags.split(",").map((tag: string) => tag.trim()) : [],
          category: category || "general",
          user_id: userId
        };

        const video = await VideoModel.create(videoData);

        await queueService.publishVideoJob({
          videoId: video.id,
          filePath: req.file.path,
          userId
        });

        res.status(201).json({
          message: "Video uploaded successfully",
          video: {
            id: video.id,
            title: video.title,
            status: video.status
          }
        });
      });
    } catch (error) {
      console.error("Error uploading video:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getVideo(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const cacheKey = `video:${id}`;
      let video = await cacheService.get(cacheKey);

      if (!video) {
        video = await VideoModel.findById(id);
        if (video) {
          await cacheService.set(cacheKey, video, 300);
          await cacheService.recordHit();
        } else {
          await cacheService.recordMiss();
          return res.status(404).json({ error: "Video not found" });
        }
      } else {
        await cacheService.recordHit();
      }

      await VideoModel.incrementViews(id);

      const transformedVideo = this.transformVideoData(video);
      res.json({ video: transformedVideo });
    } catch (error) {
      console.error("Error getting video:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async listVideos(req: Request, res: Response) {
    try {
      const { page = "1", limit = "20", category } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const cacheKey = `videos:${pageNum}:${limitNum}:${category}`;
      let videos = await cacheService.get(cacheKey);

      if (!videos) {
        if (category) {
          videos = await VideoModel.search(
            category as string,
            limitNum,
            offset
          );
        } else {
          videos = await VideoModel.findAll(limitNum, offset);
        }

        if (videos.length > 0) {
          await cacheService.set(cacheKey, videos, 60);
          await cacheService.recordHit();
        } else {
          await cacheService.recordMiss();
        }
      } else {
        await cacheService.recordHit();
      }

      const transformedVideos = this.transformVideosData(videos);
      res.json({ videos: transformedVideos, page: pageNum, limit: limitNum });
    } catch (error) {
      console.error("Error listing videos:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async searchVideos(req: Request, res: Response) {
    try {
      const { q, page = "1", limit = "20" } = req.query;

      if (!q) {
        return res.status(400).json({ error: "Search query is required" });
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const cacheKey = `search:${q}:${pageNum}:${limitNum}`;
      let videos = await cacheService.get(cacheKey);

      if (!videos) {
        videos = await VideoModel.search(q as string, limitNum, offset);

        if (videos.length > 0) {
          await cacheService.set(cacheKey, videos, 300);
          await cacheService.recordHit();
        } else {
          await cacheService.recordMiss();
        }
      } else {
        await cacheService.recordHit();
      }

      const transformedVideos = this.transformVideosData(videos);
      res.json({
        videos: transformedVideos,
        query: q,
        page: pageNum,
        limit: limitNum
      });
    } catch (error) {
      console.error("Error searching videos:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async updateVideo(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { title, description, tags, category } = req.body;
      const userId = (req as any).user?.id;

      const video = await VideoModel.findById(id);
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }

      if (video.user_id !== userId) {
        return res
          .status(403)
          .json({ error: "Not authorized to update this video" });
      }

      const updateData: any = {};
      if (title) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (tags)
        updateData.tags = tags.split(",").map((tag: string) => tag.trim());
      if (category) updateData.category = category;

      const updatedVideo = await VideoModel.update(id, updateData);

      if (updatedVideo) {
        await cacheService.del(`video:${id}`);
        await cacheService.delPattern("videos:*");
        await cacheService.delPattern("search:*");

        const transformedVideo = this.transformVideoData(updatedVideo);
        res.json({ video: transformedVideo });
      } else {
        res.status(500).json({ error: "Failed to update video" });
      }
    } catch (error) {
      console.error("Error updating video:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async deleteVideo(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      const video = await VideoModel.findById(id);
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }

      if (video.user_id !== userId) {
        return res
          .status(403)
          .json({ error: "Not authorized to delete this video" });
      }

      const deleted = await VideoModel.delete(id);
      if (deleted) {
        await cacheService.del(`video:${id}`);
        await cacheService.delPattern("videos:*");
        await cacheService.delPattern("search:*");

        await videoProcessingService.cleanupTempFiles(id);

        res.json({ message: "Video deleted successfully" });
      } else {
        res.status(500).json({ error: "Failed to delete video" });
      }
    } catch (error) {
      console.error("Error deleting video:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async likeVideo(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await VideoModel.incrementLikes(id);
      await cacheService.del(`video:${id}`);

      res.json({ message: "Video liked successfully" });
    } catch (error) {
      console.error("Error liking video:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getComments(req: Request, res: Response) {
    try {
      const { videoId } = req.params;
      const { page = "1", limit = "50" } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const comments = await CommentModel.findByVideoId(
        videoId,
        limitNum,
        offset
      );
      res.json({ comments, page: pageNum, limit: limitNum });
    } catch (error) {
      console.error("Error getting comments:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async addComment(req: Request, res: Response) {
    try {
      const { videoId } = req.params;
      const { content, parentId } = req.body;
      const userId = (req as any).user?.id || "anonymous";

      if (!content) {
        return res.status(400).json({ error: "Comment content is required" });
      }

      const comment = await CommentModel.create({
        content,
        user_id: userId,
        video_id: videoId,
        parent_id: parentId
      });

      res.status(201).json({ comment });
    } catch (error) {
      console.error("Error adding comment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
