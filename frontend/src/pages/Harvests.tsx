import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { harvestService } from '../services/harvestService';
import { vineyardService } from '../services/vineyardService';
import { useAuth } from '../context/AuthContext';
import { type Harvest, type CreateHarvestRequest, type Vineyard, type Parcel, HarvestStatus } from '../types';
import '../styles/Harvests.css';

const Harvests: React.FC = () => {
  const { user } = useAuth();
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [vineyards, setVineyards] = useState<Vineyard[]>([]);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingHarvest, setEditingHarvest] = useState<Harvest | null>(null);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState<HarvestStatus | 'all'>('all');
  const [formData, setFormData] = useState<CreateHarvestRequest>({
    parcel_id: '',
    vineyard_id: '',
    harvest_date: new Date().toISOString().split('T')[0],
    total_weight_kg: 0,
    yield_per_hectare: 0,
    weather_condition: '',
    temperature_celsius: 0,
    humidity_percent: 0,
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.vineyard_id) {
      loadParcels(formData.vineyard_id);
    }
  }, [formData.vineyard_id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [harvestsData, vineyardsData] = await Promise.all([
        harvestService.getHarvests(),
        vineyardService.getVineyards(),
      ]);
      setHarvests(harvestsData);
      setVineyards(vineyardsData);
      setError('');
    } catch (err: any) {
      console.error('Failed to load data:', err);
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadParcels = async (vineyardId: string) => {
    try {
      const parcelsData = await vineyardService.getParcels(vineyardId);
      setParcels(parcelsData);
    } catch (err) {
      console.error('Failed to load parcels:', err);
      setParcels([]);
    }
  };

  const handleOpenModal = (harvest?: Harvest) => {
    if (harvest) {
      setEditingHarvest(harvest);
      setFormData({
        parcel_id: harvest.parcel_id,
        vineyard_id: harvest.vineyard_id,
        harvest_date: harvest.harvest_date.split('T')[0],
        total_weight_kg: harvest.total_weight_kg || 0,
        yield_per_hectare: harvest.yield_per_hectare || 0,
        weather_condition: harvest.weather_condition || '',
        temperature_celsius: harvest.temperature_celsius || 0,
        humidity_percent: harvest.humidity_percent || 0,
        notes: harvest.notes || '',
      });
    } else {
      setEditingHarvest(null);
      setFormData({
        parcel_id: '',
        vineyard_id: '',
        harvest_date: new Date().toISOString().split('T')[0],
        total_weight_kg: 0,
        yield_per_hectare: 0,
        weather_condition: '',
        temperature_celsius: 0,
        humidity_percent: 0,
        notes: '',
      });
      setParcels([]);
    }
    setShowModal(true);
    setError('');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingHarvest(null);
    setParcels([]);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.parcel_id || !formData.vineyard_id) {
      setError('Vinograd i parcela su obavezni');
      return;
    }

    try {
      if (editingHarvest) {
        await harvestService.updateHarvest(editingHarvest.id, formData);
      } else {
        await harvestService.createHarvest(formData);
      }
      handleCloseModal();
      loadData();
    } catch (err: any) {
      console.error('Failed to save harvest:', err);
      setError(err.response?.data?.error || 'Failed to save harvest');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Da li ste sigurni da želite da obrišete ovu berbu?')) {
      try {
        await harvestService.deleteHarvest(id);
        loadData();
      } catch (err: any) {
        console.error('Failed to delete harvest:', err);
        alert(err.response?.data?.error || 'Failed to delete harvest');
      }
    }
  };

  const handleStatusChange = async (harvestId: string, newStatus: HarvestStatus) => {
    try {
      await harvestService.updateHarvestStatus(harvestId, newStatus);
      loadData();
    } catch (err: any) {
      console.error('Failed to update status:', err);
      alert(err.response?.data?.error || 'Failed to update status');
    }
  };

  const getStatusBadgeClass = (status: HarvestStatus) => {
    const statusMap: Record<HarvestStatus, string> = {
      planned: 'warning',
      in_progress: 'primary',
      completed: 'success',
      cancelled: 'danger',
    };
    return `badge badge-${statusMap[status]}`;
  };

  const getStatusLabel = (status: HarvestStatus) => {
    const labels: Record<HarvestStatus, string> = {
      planned: 'Planirano',
      in_progress: 'U toku',
      completed: 'Završeno',
      cancelled: 'Otkazano',
    };
    return labels[status];
  };

  const getVineyardName = (vineyardId: string) => {
    return vineyards.find((v) => v.id === vineyardId)?.name || 'N/A';
  };

  const filteredHarvests = filterStatus === 'all' 
    ? harvests 
    : harvests.filter((h) => h.status === filterStatus);

  const canModify = user?.role === 'admin' || user?.role === 'winemaker';

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Učitavanje berbi...</p>
      </div>
    );
  }

  return (
    <div className="harvests-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Berbe</h1>
          <p className="page-subtitle">Evidencija berbi i praćenje kvaliteta</p>
        </div>
        {canModify && (
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            + Nova Berba
          </button>
        )}
      </div>

      {error && !showModal && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <label className="filter-label">Status:</label>
          <select
            className="filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as HarvestStatus | 'all')}
          >
            <option value="all">Sve berbe</option>
            <option value="planned">Planirano</option>
            <option value="in_progress">U toku</option>
            <option value="completed">Završeno</option>
            <option value="cancelled">Otkazano</option>
          </select>
        </div>
        <div className="filter-stats">
          <span className="filter-stat">
            Ukupno: <strong>{filteredHarvests.length}</strong>
          </span>
        </div>
      </div>

      {filteredHarvests.length === 0 ? (
        <div className="empty-state-large">
          <div className="empty-icon">🌾</div>
          <h2>Nema berbi</h2>
          <p>
            {filterStatus === 'all'
              ? 'Započnite evidenciju prve berbe'
              : `Nema berbi sa statusom "${getStatusLabel(filterStatus as HarvestStatus)}"`}
          </p>
          {canModify && filterStatus === 'all' && (
            <button className="btn btn-primary" onClick={() => handleOpenModal()}>
              Evidentiraj prvu berbu
            </button>
          )}
        </div>
      ) : (
        <div className="harvests-grid">
          {filteredHarvests.map((harvest) => (
            <div key={harvest.id} className="harvest-card">
              <div className="harvest-card-header">
                <div className="harvest-date">
                  <div className="date-icon">📅</div>
                  <div>
                    <div className="date-main">
                      {new Date(harvest.harvest_date).toLocaleDateString('sr-RS', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </div>
                    <div className="vineyard-name">{getVineyardName(harvest.vineyard_id)}</div>
                  </div>
                </div>
                <span className={getStatusBadgeClass(harvest.status)}>
                  {getStatusLabel(harvest.status)}
                </span>
              </div>

              <div className="harvest-card-body">
                {harvest.total_weight_kg && (
                  <div className="harvest-stat">
                    <span className="stat-icon">⚖️</span>
                    <span className="stat-value">{harvest.total_weight_kg} kg</span>
                  </div>
                )}
                {harvest.yield_per_hectare && (
                  <div className="harvest-stat">
                    <span className="stat-icon">📊</span>
                    <span className="stat-value">{harvest.yield_per_hectare} kg/ha</span>
                  </div>
                )}
                {harvest.weather_condition && (
                  <div className="harvest-stat">
                    <span className="stat-icon">🌤️</span>
                    <span className="stat-value">{harvest.weather_condition}</span>
                  </div>
                )}
                {harvest.temperature_celsius !== undefined && (
                  <div className="harvest-stat">
                    <span className="stat-icon">🌡️</span>
                    <span className="stat-value">{harvest.temperature_celsius}°C</span>
                  </div>
                )}
              </div>

              <div className="harvest-card-footer">
                <Link to={`/harvests/${harvest.id}`} className="btn btn-secondary btn-sm">
                  Detalji
                </Link>
                {canModify && (
                  <>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOpenModal(harvest)}
                    >
                      Izmeni
                    </button>
                    {harvest.status !== 'completed' && harvest.status !== 'cancelled' && (
                      <div className="dropdown">
                        <button className="btn btn-secondary btn-sm">Status ▼</button>
                        <div className="dropdown-menu">
                          <button onClick={() => handleStatusChange(harvest.id, HarvestStatus.Planned)}>
                            Planirano
                          </button>
                          <button onClick={() => handleStatusChange(harvest.id, HarvestStatus.InProgress)}>
                            U toku
                          </button>
                          <button onClick={() => handleStatusChange(harvest.id, HarvestStatus.Completed)}>
                            Završeno
                          </button>
                          <button onClick={() => handleStatusChange(harvest.id, HarvestStatus.Cancelled)}>
                            Otkazano
                          </button>
                        </div>
                      </div>
                    )}
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(harvest.id)}
                    >
                      Obriši
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingHarvest ? 'Izmeni berbu' : 'Nova berba'}</h2>
              <button className="btn-close" onClick={handleCloseModal}>
                ✕
              </button>
            </div>

            {error && (
              <div className="alert alert-error">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Vinograd *</label>
                    <select
                      className="form-control"
                      value={formData.vineyard_id}
                      onChange={(e) =>
                        setFormData({ ...formData, vineyard_id: e.target.value, parcel_id: '' })
                      }
                      required
                    >
                      <option value="">Odaberi vinograd</option>
                      {vineyards.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.location})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Parcela *</label>
                    <select
                      className="form-control"
                      value={formData.parcel_id}
                      onChange={(e) => setFormData({ ...formData, parcel_id: e.target.value })}
                      required
                      disabled={!formData.vineyard_id}
                    >
                      <option value="">Odaberi parcelu</option>
                      {parcels.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} - {p.grape_variety} ({p.area}m²)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Datum berbe *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.harvest_date}
                      onChange={(e) => setFormData({ ...formData, harvest_date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Ukupna težina (kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={formData.total_weight_kg}
                      onChange={(e) =>
                        setFormData({ ...formData, total_weight_kg: Number(e.target.value) })
                      }
                      min="0"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Prinos (kg/ha)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={formData.yield_per_hectare}
                      onChange={(e) =>
                        setFormData({ ...formData, yield_per_hectare: Number(e.target.value) })
                      }
                      min="0"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vremenske prilike</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.weather_condition}
                      onChange={(e) =>
                        setFormData({ ...formData, weather_condition: e.target.value })
                      }
                      placeholder="npr. Sunčano"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Temperatura (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-control"
                      value={formData.temperature_celsius}
                      onChange={(e) =>
                        setFormData({ ...formData, temperature_celsius: Number(e.target.value) })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vlažnost (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-control"
                      value={formData.humidity_percent}
                      onChange={(e) =>
                        setFormData({ ...formData, humidity_percent: Number(e.target.value) })
                      }
                      min="0"
                      max="100"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Napomene</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Dodatne napomene..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  Otkaži
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingHarvest ? 'Sačuvaj izmene' : 'Dodaj berbu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Harvests;