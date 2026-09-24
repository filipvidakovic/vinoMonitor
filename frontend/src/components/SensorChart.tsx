import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface ChartPoint {
  t: number; // epoch ms
  v: number;
}

interface Props {
  title: string;
  unit: string;
  points: ChartPoint[];
  from: number;
  to: number;
  /** Tačke udaljenije od ovoga (ms) se ne spajaju linijom - nedostaju merenja */
  gapMs: number;
  decimals?: number;
  /** Y osa počinje od nule (npr. svetlost) */
  zeroBased?: boolean;
  dimmed?: boolean;
}

const HEIGHT = 220;
const M = { top: 12, right: 16, bottom: 28, left: 52 };

const niceStep = (range: number, count: number) => {
  const raw = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1;
  return step * mag;
};

const formatTime = (t: number, spanMs: number) => {
  const d = new Date(t);
  if (spanMs > 2 * 24 * 3600 * 1000) {
    return d.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit' });
  }
  return d.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });
};

const formatFull = (t: number) =>
  new Date(t).toLocaleString('sr-RS', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

const SensorChart: React.FC<Props> = ({
  title, unit, points, from, to, gapMs, decimals = 1, zeroBased = false, dimmed = false,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const plotW = width - M.left - M.right;
  const plotH = HEIGHT - M.top - M.bottom;

  const { yMin, yMax, yTicks } = useMemo(() => {
    if (points.length === 0) return { yMin: 0, yMax: 1, yTicks: [0, 1] };
    let lo = Math.min(...points.map((p) => p.v));
    let hi = Math.max(...points.map((p) => p.v));
    if (zeroBased) lo = 0;
    if (hi - lo < 1e-9) { hi += 1; lo = zeroBased ? 0 : lo - 1; }
    const step = niceStep(hi - lo, 4);
    const min = Math.floor(lo / step) * step;
    const max = Math.ceil(hi / step) * step;
    const ticks: number[] = [];
    for (let v = min; v <= max + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
    return { yMin: min, yMax: max, yTicks: ticks };
  }, [points, zeroBased]);

  const x = (t: number) => M.left + ((t - from) / (to - from)) * plotW;
  const y = (v: number) => M.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  const path = useMemo(() => {
    let d = '';
    points.forEach((p, i) => {
      const cmd = i === 0 || p.t - points[i - 1].t > gapMs ? 'M' : 'L';
      d += `${cmd}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`;
    });
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, gapMs, width, yMin, yMax, from, to]);

  const xTicks = useMemo(() => {
    const n = Math.max(2, Math.min(6, Math.floor(plotW / 110)));
    return Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n);
  }, [from, to, plotW]);

  const nearestIndex = (clientX: number) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const t = from + ((clientX - rect.left - M.left) / plotW) * (to - from);
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i].t - t) < Math.abs(points[best].t - t)) best = i;
    }
    return best;
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (points.length === 0) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const cur = active ?? points.length - 1;
      const next = e.key === 'ArrowRight' ? Math.min(points.length - 1, cur + 1) : Math.max(0, cur - 1);
      setActive(next);
    } else if (e.key === 'Escape') {
      setActive(null);
    }
  };

  const activePoint = active !== null ? points[active] : null;
  const tooltipLeft = activePoint ? Math.min(Math.max(x(activePoint.t), 70), width - 70) : 0;

  return (
    <div className={`sensor-chart ${dimmed ? 'sensor-chart-dimmed' : ''}`}>
      <div className="sensor-chart-title">
        {title} <span className="sensor-chart-unit">({unit})</span>
      </div>
      <div className="sensor-chart-plot" ref={wrapRef}>
        {points.length === 0 ? (
          <div className="sensor-chart-empty" style={{ height: HEIGHT }}>
            Nema merenja u izabranom periodu
          </div>
        ) : (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`${title}, ${points.length} tačaka. Strelicama levo/desno kroz vrednosti.`}
            tabIndex={0}
            onPointerMove={(e) => setActive(nearestIndex(e.clientX))}
            onPointerLeave={() => setActive(null)}
            onKeyDown={handleKey}
            onBlur={() => setActive(null)}
          >
            {/* Grid + Y osa */}
            {yTicks.map((v) => (
              <g key={v}>
                <line x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)}
                  className={v === yMin ? 'chart-baseline' : 'chart-grid'} />
                <text x={M.left - 8} y={y(v)} className="chart-tick" textAnchor="end" dominantBaseline="middle">
                  {v.toLocaleString('sr-RS')}
                </text>
              </g>
            ))}
            {/* X osa */}
            {xTicks.map((t, i) => (
              <text key={t} x={x(t)} y={HEIGHT - 8} className="chart-tick"
                textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}>
                {formatTime(t, to - from)}
              </text>
            ))}

            <path d={path} className="chart-line" />

            {/* Usamljene tačke (bez suseda) inače ne bi bile vidljive */}
            {points.map((p, i) => {
              const alone = (i === 0 || p.t - points[i - 1].t > gapMs)
                && (i === points.length - 1 || points[i + 1].t - p.t > gapMs);
              return alone ? <circle key={p.t} cx={x(p.t)} cy={y(p.v)} r={3} className="chart-dot-small" /> : null;
            })}

            {activePoint && (
              <g pointerEvents="none">
                <line x1={x(activePoint.t)} x2={x(activePoint.t)} y1={M.top} y2={M.top + plotH}
                  className="chart-crosshair" />
                <circle cx={x(activePoint.t)} cy={y(activePoint.v)} r={5} className="chart-dot" />
              </g>
            )}
          </svg>
        )}

        {activePoint && (
          <div className="chart-tooltip" style={{ left: tooltipLeft }}>
            <div className="chart-tooltip-value">
              <span className="chart-tooltip-key" />
              {activePoint.v.toLocaleString('sr-RS', { maximumFractionDigits: decimals })} {unit}
            </div>
            <div className="chart-tooltip-label">{formatFull(activePoint.t)}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SensorChart;
