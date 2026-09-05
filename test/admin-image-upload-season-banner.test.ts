import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const productForm = readFileSync('src/app/admin/productos/ProductoForm.tsx', 'utf8');
const seasonsPage = readFileSync('src/app/admin/temporadas/page.tsx', 'utf8');
const campaignPage = readFileSync('src/app/fiestas-patrias-2026/page.tsx', 'utf8');

function readOptional(path: string) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

const imageField = readOptional('src/app/admin/_ui/AdminImageUploadField.tsx');

test('Catálogo Master permite subir una imagen y conserva la URL resultante en imagen_url', () => {
  assert.match(productForm, /AdminImageUploadField/);
  assert.match(productForm, /name=["']imagen_url["']/);
  assert.match(productForm, /Imagen del producto/);
  assert.match(imageField, /type=["']file["']/);
  assert.match(imageField, /accept=.*image\//);
  assert.match(imageField, /\/api\/admin\/media\/sign/);
  assert.match(imageField, /uploadToSignedUrl/);
});

test('Temporadas permite subir banner sin obligar a pegar una URL manual', () => {
  assert.match(seasonsPage, /AdminImageUploadField/);
  assert.match(seasonsPage, /name=["']banner_image["']/);
  assert.match(seasonsPage, /Banner de temporada/);
  assert.match(seasonsPage, /Usar URL manual/);
});

test('Fiestas Patrias renderiza banner local o remoto sin optimización remota de next image', () => {
  assert.doesNotMatch(campaignPage, /from ['"]next\/image['"]/);
  assert.match(campaignPage, /<img[^>]+src=\{dto\.bannerImage\}/);
});
