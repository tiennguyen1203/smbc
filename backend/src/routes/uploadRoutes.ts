import { Router } from "express";
import { UploadController } from "../controllers/uploadController";
import { authMiddleware } from "../middleware/auth";
import rateLimit from "express-rate-limit";

const router = Router();
const uploadController = new UploadController();

const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many upload requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false
});

const chunkUploadRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  message: "Too many chunk upload requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false
});

router.post(
  "/initialize",
  authMiddleware,
  uploadRateLimit,
  uploadController.initializeUpload.bind(uploadController)
);

router.post(
  "/chunk",
  authMiddleware,
  chunkUploadRateLimit,
  uploadController.uploadChunk.bind(uploadController)
);

router.get(
  "/status/:sessionId",
  authMiddleware,
  uploadController.getUploadStatus.bind(uploadController)
);

router.post(
  "/resume/:sessionId",
  authMiddleware,
  uploadController.resumeUpload.bind(uploadController)
);

router.delete(
  "/cancel/:sessionId",
  authMiddleware,
  uploadController.cancelUpload.bind(uploadController)
);

router.get(
  "/sessions",
  authMiddleware,
  uploadController.listUploadSessions.bind(uploadController)
);

router.post(
  "/cleanup-expired",
  authMiddleware,
  uploadController.cleanupExpiredSessions.bind(uploadController)
);

export default router;
