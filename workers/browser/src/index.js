import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const API_URL = String(process.env.SYNTHETIQ_API_URL || 'https://lamanitodelvegano.cl').replace(/\/$/, '');
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
  const context = cdpBrowser.contexts()[0];
  if (!context) throw new Error('cdp_context_missing');
  const key = safeProfileName(provider);
  const cached = cdpPages.get(key);
  if (cached && !cached.isClosed()) return cached;

  const target = providerUrls[provider] || '';
  let page = null;
  if (target) {
    const host = new URL(target).hostname;
    const matching = context.pages().filter((p) => {
      try { return new URL(p.url()).hostname === host; } catch { return false; }
    });
    if (provider === 'google_flow') page = matching.find((p) => /\/project\//.test(p.url())) || null;
    page ||= matching[0] || null;
  }
  page ||= context.pages().find((p) => p.url() === 'about:blank') || null;
  page ||= await context.newPage();
  cdpPages.set(key, page);
  return page;
}

async function getPage(provider) {
  if (CDP_URL) return getCdpPage(provider);
  const context = await getContext(provider);
  return context.pages()[0] || await context.newPage();
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

async function clickVisibleText(page, text, { exact = false, timeout = 8000 } = {}) {
  const locator = page.getByText(text, { exact }).filter({ visible: true }).first();
  if (await locator.count().catch(() => 0)) {
    await locator.click({ timeout });
    return true;
  }
  return false;
}

async function clickClickableContainingText(page, candidates) {
  return page.evaluate((texts) => {
    const normalized = texts.map((v) => String(v).toLowerCase());
    const nodes = Array.from(document.querySelectorAll('button,[role="button"],[role="menuitem"],[role="option"],[tabindex]'));
    const visible = nodes.filter((node) => {
      if (!(node instanceof HTMLElement)) return false;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    });
    const scored = visible.map((node) => {
      const own = String(node.textContent || '').trim().toLowerCase();
      let score = 999;
      for (const text of normalized) {
        if (own === text) score = Math.min(score, 0);
        else if (own.startsWith(text)) score = Math.min(score, 1);
        else if (own.includes(text)) score = Math.min(score, 2);
      }
      return { node, score, len: own.length };
    }).filter((x) => x.score < 999).sort((a, b) => a.score - b.score || a.len - b.len);
    const target = scored[0]?.node;
    if (target instanceof HTMLElement) { target.click(); return true; }
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
  const response = await fetch(safeUrl(url), { redirect: 'follow' });
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
  await page.getByText('¿Qué quieres crear?', { exact: false }).first().waitFor({ state: 'visible', timeout: 45000 }).catch(async () => {
    await page.getByText(/what do you want to create/i).first().waitFor({ state: 'visible', timeout: 5000 });
  });
  await sleep(800);
}

async function ensureFlowProject(page) {
  if (/\/project\//.test(page.url())) {
    await waitForFlowReady(page);
    return page;
  }

  const context = page.context();
  const existingProject = context.pages().find((p) => /labs\.google/.test(p.url()) && /\/project\//.test(p.url()));
  if (existingProject) {
    await existingProject.bringToFront().catch(() => undefined);
    cdpPages.set('google_flow', existingProject);
    await waitForFlowReady(existingProject);
    return existingProject;
  }

  if (!page.url().includes('labs.google')) await page.goto(providerUrls.google_flow, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const before = new Set(context.pages());
  const newProject = page.getByRole('button', { name: /new project|nuevo proyecto/i }).first();
  if (await newProject.count()) await newProject.click({ timeout: 15000 });
  else if (!await clickClickableContainingText(page, ['new project', 'nuevo proyecto'])) throw new Error('flow_new_project_control_not_found');

  const deadline = Date.now() + 35000;
  let projectPage = null;
  while (Date.now() < deadline) {
    if (/\/project\//.test(page.url())) { projectPage = page; break; }
    projectPage = context.pages().find((p) => !before.has(p) && /\/project\//.test(p.url())) || context.pages().find((p) => /\/project\//.test(p.url())) || null;
    if (projectPage) break;
    await sleep(500);
  }
  if (!projectPage) throw new Error('flow_project_not_opened');
  cdpPages.set('google_flow', projectPage);
  await waitForFlowReady(projectPage);
  return projectPage;
}

async function ensureFlowVideoMode(page) {
  await waitForFlowReady(page);
  let body = await page.locator('body').innerText().catch(() => '');
  if (/vídeo\s*[·•]|video\s*[·•]/i.test(body)) return;

  const nano = page.getByText(/nano banana/i).first();
  if (await nano.count()) await nano.click({ timeout: 8000 });
  else if (!await clickClickableContainingText(page, ['nano banana'])) throw new Error('flow_generation_type_control_not_found');
  await sleep(700);

  const video = page.getByText(/vídeo|video/i).filter({ visible: true }).first();
  if (await video.count()) await video.click({ timeout: 8000 });
  else if (!await clickClickableContainingText(page, ['vídeo', 'video'])) throw new Error('flow_video_option_not_found');
  await sleep(1200);
  body = await page.locator('body').innerText().catch(() => '');
  if (!/vídeo\s*[·•]|video\s*[·•]/i.test(body)) throw new Error('flow_video_mode_not_selected');
}

async function ensureFlowFramesMode(page) {
  await ensureFlowVideoMode(page);
  let body = await page.locator('body').innerText().catch(() => '');
  if (/\bInicial\b[\s\S]*\bFinal\b/i.test(body)) return;

  const chip = page.getByText(/vídeo\s*[·•].*\d+s|video\s*[·•].*\d+s/i).first();
  if (await chip.count()) await chip.click({ timeout: 8000 });
  else if (!await clickClickableContainingText(page, ['vídeo ·', 'video ·'])) throw new Error('flow_video_settings_control_not_found');
  await sleep(700);

  const frames = page.getByText(/fotogramas|frames/i).filter({ visible: true }).first();
  if (await frames.count()) await frames.click({ timeout: 8000 });
  else if (!await clickClickableContainingText(page, ['fotogramas', 'frames'])) throw new Error('flow_frames_option_not_found');
  await sleep(900);
  body = await page.locator('body').innerText().catch(() => '');
  if (!/\bInicial\b|\bStart\b/i.test(body)) throw new Error('flow_frames_mode_not_selected');
}

async function attachFlowStartFrame(page, file) {
  await ensureFlowFramesMode(page);
  const initial = page.getByText(/^(Inicial|Start)$/i).first();
  if (await initial.count()) await initial.click({ timeout: 8000 });
  else if (!await clickClickableContainingText(page, ['inicial', 'start'])) throw new Error('flow_start_frame_control_not_found');

  await page.getByText(/Subir archivos multimedia|Upload media/i).first().waitFor({ state: 'visible', timeout: 10000 });
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 10000 });
  await fileInput.setInputFiles(file);
  await sleep(3000);

  const addButton = page.getByRole('button', { name: /Añadir a la petición|Add to prompt/i }).first();
  await addButton.waitFor({ state: 'visible', timeout: 15000 });
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (await addButton.isEnabled().catch(() => false)) break;
    await sleep(500);
  }
  if (!await addButton.isEnabled().catch(() => false)) throw new Error('flow_add_to_prompt_disabled');
  await addButton.click({ timeout: 8000 });
  await sleep(700);

  const doneButton = page.getByRole('button', { name: /Hecho|Done/i }).first();
  if (await doneButton.count().catch(() => 0) && await doneButton.isVisible().catch(() => false)) {
    await doneButton.click({ timeout: 8000 });
    await sleep(1400);
  } else {
    const doneText = page.getByText(/^(Hecho|Done)$/i).filter({ visible: true }).first();
    if (await doneText.count().catch(() => 0)) {
      await doneText.click({ timeout: 8000 });
      await sleep(1400);
    }
  }
}

async function fillFlowPrompt(page, prompt) {
  const promptInput = page.locator([
    'input[aria-label="Texto editable"]',
    'textarea[aria-label="Texto editable"]',
    'input[aria-label="Editable text"]',
    'textarea[aria-label="Editable text"]',
    '[contenteditable="true"][aria-label="Texto editable"]',
    '[contenteditable="true"][aria-label="Editable text"]',
  ].join(',')).first();
  await promptInput.waitFor({ state: 'visible', timeout: 20000 });
  try { await promptInput.fill(prompt); }
  catch {
    await promptInput.click({ timeout: 8000 });
    await page.keyboard.press('Control+A').catch(() => undefined);
    await page.keyboard.press('Backspace').catch(() => undefined);
    await page.keyboard.type(prompt, { delay: 6 });
  }
}

async function clickFlowCreate(page) {
  const buttons = page.getByRole('button', { name: /crear|create|generate/i });
  const count = await buttons.count();
  let chosen = null;
  for (let i = count - 1; i >= 0; i--) {
    const candidate = buttons.nth(i);
    if (await candidate.isVisible().catch(() => false) && await candidate.isEnabled().catch(() => false)) { chosen = candidate; break; }
  }
  if (!chosen) {
    const observation = await observe(page);
    throw new Error(`flow_create_disabled:${JSON.stringify({ buttons: observation.buttons?.slice(-12), text: observation.text?.slice(-900) })}`);
  }
  await chosen.click({ timeout: 10000 });
}

async function runFlowMediaJob(page, job, input) {
  page = await ensureFlowProject(page);
  const referencePaths = Array.isArray(input.reference_paths) ? input.reference_paths.filter(Boolean).slice(0, 1) : [];
  const referenceUrls = Array.isArray(input.reference_urls) ? input.reference_urls.filter(Boolean).slice(0, 1) : [];
  const prompt = String(input.prompt || job.instruction || '').trim();
  if (!prompt) throw new Error('flow_prompt_required');

  if (referencePaths.length || referenceUrls.length) {
    const file = referencePaths.length
      ? await downloadReferencePath(String(referencePaths[0]), job.id)
      : await downloadReferenceUrl(String(referenceUrls[0]), job.id);
    await attachFlowStartFrame(page, file);
  } else if (String(input.media_type || '').toLowerCase().startsWith('video')) {
    await ensureFlowVideoMode(page);
  }

  await fillFlowPrompt(page, prompt);
  await sleep(500);
  await clickFlowCreate(page);
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
  let page = await getPage(provider);
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
