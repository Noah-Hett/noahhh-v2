import { Component } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

// Catches bad Project data (validateProject throws during render) so one
// broken entry shows a fallback instead of blanking the whole app.
// Resets when the slug changes so navigating away recovers.
export default class ProjectErrorBoundary extends Component<
  { slug: string | undefined; children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidUpdate(prevProps: { slug: string | undefined }): void {
    if (prevProps.slug !== this.props.slug && this.state.error) {
      this.setState({ error: null });
    }
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <main className="page">
          <h1>This project can't be shown</h1>
          <p>Something in its content is broken, so it was held back.</p>
          <p>
            <Link to="/projects">Back to all projects</Link>
          </p>
        </main>
      );
    }
    return this.props.children;
  }
}
