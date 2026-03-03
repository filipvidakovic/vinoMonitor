import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fermentationService } from '../services/fermentationService';
import { useAuth } from '../context/AuthContext';
import type { FermentationBatch, FermentationReading, Tank, BatchStats } from '../types';
import '../styles/FermentationDetail.css';

const FermentationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [batch, setBatch] = useState<FermentationBatch | null>(null);
  const [tank, setTank] = useState<Tank | null>(null);
  const [readings, setReadings] = useState<FermentationReading[]>([]);
  const [stats, setStats] = useState<BatchStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReadingModal, setShowReadingModal] = useState(false);
  const [error, setError] = useState('');

  const [readingFormData, setReadingFormData] = useState({
    temperature: 0,
    brix: 0,
    ph: 0,
    density: 0,
    alcohol_percent: 0,
    volatile_acidity: 0,
    free_so2: 0,
    total_so2: 0,
    color: '',
    clarity: '',
    aroma_notes: '',
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
      const batchData = await fermentationService.getBatch(id);
      setBatch(batchData);

      // Load tank
      const tankData = await fermentationService.getTank(batchData.tank_id);
      setTank(tankData);

      // Load readings and stats
      const [readingsData, statsData] = await Promise.all([
        fermentationService.getReadings(id, 50),
        fermentationService.getBatchStats(id),
      ]);
      console.log('Readings:', readingsData);
      console.log('Stats:', statsData);

      setReadings(readingsData);
      setStats(statsData);
      setError('');
    } catch (err: any) {
      console.error('Failed to load batch:', err);
      setError(err.response?.data?.error || 'Failed to load batch');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReadingModal = () => {
    setShowReadingModal(true);
    setError('');
    setReadingFormData({
      temperature: batch?.target_temperature || 18,
      brix: 0,
      ph: 0,
      density: 0,
      alcohol_percent: 0,
      volatile_acidity: 0,
      free_so2: 0,
      total_so2: 0,
      color: '',
      clarity: '',
      aroma_notes: '',
      notes: '',
    });
  };

  const handleCloseReadingModal = () => {
    setShowReadingModal(false);
    setError('');
  };

  const handleReadingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setError('');

    try {
      await fermentationService.addReading(id, readingFormData);
      handleCloseReadingModal();
      loadData();
    } catch (err: any) {
      console.error('Failed to add reading:', err);
      setError(err.response?.data?.error || 'Failed to add reading');
    }
  };

  const handleDeleteReading = async (readingId: string) => {
    if (!id) return;

    if (window.confirm('Da li ste sigurni da želite da obrišete ovo merenje?')) {
      try {
        await fermentationService.deleteReading(id, readingId);
        loadData();
      } catch (err: any) {
        console.error('Failed to delete reading:', err);
        alert(err.response?.data?.error || 'Failed to delete reading');
      }
    }
  };

  const handleDeleteBatch = async () => {
    if (!id || !batch) return;

    if (
      window.confirm(
        `Da li ste sigurni da želite da obrišete batch "${batch.name}"? Tank će postati dostupan.`
      )
    ) {
      try {
        await fermentationService.deleteBatch(id);
        navigate('/fermentation');
      } catch (err: any) {
        console.error('Failed to delete batch:', err);
        alert(err.response?.data?.error || 'Failed to delete batch');
      }
    }
  };

  const getStatusClass = (status: string) => {
    const statusMap: Record<string, string> = {
      active: 'success',
      completed: 'info',
      paused: 'warning',
      cancelled: 'danger',
    };
    return `badge badge-${statusMap[status] || 'secondary'}`;
  };

  const canModify = user?.role === 'admin' || user?.role === 'winemaker';
  const canAddReading = user?.role === 'admin' || user?.role === 'winemaker' || user?.role === 'worker';

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Učitavanje...</p>
      </div>
    );
  }

  if (error && !batch) {
    return (
      <div className="error-page">
        <h2>Greška</h2>
        <p>{error}</p>
        <Link to="/fermentation" className="btn btn-primary">
          Nazad na fermentaciju
        </Link>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="error-page">
        <h2>Batch nije pronađen</h2>
        <Link to="/fermentation" className="btn btn-primary">
          Nazad na fermentaciju
        </Link>
      </div>
    );
  }

  return (
    <div className="fermentation-detail-page">
      {/* Header */}
      <div className="detail-header">
        <div className="header-left">
          <Link to="/fermentation" className="back-link">
            ← Nazad na fermentaciju
          </Link>
          <h1 className="page-title">{batch.name}</h1>
          <div className="batch-meta">
            <span className="meta-item">
              <span className="meta-icon">🍇</span>
              {batch.grape_variety}
            </span>
            {tank && (
              <span className="meta-item">
                <span className="meta-icon">🛢️</span>
                {tank.name}
              </span>
            )}
            <span className="meta-item">
              <span className="meta-icon">📏</span>
              {batch.volume_liters}L
            </span>
            <span className="meta-item">
              <span className={getStatusClass(batch.status)}>{batch.status}</span>
            </span>
          </div>
        </div>
        <div className="header-actions">
          {canModify && (
            <button className="btn btn-danger" onClick={handleDeleteBatch}>
              Obriši batch
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <div className="stat-value">{stats.total_readings}</div>
              <div className="stat-label">Merenja</div>
            </div>
          </div>
          {stats.avg_temperature !== undefined && (
            <div className="stat-card">
              <div className="stat-icon">🌡️</div>
              <div className="stat-content">
                <div className="stat-value">{stats.avg_temperature?.toFixed(1)}°C</div>
                <div className="stat-label">Prosečna temperatura</div>
                <div className="stat-detail">
                  Min: {stats.min_temperature?.toFixed(1)}°C | Max: {stats.max_temperature?.toFixed(1)}°C
                </div>
              </div>
            </div>
          )}
          {stats.latest_brix !== undefined && stats.latest_brix > 0 && (
            <div className="stat-card">
              <div className="stat-icon">🍯</div>
              <div className="stat-content">
                <div className="stat-value">{stats.latest_brix.toFixed(1)}°</div>
                <div className="stat-label">Trenutni Brix</div>
              </div>
            </div>
          )}
          {stats.latest_alcohol !== undefined && stats.latest_alcohol > 0 && (
            <div className="stat-card">
              <div className="stat-icon">🍷</div>
              <div className="stat-content">
                <div className="stat-value">{stats.latest_alcohol.toFixed(1)}%</div>
                <div className="stat-label">Alkohol</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Cards */}
      <div className="info-grid">
        <div className="info-card">
          <div className="info-card-header">
            <span className="info-icon">⚗️</span>
            <h3>Parametri fermentacije</h3>
          </div>
          <div className="info-card-body">
            {batch.target_temperature && (
              <div className="info-row">
                <span className="info-label">Ciljna temperatura:</span>
                <span className="info-value">{batch.target_temperature}°C</span>
              </div>
            )}
            {batch.yeast_strain && (
              <div className="info-row">
                <span className="info-label">Kvasac:</span>
                <span className="info-value">{batch.yeast_strain}</span>
              </div>
            )}
            {batch.initial_brix !== undefined && batch.initial_brix > 0 && (
              <div className="info-row">
                <span className="info-label">Početni Brix:</span>
                <span className="info-value">{batch.initial_brix}°</span>
              </div>
            )}
            {batch.initial_ph !== undefined && batch.initial_ph > 0 && (
              <div className="info-row">
                <span className="info-label">Početni pH:</span>
                <span className="info-value">{batch.initial_ph}</span>
              </div>
            )}
          </div>
        </div>

        <div className="info-card">
          <div className="info-card-header">
            <span className="info-icon">📅</span>
            <h3>Vremenski okvir</h3>
          </div>
          <div className="info-card-body">
            {batch.start_date && (
              <div className="info-row">
                <span className="info-label">Početak:</span>
                <span className="info-value">
                  {new Date(batch.start_date).toLocaleDateString('sr-RS')}
                </span>
              </div>
            )}
            {batch.expected_end_date && (
              <div className="info-row">
                <span className="info-label">Očekivan završetak:</span>
                <span className="info-value">
                  {new Date(batch.expected_end_date).toLocaleDateString('sr-RS')}
                </span>
              </div>
            )}
            {batch.end_date && (
              <div className="info-row">
                <span className="info-label">Završeno:</span>
                <span className="info-value">
                  {new Date(batch.end_date).toLocaleDateString('sr-RS')}
                </span>
              </div>
            )}
          </div>
        </div>

        {batch.notes && (
          <div className="info-card full-width">
            <div className="info-card-header">
              <span className="info-icon">📝</span>
              <h3>Napomene</h3>
            </div>
            <div className="info-card-body">
              <p>{batch.notes}</p>
            </div>
          </div>
        )}
      </div>

      {/* Readings */}
      <div className="readings-section">
        <div className="section-header">
          <h2>Merenja ({readings.length})</h2>
          {canAddReading && batch.status === 'active' && (
            <button className="btn btn-primary" onClick={handleOpenReadingModal}>
              + Dodaj merenje
            </button>
          )}
        </div>

        {readings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h3>Nema merenja</h3>
            <p>Dodajte prvo merenje kako bi pratili proces fermentacije</p>
            {canAddReading && batch.status === 'active' && (
              <button className="btn btn-primary" onClick={handleOpenReadingModal}>
                Dodaj merenje
              </button>
            )}
          </div>
        ) : (
          <div className="readings-timeline">
            {readings.map((reading, index) => (
              <div key={reading.id} className="reading-item">
                <div className="reading-date">
                  <div className="date-marker"></div>
                  <span className="date-text">
                    {new Date(reading.recorded_at).toLocaleDateString('sr-RS', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className={`reading-source badge badge-${reading.source === 'iot' ? 'primary' : 'secondary'}`}>
                    {reading.source === 'iot' ? 'IoT' : 'Manual'}
                  </span>
                </div>
                <div className="reading-card">
                  <div className="reading-header">
                    <div className="reading-values">
                      {reading.temperature !== undefined && (
                        <div className="value-chip temp">
                          <span className="chip-icon">🌡️</span>
                          <span className="chip-value">{reading.temperature.toFixed(1)}°C</span>
                        </div>
                      )}
                      {reading.brix !== undefined && reading.brix > 0 && (
                        <div className="value-chip">
                          <span className="chip-icon">🍯</span>
                          <span className="chip-value">{reading.brix.toFixed(1)}°</span>
                        </div>
                      )}
                      {reading.ph !== undefined && reading.ph > 0 && (
                        <div className="value-chip">
                          <span className="chip-icon">⚗️</span>
                          <span className="chip-value">pH {reading.ph.toFixed(2)}</span>
                        </div>
                      )}
                      {reading.alcohol_percent !== undefined && reading.alcohol_percent > 0 && (
                        <div className="value-chip">
                          <span className="chip-icon">🍷</span>
                          <span className="chip-value">{reading.alcohol_percent.toFixed(1)}%</span>
                        </div>
                      )}
                    </div>
                    {canModify && (
                      <button
                        className="btn-icon btn-danger"
                        onClick={() => handleDeleteReading(reading.id)}
                        title="Obriši"
                      >
                        🗑️
                      </button>
                    )}
                  </div>

                  {(reading.density ||
                    reading.volatile_acidity ||
                    reading.free_so2 ||
                    reading.total_so2 ||
                    reading.color ||
                    reading.clarity ||
                    reading.aroma_notes ||
                    reading.notes) && (
                    <div className="reading-details">
                      {reading.density !== undefined && reading.density > 0 && (
                        <div className="detail-item">
                          <span className="detail-label">Gustina:</span>
                          <span>{reading.density.toFixed(3)} g/mL</span>
                        </div>
                      )}
                      {reading.volatile_acidity !== undefined && reading.volatile_acidity > 0 && (
                        <div className="detail-item">
                          <span className="detail-label">Isparljiva kiselost:</span>
                          <span>{reading.volatile_acidity.toFixed(2)} g/L</span>
                        </div>
                      )}
                      {reading.free_so2 !== undefined && reading.free_so2 > 0 && (
                        <div className="detail-item">
                          <span className="detail-label">Slobodni SO₂:</span>
                          <span>{reading.free_so2} mg/L</span>
                        </div>
                      )}
                      {reading.total_so2 !== undefined && reading.total_so2 > 0 && (
                        <div className="detail-item">
                          <span className="detail-label">Ukupni SO₂:</span>
                          <span>{reading.total_so2} mg/L</span>
                        </div>
                      )}
                      {reading.color && (
                        <div className="detail-item">
                          <span className="detail-label">Boja:</span>
                          <span>{reading.color}</span>
                        </div>
                      )}
                      {reading.clarity && (
                        <div className="detail-item">
                          <span className="detail-label">Bistrina:</span>
                          <span>{reading.clarity}</span>
                        </div>
                      )}
                      {reading.aroma_notes && (
                        <div className="detail-item">
                          <span className="detail-label">Aroma:</span>
                          <span>{reading.aroma_notes}</span>
                        </div>
                      )}
                      {reading.notes && (
                        <div className="reading-notes">
                          <p>{reading.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reading Modal */}
      {showReadingModal && (
        <div className="modal-overlay" onClick={handleCloseReadingModal}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Dodaj merenje</h2>
              <button className="btn-close" onClick={handleCloseReadingModal}>
                ✕
              </button>
            </div>

            {error && (
              <div className="alert alert-error">
                {error}
              </div>
            )}

            <form onSubmit={handleReadingSubmit}>
              <div className="modal-body">
                <h4 style={{ marginBottom: '16px' }}>Osnovna merenja</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Temperatura (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-control"
                      value={readingFormData.temperature}
                      onChange={(e) =>
                        setReadingFormData({ ...readingFormData, temperature: Number(e.target.value) })
                      }
                      placeholder="npr. 18.5"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Brix (°)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-control"
                      value={readingFormData.brix}
                      onChange={(e) =>
                        setReadingFormData({ ...readingFormData, brix: Number(e.target.value) })
                      }
                      min="0"
                      max="50"
                      placeholder="npr. 22.5"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">pH</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={readingFormData.ph}
                      onChange={(e) =>
                        setReadingFormData({ ...readingFormData, ph: Number(e.target.value) })
                      }
                      min="0"
                      max="14"
                      placeholder="npr. 3.45"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Gustina (g/mL)</label>
                    <input
                      type="number"
                      step="0.001"
                      className="form-control"
                      value={readingFormData.density}
                      onChange={(e) =>
                        setReadingFormData({ ...readingFormData, density: Number(e.target.value) })
                      }
                      min="0.8"
                      max="1.2"
                      placeholder="npr. 1.085"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Alkohol (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-control"
                      value={readingFormData.alcohol_percent}
                      onChange={(e) =>
                        setReadingFormData({
                          ...readingFormData,
                          alcohol_percent: Number(e.target.value),
                        })
                      }
                      min="0"
                      max="22"
                      placeholder="npr. 12.5"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Isparljiva kiselost (g/L)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={readingFormData.volatile_acidity}
                      onChange={(e) =>
                        setReadingFormData({
                          ...readingFormData,
                          volatile_acidity: Number(e.target.value),
                        })
                      }
                      min="0"
                      max="3"
                      placeholder="npr. 0.45"
                    />
                  </div>
                </div>

                <h4 style={{ margin: '24px 0 16px' }}>SO₂ nivoi</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Slobodni SO₂ (mg/L)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={readingFormData.free_so2}
                      onChange={(e) =>
                        setReadingFormData({ ...readingFormData, free_so2: Number(e.target.value) })
                      }
                      min="0"
                      max="100"
                      placeholder="npr. 35"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Ukupni SO₂ (mg/L)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={readingFormData.total_so2}
                      onChange={(e) =>
                        setReadingFormData({ ...readingFormData, total_so2: Number(e.target.value) })
                      }
                      min="0"
                      max="350"
                      placeholder="npr. 120"
                    />
                  </div>
                </div>

                <h4 style={{ margin: '24px 0 16px' }}>Vizuelna ocena</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Boja</label>
                    <input
                      type="text"
                      className="form-control"
                      value={readingFormData.color}
                      onChange={(e) =>
                        setReadingFormData({ ...readingFormData, color: e.target.value })
                      }
                      placeholder="npr. Duboka purpurna"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Bistrina</label>
                    <input
                      type="text"
                      className="form-control"
                      value={readingFormData.clarity}
                      onChange={(e) =>
                        setReadingFormData({ ...readingFormData, clarity: e.target.value })
                      }
                      placeholder="npr. Bistra"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Aroma</label>
                  <input
                    type="text"
                    className="form-control"
                    value={readingFormData.aroma_notes}
                    onChange={(e) =>
                      setReadingFormData({ ...readingFormData, aroma_notes: e.target.value })
                    }
                    placeholder="npr. Trešnja, vanila, začini"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Napomene</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={readingFormData.notes}
                    onChange={(e) =>
                      setReadingFormData({ ...readingFormData, notes: e.target.value })
                    }
                    placeholder="Dodatne napomene o merenju..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseReadingModal}>
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

export default FermentationDetail;