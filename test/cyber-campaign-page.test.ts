import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const home = readFileSync('src/app/page.tsx', 'utf8');
const hero = readFileSync('src/components/layout/Hero.tsx', 'utf8');
const cyberPage = readFileSync('src/app/cyber-day-chocolatoso-2026/page.tsx', 'utf8');
const cardSource = readFileSync('src/components/tienda/CampaignProductCard.tsx', 'utf8');
const catalogSource = readFileSync('src/components/tienda/CampaignCatalog.tsx', 'utf8');
const optionSelectorSource = readFileSync('src/components/tienda/OptionQuantitySelector.tsx', 'utf8');

test('home uses the isolated six-card Cyber presentation', () => {
  assert.match(home, /CampaignFeaturedGrid/);
  assert.match(home, /toPublicCatalogCampaign/);
  assert.match(home, /presentationSlot === ['"]featured['"]/);
  assert.doesNotMatch(home, /cyberFeaturedIds/);
});

test('Cyber page composes hero, featured and 25% catalog slots without target duplicates', () => {
  assert.match(cyberPage, /presentationSlot === ['"]hero_offer['"]/);
  assert.match(cyberPage, /presentationSlot === ['"]featured['"]/);
  assert.match(cyberPage, /presentationSlot === ['"]catalog['"]/);
  assert.match(cyberPage, /presentationSlot !== ['"]target_only['"]/);
  assert.match(cyberPage, /25% de descuento/);
});

test('campaign media remains uncropped on the cards and hero links to its offer', () => {
  assert.match(cardSource, /campaignImageUrl\s*\|\|\s*product\.imageUrl/);
  assert.match(cardSource, /object-contain/);
  assert.match(hero, /object-contain/);
  assert.match(hero, /#offer-duo-barras-rellenas/);
});

test('campaign cards can shrink to a mobile viewport without flavor labels widening the grid', () => {
  assert.match(catalogSource, /grid-cols-1/);
  assert.match(catalogSource, /className="min-w-0"/);
  assert.match(optionSelectorSource, /min-w-0 break-words/);
  assert.match(cardSource, /w-full max-w-full/);
  assert.match(cardSource, /flex-col[^"']*sm:flex-row/);
  assert.match(cyberPage, /break-words[^"']*text-3xl/);
});
