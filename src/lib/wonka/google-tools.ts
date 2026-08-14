import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readEmail, searchEmails, sendEmail } from './google-gmail';

export type GoogleToolDefinition = {
  name: string;
  description: string;
  write: boolean;
  confirmationMode?: 'direct_command' | 'explicit';
  inputSchema: Record<string, unknown>;
};

export const WONKA_GOOGLE_TOOLS: GoogleToolDefinition[] = [
  {
    name: 'recent_emails',
    description: 'Lista correos recientes de Gmail con remitente, asunto, fecha y snippet. No descarga el cuerpo completo salvo que se use read_email.',
    write: false,
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 20 } }, additionalProperties: false },
  },
  {
    name: 'email_search',
    description: 'Busca correos en Gmail usando la sintaxis de búsqueda de Gmail, por ejemplo from:, subject:, newer_than:, is:unread.',
    write: false,
    inputSchema: {
      type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 20 } },
      required: ['query'], additionalProperties: false,
    },
  },
  {
    name: 'read_email',
    description: 'Lee un correo específico de Gmail por message_id y devuelve metadatos y cuerpo de texto limitado.',
    write: false,
    inputSchema: { type: 'object', properties: { message_id: { type: 'string' } }, required: ['message_id'], additionalProperties: false },
  },
  {
    name: 'send_email',
    description: 'Envía un correo real desde Gmail. Si Esteban ordena directamente “envía”, “respóndele” o equivalente con destinatario y contenido claros, esa orden cuenta como autorización. Si solo pide preparar/redactar, no envíes.',
    write: true,
    confirmationMode: 'direct_command',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'array', items: { type: 'string' } },
        cc: { type: 'array', items: { type: 'string' } },
        subject: { type: 'string' },
        body: { type: 'string' },
        reply_to_message_id: { type: 'string' },
      },
      required: ['to','subject','body'], additionalProperties: false,
    },
  },
];

export function isGoogleTool(name: string) { return WONKA_GOOGLE_TOOLS.some((tool) => tool.name === name); }
export function getGoogleToolDefinition(name: string) { return WONKA_GOOGLE_TOOLS.find((tool) => tool.name === name) || null; }

export async function runGoogleTool(db: SupabaseClient, toolName: string, args: any, ctx: { allowWrite?: boolean }) {
  const definition = WONKA_GOOGLE_TOOLS.find((tool) => tool.name === toolName);
  if (!definition) throw new Error('unknown_google_tool');
  if (definition.write && !ctx.allowWrite) throw new Error('write_confirmation_required');
  if (toolName === 'recent_emails') return searchEmails(db, { limit: Number(args?.limit || 10) });
  if (toolName === 'email_search') return searchEmails(db, { query: String(args?.query || ''), limit: Number(args?.limit || 10) });
  if (toolName === 'read_email') return readEmail(db, String(args?.message_id || ''));
  if (toolName === 'send_email') return sendEmail(db, {
    to: Array.isArray(args?.to) ? args.to.map(String) : [],
    cc: Array.isArray(args?.cc) ? args.cc.map(String) : [],
    subject: String(args?.subject || ''),
    body: String(args?.body || ''),
    replyToMessageId: args?.reply_to_message_id ? String(args.reply_to_message_id) : undefined,
  });
  throw new Error('unknown_google_tool');
}
