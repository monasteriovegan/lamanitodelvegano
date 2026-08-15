import { createHash } from 'crypto';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

const BUCKET = 'wonka-attachments';

async function authorize(request: Request, db: ReturnType<typeof createSupabaseServiceClient>) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const { data } = await db.from('wonka_worker_tokens').select('id,name,active,metadata').eq('token_hash', tokenHash).eq('active', true).maybeSingle();
  if (!data) return null;
  await db.from('wonka_worker_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', data.id);
  return data;
}

export async function GET(request: Request) {
  const db = createSupabaseServiceClient();
  const workerToken = await authorize(request, db);
  if (!workerToken) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const jobId = String(url.searchParams.get('job_id') || '');
  const path = String(url.searchParams.get('path') || '');
  if (!jobId || !path || path.includes('..') || path.startsWith('/')) return Response.json({ error: 'invalid_payload' }, { status: 400 });

  const { data: job, error: jobError } = await db.from('wonka_jobs').select('id,status,input,worker_id').eq('id', jobId).maybeSingle();
  if (jobError) return Response.json({ error: jobError.message }, { status: 400 });
  if (!job) return Response.json({ error: 'job_not_found' }, { status: 404 });
  if (!['running','waiting_user'].includes(String(job.status || ''))) return Response.json({ error: 'job_not_active' }, { status: 409 });

  const allowedPaths = Array.isArray((job.input as any)?.reference_paths) ? (job.input as any).reference_paths.map(String) : [];
  if (!allowedPaths.includes(path)) return Response.json({ error: 'attachment_not_allowed_for_job' }, { status: 403 });

  const downloaded = await db.storage.from(BUCKET).download(path);
  if (downloaded.error || !downloaded.data) return Response.json({ error: 'attachment_download_failed' }, { status: 404 });

  const bytes = await downloaded.data.arrayBuffer();
  const contentType = downloaded.data.type || 'application/octet-stream';
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
