import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const API_URL = String(process.env.SYNTHETIQ_API_URL || 'https://lamanitodelvegano.vercel.app').replace(/\/$/, '');
const TOKEN = String(process.env.SYNTHETIQ_WORKER_TOKEN || '');
const WORKER_ID = String(process.env.SYNTHETIQ_WORKER_ID || 'synthetiq-browser-railway');
const POLL_MS = Math.max(3000, Number(process.env.POLL_MS || 5000));
const HEADLESS = String(process.env.BROWSER_HEADLESS || 'true') !== 'false';
const DATA_DIR = String(process.env.BROWSER_DATA_DIR || '/data');

if (!TOKEN) throw new Error('missing_SYNTHETIQ_WORKER_TOKEN');

const providerUrls = {
  chatgpt_web: 'https://chatgpt.com/',
  gemini_web: 'https://gemini.google.com/app',
  claude_web: 'https://claude.ai/',
  google_flow: process.env.GOOGLE_FLOW_URL || '',
  higgsfield: process.env.HIGGSFIELD_URL || '',
};

const contexts = new Map();

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function api(payload) {
  const response = await fetch(`${API_URL}/api/worker/jobs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`worker_api_${response.status}:${body?.error || 'unknown'}`);
  return body;
}

function isPrivateHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '::1' || h.endsWith('.local')) return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
  const m = h.match(/^172\.(\d+)\./);
  return Boolean(m && Number(m[1]) >= 16 && Number(m[1]) <= 31);
}

function safeUrl(value) {
  const url = new URL(String(value));
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('blocked_url_protocol');
  if (isPrivateHost(url.hostname)) throw new Error('blocked_private_network_url');
  return url.toString();
}

function safeProfileName(provider) {
  return String(provider || 'generic').toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 80);
}

async function getContext(provider) {
  const key = safeProfileName(provider);
  if (contexts.has(key)) return contexts.get(key);
  const profileDir = path.join(DATA_DIR, 'profiles', key);
  await fs.mkdir(profileDir, { recursive: true });
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: HEADLESS,
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  contexts.set(key, context);
  return context;
}

async function getPage(provider) {
  const context = await getContext(provider);
  const pages = context.pages();
  return pages[0] || await context.newPage();
}

async function snapshot(page, jobId) {
  const dir = path.join(DATA_DIR, 'screenshots');
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${jobId}-${Date.now()}.png`);
  await page.screenshot({ path: file, fullPage: false }).catch(() => undefined);
  return file;
}

async function observe(page) {
  const title = await page.title().catch(() => '');
  const url = page.url();
  const text = (await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')).slice(0, 3500);
  const buttons = await page.getByRole('button').allTextContents().catch(() => []);
  const links = await page.getByRole('link').allTextContents().catch(() => []);
  const inputs = await page.locator('input,textarea,select').evaluateAll((els) => els.slice(0, 30).map((el) => ({
    tag: el.tagName.toLowerCase(),
    type: el.getAttribute('type'),
    name: el.getAttribute('name'),
    placeholder: el.getAttribute('placeholder'),
    ariaLabel: el.getAttribute('aria-label'),
  }))).catch(() => []);
  return { title, url, text, buttons: buttons.slice(0, 40), links: links.slice(0, 40), inputs };
}

async function runStep(page, step) {
  const action = String(step?.action || '');
  if (action === 'goto') return page.goto(safeUrl(step.url), { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (action === 'click_text') return page.getByText(String(step.text || ''), { exact: Boolean(step.exact) }).first().click({ timeout: 15000 });
  if (action === 'click_button') return page.getByRole('button', { name: String(step.name || ''), exact: Boolean(step.exact) }).first().click({ timeout: 15000 });
  if (action === 'fill_label') return page.getByLabel(String(step.label || ''), { exact: Boolean(step.exact) }).first().fill(String(step.value ?? ''), { timeout: 15000 });
  if (action === 'fill_placeholder') return page.getByPlaceholder(String(step.placeholder || ''), { exact: Boolean(step.exact) }).first().fill(String(step.value ?? ''), { timeout: 15000 });
  if (action === 'press') return page.keyboard.press(String(step.key || 'Enter'));
  if (action === 'wait_text') return page.getByText(String(step.text || '')).first().waitFor({ state: 'visible', timeout: Math.min(60000, Number(step.timeout_ms || 15000)) });
  if (action === 'wait_ms') return sleep(Math.min(30000, Math.max(0, Number(step.ms || 1000))));
  if (action === 'select_label') return page.getByLabel(String(step.label || '')).first().selectOption(String(step.value || ''), { timeout: 15000 });
  if (action === 'check_label') return page.getByLabel(String(step.label || '')).first().check({ timeout: 15000 });
  if (action === 'screenshot') return snapshot(page, String(step.job_id || 'step'));
  throw new Error(`unsupported_browser_step:${action}`);
}

async function processJob(job) {
  const provider = String(job.provider || 'synthetiq_browser');
  const page = await getPage(provider);
  const input = job.input && typeof job.input === 'object' ? job.input : {};
  const startUrl = input.url || providerUrls[provider] || '';
  if (startUrl) await page.goto(safeUrl(startUrl), { waitUntil: 'domcontentloaded', timeout: 60000 });

  const steps = Array.isArray(input.steps) ? input.steps.slice(0, 50) : [];
  if (steps.length) {
    for (const step of steps) await runStep(page, step);
    const observation = await observe(page);
    const screenshot = await snapshot(page, job.id);
    return { status: 'completed', output: { observation, screenshot_path: screenshot, steps_executed: steps.length } };
  }

  const observation = await observe(page);
  const screenshot = await snapshot(page, job.id);
  return {
    status: 'waiting_user',
    output: {
      reason: 'adapter_or_steps_required',
      provider,
      instruction: String(job.instruction || '').slice(0, 2000),
      observation,
      screenshot_path: screenshot,
      note: 'Sesión/navegación lista. Falta un adaptador específico o pasos estructurados para continuar sin usar un LLM adicional.',
    },
  };
}

async function updateJob(jobId, result) {
  return api({ action: 'update', job_id: jobId, status: result.status, output: result.output || null, error: result.error || undefined, worker_id: WORKER_ID });
}

async function loop() {
  console.log('synthetiq_browser_worker_started', { API_URL, WORKER_ID, headless: HEADLESS });
  while (true) {
    try {
      const claimed = await api({ action: 'claim', worker_id: WORKER_ID, capabilities: ['browser', 'media'] });
      const job = claimed?.job;
      if (!job) { await sleep(POLL_MS); continue; }
      console.log('job_claimed', { id: job.id, type: job.job_type, provider: job.provider });
      try {
        const result = await processJob(job);
        await updateJob(job.id, result);
        console.log('job_updated', { id: job.id, status: result.status });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await updateJob(job.id, { status: 'failed', error: message, output: { provider: job.provider || null } }).catch(() => undefined);
        console.error('job_failed', { id: job.id, error: message });
      }
    } catch (error) {
      console.error('worker_loop_error', error instanceof Error ? error.message : String(error));
      await sleep(Math.max(POLL_MS, 10000));
    }
  }
}

async function shutdown() {
  for (const context of contexts.values()) await context.close().catch(() => undefined);
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await loop();
