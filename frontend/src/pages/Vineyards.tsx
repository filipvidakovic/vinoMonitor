import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { vineyardService } from '../services/vineyardService';
import { useAuth } from '../context/AuthContext';
import type { Vineyard, CreateVineyardRequest } from '../types';
import '../styles/Vineyards.css';

const Vineyards: React.FC = () => {
  const { user } = useAuth();
  const [vineyards, setVineyards] = useState<Vineyard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVineyard, setEditingVineyard] = useState<Vineyard | null>(null);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<CreateVineyardRequest>({
    name: '',
    location: '',
    total_area: 0,
    description: '',
  });

  useEffect(() => {
    loadVineyards();
  }, []);

  const loadVineyards = async () => {
    try {
      setLoading(true);
      const data = await vineyardService.getVineyards();
      setVineyards(data);
      setError('');
    } catch (err: any) {
      console.error('Failed to load vineyards:', err);
      setError(err.response?.data?.error || 'Failed to load vineyards');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (vineyard?: Vineyard) => {
    if (vineyard) {
      setEditingVineyard(vineyard);
      setFormData({
        name: vineyard.name,
        location: vineyard.location,
        total_area: vineyard.total_area,
        description: vineyard.description || '',
      });
    } else {
      setEditingVineyard(null);
      setFormData({
        name: '',
        location: '',
        total_area: 0,
        description: '',
      });
    }
    setShowModal(true);
    setError('');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingVineyard(null);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (editingVineyard) {
        await vineyardService.updateVineyard(editingVineyard.id, formData);
      } else {
        await vineyardService.createVineyard(formData);
      }
      handleCloseModal();
      loadVineyards();
    } catch (err: any) {
      console.error('Failed to save vineyard:', err);
      setError(err.response?.data?.error || 'Failed to save vineyard');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Da li ste sigurni da želite da obrišete vinograd "${name}"?`)) {
      try {
        await vineyardService.deleteVineyard(id);
        loadVineyards();
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
        <p>Učitavanje vinograda...</p>
      </div>
    );
  }

  return (
    <div className="vineyards-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Vinogradi</h1>
          <p className="page-subtitle">Upravljanje vinogradima i parcelama</p>
        </div>
        {canModify && (
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            + Dodaj Vinograd
          </button>
        )}
      </div>

      {error && !showModal && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {vineyards.length === 0 ? (
        <div className="empty-state-large">
          <div className="empty-icon">🍇</div>
          <h2>Nema vinograda</h2>
          <p>Započnite dodavanjem prvog vinograda</p>
          {canModify && (
            <button className="btn btn-primary" onClick={() => handleOpenModal()}>
              Dodaj prvi vinograd
            </button>
          )}
        </div>
      ) : (
        <div className="vineyards-grid">
          {vineyards.map((vineyard) => (
            <div key={vineyard.id} className="vineyard-card">
              <div className="vineyard-card-header">
                <h3>{vineyard.name}</h3>
                {canModify && (
                  <div className="vineyard-actions">
                    <button
                      className="btn-icon"
                      onClick={() => handleOpenModal(vineyard)}
                      title="Izmeni"
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-icon btn-danger"
                      onClick={() => handleDelete(vineyard.id, vineyard.name)}
                      title="Obriši"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>

              <div className="vineyard-card-body">
                <div className="vineyard-info">
                  <span className="info-icon">📍</span>
                  <span>{vineyard.location}</span>
                </div>
                <div className="vineyard-info">
                  <span className="info-icon">📏</span>
                  <span>{vineyard.total_area} hektara</span>
                </div>
                {vineyard.description && (
                  <div className="vineyard-description">
                    {vineyard.description}
                  </div>
                )}
              </div>

              <div className="vineyard-card-footer">
                <Link
                  to={`/vineyards/${vineyard.id}`}
                  className="btn btn-secondary btn-sm btn-block"
                >
                  Vidi detalje →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingVineyard ? 'Izmeni vinograd' : 'Dodaj novi vinograd'}</h2>
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
                <div className="form-group">
                  <label className="form-label">Naziv vinograda *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="npr. Vinograd Šumadija"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Lokacija *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    required
                    placeholder="npr. Topola, Srbija"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Ukupna površina (ha) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formData.total_area}
                    onChange={(e) => setFormData({ ...formData, total_area: Number(e.target.value) })}
                    required
                    min="0"
                    placeholder="npr. 5.5"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Opis</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Kratki opis vinograda..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  Otkaži
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingVineyard ? 'Sačuvaj izmene' : 'Dodaj vinograd'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vineyards;