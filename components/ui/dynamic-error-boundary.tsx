"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { DynamicLoadError } from "@/components/ui/dynamic-load-error";

interface Props {
  /** Human-readable name of the component being loaded */
  componentName?: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  retryCount: number;
}

/**
 * Error boundary that catches dynamic import failures and shows an inline
 * error with a retry action.
 *
 * Requirement 20.5: IF a dynamically imported component fails to load due to
 * a network error, display a non-blocking error message with a retry action.
 */
export class DynamicErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[DynamicErrorBoundary] Failed to load ${this.props.componentName ?? "component"}:`,
      error,
      errorInfo,
    );
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      retryCount: prev.retryCount + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <DynamicLoadError
          componentName={this.props.componentName}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}
