import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";

import adminRoutes from "./routes/adminRoutes";
import { userRoutes } from "./routes/userRoutes";
import videoRoutes from "./routes/videoRoutes";
import { productRoutes } from "./routes/productRoutes";
import { authRoutes } from "./routes/authRoutes";
import uploadRoutes from "./routes/uploadRoutes";
import queueService from "./services/queueService";
import videoProcessingService from "./services/videoProcessingService";
import path from "path";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const uploadsDir = path.join(__dirname, "../uploads");
const processedDir = path.join(__dirname, "../processed");
const thumbnailsDir = path.join(__dirname, "../thumbnails");

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "http:", "https:"],
        connectSrc: ["'self'", "http:", "https:"],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'"]
      }
    }
  })
);
app.use(
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(morgan("combined"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    message: "Video Platform API is running! 3"
  });
});

app.get("/", (req, res) => {
  res.json({ message: "Video Platform API is running! 2" });
});

app.use("/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/products", productRoutes);
app.use("/api/upload", uploadRoutes);

app.use("/uploads", express.static(uploadsDir));
app.use("/processed", express.static(processedDir));
app.use("/thumbnails", express.static(thumbnailsDir));

app.get("/stream/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, filename);

  if (!require("fs").existsSync(filePath)) {
    return res.status(404).json({ error: "Video file not found" });
  }

  const stat = require("fs").statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = require("fs").createReadStream(filePath, { start, end });

    const head = {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": "video/mp4"
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4"
    };

    res.writeHead(200, head);
    require("fs").createReadStream(filePath).pipe(res);
  }
});

app.get("/thumbnail/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(thumbnailsDir, filename);

  if (!require("fs").existsSync(filePath)) {
    return res.status(404).json({ error: "Thumbnail not found" });
  }

  const ext = path.extname(filename).toLowerCase();
  let contentType = "image/jpeg";

  if (ext === ".png") contentType = "image/png";
  else if (ext === ".gif") contentType = "image/gif";
  else if (ext === ".webp") contentType = "image/webp";

  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=86400");
  require("fs").createReadStream(filePath).pipe(res);
});

const server = app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  try {
    const connected = await queueService.connectWithRetry();

    if (connected && queueService.isReady()) {
      await queueService.consumeVideoJobs(async job => {
        console.log(`Processing video job: ${job.videoId}`);
        await videoProcessingService.processVideo(job.videoId, job.filePath);
      });
      console.log("Video processing consumer started successfully");
    } else {
      console.error(
        "Failed to start video processing consumer - queue service not ready"
      );
    }
  } catch (error) {
    console.error("Failed to initialize queue service:", error);
  }
});

process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully");
  await queueService.close();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully");
  await queueService.close();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
