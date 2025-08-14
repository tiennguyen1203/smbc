import { Router } from "express";
import { AdminController } from "../controllers/adminController";

const router = Router();
const adminController = new AdminController();

router.get("/cache-stats", adminController.getCacheStats.bind(adminController));
router.get("/health", adminController.getSystemHealth.bind(adminController));
router.post("/cache/clear", adminController.clearCache.bind(adminController));
router.get("/queue/stats", adminController.getQueueStats.bind(adminController));
router.post(
  "/queue/retry/:videoId",
  adminController.retryFailedJob.bind(adminController)
);
router.post(
  "/regenerate-thumbnails",
  adminController.regenerateThumbnails.bind(adminController)
);
router.post(
  "/fix-thumbnail-paths",
  adminController.fixThumbnailPaths.bind(adminController)
);

export default router;
