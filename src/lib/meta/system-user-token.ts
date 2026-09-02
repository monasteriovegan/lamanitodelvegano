type MetaTokenDiagnostic = {
  appId: string | null;
  valid: boolean;
  tokenType?: string;
  subjectId?: string | null;
  scopes: string[];
};

const REQUIRED_SCOPES = [
  'whatsapp_business_management',
  'whatsapp_business_messaging',
] as const;

export function validateWhatsAppSystemUserToken(
  diagnostic: MetaTokenDiagnostic,
  expectedAppId: string,
) {
  if (!diagnostic.valid) return { ok: false as const, reason: 'token_invalid' };
  if (diagnostic.appId !== expectedAppId) return { ok: false as const, reason: 'wrong_app' };
  if (diagnostic.tokenType !== 'SYSTEM_USER') return { ok: false as const, reason: 'wrong_token_type' };
  if (!REQUIRED_SCOPES.every((scope) => diagnostic.scopes.includes(scope))) {
    return { ok: false as const, reason: 'missing_required_scopes' };
  }

  return {
    ok: true as const,
    systemUserId: diagnostic.subjectId ?? null,
    scopes: REQUIRED_SCOPES.slice(),
  };
}
