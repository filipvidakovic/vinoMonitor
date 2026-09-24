import { iotApi } from './api';
import type {
  IotDevice,
  SensorReading,
  SeriesPoint,
  SensorStats,
  DeviceCommand,
  TargetType,
} from '../types';

interface RangeParams {
  target_type: TargetType;
  target_id: string;
  from?: string;
  to?: string;
}

export const iotService = {
  // Devices
  async getDevices(): Promise<IotDevice[]> {
    const response = await iotApi.get<IotDevice[]>('/devices');
    return response.data;
  },

  async sendCommand(deviceId: string, command: DeviceCommand): Promise<void> {
    await iotApi.post(`/devices/${deviceId}/commands`, command);
  },

  // Readings
  async getLatest(targetType?: TargetType): Promise<SensorReading[]> {
    const params = targetType ? { target_type: targetType } : {};
    const response = await iotApi.get<SensorReading[]>('/readings/latest', { params });
    return response.data;
  },

  async getReadings(params: RangeParams & { limit?: number }): Promise<SensorReading[]> {
    const response = await iotApi.get<SensorReading[]>('/readings', { params });
    return response.data;
  },

  async getSeries(params: RangeParams & { bucket_minutes?: number }): Promise<SeriesPoint[]> {
    const response = await iotApi.get<SeriesPoint[]>('/readings/series', { params });
    return response.data;
  },

  async getStats(params: RangeParams): Promise<SensorStats> {
    const response = await iotApi.get<SensorStats>('/readings/stats', { params });
    return response.data;
  },
};
