import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { userService } from "../services/userService";
import { CreateUserData } from "../models/User";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export const authController = {
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "Email and password are required" });
      }

      const user = await userService.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      const { password: _, ...userWithoutPassword } = user;
      res.json({
        user: userWithoutPassword,
        token
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  },

  async signup(req: Request, res: Response) {
    try {
      const userData: CreateUserData = req.body;

      if (!userData.username || !userData.email || !userData.password) {
        return res.status(400).json({
          error: "Username, email and password are required"
        });
      }

      const existingUser = await userService.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already exists" });
      }

      const existingUsername = await userService.getUserByUsername(
        userData.username
      );
      if (existingUsername) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const newUser = await userService.createUser(userData);
      const token = jwt.sign(
        { userId: newUser.id, email: newUser.email },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      const { password: _, ...userWithoutPassword } = newUser;
      res.status(201).json({
        user: userWithoutPassword,
        token
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "Signup failed" });
    }
  },

  async verifyToken(req: Request, res: Response) {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        return res.status(401).json({ error: "No token provided" });
      }

      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const user = await userService.getUserById(decoded.userId);

      if (!user) {
        return res.status(401).json({ error: "Invalid token" });
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      res.status(401).json({ error: "Invalid token" });
    }
  }
};
