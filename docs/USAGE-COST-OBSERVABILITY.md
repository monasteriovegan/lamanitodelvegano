# Uso & Costos · Synthetiq

La capa de observabilidad registra eventos append-only en `usage_events`.

## Alcance actual

- Gemini: tokens de entrada, salida, pensamiento, caché, herramientas, total, latencia y costo estimado por llamada.
- Remy: asociación por `business_unit_id` y `conversation_id`.
- Wonka: asociación al negocio activo por defecto y al thread cuando se provee.
- WhatsApp Cloud API: cada envío queda observado por conversación con provider message id y latencia. El costo se deja `observed_unpriced` mientras no exista información de facturación/categoría suficiente para asignar una tarifa real sin inferencias.
- Dashboard: `/admin/uso-costos` muestra hoy/mes, agentes, conversaciones, tokens, costos y cuota observada.

## Precios

`provider_pricing` guarda snapshots versionados. El costo histórico no se recalcula retroactivamente si cambia la tarifa.

El seed inicial usa la tarifa estándar pagada de Gemini 2.5 Flash vigente al implementar esta capa; la fuente queda guardada en `source_url`.

## Cuotas

`provider_quota_configs` admite RPM, TPM y RPD verificados. Si un límite no está configurado, el panel muestra únicamente el consumo observado y dice explícitamente `límite no configurado`.

## Multi-negocio

Los eventos llevan `business_unit_id`; no existe una tabla paralela por marca. Al sumar Makangru u otra unidad, la misma telemetría puede agregarse por workspace sin rediseñar el ledger.
