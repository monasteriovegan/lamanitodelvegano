import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const API_URL = String(process.env.SYNTHETIQ_API_URL || 'https://lamanitodelvegano.vercel.app').replace(/\/$/, '');
const TOKEN = String(process.env.SYNTHETIQ_WORKER_TOKEN || '');
const WORKER_ID = String(process.env.SYNTHETIQ_WORKER_ID || 'synthetiq-browser-railway');
const POLL_MS = Math.max(3000, Number(process.env.POLL_MS || 5000));
const HEADLESS = String(process.env.BROWSER_HEADLESS || 'true') !== 'false';
const DATA_DIR = String(process.env.BROWSER_DATA_DIR || '/data');
const CDP_URL = String(process.env.BROWSER_CDP_URL || '').trim();
const WORKER_PROVIDERS = String(process.env.WORKER_PROVIDERS || 'synthetiq_browser')
  .split(',').map((v) => v.trim()).filter(Boolean);

if (!TOKEN) throw new Error('missing_SYNTHETIQ_WORKER_TOKEN');

const providerUrls = {
  chatgpt_web: 'https://chatgpt.com/',
  gemini_web: 'https://gemini.google.com/app',
  claude_web: 'https://claude.ai/',
  google_flow: process.env.GOOGLE_FLOW_URL || 'https://labs.google/fx/tools/flow/',
  higgsfield: process.env.HIGGSFIELD_URL || 'https://higgsfield.ai/',
};

const contexts = new Map();
const cdpPages = new Map();
let cdpBrowser = null;

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

async function getCdpPage(provider) {
  if (!cdpBrowser) cdpBrowser = await chromium.connectOverCDP(CDP_URL);
  const browserContexts = cdpBrowser.contexts();
  const context = browserContexts[0];
  if (!context) throw new Error('cdp_context_missing');
  const key = safeProfileName(provider);
  const cached = cdpPages.get(key);
  if (cached && !cached.isClosed()) return cached;
  const target = providerUrls[provider] || '';
  let page = null;
  if (target) {
    const host = new URL(target).hostname;
    page = context.pages().find((p) => {
      try { return new URL(p.url()).hostname === host; } catch { return false; }
    }) || null;
  }
  page ||= context.pages().find((p) => p.url() === 'about:blank') || null;
  page ||= await context.newPage();
  cdpPages.set(key, page);
  return page;
}

async function getPage(provider) {
  if (CDP_URL) return getCdpPage(provider);
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

async function clickClickableContainingText(page, candidates) {
  return page.evaluate((texts) => {
    const normalized = texts.map((v) => String(v).toLowerCase());
    const nodes = Array.from(document.querySelectorAll('button,[role="button"],div,span'));
    for (const node of nodes) {
      const own = String(node.textContent || '').trim().toLowerCase();
      if (!own || !normalized.some((text) => own.includes(text))) continue;
      const clickable = node.closest('button,[role="button"]') || node;
      if (clickable instanceof HTMLElement) { clickable.click(); return true; }
    }
    return false;
  }, candidates);
}

async function saveReferenceResponse(response, jobId) {
  const contentType = String(response.headers.get('content-type') || 'image/jpeg').split(';')[0];
  if (!['image/jpeg','image/png','image/webp'].includes(contentType)) throw new Error('reference_not_supported_image');
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > 15 * 1024 * 1024) throw new Error('reference_too_large');
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const dir = path.join(DATA_DIR, 'downloads');
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${jobId}-reference.${ext}`);
  await fs.writeFile(file, data);
  return file;
}

async function downloadReferenceUrl(url, jobId) {
  const safe = safeUrl(url);
  const response = await fetch(safe, { redirect: 'follow' });
  if (!response.ok) throw new Error(`reference_download_failed:${response.status}`);
  return saveReferenceResponse(response, jobId);
}

async function downloadReferencePath(referencePath, jobId) {
  const endpoint = new URL(`${API_URL}/api/worker/attachment`);
  endpoint.searchParams.set('job_id', jobId);
  endpoint.searchParams.set('path', String(referencePath));
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: { Authorization: `Bearer ${TOKEN}` },
    redirect: 'follow',
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`worker_attachment_download_failed:${response.status}:${detail.slice(0, 180)}`);
  }
  return saveReferenceResponse(response, jobId);
}

async function waitForFlowReady(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => undefined);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);

  await page.waitForFunction(() => {
    const bodyText = String(document.body?.innerText || '').toLowerCase();
    const stillLoading = bodyText.includes('cargando') || bodyText.includes('loading');
    const hasPrompt = Boolean(
      document.querySelector('textarea[aria-label="Texto editable"]') ||
      document.querySelector('input[aria-label="Texto editable"]') ||
      document.querySelector('textarea[aria-label="Editable text"]') ||
      document.querySelector('input[aria-label="Editable text"]') ||
      document.querySelector('[contenteditable="true"][aria-label="Texto editable"]') ||
      document.querySelector('[contenteditable="true"][aria-label="Editable text"]')
    );
    return hasPrompt && !stillLoading;
  }, { timeout: 45000 });

  await sleep(1200);
}

async function ensureFlowProject(page) {
  if (!/\/project\//.test(page.url())) {
    if (!page.url().includes('labs.google')) {
      await page.goto(providerUrls.google_flow, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }
    const newProject = page.getByRole('button', { name: /new project|nuevo proyecto/i }).first();
    if (await newProject.count()) await newProject.click({ timeout: 15000 });
    else {
      const clicked = await clickClickableContainingText(page, ['new project', 'nuevo proyecto']);
      if (!clicked) throw new Error('flow_new_project_control_not_found');
    }
    await page.waitForURL(/\/project\//, { timeout: 30000 });
  }
  await waitForFlowReady(page);
}

async function openFlowModePicker(page) {
  const selectors = [
    page.getByRole('button', { name: /nano banana|imagen|image|video|vídeo|veo/i }).first(),
    page.getByText(/nano banana|imagen|image|video|vídeo|veo/i).first(),
  ];

  for (const selector of selectors) {
    try {
      if (await selector.count()) {
        await selector.click({ timeout: 5000 });
        await sleep(800);
        return true;
      }
    } catch {}
  }

  const clicked = await clickClickableContainingText(page, ['nano banana', 'imagen', 'image', 'video', 'vídeo', 'veo']).catch(() => false);
  if (clicked) await sleep(800);
  return Boolean(clicked);
}

async function selectFlowVideoMode(page) {
  await waitForFlowReady(page);
  const bodyBefore = await page.locator('body').innerText().catch(() => '');
  const lowerBefore = String(bodyBefore || '').toLowerCase();

  if ((lowerBefore.includes('veo') || lowerBefore.includes('gemini omni')) && !lowerBefore.includes('nano banana')) return;

  const opened = await openFlowModePicker(page);
  if (!opened) {
    const observation = await observe(page);
    throw new Error(`flow_generation_type_control_not_found:${JSON.stringify({
      buttons: observation.buttons?.slice(0, 20) || [],
      text: String(observation.text || '').slice(0, 500),
    })}`);
  }

  const candidates = [/vídeo/i, /video/i, /veo/i, /gemini omni/i];
  let clicked = false;
  for (const regex of candidates) {
    try {
      const button = page.getByRole('button', { name: regex }).first();
      if (await button.count()) {
        await button.click({ timeout: 5000 });
        clicked = true;
        break;
      }
    } catch {}
    try {
      const text = page.getByText(regex).first();
      if (await text.count()) {
        await text.click({ timeout: 5000 });
        clicked = true;
        break;
      }
    } catch {}
  }

  if (!clicked) clicked = Boolean(await clickClickableContainingText(page, ['vídeo', 'video', 'veo', 'gemini omni']).catch(() => false));

  if (!clicked) {
    const observation = await observe(page);
    throw new Error(`flow_video_option_not_found:${JSON.stringify({
      buttons: observation.buttons?.slice(0, 20) || [],
      text: String(observation.text || '').slice(0, 500),
    })}`);
  }

  await sleep(1500);
  await waitForFlowReady(page);
}

async function runFlowMediaJob(page, job, input) {
  await ensureFlowProject(page);
  const referencePaths = Array.isArray(input.reference_paths) ? input.reference_paths.filter(Boolean).slice(0, 1) : [];
  const referenceUrls = Array.isArray(input.reference_urls) ? input.reference_urls.filter(Boolean).slice(0, 1) : [];
  if (referencePaths.length || referenceUrls.length) {
    const file = referencePaths.length
      ? await downloadReferencePath(String(referencePaths[0]), job.id)
      : await downloadReferenceUrl(String(referenceUrls[0]), job.id);
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.waitFor({ state: 'attached', timeout: 15000 });
    await fileInput.setInputFiles(file);
    await sleep(2500);
    await waitForFlowReady(page);
  }

  if (String(input.media_type || '').toLowerCase() === 'video') await selectFlowVideoMode(page);

  const prompt = String(input.prompt || job.instruction || '').trim();
  if (!prompt) throw new Error('flow_prompt_required');
  const promptInput = page.locator([
    'input[aria-label="Texto editable"]',
    'textarea[aria-label="Texto editable"]',
    'input[aria-label="Editable text"]',
    'textarea[aria-label="Editable text"]',
    '[contenteditable="true"][aria-label="Texto editable"]',
    '[contenteditable="true"][aria-label="Editable text"]',
  ].join(',')).first();
  await promptInput.waitFor({ state: 'visible', timeout: 20000 });
  try {
    await promptInput.fill(prompt);
  } catch {
    await promptInput.click({ timeout: 10000 });
    await page.keyboard.press('Control+A').catch(() => undefined);
    await page.keyboard.press('Backspace').catch(() => undefined);
    await page.keyboard.type(prompt, { delay: 8 });
  }

  await waitForFlowReady(page);
  const createButtons = page.getByRole('button', { name: /crear|create/i });
  const count = await createButtons.count();
  if (count > 0) await createButtons.nth(count - 1).click({ timeout: 15000 });
  else {
    const clicked = await clickClickableContainingText(page, ['crear', 'create']);
    if (!clicked) throw new Error('flow_create_control_not_found');
  }
  await sleep(2500);
  const observation = await observe(page);
  const screenshot = await snapshot(page, job.id);
  return {
    status: 'completed',
    output: {
      submitted: true,
      provider: 'google_flow',
      media_type: input.media_type || null,
      reference_count: referencePaths.length + referenceUrls.length,
      observation,
      screenshot_path: screenshot,
      note: 'Solicitud enviada a Google Flow desde Chrome Wonka.',
    },
  };
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

  if (provider === 'google_flow' && job.job_type === 'media' && (input.prompt || job.instruction)) {
    return runFlowMediaJob(page, job, input);
  }

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
  console.log('synthetiq_browser_worker_started', { API_URL, WORKER_ID, headless: HEADLESS, cdp: Boolean(CDP_URL), providers: WORKER_PROVIDERS });
  while (true) {
    try {
      const claimed = await api({ action: 'claim', worker_id: WORKER_ID, capabilities: ['browser', 'media'], providers: WORKER_PROVIDERS });
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
  if (cdpBrowser) await cdpBrowser.close().catch(() => undefined);
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await loop();