import React from 'react';
import { Link } from 'react-router-dom';
import type { Provenance } from '../types';

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' }) : undefined;

const num = (v: number | undefined | null, unit = '', decimals = 1) =>
  v === undefined || v === null
    ? undefined
    : `${v.toLocaleString('sr-RS', { maximumFractionDigits: decimals })}${unit}`;

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) =>
  value === undefined || value === null || value === '' ? null : (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{value}</span>
    </div>
  );

/** Kompletno poreklo vina: vinograd → parcela → berba → fermentacija */
const ProvenanceCards: React.FC<{ provenance: Provenance }> = ({ provenance }) => {
  const { vineyard, parcel, harvest, fermentation: f } = provenance;

  return (
    <div className="info-grid provenance-grid">
      <div className="info-card">
        <div className="info-card-header">
          <span className="info-icon">🍇</span>
          <h3>Vinograd</h3>
        </div>
        <div className="info-card-body">
          {vineyard ? (
            <>
              <Row label="Naziv:" value={vineyard.name} />
              <Row label="Lokacija:" value={vineyard.location} />
              <Row label="Površina:" value={num(vineyard.total_area, ' ha', 2)} />
              <Row label="Opis:" value={vineyard.description} />
              {parcel && (
                <>
                  <div className="provenance-subtitle">Parcela</div>
                  <Row label="Naziv:" value={parcel.name} />
                  <Row label="Sorta:" value={parcel.grape_variety} />
                  <Row label="Površina:" value={num(parcel.area, ' m²', 0)} />
                  <Row label="Godina sadnje:" value={parcel.planting_year} />
                  <Row label="Tip zemljišta:" value={parcel.soil_type} />
                  <Row
                    label="Koordinate:"
                    value={
                      parcel.latitude !== undefined && parcel.longitude !== undefined && parcel.latitude !== null
                        ? `${parcel.latitude.toFixed(5)}, ${parcel.longitude?.toFixed(5)}`
                        : undefined
                    }
                  />
                </>
              )}
            </>
          ) : (
            <p className="provenance-missing">Batch nije povezan sa berbom, pa vinograd nije poznat.</p>
          )}
        </div>
      </div>

      <div className="info-card">
        <div className="info-card-header">
          <span className="info-icon">🌾</span>
          <h3>Berba</h3>
        </div>
        <div className="info-card-body">
          {harvest ? (
            <>
              <Row label="Datum berbe:" value={formatDate(harvest.harvest_date)} />
              <Row label="Ukupno grožđa:" value={num(harvest.total_weight_kg, ' kg', 0)} />
              <Row label="Prinos:" value={num(harvest.yield_per_hectare, ' kg/ha', 0)} />
              <Row label="Vreme:" value={harvest.weather_condition} />
              <Row label="Temperatura:" value={num(harvest.temperature_celsius, ' °C')} />
              <Row label="Vlažnost:" value={num(harvest.humidity_percent, ' %', 0)} />
              <Row label="Napomene:" value={harvest.notes} />
              {harvest.quality_measurements.length > 0 && (
                <>
                  <div className="provenance-subtitle">
                    Kvalitet grožđa ({harvest.quality_measurements.length} merenja)
                  </div>
                  {harvest.quality_measurements.map((q, i) => (
                    <div key={i} className="provenance-quality">
                      <span className="provenance-quality-date">{formatDate(q.measured_at)}</span>
                      {[
                        num(q.brix, ' °Bx'),
                        q.ph !== undefined && q.ph !== null ? `pH ${num(q.ph, '', 2)}` : undefined,
                        num(q.acidity, ' g/L kis.'),
                        q.grape_health,
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                    </div>
                  ))}
                </>
              )}
            </>
          ) : (
            <p className="provenance-missing">Nema podataka o berbi.</p>
          )}
        </div>
      </div>

      <div className="info-card">
        <div className="info-card-header">
          <span className="info-icon">⚗️</span>
          <h3>Fermentacija</h3>
        </div>
        <div className="info-card-body">
          <Row
            label="Batch:"
            value={<Link to={`/fermentation/${f.batch_id}`}>{f.batch_name}</Link>}
          />
          <Row label="Sorta:" value={f.grape_variety} />
          <Row label="Tank:" value={f.tank_name && `${f.tank_name}${f.tank_material ? ` (${f.tank_material.replace('_', ' ')})` : ''}`} />
          <Row label="Zapremina šire:" value={num(f.volume_liters, ' L', 0)} />
          <Row label="Kvasac:" value={f.yeast_strain} />
          <Row label="Period:" value={f.start_date && `${formatDate(f.start_date)} – ${formatDate(f.end_date) ?? '…'}`} />
          <Row label="Početni Brix:" value={num(f.initial_brix, ' °Bx')} />
          <Row label="Početni pH:" value={num(f.initial_ph, '', 2)} />
          <Row label="Ciljna temp.:" value={num(f.target_temperature, ' °C')} />
          <div className="provenance-subtitle">Tok fermentacije ({f.stats.total_readings} merenja)</div>
          <Row
            label="Temperatura:"
            value={
              f.stats.avg_temperature !== undefined && f.stats.avg_temperature !== null
                ? `prosek ${num(f.stats.avg_temperature, ' °C')} (${num(f.stats.min_temperature)}–${num(f.stats.max_temperature, ' °C')})`
                : undefined
            }
          />
          <Row label="Alkohol:" value={num(f.stats.latest_alcohol, ' %')} />
          <Row label="Završni Brix:" value={num(f.stats.latest_brix, ' °Bx')} />
          <Row label="Završni pH:" value={num(f.stats.latest_ph, '', 2)} />
          <Row label="Napomene:" value={f.notes} />
        </div>
      </div>
    </div>
  );
};

export default ProvenanceCards;
