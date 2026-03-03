import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { harvestService } from '../services/harvestService';
import { vineyardService } from '../services/vineyardService';
import { pdfService } from '../services/pdfService';
import { useAuth } from '../context/AuthContext';
import { type Harvest, type HarvestQuality, HarvestStatus, type Vineyard, type Parcel } from '../types';
import '../styles/HarvestDetail.css';

const HarvestDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [harvest, setHarvest] = useState<Harvest | null>(null);
  const [vineyard, setVineyard] = useState<Vineyard | null>(null);
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [qualityMeasurements, setQualityMeasurements] = useState<HarvestQuality[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [error, setError] = useState('');
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  const handleDownloadPDF = async () => {
    setDownloadingPDF(true);
    try {
      await pdfService.downloadHarvestPDF(id!);
    } catch (error) {
      console.error('Failed to download PDF:', error);
    } finally {
      setDownloadingPDF(false);
    }
  };

  const [qualityFormData, setQualityFormData] = useState({
    brix: 0,
    ph: 0,
    acidity: 0,
    berry_size: '',
    berry_color: '',
    grape_health: '',
    notes: '',
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
      const harvestData = await harvestService.getHarvest(id);
      setHarvest(harvestData);

      // Load vineyard and parcel
      const [vineyardData, parcelData] = await Promise.all([
        vineyardService.getVineyard(harvestData.vineyard_id),
        vineyardService.getParcel(harvestData.vineyard_id, harvestData.parcel_id),
      ]);

      setVineyard(vineyardData);
      setParcel(parcelData);

      // Load quality measurements
      try {
        const measurements = await harvestService.getQualityMeasurements(id);
        setQualityMeasurements(measurements);
      } catch (err) {
        console.log('No quality measurements yet');
      }

      setError('');
    } catch (err: any) {
      console.error('Failed to load harvest:', err);
      setError(err.response?.data?.error || 'Failed to load harvest');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: HarvestStatus) => {
    if (!id) return;

    try {
      await harvestService.updateHarvestStatus(id, newStatus);
      loadData();
    } catch (err: any) {
      console.error('Failed to update status:', err);
      alert(err.response?.data?.error || 'Failed to update status');
    }
  };

  const handleOpenQualityModal = () => {
    setShowQualityModal(true);
    setError('');
    setQualityFormData({
      brix: 0,
      ph: 0,
      acidity: 0,
      berry_size: '',
      berry_color: '',
      grape_health: '',
      notes: '',
    });
  };

  const handleCloseQualityModal = () => {
    setShowQualityModal(false);
    setError('');
  };

  const handleQualitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setError('');

    try {
      await harvestService.addQualityMeasurement(id, qualityFormData);
      handleCloseQualityModal();
      loadData();
    } catch (err: any) {
      console.error('Failed to add quality measurement:', err);
      setError(err.response?.data?.error || 'Failed to add measurement');
    }
  };

  const handleDeleteMeasurement = async (measurementId: string) => {
    if (!id) return;

    if (window.confirm('Da li ste sigurni da želite da obrišete merenje kvaliteta?')) {
      try {
        await harvestService.deleteQualityMeasurement(id, measurementId);
        loadData();
      } catch (err: any) {
        console.error('Failed to delete measurement:', err);
        alert(err.response?.data?.error || 'Failed to delete measurement');
      }
    }
  };

  const handleDeleteHarvest = async () => {
    if (!id || !harvest) return;

    if (window.confirm('Da li ste sigurni da želite da obrišete ovu berbu?')) {
      try {
        await harvestService.deleteHarvest(id);
        navigate('/harvests');
      } catch (err: any) {
        console.error('Failed to delete harvest:', err);
        alert(err.response?.data?.error || 'Failed to delete harvest');
      }
    }
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

  const getStatusClass = (status: HarvestStatus) => {
    const statusMap: Record<HarvestStatus, string> = {
      planned: 'warning',
      in_progress: 'primary',
      completed: 'success',
      cancelled: 'danger',
    };
    return `badge badge-${statusMap[status]}`;
  };

  const canModify = user?.role === 'admin' || user?.role === 'winemaker';
  const canAddMeasurement = user?.role === 'admin' || user?.role === 'winemaker' || user?.role === 'worker';

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Učitavanje...</p>
      </div>
    );
  }

  if (error && !harvest) {
    return (
      <div className="error-page">
        <h2>Greška</h2>
        <p>{error}</p>
        <Link to="/harvests" className="btn btn-primary">
          Nazad na berbe
        </Link>
      </div>
    );
  }

  if (!harvest) {
    return (
      <div className="error-page">
        <h2>Berba nije pronađena</h2>
        <Link to="/harvests" className="btn btn-primary">
          Nazad na berbe
        </Link>
      </div>
    );
  }

  return (
    <div className="harvest-detail-page">
      {/* Header */}
      <div className="detail-header">
        <div className="header-left">
          <Link to="/harvests" className="back-link">
            ← Nazad na berbe
          </Link>
          <h1 className="page-title">
            Berba {new Date(harvest.harvest_date).toLocaleDateString('sr-RS')}
          </h1>
          <div className="harvest-meta">
            {vineyard && (
              <span className="meta-item">
                <span className="meta-icon">🍇</span>
                <Link to={`/vineyards/${vineyard.id}`}>{vineyard.name}</Link>
              </span>
            )}
            {parcel && (
              <span className="meta-item">
                <span className="meta-icon">📦</span>
                {parcel.name} ({parcel.grape_variety})
              </span>
            )}
            <span className="meta-item">
              <span className={getStatusClass(harvest.status)}>
                {getStatusLabel(harvest.status)}
              </span>
            </span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleDownloadPDF} disabled={downloadingPDF}>
          {downloadingPDF ? 'Preuzimanje...' : 'Preuzmi PDF izveštaj'}
        </button>
        <div className="header-actions">
          {canModify && harvest.status !== 'completed' && harvest.status !== 'cancelled' && (
            <div className="status-dropdown">
              <button className="btn btn-secondary">Promeni status ▼</button>
              <div className="dropdown-menu">
                <button onClick={() => handleStatusChange(HarvestStatus.Planned)}>Planirano</button>
                <button onClick={() => handleStatusChange(HarvestStatus.InProgress)}>U toku</button>
                <button onClick={() => handleStatusChange(HarvestStatus.Completed)}>Završeno</button>
                <button onClick={() => handleStatusChange(HarvestStatus.Cancelled)}>Otkazano</button>
              </div>
            </div>
          )}
          {canModify && (
            <button className="btn btn-danger" onClick={handleDeleteHarvest}>
              Obriši berbu
            </button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="info-grid">
        <div className="info-card">
          <div className="info-card-header">
            <span className="info-icon">📅</span>
            <h3>Osnovni podaci</h3>
          </div>
          <div className="info-card-body">
            <div className="info-row">
              <span className="info-label">Datum berbe:</span>
              <span className="info-value">
                {new Date(harvest.harvest_date).toLocaleDateString('sr-RS', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
            {harvest.total_weight_kg && (
              <div className="info-row">
                <span className="info-label">Ukupna težina:</span>
                <span className="info-value">{harvest.total_weight_kg} kg</span>
              </div>
            )}
            {harvest.yield_per_hectare && (
              <div className="info-row">
                <span className="info-label">Prinos:</span>
                <span className="info-value">{harvest.yield_per_hectare} kg/ha</span>
              </div>
            )}
            {parcel && (
              <div className="info-row">
                <span className="info-label">Površina parcele:</span>
                <span className="info-value">{parcel.area} m²</span>
              </div>
            )}
          </div>
        </div>

        <div className="info-card">
          <div className="info-card-header">
            <span className="info-icon">🌤️</span>
            <h3>Vremenski uslovi</h3>
          </div>
          <div className="info-card-body">
            {harvest.weather_condition ? (
              <>
                <div className="info-row">
                  <span className="info-label">Vreme:</span>
                  <span className="info-value">{harvest.weather_condition}</span>
                </div>
                {harvest.temperature_celsius !== undefined && (
                  <div className="info-row">
                    <span className="info-label">Temperatura:</span>
                    <span className="info-value">{harvest.temperature_celsius}°C</span>
                  </div>
                )}
                {harvest.humidity_percent !== undefined && (
                  <div className="info-row">
                    <span className="info-label">Vlažnost:</span>
                    <span className="info-value">{harvest.humidity_percent}%</span>
                  </div>
                )}
              </>
            ) : (
              <p className="no-data">Nema podataka o vremenskim uslovima</p>
            )}
          </div>
        </div>

        {harvest.notes && (
          <div className="info-card full-width">
            <div className="info-card-header">
              <span className="info-icon">📝</span>
              <h3>Napomene</h3>
            </div>
            <div className="info-card-body">
              <p>{harvest.notes}</p>
            </div>
          </div>
        )}
      </div>

      {/* Quality Measurements */}
      <div className="quality-section">
        <div className="section-header">
          <h2>Merenja kvaliteta ({qualityMeasurements.length})</h2>
          {canAddMeasurement && (
            <button className="btn btn-primary" onClick={handleOpenQualityModal}>
              + Dodaj merenje
            </button>
          )}
        </div>

        {qualityMeasurements.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h3>Nema merenja kvaliteta</h3>
            <p>Dodajte prvo merenje kako bi pratili kvalitet grožđa</p>
            {canAddMeasurement && (
              <button className="btn btn-primary" onClick={handleOpenQualityModal}>
                Dodaj merenje
              </button>
            )}
          </div>
        ) : (
          <div className="measurements-grid">
            {qualityMeasurements.map((measurement) => (
              <div key={measurement.id} className="measurement-card">
                <div className="measurement-header">
                  <span className="measurement-date">
                    {new Date(measurement.measured_at).toLocaleDateString('sr-RS', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {canModify && (
                    <button
                      className="btn-icon btn-danger"
                      onClick={() => handleDeleteMeasurement(measurement.id)}
                      title="Obriši"
                    >
                      🗑️
                    </button>
                  )}
                </div>
                <div className="measurement-body">
                  {measurement.brix !== undefined && measurement.brix > 0 && (
                    <div className="measurement-item">
                      <span className="measurement-label">Brix:</span>
                      <span className="measurement-value">{measurement.brix}°</span>
                    </div>
                  )}
                  {measurement.ph !== undefined && measurement.ph > 0 && (
                    <div className="measurement-item">
                      <span className="measurement-label">pH:</span>
                      <span className="measurement-value">{measurement.ph}</span>
                    </div>
                  )}
                  {measurement.acidity !== undefined && measurement.acidity > 0 && (
                    <div className="measurement-item">
                      <span className="measurement-label">Kiselost:</span>
                      <span className="measurement-value">{measurement.acidity} g/L</span>
                    </div>
                  )}
                  {measurement.berry_size && (
                    <div className="measurement-item">
                      <span className="measurement-label">Veličina bobice:</span>
                      <span className="measurement-value">{measurement.berry_size}</span>
                    </div>
                  )}
                  {measurement.berry_color && (
                    <div className="measurement-item">
                      <span className="measurement-label">Boja:</span>
                      <span className="measurement-value">{measurement.berry_color}</span>
                    </div>
                  )}
                  {measurement.grape_health && (
                    <div className="measurement-item">
                      <span className="measurement-label">Zdravlje:</span>
                      <span className="measurement-value">{measurement.grape_health}</span>
                    </div>
                  )}
                  {measurement.notes && (
                    <div className="measurement-notes">
                      <p>{measurement.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quality Modal */}
      {showQualityModal && (
        <div className="modal-overlay" onClick={handleCloseQualityModal}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Dodaj merenje kvaliteta</h2>
              <button className="btn-close" onClick={handleCloseQualityModal}>
                ✕
              </button>
            </div>

            {error && (
              <div className="alert alert-error">
                {error}
              </div>
            )}

            <form onSubmit={handleQualitySubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Brix (°)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-control"
                      value={qualityFormData.brix}
                      onChange={(e) =>
                        setQualityFormData({ ...qualityFormData, brix: Number(e.target.value) })
                      }
                      min="0"
                      max="50"
                      placeholder="npr. 22.5"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">pH</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={qualityFormData.ph}
                      onChange={(e) =>
                        setQualityFormData({ ...qualityFormData, ph: Number(e.target.value) })
                      }
                      min="0"
                      max="14"
                      placeholder="npr. 3.45"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Kiselost (g/L)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-control"
                      value={qualityFormData.acidity}
                      onChange={(e) =>
                        setQualityFormData({ ...qualityFormData, acidity: Number(e.target.value) })
                      }
                      min="0"
                      placeholder="npr. 6.5"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Veličina bobice</label>
                    <input
                      type="text"
                      className="form-control"
                      value={qualityFormData.berry_size}
                      onChange={(e) =>
                        setQualityFormData({ ...qualityFormData, berry_size: e.target.value })
                      }
                      placeholder="npr. Srednja"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Boja bobice</label>
                    <input
                      type="text"
                      className="form-control"
                      value={qualityFormData.berry_color}
                      onChange={(e) =>
                        setQualityFormData({ ...qualityFormData, berry_color: e.target.value })
                      }
                      placeholder="npr. Tamno crvena"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Zdravlje grožđa</label>
                    <input
                      type="text"
                      className="form-control"
                      value={qualityFormData.grape_health}
                      onChange={(e) =>
                        setQualityFormData({ ...qualityFormData, grape_health: e.target.value })
                      }
                      placeholder="npr. Odlično"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Napomene</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={qualityFormData.notes}
                    onChange={(e) =>
                      setQualityFormData({ ...qualityFormData, notes: e.target.value })
                    }
                    placeholder="Dodatne napomene o merenju..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseQualityModal}>
                  Otkaži
                </button>
                <button type="submit" className="btn btn-primary">
                  Dodaj merenje
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HarvestDetail;