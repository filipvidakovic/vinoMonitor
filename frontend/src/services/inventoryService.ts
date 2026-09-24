import { inventoryApi } from './api';
import type {
  Bottle,
  Bottling,
  BottlesPage,
  BottleStatus,
  CreateBottlingRequest,
  InventoryStats,
} from '../types';

export const inventoryService = {
  // Flaširanje (lotovi)
  async createBottling(data: CreateBottlingRequest): Promise<Bottling> {
    // Upis hiljada flaša može potrajati duže od podrazumevanih 10s
    const response = await inventoryApi.post<Bottling>('/bottlings', data, { timeout: 60000 });
    return response.data;
  },

  async getBottlings(batchId?: string): Promise<Bottling[]> {
    const params = batchId ? { batch_id: batchId } : {};
    const response = await inventoryApi.get<Bottling[]>('/bottlings', { params });
    return response.data;
  },

  async getBottling(id: string): Promise<Bottling> {
    const response = await inventoryApi.get<Bottling>(`/bottlings/${id}`);
    return response.data;
  },

  // Flaše
  async getBottles(params: {
    bottling_id?: string;
    status?: BottleStatus;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<BottlesPage> {
    const response = await inventoryApi.get<BottlesPage>('/bottles', { params });
    return response.data;
  },

  async getBottle(serial: string): Promise<Bottle> {
    const response = await inventoryApi.get<Bottle>(`/bottles/${encodeURIComponent(serial)}`);
    return response.data;
  },

  async updateBottleStatus(serial: string, status: BottleStatus): Promise<Bottle> {
    const response = await inventoryApi.patch<Bottle>(`/bottles/${encodeURIComponent(serial)}/status`, {
      status,
    });
    return response.data;
  },

  async getStats(): Promise<InventoryStats> {
    const response = await inventoryApi.get<InventoryStats>('/stats');
    return response.data;
  },
};
