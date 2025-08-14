import { User, CreateUserData } from "../models/User";
import { UserModel } from "../models/User";
import bcrypt from "bcryptjs";

class UserService {
  async getAllUsers(): Promise<User[]> {
    return await UserModel.findAll();
  }

  async getUserById(id: string): Promise<User | null> {
    return await UserModel.findById(id);
  }

  async createUser(userData: CreateUserData): Promise<User> {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const userWithHash = { ...userData, password: hashedPassword };

    return await UserModel.create(userWithHash);
  }

  async updateUser(
    id: string,
    userData: Partial<CreateUserData>
  ): Promise<User | null> {
    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 10);
    }

    return await UserModel.update(id, userData);
  }

  async deleteUser(id: string): Promise<boolean> {
    const user = await UserModel.findById(id);
    if (!user) return false;

    return true;
  }

  async findByEmail(email: string): Promise<User | null> {
    return await UserModel.findByEmail(email);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return await UserModel.findByEmail(email);
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return await UserModel.findByUsername(username);
  }
}

export const userService = new UserService();
