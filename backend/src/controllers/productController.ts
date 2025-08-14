import { Request, Response } from "express";
import { productService } from "../services/productService";
import { CreateProductRequest, UpdateProductRequest } from "../models/Product";

export const productController = {
  async getAllProducts(req: Request, res: Response) {
    try {
      const products = await productService.getAllProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  },

  async getProductById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const product = await productService.getProductById(id);

      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch product" });
    }
  },

  async createProduct(req: Request, res: Response) {
    try {
      const productData: CreateProductRequest = req.body;

      if (
        !productData.name ||
        !productData.description ||
        !productData.price ||
        !productData.category
      ) {
        return res.status(400).json({ error: "All fields are required" });
      }

      if (productData.price <= 0) {
        return res.status(400).json({ error: "Price must be greater than 0" });
      }

      const newProduct = await productService.createProduct(productData);
      res.status(201).json(newProduct);
    } catch (error) {
      res.status(500).json({ error: "Failed to create product" });
    }
  },

  async updateProduct(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const productData: UpdateProductRequest = req.body;

      if (productData.price !== undefined && productData.price <= 0) {
        return res.status(400).json({ error: "Price must be greater than 0" });
      }

      const updatedProduct = await productService.updateProduct(
        id,
        productData
      );

      if (!updatedProduct) {
        return res.status(404).json({ error: "Product not found" });
      }

      res.json(updatedProduct);
    } catch (error) {
      res.status(500).json({ error: "Failed to update product" });
    }
  },

  async deleteProduct(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const deleted = await productService.deleteProduct(id);

      if (!deleted) {
        return res.status(404).json({ error: "Product not found" });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete product" });
    }
  },

  async getProductsByCategory(req: Request, res: Response) {
    try {
      const { category } = req.params;
      const products = await productService.getProductsByCategory(category);
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch products by category" });
    }
  }
};
