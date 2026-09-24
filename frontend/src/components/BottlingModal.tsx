import React, { useState } from 'react';
import { isAxiosError } from 'axios';
import { fermentationService } from '../services/fermentationService';
import { inventoryService } from '../services/inventoryService';
import { BOTTLE_VOLUME_LITERS, FermentationStatus, type Bottling, type FermentationBatch } from '../types';

interface Props {
  batch: FermentationBatch;
  onClose: () => void;
  /** Batch je upravo označen kao završen (i ako flaširanje posle toga ne uspe) */
  onBatchCompleted: () => void;
  onBottled: (bottling: Bottling) => void;
}

const apiError = (err: unknown, fallback: string) =>
  (isAxiosError<{ error?: string }>(err) && err.response?.data?.error) || fallback;

const BottlingModal: React.FC<Props> = ({ batch, onClose, onBatchCompleted, onBottled }) => {
  const isActive = batch.status === FermentationStatus.Active;
  const [liters, setLiters] = useState<string>(String(batch.volume_liters));
  const [wineName, setWineName] = useState(batch.name);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const litersNum = Number(liters.replace(',', '.'));
  const validLiters = Number.isFinite(litersNum) && litersNum > 0;
  const bottleCount = validLiters ? Math.floor(litersNum / BOTTLE_VOLUME_LITERS + 1e-9) : 0;
  const remainder = validLiters ? Math.max(0, litersNum - bottleCount * BOTTLE_VOLUME_LITERS) : 0;
  const tooMuch = validLiters && litersNum > batch.volume_liters;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validLiters || bottleCount === 0 || tooMuch) return;
    setSubmitting(true);
    setError('');

    if (isActive) {
      try {
        await fermentationService.updateBatch(batch.id, {
          status: FermentationStatus.Completed,
          end_date: new Date().toISOString(),
        });
        onBatchCompleted();
      } catch (err) {
        setError(apiError(err, 'Završavanje fermentacije nije uspelo'));
        setSubmitting(false);
        return;
      }
    }

    try {
      const bottling = await inventoryService.createBottling({
        batch_id: batch.id,
        wine_liters: litersNum,
        wine_name: wineName.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onBottled(bottling);
    } catch (err) {
      setError(
        (isActive ? 'Fermentacija je završena, ali flaširanje nije uspelo: ' : '') +
          apiError(err, 'Flaširanje nije uspelo')
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={submitting ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isActive ? 'Završi fermentaciju i flaširaj' : 'Flaširaj vino'}</h2>
          <button className="btn-close" onClick={onClose} disabled={submitting} aria-label="Zatvori">
            ✕
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {isActive && (
              <p className="bottling-hint">
                Batch <strong>{batch.name}</strong> će biti označen kao završen, a tank oslobođen.
              </p>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="bottling-liters">
                Koliko litara vina je dobijeno? *
              </label>
              <input
                id="bottling-liters"
                type="number"
                step="0.1"
                min={BOTTLE_VOLUME_LITERS}
                max={batch.volume_liters}
                className="form-control"
                value={liters}
                onChange={(e) => setLiters(e.target.value)}
                required
                autoFocus
              />
              <small className="form-hint">
                Početna zapremina šire: {batch.volume_liters.toLocaleString('sr-RS')} L
              </small>
            </div>

            <div className={`bottling-preview ${tooMuch || (validLiters && bottleCount === 0) ? 'invalid' : ''}`}>
              {tooMuch ? (
                <>⚠ Ne može biti više vina od početne zapremine ({batch.volume_liters} L)</>
              ) : validLiters && bottleCount === 0 ? (
                <>⚠ Premalo vina za jednu flašu od {BOTTLE_VOLUME_LITERS} L</>
              ) : (
                <>
                  <span className="bottling-preview-count">🍾 {bottleCount.toLocaleString('sr-RS')}</span>
                  <span>
                    flaša po {BOTTLE_VOLUME_LITERS.toLocaleString('sr-RS')} L
                    {remainder > 0.004 && <> • ostatak {remainder.toLocaleString('sr-RS', { maximumFractionDigits: 2 })} L</>}
                  </span>
                </>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="bottling-name">Naziv vina</label>
              <input
                id="bottling-name"
                type="text"
                className="form-control"
                value={wineName}
                onChange={(e) => setWineName(e.target.value)}
                maxLength={120}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="bottling-notes">Napomene</label>
              <textarea
                id="bottling-notes"
                className="form-control"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="npr. filtrirano, bez sumpora..."
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Otkaži
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !validLiters || bottleCount === 0 || tooMuch}
            >
              {submitting ? 'Flaširanje…' : `Napravi ${bottleCount.toLocaleString('sr-RS')} flaša`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BottlingModal;
