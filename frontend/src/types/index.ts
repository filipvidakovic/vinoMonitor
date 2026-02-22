// ============== User & Auth ==============

export enum UserRole {
  Admin = 'admin',
  Winemaker = 'winemaker',
  Worker = 'worker',
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: string;
}

// ============== Vineyard ==============

export interface Vineyard {
  id: string;
  name: string;
  location: string;
  total_area: number;
  owner_id: string;
  description?: string;
  parcel_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Parcel {
  id: string;
  vineyard_id: string;
  name: string;
  area: number;
  grape_variety: string;
  planting_year?: number;
  soil_type?: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateVineyardRequest {
  name: string;
  location: string;
  total_area: number;
  description?: string;
}

export interface UpdateVineyardRequest {
  name?: string;
  location?: string;
  total_area?: number;
  description?: string;
}

export interface CreateParcelRequest {
  name: string;
  area: number;
  grape_variety: string;
  planting_year?: number;
  soil_type?: string;
  latitude?: number;
  longitude?: number;
}

// ============== Harvest ==============

export enum HarvestStatus {
  Planned = 'planned',
  InProgress = 'in_progress',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export interface Harvest {
  id: string;
  parcel_id: string;
  vineyard_id: string;
  harvest_date: string;
  status: HarvestStatus;
  total_weight_kg?: number;
  yield_per_hectare?: number;
  weather_condition?: string;
  temperature_celsius?: number;
  humidity_percent?: number;
  notes?: string;
  created_by: string;
  quality_measurements?: HarvestQuality[];
  created_at: string;
  updated_at: string;
}

export interface HarvestQuality {
  id: string;
  harvest_id: string;
  brix?: number;
  ph?: number;
  acidity?: number;
  berry_size?: string;
  berry_color?: string;
  grape_health?: string;
  notes?: string;
  measured_at: string;
}

export interface CreateHarvestRequest {
  parcel_id: string;
  vineyard_id: string;
  harvest_date: string;
  total_weight_kg?: number;
  yield_per_hectare?: number;
  weather_condition?: string;
  temperature_celsius?: number;
  humidity_percent?: number;
  notes?: string;
}

// ============== Fermentation ==============

export enum TankStatus {
  Available = 'available',
  InUse = 'in_use',
  Cleaning = 'cleaning',
  Maintenance = 'maintenance',
}

export enum TankMaterial {
  StainlessSteel = 'stainless_steel',
  Oak = 'oak',
  Concrete = 'concrete',
  Fiberglass = 'fiberglass',
}

export enum FermentationStatus {
  Active = 'active',
  Completed = 'completed',
  Paused = 'paused',
  Cancelled = 'cancelled',
}

export interface Tank {
  id: string;
  name: string;
  capacity_liters: number;
  material: TankMaterial;
  status: TankStatus;
  location?: string;
  notes?: string;
  active_batch?: string;
  created_at: string;
  updated_at: string;
}

export interface FermentationBatch {
  id: string;
  tank_id: string;
  harvest_id?: string;
  name: string;
  grape_variety: string;
  volume_liters: number;
  status: FermentationStatus;
  target_temperature?: number;
  yeast_strain?: string;
  initial_brix?: number;
  initial_ph?: number;
  start_date?: string;
  end_date?: string;
  expected_end_date?: string;
  notes?: string;
  created_by: string;
  latest_reading?: FermentationReading;
  created_at: string;
  updated_at: string;
}

export interface FermentationReading {
  id: string;
  batch_id: string;
  temperature?: number;
  brix?: number;
  ph?: number;
  density?: number;
  alcohol_percent?: number;
  volatile_acidity?: number;
  free_so2?: number;
  total_so2?: number;
  color?: string;
  clarity?: string;
  aroma_notes?: string;
  source: 'manual' | 'iot';
  notes?: string;
  recorded_at: string;
}

export interface CreateTankRequest {
  name: string;
  capacity_liters: number;
  material: TankMaterial;
  location?: string;
  notes?: string;
}

export interface CreateBatchRequest {
  tank_id: string;
  harvest_id?: string;
  name: string;
  grape_variety: string;
  volume_liters: number;
  target_temperature?: number;
  yeast_strain?: string;
  initial_brix?: number;
  initial_ph?: number;
  expected_end_date?: string;
  notes?: string;
}

// ============== API ==============

export interface ApiError {
  error: string;
  status: number;
}

export interface HealthResponse {
  status: string;
  service: string;
}

export interface VineyardStats {
  total_harvests: number;
  total_weight_kg: number;
  avg_yield_per_hectare: number;
  avg_brix: number;
  avg_ph: number;
}

export interface BatchStats {
  batch_id: string;
  total_readings: number;
  avg_temperature?: number;
  min_temperature?: number;
  max_temperature?: number;
  latest_brix?: number;
  latest_ph?: number;
  latest_alcohol?: number;
  duration_days?: number;
}