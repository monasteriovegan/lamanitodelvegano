import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(_request: Request, context: { params: Promise<{ size: string }> }) {
  const { size } = await context.params;
  const px = size === '512' ? 512 : 192;
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#020705', color: '#00ffb3', borderRadius: px * 0.18,
        border: `${Math.max(4, px * 0.025)}px solid #00ffb3`, fontSize: px * 0.46,
      }}>🎩</div>
    ),
    { width: px, height: px },
  );
}
