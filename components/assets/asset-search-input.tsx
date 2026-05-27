'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X, Loader2 } from 'lucide-react';

const DEBOUNCE_MS = 150;

export function AssetSearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get('q') ?? '');
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync from URL when the change came from elsewhere (e.g. Clear All).
  // Skip while the user is actively typing, or we'd clobber in-flight input
  // when the server response from a prior keystroke catches up.
  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setValue(searchParams.get('q') ?? '');
  }, [searchParams]);

  function pushQuery(q: string) {
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = q.trim();
    if (trimmed) params.set('q', trimmed);
    else params.delete('q');
    params.delete('page');
    startTransition(() => {
      router.replace(`/capital-markets/assets?${params.toString()}`);
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setValue(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushQuery(q), DEBOUNCE_MS);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      pushQuery(value);
    }
    if (e.key === 'Escape') {
      clear();
    }
  }

  function clear() {
    setValue('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    pushQuery('');
  }

  return (
    <div className="relative w-full max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
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
    </div>
  );
}
