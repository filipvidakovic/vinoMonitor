import { harvestApi } from './api';
import type {
  Harvest,
  HarvestQuality,
  CreateHarvestRequest,
  VineyardStats,
  HarvestStatus,
} from '../types';

export const harvestService = {
  // Harvests
  async getHarvests(): Promise<Harvest[]> {
    const response = await harvestApi.get<Harvest[]>('/harvests');
    return response.data;
  },

  async getHarvest(id: string): Promise<Harvest> {
    const response = await harvestApi.get<Harvest>(`/harvests/${id}`);
    return response.data;
  },

  async getHarvestsByVineyard(vineyardId: string): Promise<Harvest[]> {
    const response = await harvestApi.get<Harvest[]>(`/vineyards/${vineyardId}/harvests`);
    return response.data;
  },

  async getHarvestsByParcel(parcelId: string): Promise<Harvest[]> {
    const response = await harvestApi.get<Harvest[]>(`/parcels/${parcelId}/harvests`);
    return response.data;
  },

  async createHarvest(data: CreateHarvestRequest): Promise<Harvest> {
    const response = await harvestApi.post<Harvest>('/harvests', data);
    return response.data;
  },

  async updateHarvest(id: string, data: Partial<CreateHarvestRequest>): Promise<Harvest> {
    const response = await harvestApi.put<Harvest>(`/harvests/${id}`, data);
    return response.data;
  },

  async updateHarvestStatus(id: string, status: HarvestStatus): Promise<Harvest> {
    const response = await harvestApi.patch<Harvest>(`/harvests/${id}/status`, { status });
    return response.data;
  },

  async deleteHarvest(id: string): Promise<void> {
    await harvestApi.delete(`/harvests/${id}`);
  },

  // Quality measurements
  async addQualityMeasurement(
    harvestId: string,
    data: Partial<HarvestQuality>
  ): Promise<HarvestQuality> {
    const response = await harvestApi.post<HarvestQuality>(`/harvests/${harvestId}/quality`, data);
    return response.data;
  },

  async getQualityMeasurements(harvestId: string): Promise<HarvestQuality[]> {
    const response = await harvestApi.get<HarvestQuality[]>(`/harvests/${harvestId}/quality`);
    return response.data;
  },

  async deleteQualityMeasurement(harvestId: string, measurementId: string): Promise<void> {
    await harvestApi.delete(`/harvests/${harvestId}/quality/${measurementId}`);
  },

  // Stats
  async getVineyardStats(vineyardId: string): Promise<VineyardStats> {
    const response = await harvestApi.get<VineyardStats>(`/vineyards/${vineyardId}/stats`);
    return response.data;
  },
};