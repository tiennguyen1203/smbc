import { Request, Response } from "express";
import { userService } from "../services/userService";
import { CreateUserData } from "../models/User";

export const userController = {
  async getAllUsers(req: Request, res: Response) {
    try {
      const users = await userService.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  },

  async getUserById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = await userService.getUserById(id);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  },

  async createUser(req: Request, res: Response) {
    try {
      const userData: CreateUserData = req.body;

      if (!userData.username || !userData.email || !userData.password) {
        return res
          .status(400)
          .json({ error: "Username, email and password are required" });
      }

      const newUser = await userService.createUser(userData);
      res.status(201).json(newUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to create user" });
    }
  },

  async updateUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userData: Partial<CreateUserData> = req.body;

      const updatedUser = await userService.updateUser(id, userData);

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  },

  async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const deleted = await userService.deleteUser(id);

      if (!deleted) {
        return res.status(404).json({ error: "User not found" });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  }
};
