import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { inventoryService } from '../services/inventoryService';
import ProvenanceCards from '../components/ProvenanceCards';
import BottleStatusBadge from '../components/BottleStatusBadge';
import { BOTTLE_STATUS_LABELS, type Bottle, type BottleStatus } from '../types';
import '../styles/Inventory.css';

const apiError = (err: unknown, fallback: string) =>
  (isAxiosError<{ error?: string }>(err) && err.response?.data?.error) || fallback;

const BottleDetail: React.FC = () => {
  const { serial } = useParams<{ serial: string }>();
  const [bottle, setBottle] = useState<Bottle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!serial) return;
    setLoading(true);
    inventoryService
      .getBottle(serial)
      .then((b) => { setBottle(b); setError(''); })
      .catch((err) => setError(apiError(err, 'Flaša nije pronađena')))
      .finally(() => setLoading(false));
  }, [serial]);

  const changeStatus = async (status: BottleStatus) => {
    if (!bottle) return;
    setUpdating(true);
    try {
      setBottle(await inventoryService.updateBottleStatus(bottle.serial, status));
    } catch (err) {
      setError(apiError(err, 'Promena statusa nije uspela'));
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Učitavanje...</p>
      </div>
    );
  }

  if (!bottle) {
    return (
      <div className="inventory-page">
        <div className="alert alert-error">{error || 'Flaša nije pronađena'}</div>
        <Link to="/inventory" className="btn btn-primary">Nazad na inventar</Link>
      </div>
    );
  }

  const pv = bottle.provenance;

  return (
    <div className="inventory-page">
      <Link to={`/inventory/lots/${bottle.bottling_id}`} className="back-link">
        ← Lot {bottle.lot_code}
      </Link>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="bottle-label">
        <div className="bottle-label-icon" aria-hidden="true">🍾</div>
        <div className="bottle-label-main">
          <div className="bottle-label-name">{bottle.wine_name}</div>
          <div className="bottle-label-sub">
            {bottle.grape_variety}
            {bottle.vintage && <> • berba {bottle.vintage}</>}
            {pv.vineyard && <> • {pv.vineyard.name}, {pv.vineyard.location}</>}
          </div>
          <div className="bottle-label-facts">
            <span><small>Serijski broj</small><strong className="inv-serial">{bottle.serial}</strong></span>
            <span><small>Lot</small><strong>{bottle.lot_code}</strong></span>
            <span><small>Zapremina</small><strong>{bottle.volume_liters.toLocaleString('sr-RS')} L</strong></span>
            {pv.fermentation.stats.latest_alcohol !== undefined && pv.fermentation.stats.latest_alcohol !== null && (
              <span><small>Alkohol</small><strong>{pv.fermentation.stats.latest_alcohol.toLocaleString('sr-RS')} %</strong></span>
            )}
            <span><small>Flaširano</small><strong>{new Date(bottle.bottled_at).toLocaleDateString('sr-RS')}</strong></span>
          </div>
        </div>
        <div className="bottle-label-status">
          <BottleStatusBadge status={bottle.status} />
          <label className="visually-hidden" htmlFor="bottle-status">Promeni status</label>
          <select
            id="bottle-status"
            className="inv-status-select"
            value={bottle.status}
            disabled={updating}
            onChange={(e) => changeStatus(e.target.value as BottleStatus)}
          >
            {Object.entries(BOTTLE_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <small>od {new Date(bottle.status_changed_at).toLocaleString('sr-RS')}</small>
        </div>
      </div>

      <h2 className="section-title">Poreklo ove flaše</h2>
      <ProvenanceCards provenance={pv} />
    </div>
  );
};

export default BottleDetail;
