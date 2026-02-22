import { fermentationApi } from './api';
import type {
  Tank,
  FermentationBatch,
  FermentationReading,
  CreateTankRequest,
  CreateBatchRequest,
  BatchStats,
  FermentationStatus,
} from '../types';

export const fermentationService = {
  // Tanks
  async getTanks(): Promise<Tank[]> {
    const response = await fermentationApi.get<Tank[]>('/tanks');
    return response.data;
  },

  async getAvailableTanks(): Promise<Tank[]> {
    const response = await fermentationApi.get<Tank[]>('/tanks/available');
    return response.data;
  },

  async getTank(id: string): Promise<Tank> {
    const response = await fermentationApi.get<Tank>(`/tanks/${id}`);
    return response.data;
  },

  async createTank(data: CreateTankRequest): Promise<Tank> {
    const response = await fermentationApi.post<Tank>('/tanks', data);
    return response.data;
  },

  async updateTank(id: string, data: Partial<CreateTankRequest>): Promise<Tank> {
    const response = await fermentationApi.put<Tank>(`/tanks/${id}`, data);
    return response.data;
  },

  async deleteTank(id: string): Promise<void> {
    await fermentationApi.delete(`/tanks/${id}`);
  },

  // Batches
  async getBatches(): Promise<FermentationBatch[]> {
    const response = await fermentationApi.get<FermentationBatch[]>('/batches');
    return response.data;
  },

  async getActiveBatches(): Promise<FermentationBatch[]> {
    const response = await fermentationApi.get<FermentationBatch[]>('/batches/active');
    return response.data;
  },

  async getBatch(id: string): Promise<FermentationBatch> {
    const response = await fermentationApi.get<FermentationBatch>(`/batches/${id}`);
    return response.data;
  },

  async getBatchesByTank(tankId: string): Promise<FermentationBatch[]> {
    const response = await fermentationApi.get<FermentationBatch[]>(`/tanks/${tankId}/batches`);
    return response.data;
  },

  async createBatch(data: CreateBatchRequest): Promise<FermentationBatch> {
    const response = await fermentationApi.post<FermentationBatch>('/batches', data);
    return response.data;
  },

  async updateBatch(
    id: string,
    data: Partial<CreateBatchRequest & { status?: FermentationStatus }>
  ): Promise<FermentationBatch> {
    const response = await fermentationApi.put<FermentationBatch>(`/batches/${id}`, data);
    return response.data;
  },

  async deleteBatch(id: string): Promise<void> {
    await fermentationApi.delete(`/batches/${id}`);
  },

  // Readings
  async addReading(
    batchId: string,
    data: Partial<FermentationReading>
  ): Promise<FermentationReading> {
    const response = await fermentationApi.post<FermentationReading>(`/batches/${batchId}/readings`, data);
    return response.data;
  },

  async getReadings(batchId: string, limit?: number): Promise<FermentationReading[]> {
    const params = limit ? { limit } : {};
    const response = await fermentationApi.get<FermentationReading[]>(`/batches/${batchId}/readings`, {
      params,
    });
    return response.data;
  },

  async deleteReading(batchId: string, readingId: string): Promise<void> {
    await fermentationApi.delete(`/batches/${batchId}/readings/${readingId}`);
  },

  // Stats
  async getBatchStats(batchId: string): Promise<BatchStats> {
    const response = await fermentationApi.get<BatchStats>(`/batches/${batchId}/stats`);
    return response.data;
  },
};