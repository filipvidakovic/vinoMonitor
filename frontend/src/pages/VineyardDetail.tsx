import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { vineyardService } from '../services/vineyardService';
import { harvestService } from '../services/harvestService';
import { useAuth } from '../context/AuthContext';
import type { Vineyard, Parcel, CreateParcelRequest, Harvest, VineyardStats } from '../types';
import '../styles/VineyardDetail.css';
import MapPicker from '../components/MapPicker';
import { MapContainer } from 'react-leaflet/MapContainer';
import { Marker } from 'react-leaflet/Marker';
import { Popup } from 'react-leaflet/Popup';
import { TileLayer } from 'react-leaflet/TileLayer';

const VineyardDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [vineyard, setVineyard] = useState<Vineyard | null>(null);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [stats, setStats] = useState<VineyardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showParcelModal, setShowParcelModal] = useState(false);
  const [editingParcel, setEditingParcel] = useState<Parcel | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'parcels' | 'harvests' | 'stats'>('parcels');

  const [parcelFormData, setParcelFormData] = useState<CreateParcelRequest>({
    name: '',
    area: 0,
    grape_variety: '',
    planting_year: new Date().getFullYear(),
    soil_type: '',
    latitude: undefined,
    longitude: undefined,
  });

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const [vineyardData, parcelsData] = await Promise.all([
        vineyardService.getVineyard(id),
        vineyardService.getParcels(id),
      ]);

      setVineyard(vineyardData);
      setParcels(parcelsData);

      // Load harvests and stats
      try {
        const [harvestsData, statsData] = await Promise.all([
          harvestService.getHarvestsByVineyard(id),
          harvestService.getVineyardStats(id),
        ]);
        setHarvests(harvestsData);
        setStats(statsData);
      } catch (err) {
        console.log('Harvests or stats not available');
      }

      setError('');
    } catch (err: any) {
      console.error('Failed to load vineyard:', err);
      setError(err.response?.data?.error || 'Failed to load vineyard');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenParcelModal = (parcel?: Parcel) => {
    if (parcel) {
      setEditingParcel(parcel);
      setParcelFormData({
        name: parcel.name,
        area: parcel.area,
        grape_variety: parcel.grape_variety,
        planting_year: parcel.planting_year,
        soil_type: parcel.soil_type || '',
        latitude: parcel.latitude,
        longitude: parcel.longitude,
      });
    } else {
      setEditingParcel(null);
      setParcelFormData({
        name: '',
        area: 0,
        grape_variety: '',
        planting_year: new Date().getFullYear(),
        soil_type: '',
        latitude: undefined,
        longitude: undefined,
      });
    }
    setShowParcelModal(true);
    setError('');
  };

  const handleCloseParcelModal = () => {
    setShowParcelModal(false);
    setEditingParcel(null);
    setError('');
  };

  const handleParcelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setError('');

    try {
      if (editingParcel) {
        await vineyardService.updateParcel(id, editingParcel.id, parcelFormData);
      } else {
        await vineyardService.createParcel(id, parcelFormData);
      }
      handleCloseParcelModal();
      loadData();
    } catch (err: any) {
      console.error('Failed to save parcel:', err);
      setError(err.response?.data?.error || 'Failed to save parcel');
    }
  };

  const handleDeleteParcel = async (parcelId: string, parcelName: string) => {
    if (!id) return;

    if (window.confirm(`Da li ste sigurni da želite da obrišete parcelu "${parcelName}"?`)) {
      try {
        await vineyardService.deleteParcel(id, parcelId);
        loadData();
      } catch (err: any) {
        console.error('Failed to delete parcel:', err);
        alert(err.response?.data?.error || 'Failed to delete parcel');
      }
    }
  };

  const handleDeleteVineyard = async () => {
    if (!id || !vineyard) return;

    if (
      window.confirm(
        `Da li ste sigurni da želite da obrišete vinograd "${vineyard.name}"? Ovo će obrisati i sve parcele!`
      )
    ) {
      try {
        await vineyardService.deleteVineyard(id);
        navigate('/vineyards');
      } catch (err: any) {
        console.error('Failed to delete vineyard:', err);
        alert(err.response?.data?.error || 'Failed to delete vineyard');
      }
    }
  };

  const canModify = user?.role === 'admin' || user?.role === 'winemaker';

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Učitavanje...</p>
      </div>
    );
  }

  if (error && !vineyard) {
    return (
      <div className="error-page">
        <h2>Greška</h2>
        <p>{error}</p>
        <Link to="/vineyards" className="btn btn-primary">
          Nazad na vinograde
        </Link>
      </div>
    );
  }

  if (!vineyard) {
    return (
      <div className="error-page">
        <h2>Vinograd nije pronađen</h2>
        <Link to="/vineyards" className="btn btn-primary">
          Nazad na vinograde
        </Link>
      </div>
    );
  }

  return (
    <div className="vineyard-detail-page">
      {/* Header */}
      <div className="detail-header">
        <div className="header-left">
          <Link to="/vineyards" className="back-link">
            ← Nazad na vinograde
          </Link>
          <h1 className="page-title">{vineyard.name}</h1>
          <div className="vineyard-meta">
            <span className="meta-item">
              <span className="meta-icon">📍</span>
              {vineyard.location}
            </span>
            <span className="meta-item">
              <span className="meta-icon">📏</span>
              {vineyard.total_area} ha
            </span>
            <span className="meta-item">
              <span className="meta-icon">🗓️</span>
              Kreirano {new Date(vineyard.created_at).toLocaleDateString('sr-RS')}
            </span>
          </div>
        </div>
        <div className="header-actions">
          {canModify && (
            <>
              <button className="btn btn-secondary" onClick={() => navigate(`/vineyards`)}>
                Izmeni vinograd
              </button>
              <button className="btn btn-danger" onClick={handleDeleteVineyard}>
                Obriši vinograd
              </button>
            </>
          )}
        </div>
      </div>

      {vineyard.description && (
        <div className="vineyard-description-card">
          <p>{vineyard.description}</p>
        </div>
      )}

      {parcels.length > 0 && (
        <div className="vineyard-map-card">
            <h2>Mapa parcela</h2>

            <MapContainer
            center={[
                parcels.find(p => p.latitude && p.longitude)?.latitude || 44.8176,
                parcels.find(p => p.latitude && p.longitude)?.longitude || 20.4633
            ]}
            zoom={15}
            style={{ height: '400px', width: '100%', borderRadius: '12px' }}
            >
            <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {parcels
                .filter(p => p.latitude && p.longitude)
                .map(parcel => (
                <Marker
                    key={parcel.id}
                    position={[parcel.latitude!, parcel.longitude!]}
                >
                    <Popup>
                    <strong>{parcel.name}</strong>
                    <br />
                    🍇 {parcel.grape_variety}
                    <br />
                    📏 {parcel.area} m²
                    {parcel.planting_year && (
                        <>
                        <br />
                        📅 {parcel.planting_year}
                        </>
                    )}
                    </Popup>
                </Marker>
                ))}
            </MapContainer>
        </div>
        )}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <div className="stat-value">{parcels.length}</div>
            <div className="stat-label">Parcela</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🌾</div>
          <div className="stat-content">
            <div className="stat-value">{harvests.length}</div>
            <div className="stat-label">Berbi</div>
          </div>
        </div>
        {stats && (
          <>
            <div className="stat-card">
              <div className="stat-icon">⚖️</div>
              <div className="stat-content">
                <div className="stat-value">{stats.total_weight_kg?.toFixed(0) || 0} kg</div>
                <div className="stat-label">Ukupna težina</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-content">
                <div className="stat-value">{stats.avg_yield_per_hectare?.toFixed(1) || 0} kg/ha</div>
                <div className="stat-label">Prosečan prinos</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'parcels' ? 'active' : ''}`}
          onClick={() => setActiveTab('parcels')}
        >
          Parcele ({parcels.length})
        </button>
        <button
          className={`tab ${activeTab === 'harvests' ? 'active' : ''}`}
          onClick={() => setActiveTab('harvests')}
        >
          Berbe ({harvests.length})
        </button>
        {stats && (
          <button
            className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            Statistika
          </button>
        )}
      </div>

      {/* Parcels Tab */}
      {activeTab === 'parcels' && (
        <div className="tab-content">
          <div className="tab-header">
            <h2>Parcele</h2>
            {canModify && (
              <button className="btn btn-primary" onClick={() => handleOpenParcelModal()}>
                + Dodaj Parcelu
              </button>
            )}
          </div>

          {parcels.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <h3>Nema parcela</h3>
              <p>Dodajte prvu parcelu ovom vinogradu</p>
              {canModify && (
                <button className="btn btn-primary" onClick={() => handleOpenParcelModal()}>
                  Dodaj parcelu
                </button>
              )}
            </div>
          ) : (
            <div className="parcels-grid">
              {parcels.map((parcel) => (
                <div key={parcel.id} className="parcel-card">
                  <div className="parcel-header">
                    <h3>{parcel.name}</h3>
                    {canModify && (
                      <div className="parcel-actions">
                        <button
                          className="btn-icon"
                          onClick={() => handleOpenParcelModal(parcel)}
                          title="Izmeni"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn-icon btn-danger"
                          onClick={() => handleDeleteParcel(parcel.id, parcel.name)}
                          title="Obriši"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="parcel-body">
                    <div className="parcel-info">
                      <span className="info-icon">🍇</span>
                      <span>{parcel.grape_variety}</span>
                    </div>
                    <div className="parcel-info">
                      <span className="info-icon">📏</span>
                      <span>{parcel.area} m²</span>
                    </div>
                    {parcel.planting_year && (
                      <div className="parcel-info">
                        <span className="info-icon">📅</span>
                        <span>Posađeno {parcel.planting_year}</span>
                      </div>
                    )}
                    {parcel.soil_type && (
                      <div className="parcel-info">
                        <span className="info-icon">🌱</span>
                        <span>{parcel.soil_type}</span>
                      </div>
                    )}
                    {parcel.latitude && parcel.longitude && (
                      <div className="parcel-info">
                        <span className="info-icon">🗺️</span>
                        <span>
                          {parcel.latitude.toFixed(4)}, {parcel.longitude.toFixed(4)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Harvests Tab */}
      {activeTab === 'harvests' && (
        <div className="tab-content">
          <div className="tab-header">
            <h2>Berbe</h2>
            <Link to="/harvests" className="btn btn-primary">
              + Nova Berba
            </Link>
          </div>

          {harvests.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🌾</div>
              <h3>Nema berbi</h3>
              <p>Evidentirajte prvu berbu za ovaj vinograd</p>
              <Link to="/harvests" className="btn btn-primary">
                Nova berba
              </Link>
            </div>
          ) : (
            <div className="harvests-list">
              {harvests.map((harvest) => (
                <Link key={harvest.id} to={`/harvests/${harvest.id}`} className="harvest-item">
                  <div className="harvest-date">
                    <div className="date-day">
                      {new Date(harvest.harvest_date).getDate()}
                    </div>
                    <div className="date-month">
                      {new Date(harvest.harvest_date).toLocaleDateString('sr-RS', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                  <div className="harvest-info">
                    <div className="harvest-title">
                      Berba {new Date(harvest.harvest_date).toLocaleDateString('sr-RS')}
                    </div>
                    <div className="harvest-details">
                      {harvest.total_weight_kg && `${harvest.total_weight_kg} kg`}
                      {harvest.weather_condition && ` • ${harvest.weather_condition}`}
                    </div>
                  </div>
                  <div className="harvest-status">
                    <span className={`badge badge-${harvest.status}`}>{harvest.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && stats && (
        <div className="tab-content">
          <h2>Statistika</h2>
          <div className="stats-details">
            <div className="stats-row">
              <div className="stats-item">
                <div className="stats-label">Ukupno berbi</div>
                <div className="stats-value">{stats.total_harvests}</div>
              </div>
              <div className="stats-item">
                <div className="stats-label">Ukupna težina</div>
                <div className="stats-value">{stats.total_weight_kg?.toFixed(0) || 0} kg</div>
              </div>
            </div>
            <div className="stats-row">
              <div className="stats-item">
                <div className="stats-label">Prosečan prinos</div>
                <div className="stats-value">{stats.avg_yield_per_hectare?.toFixed(1) || 0} kg/ha</div>
              </div>
              <div className="stats-item">
                <div className="stats-label">Prosečan Brix</div>
                <div className="stats-value">{stats.avg_brix?.toFixed(1) || 'N/A'}</div>
              </div>
            </div>
            <div className="stats-row">
              <div className="stats-item">
                <div className="stats-label">Prosečan pH</div>
                <div className="stats-value">{stats.avg_ph?.toFixed(2) || 'N/A'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Parcel Modal */}
      {showParcelModal && (
        <div className="modal-overlay" onClick={handleCloseParcelModal}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingParcel ? 'Izmeni parcelu' : 'Dodaj novu parcelu'}</h2>
              <button className="btn-close" onClick={handleCloseParcelModal}>
                ✕
              </button>
            </div>

            {error && (
              <div className="alert alert-error">
                {error}
              </div>
            )}

            <form onSubmit={handleParcelSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Naziv parcele *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={parcelFormData.name}
                    onChange={(e) => setParcelFormData({ ...parcelFormData, name: e.target.value })}
                    required
                    placeholder="npr. Parcela 1"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Površina (m²) *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={parcelFormData.area}
                      onChange={(e) =>
                        setParcelFormData({ ...parcelFormData, area: Number(e.target.value) })
                      }
                      required
                      min="0"
                      placeholder="npr. 5000"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Sorta grožđa *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={parcelFormData.grape_variety}
                      onChange={(e) =>
                        setParcelFormData({ ...parcelFormData, grape_variety: e.target.value })
                      }
                      required
                      placeholder="npr. Cabernet Sauvignon"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Godina sadnje</label>
                    <input
                      type="number"
                      className="form-control"
                      value={parcelFormData.planting_year}
                      onChange={(e) =>
                        setParcelFormData({ ...parcelFormData, planting_year: Number(e.target.value) })
                      }
                      min="1900"
                      max={new Date().getFullYear()}
                      placeholder="npr. 2020"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Tip zemljišta</label>
                    <input
                      type="text"
                      className="form-control"
                      value={parcelFormData.soil_type}
                      onChange={(e) =>
                        setParcelFormData({ ...parcelFormData, soil_type: e.target.value })
                      }
                      placeholder="npr. Ilovača"
                    />
                  </div>
                </div>

                    <div className="form-group">
                    <label className="form-label">Izaberi lokaciju na mapi</label>

                    <MapPicker
                        latitude={parcelFormData.latitude}
                        longitude={parcelFormData.longitude}
                        onChange={(lat, lng) =>
                        setParcelFormData({
                            ...parcelFormData,
                            latitude: lat,
                            longitude: lng,
                        })
                        }
                    />

                    {parcelFormData.latitude && parcelFormData.longitude && (
                        <p style={{ marginTop: '10px' }}>
                        📍 {parcelFormData.latitude.toFixed(6)} ,
                        {parcelFormData.longitude.toFixed(6)}
                        </p>
                    )}
                    </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseParcelModal}>
                  Otkaži
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingParcel ? 'Sačuvaj izmene' : 'Dodaj parcelu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VineyardDetail;