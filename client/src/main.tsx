import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.2,
    replaysOnErrorSampleRate: 1.0,
  });
}

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<SentryFallback />}>
    <App />
  </Sentry.ErrorBoundary>
);

function SentryFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="text-center space-y-3 max-w-sm p-6">
        <p className="text-lg font-semibold text-gray-800">Something went wrong</p>
        <p className="text-sm text-gray-500">
          Our team has been notified. Please refresh the page to continue.
        </p>
        <button
          className="mt-4 px-4 py-2 bg-primary text-white rounded-md text-sm"
          onClick={() => window.location.reload()}
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
