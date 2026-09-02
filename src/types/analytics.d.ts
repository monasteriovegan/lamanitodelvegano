export {};

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    __lmvAnalytics?: {
      initialPageViewSent?: boolean;
      lastPageViewUrl?: string;
    };
    __lmvPendingMetaEvents?: unknown[][];
    __lmvPendingGoogleEvents?: Array<[string, Record<string, unknown>]>;
  }
}
