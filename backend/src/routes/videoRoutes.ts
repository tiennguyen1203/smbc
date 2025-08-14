import { Router } from "express";
import { VideoController } from "../controllers/videoController";
import { authMiddleware } from "../middleware/auth";

const router = Router();
const videoController = new VideoController();

router.post(
  "/upload",
  authMiddleware,
  videoController.uploadVideo.bind(videoController)
);
router.get("/search", videoController.searchVideos.bind(videoController));
router.get("/", videoController.listVideos.bind(videoController));
router.get("/:id", videoController.getVideo.bind(videoController));
router.put(
  "/:id",
  authMiddleware,
  videoController.updateVideo.bind(videoController)
);
router.delete(
  "/:id",
  authMiddleware,
  videoController.deleteVideo.bind(videoController)
);
router.post("/:id/like", videoController.likeVideo.bind(videoController));
router.get("/:id/comments", videoController.getComments.bind(videoController));
router.post("/:id/comments", videoController.addComment.bind(videoController));

export default router;
