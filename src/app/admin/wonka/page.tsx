import { requireRole } from '@/lib/supabase/require-role';
import WonkaHubClient from './WonkaHubClient';
import WonkaImageFlowComposer from './WonkaImageFlowComposer';

export default async function WonkaHubPage() {
  await requireRole(['admin']);
  return (
    <div className="wonka-hub-compact">
      <style>{`
        @media (min-width: 768px) {
          .wonka-hub-compact > div > div.grid > section {
            min-height: 0 !important;
            height: calc(100vh - 190px);
            max-height: 780px;
          }
        }
      `}</style>
      <WonkaHubClient />
      <WonkaImageFlowComposer />
    </div>
  );
}
