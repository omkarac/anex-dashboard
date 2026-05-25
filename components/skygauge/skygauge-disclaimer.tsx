/**
 * Skygauge disclaimer banner.
 *
 * Pinned to the bottom of the workspace. The tool is indicative only — the
 * formal No-Objection Certificate is issued solely by AAI through NOCAS.
 */

export function SkygaugeDisclaimer() {
  return (
    <div className="shrink-0 border-t bg-muted/30 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
      <span className="font-semibold text-foreground/80">Indicative only.</span>{' '}
      Heights are derived from ICAO Annex 14 obstacle limitation surfaces and do not
      account for case-by-case relief, instrument-procedure restrictions, or appellate
      rulings. The formal No-Objection Certificate is issued solely by the{' '}
      <a
        href="https://nocas2.aai.aero/"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium underline underline-offset-2 hover:text-foreground"
      >
        Airports Authority of India (AAI)
      </a>{' '}
      through the NOCAS portal.
    </div>
  );
}
