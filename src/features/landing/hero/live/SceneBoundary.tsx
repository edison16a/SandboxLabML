'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

/**
 * Catches a hero scene that fails to start, say a browser that refuses a
 * second WebGL context. The scene then draws nothing, so it never counts
 * as shown, and the hero keeps whatever else it has, down to the poster,
 * instead of taking the page down.
 */
export class SceneBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
