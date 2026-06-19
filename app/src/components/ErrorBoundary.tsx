import React from 'react';
import ErrorState from './ErrorState';
import { useI18n } from '../i18n/context';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  /** Bumped on retry to force a full remount of the subtree. */
  resetKey: number;
}

/**
 * App-wide safety net. React error boundaries catch errors thrown during render,
 * in lifecycle methods, and in constructors of the child tree — turning a raw
 * red-screen crash into a friendly, bilingual "something went wrong + retry"
 * screen. (Async/event-handler rejections are handled at the call site instead;
 * the network layer in api/ai.ts already degrades gracefully there.)
 *
 * Must live *inside* I18nProvider so the fallback can be localised.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, resetKey: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surfaced in dev logs / crash reporting; intentionally non-fatal.
    console.error('Uncaught UI error:', error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState((s) => ({ hasError: false, resetKey: s.resetKey + 1 }));
  };

  render() {
    if (this.state.hasError) {
      return <Fallback onRetry={this.handleRetry} />;
    }
    // Keying the subtree means "Try again" remounts everything below, clearing
    // whatever transient state caused the crash.
    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}

/** Functional fallback so it can read the i18n context for localised copy. */
function Fallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <ErrorState
      title={t.errors.crashTitle}
      message={t.errors.crashBody}
      retryLabel={t.errors.retry}
      onRetry={onRetry}
    />
  );
}
