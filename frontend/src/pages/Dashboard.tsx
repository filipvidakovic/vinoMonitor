import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { vineyardService } from '../services/vineyardService';
import { harvestService } from '../services/harvestService';
import { fermentationService } from '../services/fermentationService';
import { useAuth } from '../context/AuthContext';
import type { Vineyard, Harvest, FermentationBatch } from '../types';
import '../styles/Dashboard.css';

interface DashboardStats {
  vineyards: number;
  harvests: number;
  activeBatches: number;
  totalArea: number;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    vineyards: 0,
    harvests: 0,
    activeBatches: 0,
    totalArea: 0,
  });
  const [recentVineyards, setRecentVineyards] = useState<Vineyard[]>([]);
  const [recentHarvests, setRecentHarvests] = useState<Harvest[]>([]);
  const [activeBatches, setActiveBatches] = useState<FermentationBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [vineyards, harvests, batches] = await Promise.all([
        vineyardService.getVineyards(),
        harvestService.getHarvests(),
        fermentationService.getActiveBatches(),
      ]);

      const totalArea = vineyards.reduce((sum, v) => sum + v.total_area, 0);

      setStats({
        vineyards: vineyards.length,
        harvests: harvests.length,
        activeBatches: batches.length,
        totalArea,
      });

      setRecentVineyards(vineyards.slice(0, 3));
      setRecentHarvests(harvests.slice(0, 5));
      setActiveBatches(batches.slice(0, 5));
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const statusMap: Record<string, string> = {
      active: 'success',
      completed: 'info',
      planned: 'warning',
      in_progress: 'primary',
      cancelled: 'danger',
      paused: 'secondary',
    };
    return `badge badge-${statusMap[status] || 'secondary'}`;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Učitavanje...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Dobrodošli, {user?.first_name}! Pregled vašeg vinograda.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#e3f2fd' }}>
            🍇
          </div>
          <div className="stat-content">
            <div className="stat-label">Vinograda</div>
            <div className="stat-value">{stats.vineyards}</div>
            <div className="stat-detail">{stats.totalArea.toFixed(1)} ha ukupno</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fff3e0' }}>
            🌾
          </div>
          <div className="stat-content">
            <div className="stat-label">Berbi</div>
            <div className="stat-value">{stats.harvests}</div>
            <div className="stat-detail">Ukupno evidentiranih</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f3e5f5' }}>
            🍷
          </div>
          <div className="stat-content">
            <div className="stat-label">Aktivne Fermentacije</div>
            <div className="stat-value">{stats.activeBatches}</div>
            <div className="stat-detail">U toku</div>
          </div>
        </div>

        <div className="stat-card stat-card-action">
          <div className="stat-icon" style={{ background: '#e8f5e9' }}>
            📊
          </div>
          <div className="stat-content">
            <div className="stat-label">Status Sistema</div>
            <div className="stat-value">✓</div>
            <div className="stat-detail">Svi servisi aktivni</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions-section">
        <h2 className="section-title">Brzi pristup</h2>
        <div className="quick-actions">
          <Link to="/vineyards" className="quick-action-btn">
            <span className="action-icon">🍇</span>
            <span className="action-label">Upravljaj Vinogradima</span>
          </Link>
          <Link to="/harvests" className="quick-action-btn">
            <span className="action-icon">🌾</span>
            <span className="action-label">Evidentiraj Berbu</span>
          </Link>
          <Link to="/fermentation" className="quick-action-btn">
            <span className="action-icon">🍷</span>
            <span className="action-label">Fermentacija</span>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="dashboard-grid">
        {/* Recent Vineyards */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Nedavni Vinogradi</h2>
            <Link to="/vineyards" className="card-link">
              Vidi sve →
            </Link>
          </div>
          <div className="card-body">
            {recentVineyards.length > 0 ? (
              <div className="list">
                {recentVineyards.map((vineyard) => (
                  <Link
                    key={vineyard.id}
                    to={`/vineyards/${vineyard.id}`}
                    className="list-item"
                  >
                    <div className="list-item-content">
                      <div className="list-item-title">{vineyard.name}</div>
                      <div className="list-item-subtitle">
                        📍 {vineyard.location} • {vineyard.total_area} ha
                      </div>
                    </div>
                    <div className="list-item-arrow">→</div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>Nema vinograda</p>
                <Link to="/vineyards" className="btn btn-primary btn-sm">
                  Dodaj prvi vinograd
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Harvests */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Nedavne Berbe</h2>
            <Link to="/harvests" className="card-link">
              Vidi sve →
            </Link>
          </div>
          <div className="card-body">
            {recentHarvests.length > 0 ? (
              <div className="list">
                {recentHarvests.map((harvest) => (
                  <Link
                    key={harvest.id}
                    to={`/harvests/${harvest.id}`}
                    className="list-item"
                  >
                    <div className="list-item-content">
                      <div className="list-item-title">
                        Berba {new Date(harvest.harvest_date).toLocaleDateString('sr-RS')}
                      </div>
                      <div className="list-item-subtitle">
                        {harvest.total_weight_kg && `${harvest.total_weight_kg} kg`}
                        {harvest.weather_condition && ` • ${harvest.weather_condition}`}
                      </div>
                    </div>
                    <span className={getStatusBadgeClass(harvest.status)}>
                      {harvest.status}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>Nema berbi</p>
                <Link to="/harvests" className="btn btn-primary btn-sm">
                  Evidentiraj berbu
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Active Fermentations */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Aktivne Fermentacije</h2>
            <Link to="/fermentation" className="card-link">
              Vidi sve →
            </Link>
          </div>
          <div className="card-body">
            {activeBatches.length > 0 ? (
              <div className="list">
                {activeBatches.map((batch) => (
                  <Link
                    key={batch.id}
                    to={`/fermentation/${batch.id}`}
                    className="list-item"
                  >
                    <div className="list-item-content">
                      <div className="list-item-title">{batch.name}</div>
                      <div className="list-item-subtitle">
                        {batch.grape_variety} • {batch.volume_liters}L
                        {batch.latest_reading?.temperature &&
                          ` • ${batch.latest_reading.temperature.toFixed(1)}°C`}
                      </div>
                    </div>
                    <span className="badge badge-success">Active</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>Nema aktivnih fermentacija</p>
                <Link to="/fermentation" className="btn btn-primary btn-sm">
                  Započni fermentaciju
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
   );
};

export default Dashboard;