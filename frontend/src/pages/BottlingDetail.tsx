import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { inventoryService } from '../services/inventoryService';
import ProvenanceCards from '../components/ProvenanceCards';
import BottleStatusBadge from '../components/BottleStatusBadge';
import { BOTTLE_STATUS_LABELS, type Bottling, type BottleStatus, type BottlesPage } from '../types';
import '../styles/Inventory.css';

const PAGE_SIZE = 50;

const apiError = (err: unknown, fallback: string) =>
  (isAxiosError<{ error?: string }>(err) && err.response?.data?.error) || fallback;

const BottlingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [bottling, setBottling] = useState<Bottling | null>(null);
  const [page, setPage] = useState<BottlesPage>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [statusFilter, setStatusFilter] = useState<BottleStatus | ''>('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadBottling = useCallback(() => {
    if (!id) return;
    inventoryService
      .getBottling(id)
      .then(setBottling)
      .catch((err) => setError(apiError(err, 'Lot nije pronađen')))
      .finally(() => setLoading(false));
  }, [id]);

  const loadBottles = useCallback(() => {
    if (!id) return;
    inventoryService
      .getBottles({
        bottling_id: id,
        status: statusFilter || undefined,
        search: search.trim() || undefined,
        limit: PAGE_SIZE,
        offset,
      })
      .then(setPage)
      .catch((err) => setError(apiError(err, 'Greška pri učitavanju flaša')));
  }, [id, statusFilter, search, offset]);

  useEffect(loadBottling, [loadBottling]);
  useEffect(loadBottles, [loadBottles]);

  const changeStatus = async (serial: string, status: BottleStatus) => {
    setUpdating(serial);
    try {
      await inventoryService.updateBottleStatus(serial, status);
      loadBottles();
      loadBottling();
    } catch (err) {
      setError(apiError(err, 'Promena statusa nije uspela'));
    } finally {
      setUpdating(null);
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

  if (!bottling) {
    return (
      <div className="inventory-page">
        <div className="alert alert-error">{error || 'Lot nije pronađen'}</div>
        <Link to="/inventory" className="btn btn-primary">Nazad na inventar</Link>
      </div>
    );
  }

  const b = bottling;
  const pageFrom = page.total === 0 ? 0 : offset + 1;
  const pageTo = Math.min(offset + PAGE_SIZE, page.total);

  return (
    <div className="inventory-page">
      <div className="detail-header">
        <div className="header-left">
          <Link to="/inventory" className="back-link">← Nazad na inventar</Link>
          <h1 className="page-title">
            {b.wine_name} {b.vintage && <span className="inv-vintage inv-vintage-lg">{b.vintage}</span>}
          </h1>
          <div className="batch-meta">
            <span className="meta-item">🏷️ Lot <strong>{b.lot_code}</strong></span>
            <span className="meta-item">🍇 {b.grape_variety}</span>
            <span className="meta-item">📅 Flaširano {new Date(b.bottled_at).toLocaleDateString('sr-RS')}</span>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="inv-stats">
        <div className="inv-stat">
          <div className="inv-stat-label">Vino posle fermentacije</div>
          <div className="inv-stat-value">{b.wine_liters.toLocaleString('sr-RS')} L</div>
          <div className="inv-stat-detail">
            od {b.provenance.fermentation.volume_liters.toLocaleString('sr-RS')} L šire
          </div>
        </div>
        <div className="inv-stat">
          <div className="inv-stat-label">Flaša po {b.bottle_volume_liters.toLocaleString('sr-RS')} L</div>
          <div className="inv-stat-value">{b.bottle_count.toLocaleString('sr-RS')}</div>
          <div className="inv-stat-detail">
            ostatak {b.remainder_liters.toLocaleString('sr-RS')} L
          </div>
        </div>
        <div className="inv-stat">
          <div className="inv-stat-label">Na stanju</div>
          <div className="inv-stat-value">{b.counts.in_stock.toLocaleString('sr-RS')}</div>
          <div className="inv-stat-detail">
            prodato {b.counts.sold} • oštećeno {b.counts.damaged}
          </div>
        </div>
      </div>

      {b.notes && <p className="inv-notes">📝 {b.notes}</p>}

      <h2 className="section-title">Poreklo vina</h2>
      <p className="inv-section-hint">Ovi podaci su upisani u svaku flašu iz ovog lota.</p>
      <ProvenanceCards provenance={b.provenance} />

      <h2 className="section-title inv-bottles-title">Flaše</h2>
      <div className="card">
        <div className="inv-filters">
          <input
            className="form-control"
            placeholder="Pretraga po serijskom broju…"
            aria-label="Pretraga po serijskom broju"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          />
          <select
            className="form-control"
            aria-label="Filter po statusu"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as BottleStatus | ''); setOffset(0); }}
          >
            <option value="">Svi statusi</option>
            {Object.entries(BOTTLE_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                <th>Serijski broj</th>
                <th>Status</th>
                <th>Promenjeno</th>
                <th>Promeni status</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((bottle) => (
                <tr key={bottle._id}>
                  <td>
                    <Link to={`/inventory/bottles/${encodeURIComponent(bottle.serial)}`} className="inv-serial">
                      {bottle.serial}
                    </Link>
                  </td>
                  <td><BottleStatusBadge status={bottle.status} /></td>
                  <td>{new Date(bottle.status_changed_at).toLocaleString('sr-RS')}</td>
                  <td>
                    <select
                      className="inv-status-select"
                      aria-label={`Status flaše ${bottle.serial}`}
                      value={bottle.status}
                      disabled={updating === bottle.serial}
                      onChange={(e) => changeStatus(bottle.serial, e.target.value as BottleStatus)}
                    >
                      {Object.entries(BOTTLE_STATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {page.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="inv-table-empty">Nema flaša za izabrani filter</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="inv-pagination">
          <span>{pageFrom}–{pageTo} od {page.total.toLocaleString('sr-RS')}</span>
          <div>
            <button
              className="btn btn-secondary btn-sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              ← Prethodne
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={offset + PAGE_SIZE >= page.total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Sledeće →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BottlingDetail;
