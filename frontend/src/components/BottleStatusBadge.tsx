import React from 'react';
import { BOTTLE_STATUS_LABELS, type BottleStatus } from '../types';

const ICONS: Record<BottleStatus, string> = {
  in_stock: '✓',
  sold: '↗',
  damaged: '✕',
};

/** Status uvek ikona + tekst, ne samo boja */
const BottleStatusBadge: React.FC<{ status: BottleStatus }> = ({ status }) => (
  <span className={`bottle-status bottle-status-${status}`}>
    {ICONS[status]} {BOTTLE_STATUS_LABELS[status]}
  </span>
);

export default BottleStatusBadge;
