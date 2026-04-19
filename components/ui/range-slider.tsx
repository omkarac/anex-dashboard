'use client';

import { useRef, useCallback } from 'react';
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
  const rangeRef = useRef<HTMLDivElement>(null);

  const pct = useCallback(
    (v: number) => ((v - min) / (max - min)) * 100,
    [min, max]
  );

  const leftPct  = pct(valueMin);
  const rightPct = pct(valueMax);

  return (
    <div ref={rangeRef} className={cn('relative h-5 flex items-center', className)}>
      {/* Track */}
      <div className="absolute inset-x-0 h-1.5 rounded-full bg-muted" />
      {/* Active fill */}
      <div
        className="absolute h-1.5 rounded-full bg-primary"
        style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
      />
      {/* Min thumb */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valueMin}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (v <= valueMax) onChangeMin(v);
        }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        style={{ pointerEvents: valueMin >= valueMax ? 'none' : 'auto' }}
      />
      {/* Max thumb */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valueMax}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (v >= valueMin) onChangeMax(v);
        }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
      />
      {/* Visible thumbs */}
      <div
        className="absolute h-4 w-4 rounded-full border-2 border-primary bg-background shadow-sm pointer-events-none z-30 -translate-x-1/2"
        style={{ left: `${leftPct}%` }}
      />
      <div
        className="absolute h-4 w-4 rounded-full border-2 border-primary bg-background shadow-sm pointer-events-none z-30 -translate-x-1/2"
        style={{ left: `${rightPct}%` }}
      />
    </div>
  );
}
