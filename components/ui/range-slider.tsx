'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';

type RangeSliderProps = {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  step?: number;
  onChangeMin: (v: number) => void;
  onChangeMax: (v: number) => void;
  className?: string;
};

export function RangeSlider({
  min, max, valueMin, valueMax, step = 1,
  onChangeMin, onChangeMax, className,
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const activeThumb = useRef<'min' | 'max' | null>(null);
  const valuesRef = useRef({ valueMin, valueMax, onChangeMin, onChangeMax });
  valuesRef.current = { valueMin, valueMax, onChangeMin, onChangeMax };

  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const leftPct = pct(valueMin);
  const rightPct = pct(valueMax);

  function snap(v: number) {
    return Math.max(min, Math.min(max, Math.round(v / step) * step));
  }

  function getPosValue(clientX: number): number {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return min;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return snap(min + ratio * (max - min));
  }

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    const v = getPosValue(e.clientX);
    const { valueMin: vMin, valueMax: vMax } = valuesRef.current;
    const dMin = Math.abs(v - vMin);
    const dMax = Math.abs(v - vMax);
    activeThumb.current = dMin <= dMax ? 'min' : 'max';

    if (activeThumb.current === 'min') valuesRef.current.onChangeMin(Math.min(v, vMax));
    else valuesRef.current.onChangeMax(Math.max(v, vMin));

    function onMove(ev: MouseEvent) {
      if (!activeThumb.current) return;
      const val = getPosValue(ev.clientX);
      const { valueMin: vn, valueMax: vx, onChangeMin: ocm, onChangeMax: ocx } = valuesRef.current;
      if (activeThumb.current === 'min') ocm(Math.min(val, vx));
      else ocx(Math.max(val, vn));
    }

    function onUp() {
      activeThumb.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  return (
    <div
      ref={trackRef}
      className={cn('relative h-5 flex items-center cursor-pointer select-none', className)}
      onMouseDown={handleMouseDown}
    >
      {/* Track */}
      <div className="absolute inset-x-0 h-1.5 rounded-full bg-muted" />
      {/* Active fill */}
      <div
        className="absolute h-1.5 rounded-full bg-primary"
        style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
      />
      {/* Min thumb */}
      <div
        className="absolute h-4 w-4 rounded-full border-2 border-primary bg-background shadow-sm pointer-events-none -translate-x-1/2"
        style={{ left: `${leftPct}%` }}
      />
      {/* Max thumb */}
      <div
        className="absolute h-4 w-4 rounded-full border-2 border-primary bg-background shadow-sm pointer-events-none -translate-x-1/2"
        style={{ left: `${rightPct}%` }}
      />
    </div>
  );
}
