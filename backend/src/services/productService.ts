import {
  Product,
  CreateProductRequest,
  UpdateProductRequest
} from "../models/Product";
import { ProductModel } from "../models/Product";

class ProductService {
  async getAllProducts(): Promise<Product[]> {
    return await ProductModel.findAll();
  }

  async getProductById(id: string): Promise<Product | null> {
    return await ProductModel.findById(id);
  }

  async createProduct(productData: CreateProductRequest): Promise<Product> {
    return await ProductModel.create(productData);
  }

  async updateProduct(
    id: string,
    productData: UpdateProductRequest
  ): Promise<Product | null> {
    return await ProductModel.update(id, productData);
  }

  async deleteProduct(id: string): Promise<boolean> {
    return await ProductModel.delete(id);
  }

  async getProductsByCategory(category: string): Promise<Product[]> {
    return await ProductModel.findByCategory(category);
  }
}

export const productService = new ProductService();
