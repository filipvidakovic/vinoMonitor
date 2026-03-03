import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fermentationService } from '../services/fermentationService';
import { useAuth } from '../context/AuthContext';
import { type Tank, type FermentationBatch, type CreateTankRequest, type CreateBatchRequest, TankMaterial } from '../types';
import '../styles/Fermentation.css';
import { harvestService } from '../services/harvestService'
import { type Harvest } from '../types'

const Fermentation: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'batches' | 'tanks'>('batches');
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [batches, setBatches] = useState<FermentationBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'tank' | 'batch'>('tank');
  const [editingItem, setEditingItem] = useState<Tank | FermentationBatch | null>(null);
  const [error, setError] = useState('');
  const [harvests, setHarvests] = useState<Harvest[]>([])

  const [tankFormData, setTankFormData] = useState<CreateTankRequest>({
    name: '',
    capacity_liters: 0,
    material: TankMaterial.StainlessSteel,
    location: '',
    notes: '',
  });

  const [batchFormData, setBatchFormData] = useState<CreateBatchRequest>({
    tank_id: '',
    harvest_id: '',
    name: '',
    grape_variety: '',
    volume_liters: 0,
    target_temperature: 18,
    yeast_strain: '',
    initial_brix: 0,
    initial_ph: 0,
    expected_end_date: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tanksData, batchesData, harvestsData] = await Promise.all([
        fermentationService.getTanks(),
        fermentationService.getBatches(),
        harvestService.getHarvests(),
      ]);
      setTanks(tanksData);
      setBatches(batchesData);
      setHarvests(harvestsData);
      setError('');
    } catch (err: any) {
      console.error('Failed to load fermentation data:', err);
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTankModal = (tank?: Tank) => {
    setModalType('tank');
    if (tank) {
      setEditingItem(tank);
      setTankFormData({
        name: tank.name,
        capacity_liters: tank.capacity_liters,
        material: tank.material,
        location: tank.location || '',
        notes: tank.notes || '',
      });
    } else {
      setEditingItem(null);
      setTankFormData({
        name: '',
        capacity_liters: 0,
        material: TankMaterial.StainlessSteel,
        location: '',
        notes: '',
      });
    }
    setShowModal(true);
    setError('');
  };

  const handleOpenBatchModal = (batch?: FermentationBatch) => {
    setModalType('batch');
    if (batch) {
      setEditingItem(batch);
      setBatchFormData({
        tank_id: batch.tank_id,
        harvest_id: batch.harvest_id || '',
        name: batch.name,
        grape_variety: batch.grape_variety,
        volume_liters: batch.volume_liters,
        target_temperature: batch.target_temperature || 18,
        yeast_strain: batch.yeast_strain || '',
        initial_brix: batch.initial_brix || 0,
        initial_ph: batch.initial_ph || 0,
        expected_end_date: batch.expected_end_date?.split('T')[0] || '',
        notes: batch.notes || '',
      });
    } else {
      setEditingItem(null);
      setBatchFormData({
        tank_id: '',
        harvest_id: '',
        name: '',
        grape_variety: '',
        volume_liters: 0,
        target_temperature: 18,
        yeast_strain: '',
        initial_brix: 0,
        initial_ph: 0,
        expected_end_date: '',
        notes: '',
      });
    }
    setShowModal(true);
    setError('');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setError('');
  };

  const handleTankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (editingItem && 'material' in editingItem) {
        await fermentationService.updateTank(editingItem.id, tankFormData);
      } else {
        await fermentationService.createTank(tankFormData);
      }
      handleCloseModal();
      loadData();
    } catch (err: any) {
      console.error('Failed to save tank:', err);
      setError(err.response?.data?.error || 'Failed to save tank');
    }
  };

    const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
        const payload = {
        ...batchFormData,
        harvest_id: batchFormData.harvest_id || null,
        expected_end_date: batchFormData.expected_end_date
            ? new Date(batchFormData.expected_end_date).toISOString()
            : null,
        }

        if (editingItem && 'grape_variety' in editingItem) {
        await fermentationService.updateBatch(editingItem.id, payload)
        } else {
        await fermentationService.createBatch(payload)
        }

        handleCloseModal()
        loadData()
    } catch (err: any) {
        console.error('Failed to save batch:', err)
        setError(err.response?.data?.error || 'Failed to save batch')
    }
    }

  const handleDeleteTank = async (id: string, name: string) => {
    if (window.confirm(`Da li ste sigurni da želite da obrišete tank "${name}"?`)) {
      try {
        await fermentationService.deleteTank(id);
        loadData();
      } catch (err: any) {
        console.error('Failed to delete tank:', err);
        alert(err.response?.data?.error || 'Failed to delete tank');
      }
    }
  };

  const handleDeleteBatch = async (id: string, name: string) => {
    if (window.confirm(`Da li ste sigurni da želite da obrišete batch "${name}"?`)) {
      try {
        await fermentationService.deleteBatch(id);
        loadData();
      } catch (err: any) {
        console.error('Failed to delete batch:', err);
        alert(err.response?.data?.error || 'Failed to delete batch');
      }
    }
  };

  const getTankStatusClass = (status: string) => {
    const statusMap: Record<string, string> = {
      available: 'success',
      in_use: 'primary',
      cleaning: 'warning',
      maintenance: 'danger',
    };
    return `badge badge-${statusMap[status] || 'secondary'}`;
  };

  const getBatchStatusClass = (status: string) => {
    const statusMap: Record<string, string> = {
      active: 'success',
      completed: 'info',
      paused: 'warning',
      cancelled: 'danger',
    };
    return `badge badge-${statusMap[status] || 'secondary'}`;
  };

  const getMaterialLabel = (material: string) => {
    const labels: Record<string, string> = {
      stainless_steel: 'Nerđajući čelik',
      oak: 'Hrast',
      concrete: 'Beton',
      fiberglass: 'Fiberglas',
    };
    return labels[material] || material;
  };

  const getTankName = (tankId: string) => {
    return tanks.find((t) => t.id === tankId)?.name || 'N/A';
  };

  const availableTanks = tanks.filter((t) => t.status === 'available');
  const activeBatches = batches.filter((b) => b.status === 'active');

  const canModify = user?.role === 'admin' || user?.role === 'winemaker';

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Učitavanje...</p>
      </div>
    );
  }

  return (
    <div className="fermentation-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fermentacija</h1>
          <p className="page-subtitle">Upravljanje tankovima i fermentacionim procesima</p>
        </div>
        {canModify && (
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={() => handleOpenTankModal()}>
              + Dodaj Tank
            </button>
            <button className="btn btn-primary" onClick={() => handleOpenBatchModal()}>
              + Novi Batch
            </button>
          </div>
        )}
      </div>

      {error && !showModal && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'batches' ? 'active' : ''}`}
          onClick={() => setActiveTab('batches')}
        >
          Fermentacioni Batch-evi ({batches.length})
        </button>
        <button
          className={`tab ${activeTab === 'tanks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tanks')}
        >
          Tankovi ({tanks.length})
        </button>
      </div>

      {/* Batches Tab */}
      {activeTab === 'batches' && (
        <div className="tab-content">
          {batches.length === 0 ? (
            <div className="empty-state-large">
              <div className="empty-icon">🍷</div>
              <h2>Nema fermentacionih batch-eva</h2>
              <p>Započnite dodavanjem prvog batch-a</p>
              {canModify && (
                <button className="btn btn-primary" onClick={() => handleOpenBatchModal()}>
                  Dodaj prvi batch
                </button>
              )}
            </div>
          ) : (
            <div className="fermentation-grid">
              {batches.map((batch) => (
                <div key={batch.id} className="fermentation-card">
                  <div className="card-header">
                    <h3>{batch.name}</h3>
                    <span className={getBatchStatusClass(batch.status)}>
                      {batch.status}
                    </span>
                  </div>

                  <div className="card-body">
                    <div className="info-row">
                      <span className="info-icon">🍇</span>
                      <span>{batch.grape_variety}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-icon">🛢️</span>
                      <span>{getTankName(batch.tank_id)}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-icon">📏</span>
                      <span>{batch.volume_liters}L</span>
                    </div>
                    {batch.latest_reading?.temperature && (
                      <div className="info-row">
                        <span className="info-icon">🌡️</span>
                        <span>{batch.latest_reading.temperature.toFixed(1)}°C</span>
                      </div>
                    )}
                  </div>

                  <div className="card-footer">
                    <Link to={`/fermentation/${batch.id}`} className="btn btn-secondary btn-sm">
                      Detalji
                    </Link>
                    {canModify && (
                      <>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenBatchModal(batch)}
                        >
                          Izmeni
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteBatch(batch.id, batch.name)}
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
        </div>
      )}

      {/* Tanks Tab */}
      {activeTab === 'tanks' && (
        <div className="tab-content">
          {tanks.length === 0 ? (
            <div className="empty-state-large">
              <div className="empty-icon">🛢️</div>
              <h2>Nema tankova</h2>
              <p>Dodajte prve tankove za fermentaciju</p>
              {canModify && (
                <button className="btn btn-primary" onClick={() => handleOpenTankModal()}>
                  Dodaj prvi tank
                </button>
              )}
            </div>
          ) : (
            <div className="fermentation-grid">
              {tanks.map((tank) => (
                <div key={tank.id} className="fermentation-card">
                  <div className="card-header">
                    <h3>{tank.name}</h3>
                    <span className={getTankStatusClass(tank.status)}>
                      {tank.status}
                    </span>
                  </div>

                  <div className="card-body">
                    <div className="info-row">
                      <span className="info-icon">📏</span>
                      <span>{tank.capacity_liters}L kapacitet</span>
                    </div>
                    <div className="info-row">
                      <span className="info-icon">🏗️</span>
                      <span>{getMaterialLabel(tank.material)}</span>
                    </div>
                    {tank.location && (
                      <div className="info-row">
                        <span className="info-icon">📍</span>
                        <span>{tank.location}</span>
                      </div>
                    )}
                    {tank.active_batch && (
                      <div className="info-row">
                        <span className="info-icon">🍷</span>
                        <span className="active-batch-label">
                          Aktivan: {tank.active_batch}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="card-footer">
                    {canModify && (
                      <>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenTankModal(tank)}
                        >
                          Izmeni
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteTank(tank.id, tank.name)}
                          disabled={tank.status === 'in_use'}
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
        </div>
      )}

      {/* Modal - Tank */}
      {showModal && modalType === 'tank' && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingItem ? 'Izmeni tank' : 'Dodaj novi tank'}</h2>
              <button className="btn-close" onClick={handleCloseModal}>
                ✕
              </button>
            </div>

            {error && (
              <div className="alert alert-error">
                {error}
              </div>
            )}

            <form onSubmit={handleTankSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Naziv tanka *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={tankFormData.name}
                    onChange={(e) => setTankFormData({ ...tankFormData, name: e.target.value })}
                    required
                    placeholder="npr. Tank 1"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Kapacitet (L) *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={tankFormData.capacity_liters}
                      onChange={(e) =>
                        setTankFormData({ ...tankFormData, capacity_liters: Number(e.target.value) })
                      }
                      required
                      min="0"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Materijal *</label>
                    <select
                      className="form-control"
                      value={tankFormData.material}
                      onChange={(e: any) =>
                        setTankFormData({ ...tankFormData, material: e.target.value })
                      }
                      required
                    >
                      <option value="stainless_steel">Nerđajući čelik</option>
                      <option value="oak">Hrast</option>
                      <option value="concrete">Beton</option>
                      <option value="fiberglass">Fiberglas</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Lokacija</label>
                  <input
                    type="text"
                    className="form-control"
                    value={tankFormData.location}
                    onChange={(e) => setTankFormData({ ...tankFormData, location: e.target.value })}
                    placeholder="npr. Podrum A"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Napomene</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={tankFormData.notes}
                    onChange={(e) => setTankFormData({ ...tankFormData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  Otkaži
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingItem ? 'Sačuvaj izmene' : 'Dodaj tank'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Batch */}
      {showModal && modalType === 'batch' && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingItem ? 'Izmeni batch' : 'Novi fermentacioni batch'}</h2>
              <button className="btn-close" onClick={handleCloseModal}>
                ✕
              </button>
            </div>

            {error && (
              <div className="alert alert-error">
                {error}
              </div>
            )}

            <form onSubmit={handleBatchSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Naziv batch-a *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={batchFormData.name}
                    onChange={(e) => setBatchFormData({ ...batchFormData, name: e.target.value })}
                    required
                    placeholder="npr. Cabernet 2024"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Tank *</label>
                    <select
                      className="form-control"
                      value={batchFormData.tank_id}
                      onChange={(e) =>
                        setBatchFormData({ ...batchFormData, tank_id: e.target.value })
                      }
                      required
                    >
                      <option value="">Odaberi tank</option>
                      {availableTanks.map((tank) => (
                        <option key={tank.id} value={tank.id}>
                          {tank.name} ({tank.capacity_liters}L)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Harvest (opciono)</label>
                    <select
                        className="form-control"
                        value={batchFormData.harvest_id?.toString() || ''}
                        onChange={(e) =>
                        setBatchFormData({
                            ...batchFormData,
                            harvest_id: e.target.value,
                        })
                        }
                    >
                        <option value="">Bez harvest-a</option>
                        {harvests.map((harvest) => (
                        <option key={harvest.id} value={harvest.id}>
                            {harvest.notes} ({harvest.harvest_date?.split('T')[0]})
                        </option>
                        ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Sorta grožđa *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={batchFormData.grape_variety}
                      onChange={(e) =>
                        setBatchFormData({ ...batchFormData, grape_variety: e.target.value })
                      }
                      required
                      placeholder="npr. Cabernet Sauvignon"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Zapremina (L) *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={batchFormData.volume_liters}
                      onChange={(e) =>
                        setBatchFormData({ ...batchFormData, volume_liters: Number(e.target.value) })
                      }
                      required
                      min="0"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Ciljna temperatura (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-control"
                      value={batchFormData.target_temperature}
                      onChange={(e) =>
                        setBatchFormData({
                          ...batchFormData,
                          target_temperature: Number(e.target.value),
                        })
                      }
                      min="5"
                      max="35"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Kvasac</label>
                    <input
                      type="text"
                      className="form-control"
                      value={batchFormData.yeast_strain}
                      onChange={(e) =>
                        setBatchFormData({ ...batchFormData, yeast_strain: e.target.value })
                      }
                      placeholder="npr. EC-1118"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Očekivani završetak</label>
                    <input
                      type="date"
                      className="form-control"
                      value={batchFormData.expected_end_date?.split('T')[0] || ''}
                      onChange={(e) =>
                        setBatchFormData({ ...batchFormData, expected_end_date: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Početni Brix</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-control"
                      value={batchFormData.initial_brix}
                      onChange={(e) =>
                        setBatchFormData({ ...batchFormData, initial_brix: Number(e.target.value) })
                      }
                      min="0"
                      max="50"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Početni pH</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={batchFormData.initial_ph}
                      onChange={(e) =>
                        setBatchFormData({ ...batchFormData, initial_ph: Number(e.target.value) })
                      }
                      min="0"
                      max="14"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Napomene</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={batchFormData.notes}
                    onChange={(e) => setBatchFormData({ ...batchFormData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  Otkaži
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingItem ? 'Sačuvaj izmene' : 'Dodaj batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Fermentation;