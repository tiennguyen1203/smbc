import { Request, Response } from "express";
import cacheService from "../services/cacheService";
import queueService from "../services/queueService";
import pool from "../database/connection";
import { VideoModel } from "../models/Video";
import videoProcessingService from "../services/videoProcessingService";
import path from "path";

export class AdminController {
  async getCacheStats(req: Request, res: Response) {
    try {
      const stats = await cacheService.getStats();
      const hitRate =
        stats.hits + stats.misses > 0
          ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2)
          : "0.00";

      res.json({
        cache: {
          ...stats,
          hitRate: `${hitRate}%`
        }
      });
    } catch (error) {
      console.error("Error getting cache stats:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getSystemHealth(req: Request, res: Response) {
    try {
      const health = {
        database: "unknown",
        redis: "unknown",
        rabbitmq: "unknown",
        timestamp: new Date().toISOString()
      };

      try {
        await pool.query("SELECT 1");
        health.database = "healthy";
      } catch (error) {
        health.database = "unhealthy";
      }

      try {
        const redisStats = await cacheService.getStats();
        health.redis = redisStats.keys >= 0 ? "healthy" : "unhealthy";
      } catch (error) {
        health.redis = "unhealthy";
      }

      health.rabbitmq = queueService.isReady() ? "healthy" : "unhealthy";

      const overallHealth = Object.values(health).every(
        status => status === "healthy"
      )
        ? "healthy"
        : "degraded";

      res.json({
        status: overallHealth,
        services: health
      });
    } catch (error) {
      console.error("Error getting system health:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async clearCache(req: Request, res: Response) {
    try {
      const { pattern } = req.body;

      if (pattern) {
        await cacheService.delPattern(pattern);
      } else {
        await cacheService.delPattern("*");
      }

      res.json({ message: "Cache cleared successfully" });
    } catch (error) {
      console.error("Error clearing cache:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getQueueStats(req: Request, res: Response) {
    try {
      const queueStats = await queueService.getQueueStats();

      if (!queueStats) {
        return res.status(503).json({
          error: "Queue service unavailable",
          connected: false,
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        ...queueStats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error getting queue stats:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async retryFailedJob(req: Request, res: Response) {
    try {
      const { videoId } = req.params;
      const success = await queueService.retryDeadLetterJob(videoId);

      if (success) {
        res.json({
          message: `Video job ${videoId} moved back to processing queue`,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(404).json({
          error: "Video job not found in dead letter queue",
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("Error retrying failed job:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async regenerateThumbnails(req: Request, res: Response) {
    try {
      const videos = await VideoModel.findAll(100, 0);
      let processed = 0;
      let errors = 0;

      for (const video of videos) {
        if (
          video.status === "ready" &&
          (!video.thumbnail_path || video.thumbnail_path === "")
        ) {
          try {
            const filePath = path.join(
              __dirname,
              "../../uploads",
              video.filename
            );
            if (require("fs").existsSync(filePath)) {
              await videoProcessingService.generateThumbnail(
                filePath,
                video.id
              );
              await VideoModel.update(video.id, {
                thumbnail_path: `/thumbnail/${video.id}.jpg`
              });
              processed++;
            }
          } catch (error) {
            console.error(
              `Error regenerating thumbnail for video ${video.id}:`,
              error
            );
            errors++;
          }
        }
      }

      res.json({
        message: `Thumbnail regeneration completed`,
        processed,
        errors,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error regenerating thumbnails:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async fixThumbnailPaths(req: Request, res: Response) {
    try {
      const videos = await VideoModel.findAll(100, 0);
      let updated = 0;
      let errors = 0;

      for (const video of videos) {
        if (
          video.status === "ready" &&
          video.thumbnail_path &&
          video.thumbnail_path.includes("/uploads/thumbnails/")
        ) {
          try {
            await VideoModel.update(video.id, {
              thumbnail_path: `/thumbnail/${video.id}.jpg`
            });
            updated++;
          } catch (error) {
            console.error(
              `Error updating thumbnail path for video ${video.id}:`,
              error
            );
            errors++;
          }
        }
      }

      res.json({
        message: `Thumbnail path fixes completed`,
        updated,
        errors,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fixing thumbnail paths:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
