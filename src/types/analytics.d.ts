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
  }
}
