import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { approveWonkaJob, cancelWonkaJob, chooseResource, createWonkaJob, listResources, recentWonkaJobs } from './jobs';

export type ComputerToolDefinition = {
  name: string;
  description: string;
  write: boolean;
  inputSchema: Record<string, unknown>;
};

export const WONKA_COMPUTER_TOOLS: ComputerToolDefinition[] = [
  {
    name: 'synthetiq_resources',
    description: 'Lista recursos disponibles para navegador, generación multimedia, APIs y workers. Incluye prioridad, modo de uso (cuota web, open source, crédito o API) y cuota restante cuando se conoce.',
    write: false,
    inputSchema: { type: 'object', properties: { resource_type: { type: 'string', enum: ['browser','media','api','worker'] } }, additionalProperties: false },
  },
  {
    name: 'recent_wonka_jobs',
    description: 'Consulta trabajos recientes preparados o ejecutados por Wonka: navegador, multimedia, computer y workflows.',
    write: false,
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 50 } }, additionalProperties: false },
  },
  {
    name: 'prepare_browser_job',
    description: 'Prepara un trabajo para el Computer/Browser de Synthetiq, como abrir una web, rellenar formularios, subir archivos o usar una herramienta web. NO ejecuta todavía: crea un trabajo supervisado pendiente de aprobación.',
    write: true,
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' }, instruction: { type: 'string' }, url: { type: 'string' },
        provider: { type: 'string' }, business_unit_id: { type: 'string' },
        risk_level: { type: 'string', enum: ['low','medium','high'] },
      },
      required: ['title','instruction'], additionalProperties: false,
    },
  },
  {
    name: 'prepare_media_job',
    description: 'Prepara una generación de imagen o video. Selecciona preferentemente cuota web u open source antes de API pagada. Crea un trabajo supervisado pendiente de aprobación y puede apuntar a Google Flow, Higgsfield o al panel propio de Synthetiq.',
    write: true,
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' }, prompt: { type: 'string' }, media_type: { type: 'string', enum: ['image','video'] },
        provider: { type: 'string' }, model: { type: 'string' }, aspect_ratio: { type: 'string' }, duration_seconds: { type: 'integer' },
        business_unit_id: { type: 'string' }, reference_urls: { type: 'array', items: { type: 'string' } },
      },
      required: ['title','prompt','media_type'], additionalProperties: false,
    },
  },
  {
    name: 'approve_wonka_job',
    description: 'Aprueba un trabajo preparado por Wonka y lo deja en cola para que lo tome un worker. Es una acción real y requiere confirmación explícita.',
    write: true,
    inputSchema: { type: 'object', properties: { job_id: { type: 'string' } }, required: ['job_id'], additionalProperties: false },
  },
  {
    name: 'cancel_wonka_job',
    description: 'Cancela un trabajo de Wonka que todavía no finaliza. Requiere confirmación explícita.',
    write: true,
    inputSchema: { type: 'object', properties: { job_id: { type: 'string' } }, required: ['job_id'], additionalProperties: false },
  },
];

export function isComputerTool(name: string) {
  return WONKA_COMPUTER_TOOLS.some((tool) => tool.name === name);
}

export async function runComputerTool(
  db: SupabaseClient,
  toolName: string,
  args: any,
  ctx: { actorId?: string | null; allowWrite?: boolean },
) {
  const definition = WONKA_COMPUTER_TOOLS.find((tool) => tool.name === toolName);
  if (!definition) throw new Error('unknown_computer_tool');
  if (definition.write && !ctx.allowWrite) throw new Error('write_confirmation_required');

  if (toolName === 'synthetiq_resources') {
    return listResources(db, { resourceType: args?.resource_type ? String(args.resource_type) : undefined });
  }
  if (toolName === 'recent_wonka_jobs') return recentWonkaJobs(db, Number(args?.limit || 20));

  if (toolName === 'prepare_browser_job') {
    const resource = args?.provider
      ? (await listResources(db, { resourceType: 'browser', businessUnitId: args?.business_unit_id || null })).find((r: any) => String(r.provider).toLowerCase() === String(args.provider).toLowerCase())
      : await chooseResource(db, { resourceType: 'browser', businessUnitId: args?.business_unit_id || null });
    return createWonkaJob(db, {
      ownerUserId: ctx.actorId || null,
      businessUnitId: args?.business_unit_id || null,
      jobType: 'browser', title: String(args?.title || 'Trabajo de navegador'), instruction: String(args?.instruction || ''),
      provider: resource?.provider || args?.provider || null, resourceId: resource?.id || null,
      riskLevel: args?.risk_level || 'medium', input: { url: args?.url || null, routing: resource ? { mode: resource.mode, label: resource.label } : null },
    });
  }

  if (toolName === 'prepare_media_job') {
    const resources = await listResources(db, { resourceType: 'media', businessUnitId: args?.business_unit_id || null });
    const explicit = args?.provider ? resources.find((r: any) => String(r.provider).toLowerCase() === String(args.provider).toLowerCase()) : null;
    const resource = explicit || await chooseResource(db, { resourceType: 'media', businessUnitId: args?.business_unit_id || null });
    return createWonkaJob(db, {
      ownerUserId: ctx.actorId || null,
      businessUnitId: args?.business_unit_id || null,
      jobType: 'media', title: String(args?.title || 'Generación multimedia'), instruction: String(args?.prompt || ''),
      provider: resource?.provider || args?.provider || null, resourceId: resource?.id || null, riskLevel: 'medium',
      input: {
        media_type: args?.media_type, prompt: args?.prompt, model: args?.model || null, aspect_ratio: args?.aspect_ratio || null,
        duration_seconds: args?.duration_seconds || null, reference_urls: Array.isArray(args?.reference_urls) ? args.reference_urls : [],
        routing: resource ? { mode: resource.mode, label: resource.label, quota_remaining: resource.quota_remaining, quota_unit: resource.quota_unit } : null,
      },
    });
  }

  if (toolName === 'approve_wonka_job') return approveWonkaJob(db, { jobId: String(args?.job_id || ''), approvedBy: ctx.actorId || null });
  if (toolName === 'cancel_wonka_job') return cancelWonkaJob(db, String(args?.job_id || ''));
  throw new Error('unknown_computer_tool');
}
