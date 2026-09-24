import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement } from 'react';
import { buildStorageImageElement } from '../src/components/media/SafeStorageImage.ts';

test('missing storage media renders the supplied product fallback', () => {
  const fallback = createElement('span', { 'data-testid': 'product-fallback' }, '🌱');
  const rendered = buildStorageImageElement({
    src: null,
    alt: 'Producto vegano',
    className: 'cover',
    fallback,
    onFailure: () => assert.fail('missing media must not install an image error handler'),
  });

  assert.equal(rendered, fallback);
});

test('a failed storage image reports failure so the component can swap to fallback UI', () => {
  let failed = false;
  const rendered = buildStorageImageElement({
    src: 'https://storage.example.invalid/product.png',
    alt: 'Producto vegano',
    className: 'cover',
    fallback: createElement('span', null, '🌱'),
    onFailure: () => { failed = true; },
  });

  assert.ok(isValidElement<{ src: string; onError: () => void }>(rendered));
  assert.equal(rendered.type, 'img');
  assert.equal(rendered.props.src, 'https://storage.example.invalid/product.png');
  rendered.props.onError();
  assert.equal(failed, true);
});
