import amqp from "amqplib";
import dotenv from "dotenv";

dotenv.config();

interface VideoProcessingJob {
  videoId: string;
  filePath: string;
  userId: string;
}

class QueueService {
  private connection: any = null;
  private channel: amqp.Channel | null = null;
  private isConnected = false;

  async connect() {
    try {
      this.connection = await amqp.connect(process.env.RABBITMQ_URL!);
      this.channel = await this.connection.createChannel();

      await this.setupQueues();

      this.isConnected = true;
      console.log("RabbitMQ connected successfully");

      if (this.connection) {
        this.connection.on("close", () => {
          this.isConnected = false;
          console.log("RabbitMQ connection closed");
        });

        this.connection.on("error", (error: Error) => {
          this.isConnected = false;
          console.error("RabbitMQ connection error:", error);
        });
      }
    } catch (error) {
      console.error("Failed to connect to RabbitMQ:", error);
      this.isConnected = false;
    }
  }

  async connectWithRetry(maxRetries = 10, delay = 2000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `Attempting to connect to RabbitMQ (attempt ${attempt}/${maxRetries})...`
        );
        await this.connect();

        if (this.isConnected) {
          console.log("RabbitMQ connection established successfully");
          return true;
        }
      } catch (error) {
        console.log(`RabbitMQ connection attempt ${attempt} failed:`, error);
      }

      if (attempt < maxRetries) {
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.error("Failed to connect to RabbitMQ after all retry attempts");
    return false;
  }

  private async setupQueues() {
    if (!this.channel) return;

    const videoQueue = "video_processing";
    const deadLetterQueue = "video_processing_dlq";
    const retryQueue = "video_processing_retry";

    await this.channel.assertQueue(videoQueue, {
      durable: true,
      arguments: {
        "x-dead-letter-exchange": "",
        "x-dead-letter-routing-key": deadLetterQueue
      }
    });

    await this.channel.assertQueue(deadLetterQueue, { durable: true });
    await this.channel.assertQueue(retryQueue, { durable: true });

    console.log("Queues setup completed");
  }

  async publishVideoJob(job: VideoProcessingJob): Promise<boolean> {
    if (!this.channel || !this.isConnected) {
      console.error("Queue service not connected");
      return false;
    }

    try {
      const message = JSON.stringify(job);
      const success = this.channel.sendToQueue(
        "video_processing",
        Buffer.from(message),
        {
          persistent: true,
          headers: {
            retryCount: 0
          }
        }
      );

      if (success) {
        console.log(`Video processing job published for video: ${job.videoId}`);
        return true;
      } else {
        console.error("Failed to publish video processing job");
        return false;
      }
    } catch (error) {
      console.error("Error publishing video job:", error);
      return false;
    }
  }

  async consumeVideoJobs(
    processor: (job: VideoProcessingJob) => Promise<void>
  ) {
    if (!this.channel || !this.isConnected) {
      console.error("Queue service not connected");
      return;
    }

    try {
      await this.channel.consume("video_processing", async msg => {
        if (!msg) return;

        try {
          const job: VideoProcessingJob = JSON.parse(msg.content.toString());
          console.log(`Processing video job: ${job.videoId}`);

          await processor(job);

          this.channel?.ack(msg);
          console.log(`Video job completed: ${job.videoId}`);
        } catch (error) {
          console.error(
            `Error processing video job ${msg.content.toString()}:`,
            error
          );

          const retryCount = msg.properties.headers?.retryCount || 0;

          if (retryCount < 3) {
            const retryJob = { ...JSON.parse(msg.content.toString()) };
            retryJob.retryCount = retryCount + 1;

            console.log(
              `Retrying video job ${retryJob.videoId}, attempt ${
                retryCount + 1
              }/3`
            );

            await this.channel?.sendToQueue(
              "video_processing_retry",
              Buffer.from(JSON.stringify(retryJob)),
              {
                persistent: true,
                headers: { retryCount: retryCount + 1 }
              }
            );

            this.channel?.ack(msg);
            console.log(`Video job ${retryJob.videoId} moved to retry queue`);
          } else {
            console.log(
              `Video job ${
                JSON.parse(msg.content.toString()).videoId
              } exceeded retry limit, moving to DLQ`
            );

            await this.channel?.sendToQueue(
              "video_processing_dlq",
              msg.content,
              { persistent: true }
            );
            this.channel?.ack(msg);
            console.log(`Video job moved to DLQ`);
          }
        }
      });

      await this.consumeRetryJobs(processor);
      await this.monitorDeadLetterQueue();

      console.log("Video processing consumer started");
    } catch (error) {
      console.error("Error setting up video job consumer:", error);
    }
  }

  private async consumeRetryJobs(
    processor: (job: VideoProcessingJob) => Promise<void>
  ) {
    if (!this.channel) return;

    try {
      await this.channel.consume("video_processing_retry", async msg => {
        if (!msg) return;

        try {
          const job: VideoProcessingJob = JSON.parse(msg.content.toString());
          console.log(`Processing retry video job: ${job.videoId}`);

          await processor(job);

          this.channel?.ack(msg);
          console.log(`Retry video job completed: ${job.videoId}`);
        } catch (error) {
          console.error(
            `Error processing retry video job ${msg.content.toString()}:`,
            error
          );

          const retryCount = msg.properties.headers?.retryCount || 0;

          if (retryCount < 3) {
            const retryJob = { ...JSON.parse(msg.content.toString()) };
            retryJob.retryCount = retryCount + 1;

            console.log(
              `Retrying video job ${retryJob.videoId} again, attempt ${
                retryCount + 1
              }/3`
            );

            await this.channel?.sendToQueue(
              "video_processing_retry",
              Buffer.from(JSON.stringify(retryJob)),
              {
                persistent: true,
                headers: { retryCount: retryCount + 1 }
              }
            );

            this.channel?.ack(msg);
          } else {
            console.log(
              `Retry video job ${
                JSON.parse(msg.content.toString()).videoId
              } exceeded retry limit, moving to DLQ`
            );

            await this.channel?.sendToQueue(
              "video_processing_dlq",
              msg.content,
              { persistent: true }
            );
            this.channel?.ack(msg);
          }
        }
      });

      console.log("Retry queue consumer started");
    } catch (error) {
      console.error("Error setting up retry queue consumer:", error);
    }
  }

  private async monitorDeadLetterQueue() {
    if (!this.channel) return;

    try {
      await this.channel.consume("video_processing_dlq", async msg => {
        if (!msg) return;

        const job: VideoProcessingJob = JSON.parse(msg.content.toString());
        console.log(`Dead letter queue received job: ${job.videoId}`);

        this.channel?.ack(msg);

        console.log(
          `Job ${job.videoId} acknowledged in DLQ - manual intervention required`
        );
      });

      console.log("Dead letter queue monitor started");
    } catch (error) {
      console.error("Error setting up dead letter queue monitor:", error);
    }
  }

  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.isConnected = false;
      console.log("RabbitMQ connection closed");
    } catch (error) {
      console.error("Error closing RabbitMQ connection:", error);
    }
  }

  async getQueueStats() {
    if (!this.channel || !this.isConnected) {
      return null;
    }

    try {
      const videoQueue = await this.channel.assertQueue("video_processing");
      const retryQueue = await this.channel.assertQueue(
        "video_processing_retry"
      );
      const dlqQueue = await this.channel.assertQueue("video_processing_dlq");

      return {
        video_processing: {
          messages: videoQueue.messageCount,
          consumers: videoQueue.consumerCount
        },
        retry_queue: {
          messages: retryQueue.messageCount,
          consumers: retryQueue.consumerCount
        },
        dead_letter_queue: {
          messages: dlqQueue.messageCount,
          consumers: dlqQueue.consumerCount
        },
        connection_status: this.isConnected ? "connected" : "disconnected"
      };
    } catch (error) {
      console.error("Error getting queue stats:", error);
      return null;
    }
  }

  async retryDeadLetterJob(videoId: string): Promise<boolean> {
    if (!this.channel || !this.isConnected) {
      return false;
    }

    try {
      const dlqQueue = await this.channel.assertQueue("video_processing_dlq");

      if (dlqQueue.messageCount === 0) {
        return false;
      }

      console.log(`Attempting to retry dead letter job for video: ${videoId}`);
      console.log(`DLQ currently has ${dlqQueue.messageCount} messages`);

      return true;
    } catch (error) {
      console.error("Error retrying dead letter job:", error);
      return false;
    }
  }

  isReady(): boolean {
    return this.isConnected;
  }
}

export default new QueueService();
