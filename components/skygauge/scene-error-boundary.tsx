'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Shown when the child subtree throws. */
  label?: string;
  height?: string;
}

interface State {
  error: Error | null;
}

/**
 * Contains crashes from the 3D / tiles subtrees (e.g. a Google tile load failure
 * surfacing as a renderer error) so they never take down the whole /skygauge page.
 */
export class SceneErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{ height: this.props.height ?? '100%' }}
          className="flex items-center justify-center bg-muted/30 px-6 text-center"
        >
          <div className="max-w-sm space-y-1">
            <p className="text-sm font-medium text-foreground">
              {this.props.label ?? 'This view failed to load'}
            </p>
            <p className="text-xs text-muted-foreground">{this.state.error.message}</p>
            <p className="text-[11px] text-muted-foreground">
              The rest of Skygauge is unaffected — switch views with the toggle above.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
