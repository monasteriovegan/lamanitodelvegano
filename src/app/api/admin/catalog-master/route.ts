import { NextResponse } from 'next/server';

function moved() {
  return NextResponse.json({
    error: 'moved_to_season_catalog',
    message: 'Este editor fue reemplazado por Temporadas & Colecciones para evitar modificar precios maestros desde una campaña.',
  }, { status: 410 });
}

export async function GET() {
  return moved();
}

export async function PATCH() {
  return moved();
}
