import { Component, type ErrorInfo, type ReactNode } from "react";

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Keep exception details and ledger data on this device; there is no reporting endpoint.
  }
  render() {
    if (this.state.failed) return <main className="app-frame"><section className="glass-panel p-8" role="alert">
      <h1 className="text-2xl font-semibold">The ledger couldn’t open.</h1>
      <p className="muted my-4">Reload to try again. Your saved data has not been cleared. If the problem continues, try opening Tally in a browser with local storage enabled.</p>
      <button className="btn" type="button" onClick={() => window.location.reload()}>Reload Tally</button>
    </section></main>;
    return this.props.children;
  }
}
