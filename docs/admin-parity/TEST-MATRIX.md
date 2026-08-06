# Matriz de Pruebas de Paridad Administrativa

| ID | Prueba | Descripción | Resultado Esperado | Resultado |
|---|---|---|---|---|
| T01 | Compilación TypeScript | `npx tsc --noEmit` | 0 errores | COMPLETO |
| T02 | Build de Producción | `npm run build` | Compilación exitosa de todas las rutas | COMPLETO |
| T03 | Verificación de Pestañas de Pedidos | Cargar `/admin/pedidos` | Muestra contadores en vivo para cada estado operacional | COMPLETO |
| T04 | Tabla Operativa Desktop | Cargar `/admin/pedidos` en desktop | Despliega tabla con columnas `Número`, `Cliente`, `Total`, `Estado`, `Entrega`, `Fecha`, `Acciones` | COMPLETO |
| T05 | Confirmación de Pago por Transferencia | Hacer clic en "Confirmar pago recibido" | Cambia `payment_status` a `paid`, graba `paid_at = NOW()` y actualiza UI | COMPLETO |
| T06 | Stepper de Progreso de Pedido | Avanzar estado en `/admin/pedidos/[id]` | Muestra pasos completados y actualiza `status` | COMPLETO |
| T07 | Generación de Orden Imprimible | Hacer clic en "Imprimir orden" | Abre ventana de impresión con branding y logo de La Manito | COMPLETO |
| T08 | Guardado de Tracking y Notas | Guardar código de tracking y notas | Persiste datos y graba `shipped_at` | COMPLETO |
| T09 | Historial de Estado | Verificar bloque de historial | Muestra eventos con fecha y timestamp | COMPLETO |
| T10 | Acciones de Contacto | Probar botones WhatsApp y Email | Abre links con datos de pedido pre-rellenados | COMPLETO |
| T11 | Auditoría de Contaminación de Marca | Grep por "Makangru", "Atelier" | 0 resultados en lógica y vistas de La Manito | COMPLETO |

**Cobertura de Pruebas: 100%**
