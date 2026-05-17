'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { searchChannelPartners } from '@/lib/actions/sales/channel-partners';
import type { ChannelPartner } from '@/lib/schemas/sales';

interface CpSearchComboboxProps {
  value: string | null;
  onChange: (cpId: string) => void;
  projectId?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function CpSearchCombobox({
  value,
  onChange,
  placeholder = 'Search channel partner...',
  disabled = false,
}: CpSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChannelPartner[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedName, setSelectedName] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (term: string) => {
    if (!term || term.length < 2) { setResults([]); return; }
    setLoading(true);
    const data = await searchChannelPartners(term);
    setResults(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSelect(cp: ChannelPartner) {
    onChange(cp.id);
    setSelectedName(cp.canonical_name);
    setQuery('');
    setOpen(false);
  }

  function handleClear() {
    onChange('');
    setSelectedName('');
    setQuery('');
    setResults([]);
  }

  const isFuzzy = (cp: ChannelPartner) =>
    query.length > 0 &&
    !cp.canonical_name.toLowerCase().includes(query.toLowerCase()) &&
    !cp.aliases.some(a => a.toLowerCase().includes(query.toLowerCase()));

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className={cn(
          'flex items-center w-full h-10 rounded-md border border-input bg-background px-3 text-sm',
          'focus-within:ring-2 focus-within:ring-ring',
          disabled && 'opacity-50 pointer-events-none'
        )}
      >
        {value && selectedName ? (
          <>
            <span className="flex-1 truncate text-sm">{selectedName}</span>
            <button type="button" onClick={handleClear} className="ml-1 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          </>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md overflow-hidden">
          {loading && (
            <div className="py-3 text-center text-xs text-muted-foreground">Searching...</div>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="py-3 text-center text-xs text-muted-foreground">
              No CP found for &ldquo;{query}&rdquo;
            </div>
          )}
          {!loading && query.length < 2 && (
            <div className="py-3 text-center text-xs text-muted-foreground">
              Type at least 2 characters to search
            </div>
          )}
          {results.length > 0 && (
            <div className="max-h-60 overflow-y-auto py-1">
              {results.map(cp => (
                <button
                  key={cp.id}
                  type="button"
                  onClick={() => handleSelect(cp)}
                  className={cn(
                    'w-full text-left px-3 py-2 hover:bg-accent transition-colors',
                    value === cp.id && 'bg-accent/60'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{cp.canonical_name}</span>
                    {isFuzzy(cp) && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-amber-600">
                        <AlertTriangle className="h-3 w-3" /> fuzzy
                      </span>
                    )}
                  </div>
                  {cp.aliases.length > 0 && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      Also known as: {cp.aliases.slice(0, 3).join(', ')}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
