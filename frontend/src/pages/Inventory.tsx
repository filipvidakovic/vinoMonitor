import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { inventoryService } from '../services/inventoryService';
import type { Bottling, InventoryStats } from '../types';
import '../styles/Inventory.css';

const Inventory: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [bottlings, setBottlings] = useState<Bottling[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [serial, setSerial] = useState('');

  useEffect(() => {
    Promise.all([inventoryService.getStats(), inventoryService.getBottlings()])
      .then(([s, b]) => {
        setStats(s);
        setBottlings(b);
      })
      .catch((err) =>
        setError((isAxiosError<{ error?: string }>(err) && err.response?.data?.error) || 'Inventory servis nije dostupan')
      )
      .finally(() => setLoading(false));
  }, []);

  const handleFindBottle = (e: React.FormEvent) => {
    e.preventDefault();
    const s = serial.trim().toUpperCase();
    if (s) navigate(`/inventory/bottles/${encodeURIComponent(s)}`);
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
    <div className="inventory-page">
      <div className="inventory-header">
        <div>
          <h1 className="page-title">Inventar vina</h1>
          <p className="page-subtitle">
            Flaše od 0,7 L nastale iz završenih fermentacija, sa kompletnim poreklom
          </p>
        </div>
        <form className="inventory-search" onSubmit={handleFindBottle} role="search">
          <label htmlFor="serial-search" className="visually-hidden">Serijski broj flaše</label>
          <input
            id="serial-search"
            className="form-control"
            placeholder="Serijski broj, npr. L26-3F9A2C-00042"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">Pronađi flašu</button>
        </form>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {stats && (
        <div className="inv-stats">
          <div className="inv-stat">
            <div className="inv-stat-label">Flaša na stanju</div>
            <div className="inv-stat-value">{stats.counts.in_stock.toLocaleString('sr-RS')}</div>
            <div className="inv-stat-detail">{stats.liters_in_stock.toLocaleString('sr-RS')} L vina</div>
          </div>
          <div className="inv-stat">
            <div className="inv-stat-label">Prodato</div>
            <div className="inv-stat-value">{stats.counts.sold.toLocaleString('sr-RS')}</div>
            <div className="inv-stat-detail">flaša</div>
          </div>
          <div className="inv-stat">
            <div className="inv-stat-label">Oštećeno</div>
            <div className="inv-stat-value">{stats.counts.damaged.toLocaleString('sr-RS')}</div>
            <div className="inv-stat-detail">flaša</div>
          </div>
          <div className="inv-stat">
            <div className="inv-stat-label">Lotova</div>
            <div className="inv-stat-value">{stats.lots.toLocaleString('sr-RS')}</div>
            <div className="inv-stat-detail">flaširanih batch-eva</div>
          </div>
        </div>
      )}

      <h2 className="section-title">Lotovi</h2>
      {bottlings.length === 0 && !error ? (
        <div className="card inv-empty">
          <p><strong>Još nema flaširanog vina.</strong></p>
          <p>
            Otvorite batch na stranici <Link to="/fermentation">Fermentacija</Link> i kliknite
            „Završi i flaširaj“ kada se fermentacija završi.
          </p>
        </div>
      ) : (
        <div className="inv-lots">
          {bottlings.map((b) => {
            const pv = b.provenance;
            const soldPct = b.bottle_count ? (b.counts.sold / b.bottle_count) * 100 : 0;
            const damagedPct = b.bottle_count ? (b.counts.damaged / b.bottle_count) * 100 : 0;
            return (
              <Link key={b._id} to={`/inventory/lots/${b._id}`} className="inv-lot">
                <div className="inv-lot-top">
                  <span className="inv-lot-code">{b.lot_code}</span>
                  {b.vintage && <span className="inv-vintage">{b.vintage}</span>}
                </div>
                <div className="inv-lot-name">{b.wine_name}</div>
                <div className="inv-lot-meta">
                  {b.grape_variety}
                  {pv.vineyard && <> • {pv.vineyard.name}</>}
                </div>
                <div className="inv-lot-numbers">
                  <span><strong>{b.counts.in_stock.toLocaleString('sr-RS')}</strong> / {b.bottle_count.toLocaleString('sr-RS')} na stanju</span>
                  <span>{b.wine_liters.toLocaleString('sr-RS')} L</span>
                </div>
                <div
                  className="inv-bar"
                  role="img"
                  aria-label={`Na stanju ${b.counts.in_stock}, prodato ${b.counts.sold}, oštećeno ${b.counts.damaged}`}
                >
                  <span className="inv-bar-stock" style={{ width: `${100 - soldPct - damagedPct}%` }} />
                  {soldPct > 0 && <span className="inv-bar-sold" style={{ width: `${soldPct}%` }} />}
                  {damagedPct > 0 && <span className="inv-bar-damaged" style={{ width: `${damagedPct}%` }} />}
                </div>
                <div className="inv-lot-footer">
                  Flaširano {new Date(b.bottled_at).toLocaleDateString('sr-RS')}
                  {b.counts.sold > 0 && <> • prodato {b.counts.sold}</>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Inventory;
