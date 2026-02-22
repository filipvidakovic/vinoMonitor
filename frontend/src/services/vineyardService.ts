import { vineyardApi } from './api';
import type {
  Vineyard,
  Parcel,
  CreateVineyardRequest,
  UpdateVineyardRequest,
  CreateParcelRequest,
} from '../types';

export const vineyardService = {
  // Vineyards
  async getVineyards(): Promise<Vineyard[]> {
    const response = await vineyardApi.get<Vineyard[]>('/vineyards');
    console.log('Fetched vineyards:', response.data);
    return response.data;
  },

  async getVineyard(id: string): Promise<Vineyard> {
    const response = await vineyardApi.get<Vineyard>(`/vineyards/${id}`);
    return response.data;
  },

  async createVineyard(data: CreateVineyardRequest): Promise<Vineyard> {
    const response = await vineyardApi.post<Vineyard>('/vineyards', data);
    return response.data;
  },

  async updateVineyard(id: string, data: UpdateVineyardRequest): Promise<Vineyard> {
    const response = await vineyardApi.put<Vineyard>(`/vineyards/${id}`, data);
    return response.data;
  },

  async deleteVineyard(id: string): Promise<void> {
    await vineyardApi.delete(`/vineyards/${id}`);
  },

  // Parcels
  async getParcels(vineyardId: string): Promise<Parcel[]> {
    const response = await vineyardApi.get<Parcel[]>(`/vineyards/${vineyardId}/parcels`);
    return response.data;
  },

  async getParcel(vineyardId: string, parcelId: string): Promise<Parcel> {
    const response = await vineyardApi.get<Parcel>(`/vineyards/${vineyardId}/parcels/${parcelId}`);
    return response.data;
  },

  async createParcel(vineyardId: string, data: CreateParcelRequest): Promise<Parcel> {
    const response = await vineyardApi.post<Parcel>(`/vineyards/${vineyardId}/parcels`, data);
    return response.data;
  },

  async updateParcel(
    vineyardId: string,
    parcelId: string,
    data: Partial<CreateParcelRequest>
  ): Promise<Parcel> {
    const response = await vineyardApi.put<Parcel>(`/vineyards/${vineyardId}/parcels/${parcelId}`, data);
    return response.data;
  },

  async deleteParcel(vineyardId: string, parcelId: string): Promise<void> {
    await vineyardApi.delete(`/vineyards/${vineyardId}/parcels/${parcelId}`);
  },
};