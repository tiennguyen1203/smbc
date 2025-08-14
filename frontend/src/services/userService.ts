import api from "./api";
import { User, CreateUserRequest, UpdateUserRequest } from "../types";

export const userService = {
  async getAllUsers(): Promise<User[]> {
    const response = await api.get<User[]>("/users");
    return response.data;
  },

  async getUserById(id: string): Promise<User> {
    const response = await api.get<User>(`/users/${id}`);
    return response.data;
  },

  async createUser(userData: CreateUserRequest): Promise<User> {
    const response = await api.post<User>("/users", userData);
    return response.data;
  },

  async updateUser(id: string, userData: UpdateUserRequest): Promise<User> {
    const response = await api.put<User>(`/users/${id}`, userData);
    return response.data;
  },

  async deleteUser(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  }
};
