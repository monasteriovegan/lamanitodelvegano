# ADMIN BASELINE v1

## Baseline congelada

- Commit: `1a85a7e935dbb5d5113f010ad8c3d433167a0772`
- Preview confirmado por el usuario: <https://lamanitodelvegano-fnj1awq0h-monasteriovegans-projects.vercel.app/admin>
- Preview omnicanal con paridad confirmada por el usuario: <https://lamanitodelvegano-e95d1lun6-monasteriovegans-projects.vercel.app/admin>
- Estado de paridad: **CONFIRMADO**.
- Identidad visual: panel verde de La Manito del Vegano.

## Regla de evolución

El proyecto sigue la regla **PRESERVAR + EXTENDER**. Ninguna integración nueva puede reemplazar, simplificar, rediseñar, reordenar ni eliminar capacidades existentes del panel.

Ninguna pull request puede considerarse lista si altera accidentalmente el sidebar, la navegación, las rutas, los módulos, el diseño o la funcionalidad de ADMIN BASELINE v1.

## Zona protegida

La zona protegida incluye, como mínimo:

- `src/app/admin/**`
- `src/components/admin/**`
- `src/lib/supabase/server-auth.ts`
- sidebar, layout, navegación y estilos administrativos
- dashboard, productos, categorías y destacados
- clientes y CRM
- pedidos
- mensajes e integraciones
- métricas
- reservas
- zonas y entregas
- cupones y promo flyer
- blog y ajustes
- temporadas, ingredientes y recetas/costos
- cualquier otro módulo administrativo presente en el commit baseline

Una función nueva solo puede modificar esta zona mediante una adición explícita y revisada. Debe conservar el 100 % de la estructura y comportamiento anteriores.

## Verificación obligatoria por bloque

Antes de aceptar cada bloque se debe ejecutar:

```bash
git diff --exit-code 1a85a7e935dbb5d5113f010ad8c3d433167a0772 HEAD -- \
  src/app/admin src/components/admin src/lib/supabase/server-auth.ts
```

El resultado esperado es un diff vacío. Después se debe construir un Preview y pedir confirmación visual cuando corresponda.

La migración Supabase y las pruebas E2E de WhatsApp permanecen bloqueadas hasta que el Preview tenga variables válidas, autenticación operativa y paridad administrativa confirmada por el usuario.
