import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertCircle, Check, GripVertical, Loader2, Star, Trash2, X } from 'lucide-react';
import { useRouteStore } from '../store/routeStore';
import { buildSchedule, formatClock, parseClock } from '../lib/schedule';
import { formatDistance, formatDuration } from '../lib/format';
import type { StopRow } from '../types';
import { AddressInput } from './AddressInput';

interface RowProps {
  row: StopRow;
  index: number;
  total: number;
  info?: string;
  onFavorites?: () => void;
}

function Row({ row, index, total, info, onFavorites }: RowProps) {
  const { updateStop, removeStop, visits } = useRouteStore();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  const isStart = index === 0;
  const isEnd = index === total - 1;
  const visit = visits[row.id];
  const badge = isStart ? 'bg-green-600' : isEnd ? 'bg-blue-600' : 'bg-slate-600';

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${isDragging ? 'relative z-20 opacity-80' : ''}`}
    >
      <div className="flex items-start gap-1">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Déplacer l'arrêt ${index + 1}`}
          className="mt-2 cursor-grab touch-none rounded p-1 text-gray-400 hover:bg-gray-100 active:cursor-grabbing"
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <AddressInput
            value={row}
            onChange={(p) => updateStop(row.id, p)}
            placeholder={isStart ? 'Point de départ' : isEnd ? 'Destination' : `Arrêt ${index}`}
            invalid={row.status === 'error'}
            leading={
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${badge}`}>
                {isStart ? 'D' : isEnd ? 'A' : index}
              </span>
            }
            trailing={
              <span className="flex items-center gap-1.5">
                {row.status === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                {row.status === 'ok' && <Check className="h-4 w-4 text-green-600" aria-label="Adresse reconnue" />}
                {row.status === 'error' && <AlertCircle className="h-4 w-4 text-red-600" aria-label="Adresse introuvable" />}
                {onFavorites && (
                  <button type="button" onClick={onFavorites} aria-label="Adresses favorites" className="text-yellow-500 hover:text-yellow-600">
                    <Star className="h-4 w-4" />
                  </button>
                )}
                {total > 2 || row.label ? (
                  <button type="button" onClick={() => removeStop(row.id)} aria-label="Supprimer cet arrêt" className="text-gray-400 hover:text-red-600">
                    {total > 2 ? <Trash2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  </button>
                ) : null}
              </span>
            }
          />
          {row.status === 'error' && <p className="mt-0.5 text-xs text-red-600">{row.error ?? 'Adresse introuvable'} — corrigez ou précisez la saisie.</p>}
          {info && row.status !== 'error' && (
            <p className={`mt-0.5 text-xs ${visit === 'done' ? 'text-green-700' : visit === 'failed' ? 'text-red-600' : 'text-gray-500'}`}>
              {visit === 'done' ? '✓ Livré · ' : visit === 'failed' ? '✗ Échec · ' : ''}
              {info}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

export function StopList({ onFavorites }: { onFavorites: (target: 'first' | 'last') => void }) {
  const { stops, reorder, result, stale, departAt, serviceMin } = useRouteStore();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    reorder(
      stops.findIndex((s) => s.id === active.id),
      stops.findIndex((s) => s.id === over.id),
    );
  };

  // Les heures d'arrivée ne sont affichées que si la liste correspond au dernier calcul
  const schedule = result && !stale && result.legs.length === stops.length - 1
    ? buildSchedule(result.legs, parseClock(departAt), serviceMin * 60)
    : null;
  const infoFor = (i: number) => {
    if (!schedule || !result) return undefined;
    if (i === 0) return `Départ ${formatClock(schedule.arrive[0])}`;
    const leg = result.legs[i - 1];
    return `Arrivée ${formatClock(schedule.arrive[i])} · ${formatDistance(leg.distance)} · ${formatDuration(leg.duration)}`;
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <ol className="space-y-2">
          {stops.map((row, i) => (
            <Row
              key={row.id}
              row={row}
              index={i}
              total={stops.length}
              info={infoFor(i)}
              onFavorites={i === 0 ? () => onFavorites('first') : i === stops.length - 1 ? () => onFavorites('last') : undefined}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
