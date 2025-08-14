import api from './api';
import { Product, CreateProductRequest, UpdateProductRequest } from '../types';

export const productService = {
  async getAllProducts(): Promise<Product[]> {
    const response = await api.get<Product[]>('/products');
    return response.data;
  },

  async getProductById(id: string): Promise<Product> {
    const response = await api.get<Product>(`/products/${id}`);
    return response.data;
  },

  async createProduct(productData: CreateProductRequest): Promise<Product> {
    const response = await api.post<Product>('/products', productData);
    return response.data;
  },

  async updateProduct(id: string, productData: UpdateProductRequest): Promise<Product> {
    const response = await api.put<Product>(`/products/${id}`, productData);
    return response.data;
  },

  async deleteProduct(id: string): Promise<void> {
    await api.delete(`/products/${id}`);
  },

  async getProductsByCategory(category: string): Promise<Product[]> {
    const response = await api.get<Product[]>(`/products/category/${category}`);
    return response.data;
  },
};
