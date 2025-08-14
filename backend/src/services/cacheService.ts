import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

class CacheService {
  private client: ReturnType<typeof createClient>;
  private isConnected = false;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL
    });

    this.client.on("error", err => {
      console.error("Redis Client Error:", err);
      this.isConnected = false;
    });

    this.client.on("connect", () => {
      console.log("Redis Client Connected");
      this.isConnected = true;
    });

    this.connect();
  }

  private async connect() {
    try {
      await this.client.connect();
    } catch (error) {
      console.error("Failed to connect to Redis:", error);
    }
  }

  async get(key: string): Promise<any | null> {
    if (!this.isConnected) return null;

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error("Redis get error:", error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!this.isConnected) return;

    try {
      const serializedValue = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
    } catch (error) {
      console.error("Redis set error:", error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.client.del(key);
    } catch (error) {
      console.error("Redis del error:", error);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      console.error("Redis delPattern error:", error);
    }
  }

  async increment(key: string): Promise<number> {
    if (!this.isConnected) return 0;

    try {
      return await this.client.incr(key);
    } catch (error) {
      console.error("Redis increment error:", error);
      return 0;
    }
  }

  async getStats(): Promise<{ hits: number; misses: number; keys: number }> {
    if (!this.isConnected) return { hits: 0, misses: 0, keys: 0 };

    try {
      const keys = await this.client.dbSize();
      const hits = (await this.client.get("cache:hits")) || "0";
      const misses = (await this.client.get("cache:misses")) || "0";

      return {
        hits: parseInt(hits),
        misses: parseInt(misses),
        keys
      };
    } catch (error) {
      console.error("Redis stats error:", error);
      return { hits: 0, misses: 0, keys: 0 };
    }
  }

  async recordHit(): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.increment("cache:hits");
    } catch (error) {
      console.error("Redis recordHit error:", error);
    }
  }

  async recordMiss(): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.increment("cache:misses");
    } catch (error) {
      console.error("Redis recordMiss error:", error);
    }
  }

  async sadd(key: string, ...values: string[]): Promise<number> {
    if (!this.isConnected) return 0;

    try {
      return await this.client.sAdd(key, values);
    } catch (error) {
      console.error("Redis sadd error:", error);
      return 0;
    }
  }

  async scard(key: string): Promise<number> {
    if (!this.isConnected) return 0;

    try {
      return await this.client.sCard(key);
    } catch (error) {
      console.error("Redis scard error:", error);
      return 0;
    }
  }

  async smembers(key: string): Promise<string[]> {
    if (!this.isConnected) return [];

    try {
      return await this.client.sMembers(key);
    } catch (error) {
      console.error("Redis smembers error:", error);
      return [];
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      return await this.client.expire(key, seconds);
    } catch (error) {
      console.error("Redis expire error:", error);
      return false;
    }
  }
}

export default new CacheService();
