import type { SalesProject } from '@/lib/schemas/sales';

interface Props {
  projects: SalesProject[];
  currentId: string;
  basePath: string;
}

export function SalesProjectTabs({ projects, currentId, basePath }: Props) {
  if (projects.length <= 1) return null;
  return (
    <div className="flex gap-1.5 flex-wrap">
      {projects.map(p => (
        <a
          key={p.id}
          href={`${basePath}?project=${p.id}`}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            p.id === currentId
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          {p.name}
        </a>
      ))}
    </div>
  );
}
