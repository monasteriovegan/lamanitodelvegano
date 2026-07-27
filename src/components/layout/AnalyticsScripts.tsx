'use client';

import Script from 'next/script';

/**
 * Meta Pixel + GA4. Los IDs se configuran desde /admin/integraciones (no
 * hardcodeados acá) y se leen server-side en layout.tsx, que le pasa las
 * props a este componente cliente. Si un ID no está configurado, ese
 * script simplemente no se renderiza — no rompe nada, solo no trackea.
 */
export function AnalyticsScripts({ metaPixelId, ga4Id }: { metaPixelId?: string | null; ga4Id?: string | null }) {
  return (
    <>
      {metaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${metaPixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}

      {ga4Id && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${ga4Id}');
              window.gtag = gtag;
            `}
          </Script>
        </>
      )}
    </>
  );
}
