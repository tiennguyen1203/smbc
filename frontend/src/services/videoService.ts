import api from "./api";

export interface Video {
  id: string;
  title: string;
  description: string;
  filename: string;
  original_filename: string;
  file_path: string;
  thumbnail_path: string;
  video_url?: string;
  thumbnail_url?: string;
  duration: number;
  file_size: number;
  mime_type: string;
  status: "processing" | "ready" | "failed";
  user_id: string;
  tags: string[];
  category: string;
  views: number;
  likes: number;
  created_at: string;
  updated_at: string;
}

export interface CreateVideoData {
  title: string;
  description: string;
  tags?: string[];
  category?: string;
}

export interface VideoListResponse {
  videos: Video[];
  page: number;
  limit: number;
}

export interface SearchResponse {
  videos: Video[];
  query: string;
  page: number;
  limit: number;
}

export const videoService = {
  async uploadVideo(
    formData: FormData
  ): Promise<{ message: string; video: Partial<Video> }> {
    const response = await api.post("/api/videos/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
    return response.data;
  },

  async getVideo(id: string): Promise<{ video: Video }> {
    const response = await api.get(`/api/videos/${id}`);
    return response.data;
  },

  async listVideos(
    page = 1,
    limit = 20,
    category?: string
  ): Promise<VideoListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    });

    if (category) {
      params.append("category", category);
    }

    const response = await api.get(`/api/videos?${params}`);
    return response.data;
  },

  async searchVideos(
    query: string,
    page = 1,
    limit = 20
  ): Promise<SearchResponse> {
    const params = new URLSearchParams({
      q: query,
      page: page.toString(),
      limit: limit.toString()
    });

    const response = await api.get(`/api/videos/search?${params}`);
    return response.data;
  },

  async updateVideo(
    id: string,
    data: Partial<CreateVideoData>
  ): Promise<{ video: Video }> {
    const response = await api.put(`/api/videos/${id}`, data);
    return response.data;
  },

  async deleteVideo(id: string): Promise<{ message: string }> {
    const response = await api.delete(`/api/videos/${id}`);
    return response.data;
  },

  async likeVideo(id: string): Promise<{ message: string }> {
    const response = await api.post(`/api/videos/${id}/like`);
    return response.data;
  },

  async getComments(
    videoId: string,
    page = 1,
    limit = 50
  ): Promise<{ comments: any[]; page: number; limit: number }> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    });

    const response = await api.get(`/api/videos/${videoId}/comments?${params}`);
    return response.data;
  },

  async addComment(
    videoId: string,
    content: string,
    parentId?: string
  ): Promise<{ comment: any }> {
    const response = await api.post(`/api/videos/${videoId}/comments`, {
      content,
      parentId
    });
    return response.data;
  }
};
