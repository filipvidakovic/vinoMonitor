import { authApi } from './api';
import type { LoginRequest, LoginResponse, RegisterRequest, User } from '../types';

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await authApi.post<LoginResponse>('/auth/login', credentials);
    return response.data;
  },

  async register(userData: RegisterRequest): Promise<LoginResponse> {
    const response = await authApi.post<LoginResponse>('/auth/register', userData);
    return response.data;
  },

  async getProfile(): Promise<User> {
    const response = await authApi.get<User>('/user/profile');
    return response.data;
  },

  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await authApi.put<User>('/user/profile', data);
    return response.data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await authApi.put('/user/password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },
};