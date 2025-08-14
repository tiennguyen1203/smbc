export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductRequest {
  name: string;
  description: string;
  price: number;
  category: string;
}

export interface UpdateProductRequest {
  name?: string;
  description?: string;
  price?: number;
  category?: string;
}

export interface Video {
  id: string;
  title: string;
  description: string;
  filename: string;
  original_filename: string;
  file_path: string;
  thumbnail_path: string;
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
  video_url?: string;
  thumbnail_url?: string;
}
