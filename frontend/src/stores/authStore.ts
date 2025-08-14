import { create } from "zustand";
import { persist } from "zustand/middleware";
import api from "../services/api";

interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      initialize: async () => {
        const token = localStorage.getItem("authToken");
        if (token) {
          try {
            const response = await api.get("/api/auth/verify");
            const { user } = response.data;
            set({
              user,
              token,
              isAuthenticated: true
            });
          } catch (error) {
            localStorage.removeItem("authToken");
            set({
              user: null,
              token: null,
              isAuthenticated: false
            });
          }
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post("/api/auth/login", {
            email,
            password
          });
          const { user, token } = response.data;

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
            error: null
          });

          localStorage.setItem("authToken", token);
        } catch (error: any) {
          set({
            error: error.response?.data?.error || "Login failed",
            isLoading: false
          });
          throw error;
        }
      },

      signup: async (username: string, email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post("/api/auth/signup", {
            username,
            email,
            password
          });
          const { user, token } = response.data;

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
            error: null
          });

          localStorage.setItem("authToken", token);
        } catch (error: any) {
          set({
            error: error.response?.data?.error || "Signup failed",
            isLoading: false
          });
          throw error;
        }
      },

      logout: () => {
        localStorage.removeItem("authToken");
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null
        });
      },

      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: "auth-storage",
      partialize: state => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);
