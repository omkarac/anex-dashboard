'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X, Loader2 } from 'lucide-react';
import { searchAssetSuggestions } from '@/lib/actions/assets';

export function AssetSearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get('q') ?? '');
  const [suggestions, setSuggestions] = useState<{ id: string; property_name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync input if URL param changes externally
  useEffect(() => {
    setValue(searchParams.get('q') ?? '');
  }, [searchParams]);

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  function fetchSuggestions(q: string) {
    if (!q.trim()) { setSuggestions([]); setOpen(false); return; }
    startTransition(async () => {
      const results = await searchAssetSuggestions(q);
      setSuggestions(results);
      setOpen(results.length > 0);
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setValue(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(q), 280);
  }

  function navigate(q: string) {
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    if (q.trim()) {
      params.set('q', q.trim());
    } else {
      params.delete('q');
    }
    params.delete('page');
    router.push(`/assets?${params.toString()}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { navigate(value); }
    if (e.key === 'Escape') { setOpen(false); }
  }

  function clear() {
    setValue('');
    setSuggestions([]);
    setOpen(false);
    navigate('');
  }

  function selectSuggestion(item: { id: string; property_name: string }) {
    setValue(item.property_name);
    setOpen(false);
    router.push(`/assets/${item.id}`);
  }

  const highlight = (text: string, q: string) => {
    if (!q.trim()) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase().trim());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="font-semibold text-foreground">{text.slice(idx, idx + q.trim().length)}</span>
        {text.slice(idx + q.trim().length)}
      </>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder="Search assets by name…"
        className="w-full h-9 rounded-md border bg-background pl-9 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {value && !isPending && (
          <button onClick={clear} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-lg border bg-popover shadow-lg overflow-hidden">
          {suggestions.map((item) => (
            <button
              key={item.id}
              onClick={() => selectSuggestion(item)}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 transition-colors"
            >
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground truncate">
                {highlight(item.property_name, value)}
              </span>
            </button>
          ))}
          <button
            onClick={() => navigate(value)}
            className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:bg-accent border-t transition-colors"
          >
            Search all results for &ldquo;{value}&rdquo;
          </button>
        </div>
      )}
    </div>
  );
}
