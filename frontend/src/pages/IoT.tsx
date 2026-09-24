import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { iotService } from '../services/iotService';
import { fermentationService } from '../services/fermentationService';
import { vineyardService } from '../services/vineyardService';
import { useAuth } from '../context/AuthContext';
import SensorChart, { type ChartPoint } from '../components/SensorChart';
import type {
  IotDevice,
  SensorReading,
  SeriesPoint,
  SensorStats,
  TargetType,
  DeviceCommand,
} from '../types';
import '../styles/IoT.css';

const REFRESH_MS = 15000;
const STALE_MS = 10 * 60 * 1000;

const RANGES = [
  { key: '6h', label: 'Poslednjih 6h', hours: 6, bucket: 5 },
  { key: '24h', label: 'Poslednja 24h', hours: 24, bucket: 15 },
  { key: '7d', label: 'Poslednjih 7 dana', hours: 24 * 7, bucket: 60 },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];

const INTERVAL_OPTIONS = [10, 30, 60, 300, 900];

interface Selected {
  type: TargetType;
  id: string;
}

const timeAgo = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `pre ${s}s`;
  if (s < 3600) return `pre ${Math.round(s / 60)} min`;
  if (s < 86400) return `pre ${Math.round(s / 3600)}h`;
  return `pre ${Math.round(s / 86400)} d`;
};

const formatInterval = (s?: number) =>
  s === undefined ? '—' : s < 60 ? `${s}s` : `${Math.round(s / 60)} min`;

const apiError = (err: unknown, fallback: string) =>
  (isAxiosError<{ error?: string }>(err) && err.response?.data?.error) || fallback;

const fmt = (v: number | undefined | null, decimals = 1) =>
  v === undefined || v === null ? '—' : v.toLocaleString('sr-RS', { maximumFractionDigits: decimals });

const IoT: React.FC = () => {
  const { user } = useAuth();
  const canCommand = user?.role === 'admin' || user?.role === 'winemaker';

  const [devices, setDevices] = useState<IotDevice[]>([]);
  const [latest, setLatest] = useState<SensorReading[]>([]);
  const [tankNames, setTankNames] = useState<Record<string, string>>({});
  const [vineyardNames, setVineyardNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const [selected, setSelected] = useState<Selected | null>(null);
  const [range, setRange] = useState<RangeKey>('24h');
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [stats, setStats] = useState<SensorStats | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [showTable, setShowTable] = useState(false);

  const [intervalDraft, setIntervalDraft] = useState<Record<string, number>>({});
  const [commandMsg, setCommandMsg] = useState<{ deviceId: string; text: string; ok: boolean } | null>(null);

  const rangeDef = RANGES.find((r) => r.key === range)!;

  // Nazivi tankova i vinograda iz drugih servisa (jednom)
  useEffect(() => {
    fermentationService.getTanks()
      .then((tanks) => setTankNames(Object.fromEntries(tanks.map((t) => [t.id, t.name]))))
      .catch(() => {});
    vineyardService.getVineyards()
      .then((vs) => setVineyardNames(Object.fromEntries(vs.map((v) => [v.id, v.name]))))
      .catch(() => {});
  }, []);

  const loadOverview = useCallback(async () => {
    try {
      const [devicesData, latestData] = await Promise.all([
        iotService.getDevices(),
        iotService.getLatest(),
      ]);
      setDevices(devicesData);
      setLatest(latestData);
      setLastRefresh(new Date());
      setError('');
    } catch (err) {
      console.error('Failed to load IoT data:', err);
      setError(apiError(err, 'IoT servis nije dostupan'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSeries = useCallback(async () => {
    if (!selected) return;
    const to = new Date();
    const from = new Date(to.getTime() - rangeDef.hours * 3600 * 1000);
    const params = {
      target_type: selected.type,
      target_id: selected.id,
      from: from.toISOString(),
      to: to.toISOString(),
    };
    setSeriesLoading(true);
    try {
      const [seriesData, statsData] = await Promise.all([
        iotService.getSeries({ ...params, bucket_minutes: rangeDef.bucket }),
        iotService.getStats(params),
      ]);
      setSeries(seriesData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load sensor series:', err);
    } finally {
      setSeriesLoading(false);
    }
  }, [selected, rangeDef]);

  useEffect(() => {
    loadOverview();
    const id = window.setInterval(loadOverview, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [loadOverview]);

  useEffect(() => {
    loadSeries();
    const id = window.setInterval(loadSeries, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [loadSeries]);

  // Automatski izaberi prvi target kad stignu podaci
  useEffect(() => {
    if (!selected && latest.length > 0) {
      setSelected({ type: latest[0].target_type, id: latest[0].target_id });
    }
  }, [latest, selected]);

  const targetName = (type: TargetType, id: string) => {
    const names = type === 'tank' ? tankNames : vineyardNames;
    return names[id] || `${type === 'tank' ? 'Tank' : 'Vinograd'} ${id.slice(0, 8)}…`;
  };

  const tanks = latest.filter((r) => r.target_type === 'tank');
  const vineyards = latest.filter((r) => r.target_type === 'vineyard');

  const handleCommand = async (deviceId: string, command: DeviceCommand, label: string) => {
    try {
      await iotService.sendCommand(deviceId, command);
      setCommandMsg({ deviceId, text: `${label}: poslato`, ok: true });
      window.setTimeout(loadOverview, 1500);
    } catch (err) {
      setCommandMsg({ deviceId, text: apiError(err, 'Greška pri slanju komande'), ok: false });
    }
    window.setTimeout(() => setCommandMsg(null), 4000);
  };

  // Tačke za grafikone
  const now = Date.now();
  const chartFrom = now - rangeDef.hours * 3600 * 1000;
  const toPoints = (key: 'temperature' | 'humidity' | 'light_lux'): ChartPoint[] =>
    series
      .filter((p) => p[key] !== undefined && p[key] !== null)
      .map((p) => ({ t: new Date(p.bucket).getTime(), v: p[key] as number }));

  const charts = useMemo(() => {
    if (!selected) return [];
    return selected.type === 'tank'
      ? [
          { key: 'temperature' as const, title: 'Temperatura', unit: '°C', decimals: 1, zero: false },
          { key: 'humidity' as const, title: 'Vlažnost', unit: '%', decimals: 1, zero: false },
        ]
      : [
          { key: 'light_lux' as const, title: 'Sunčeva svetlost', unit: 'lux', decimals: 0, zero: true },
          { key: 'temperature' as const, title: 'Temperatura', unit: '°C', decimals: 1, zero: false },
        ];
  }, [selected]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Učitavanje...</p>
      </div>
    );
  }

  const renderTile = (r: SensorReading) => {
    const isSelected = selected?.type === r.target_type && selected.id === r.target_id;
    const stale = Date.now() - new Date(r.recorded_at).getTime() > STALE_MS;
    return (
      <button
        key={`${r.target_type}-${r.target_id}`}
        className={`iot-tile ${isSelected ? 'iot-tile-selected' : ''}`}
        onClick={() => { setSelected({ type: r.target_type, id: r.target_id }); setShowTable(false); }}
        aria-pressed={isSelected}
      >
        <div className="iot-tile-header">
          <span className="iot-tile-name">{targetName(r.target_type, r.target_id)}</span>
          {stale && <span className="iot-status iot-status-warning">⚠ Zastarelo</span>}
        </div>
        <div className="iot-tile-values">
          {r.target_type === 'vineyard' && (
            <div className="iot-metric">
              <span className="iot-metric-value">{fmt(r.light_lux, 0)}</span>
              <span className="iot-metric-label">☀ lux</span>
            </div>
          )}
          <div className="iot-metric">
            <span className="iot-metric-value">{fmt(r.temperature)}</span>
            <span className="iot-metric-label">🌡 °C</span>
          </div>
          {r.target_type === 'tank' && (
            <div className="iot-metric">
              <span className="iot-metric-value">{fmt(r.humidity)}</span>
              <span className="iot-metric-label">💧 %</span>
            </div>
          )}
        </div>
        <div className="iot-tile-footer">
          {timeAgo(r.recorded_at)} • {r.device_id}
        </div>
      </button>
    );
  };

  const statRows = selected?.type === 'tank'
    ? [
        { label: 'Temperatura (°C)', min: stats?.min_temperature, avg: stats?.avg_temperature, max: stats?.max_temperature, decimals: 1 },
        { label: 'Vlažnost (%)', min: stats?.min_humidity, avg: stats?.avg_humidity, max: stats?.max_humidity, decimals: 1 },
      ]
    : [
        { label: 'Temperatura (°C)', min: stats?.min_temperature, avg: stats?.avg_temperature, max: stats?.max_temperature, decimals: 1 },
        { label: 'Svetlost (lux)', min: undefined, avg: stats?.avg_light_lux, max: stats?.max_light_lux, decimals: 0 },
      ];

  return (
    <div className="iot-page">
      <div className="iot-header">
        <div>
          <h1 className="page-title">IoT Monitoring</h1>
          <p className="page-subtitle">
            Senzori na fermentacionim tankovima i u vinogradima (Raspberry Pi → MQTT)
          </p>
        </div>
        {lastRefresh && (
          <div className="iot-refresh">
            <span className="iot-live-dot" aria-hidden="true" />
            Osveženo {lastRefresh.toLocaleTimeString('sr-RS')} • automatski na {REFRESH_MS / 1000}s
          </div>
        )}
      </div>

      {error && <div className="iot-alert">{error}</div>}

      {/* ========== Uređaji ========== */}
      <section className="iot-section">
        <h2 className="section-title">Uređaji</h2>
        {devices.length === 0 ? (
          <div className="card iot-empty">
            <p><strong>Nema povezanih uređaja.</strong></p>
            <p>
              Pokrenite <code>python -m vinomonitor_iot</code> na Raspberry Pi-ju (vidi <code>iot-device/README.md</code>)
              ili simulator: <code>docker compose --profile simulator up -d iot-simulator</code>.
            </p>
          </div>
        ) : (
          <div className="card">
            <div className="iot-table-wrap">
              <table className="iot-table">
                <thead>
                  <tr>
                    <th>Uređaj</th>
                    <th>Status</th>
                    <th className="iot-num">Interval</th>
                    <th>Poslednji kontakt</th>
                    {canCommand && <th>Komande</th>}
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d) => {
                    const offline = d.status === 'offline';
                    return (
                      <tr key={d.id}>
                        <td>
                          <span className="iot-device-id">{d.id}</span>
                          {d.simulated && <span className="iot-sim-badge" title="Simulirani senzori">SIM</span>}
                        </td>
                        <td>
                          <span className={`iot-status ${offline ? 'iot-status-critical' : 'iot-status-good'}`}>
                            {offline ? '✕ Offline' : '● Online'}
                          </span>
                        </td>
                        <td className="iot-num">{formatInterval(d.interval_seconds)}</td>
                        <td>{timeAgo(d.last_seen_at)}</td>
                        {canCommand && (
                          <td>
                            <div className="iot-actions">
                              <button className="iot-btn" disabled={offline}
                                onClick={() => handleCommand(d.id, { command: 'read_now' }, 'Izmeri sada')}>
                                Izmeri sada
                              </button>
                              <select
                                className="iot-select"
                                aria-label={`Interval za ${d.id}`}
                                disabled={offline}
                                value={intervalDraft[d.id] ?? d.interval_seconds ?? 60}
                                onChange={(e) => setIntervalDraft({ ...intervalDraft, [d.id]: Number(e.target.value) })}
                              >
                                {[...new Set([...INTERVAL_OPTIONS, d.interval_seconds ?? 60])]
                                  .sort((a, b) => a - b)
                                  .map((s) => <option key={s} value={s}>{formatInterval(s)}</option>)}
                              </select>
                              <button className="iot-btn" disabled={offline}
                                onClick={() => handleCommand(d.id, {
                                  command: 'set_interval',
                                  interval_seconds: intervalDraft[d.id] ?? d.interval_seconds ?? 60,
                                }, 'Interval')}>
                                Postavi
                              </button>
                            </div>
                            {commandMsg?.deviceId === d.id && (
                              <div className={`iot-command-msg ${commandMsg.ok ? 'ok' : 'err'}`} role="status">
                                {commandMsg.text}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ========== Trenutne vrednosti ========== */}
      {tanks.length > 0 && (
        <section className="iot-section">
          <h2 className="section-title">🍷 Fermentacioni tankovi</h2>
          <div className="iot-tiles">{tanks.map(renderTile)}</div>
        </section>
      )}
      {vineyards.length > 0 && (
        <section className="iot-section">
          <h2 className="section-title">🍇 Vinogradi</h2>
          <div className="iot-tiles">{vineyards.map(renderTile)}</div>
        </section>
      )}

      {/* ========== Istorija izabranog ========== */}
      {selected && (
        <section className="iot-section">
          <div className="iot-detail-header">
            <h2 className="section-title">
              Istorija: {targetName(selected.type, selected.id)}
            </h2>
            <div className="iot-range" role="group" aria-label="Vremenski period">
              {RANGES.map((r) => (
                <button key={r.key}
                  className={`iot-range-btn ${range === r.key ? 'active' : ''}`}
                  aria-pressed={range === r.key}
                  onClick={() => setRange(r.key)}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card iot-detail">
            <div className="iot-stats">
              {statRows.map((s) => (
                <div key={s.label} className="iot-stat">
                  <div className="iot-stat-label">{s.label}</div>
                  <div className="iot-stat-values">
                    {s.min !== undefined && <span><small>min</small> {fmt(s.min, s.decimals)}</span>}
                    <span><small>prosek</small> <strong>{fmt(s.avg, s.decimals)}</strong></span>
                    <span><small>max</small> {fmt(s.max, s.decimals)}</span>
                  </div>
                </div>
              ))}
              <div className="iot-stat">
                <div className="iot-stat-label">Broj merenja</div>
                <div className="iot-stat-values"><strong>{stats?.total_readings ?? 0}</strong></div>
              </div>
            </div>

            <div className="iot-charts">
              {charts.map((c) => (
                <SensorChart
                  key={`${selected.id}-${c.key}`}
                  title={c.title}
                  unit={c.unit}
                  decimals={c.decimals}
                  zeroBased={c.zero}
                  points={toPoints(c.key)}
                  from={chartFrom}
                  to={now}
                  gapMs={rangeDef.bucket * 60 * 1000 * 2.5}
                  dimmed={seriesLoading}
                />
              ))}
            </div>

            <button className="iot-link-btn" onClick={() => setShowTable(!showTable)} aria-expanded={showTable}>
              {showTable ? 'Sakrij tabelu' : `Prikaži tabelu (${series.length} intervala po ${rangeDef.bucket} min)`}
            </button>
            {showTable && (
              <div className="iot-table-wrap iot-series-table">
                <table className="iot-table">
                  <thead>
                    <tr>
                      <th>Vreme</th>
                      <th className="iot-num">Temperatura (°C)</th>
                      {selected.type === 'tank'
                        ? <th className="iot-num">Vlažnost (%)</th>
                        : <th className="iot-num">Svetlost (lux)</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {[...series].reverse().map((p) => (
                      <tr key={p.bucket}>
                        <td>{new Date(p.bucket).toLocaleString('sr-RS')}</td>
                        <td className="iot-num">{fmt(p.temperature)}</td>
                        <td className="iot-num">
                          {selected.type === 'tank' ? fmt(p.humidity) : fmt(p.light_lux, 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default IoT;
