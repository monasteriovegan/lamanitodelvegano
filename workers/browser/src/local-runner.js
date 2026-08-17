import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const srcDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (m) => m.slice(1)));
const sourcePath = path.join(srcDir, 'index.js');
const runtimePath = path.join(srcDir, '.index-local-runtime.mjs');

let source = await fs.readFile(sourcePath, 'utf8');

function replaceAsyncFunction(text, name, nextName, replacement) {
  const startMarker = `async function ${name}(`;
  const endMarker = `\n\nasync function ${nextName}(`;
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`local_runner_patch_target_not_found:${name}`);
  return text.slice(0, start) + replacement.trim() + text.slice(end);
}

const robustWaitForFlowReady = String.raw`
async function waitForFlowReady(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => undefined);
  const deadline = Date.now() + 50000;
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => {
      const visible = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      };
      const body = String(document.body?.innerText || '');
      const editors = Array.from(document.querySelectorAll('textarea,input,[contenteditable="true"]')).filter(visible);
      const composer = editors.some((el) => {
        const aria = String(el.getAttribute('aria-label') || '');
        const placeholder = String(el.getAttribute('placeholder') || '');
        const type = String(el.getAttribute('type') || '').toLowerCase();
        return type !== 'file' && (el.getAttribute('contenteditable') === 'true' || el.tagName === 'TEXTAREA' || /texto editable|editable text|prompt|describe|describ/i.test(aria + ' ' + placeholder));
      });
      const promptSignal = /qué quieres crear|que quieres crear|what do you want to create/i.test(body);
      const controlSignal = /nano banana|vídeo|video|fotogramas|frames|crear|create|generate/i.test(body);
      return { ready: promptSignal || (composer && controlSignal), promptSignal, composer, controlSignal, text: body.slice(0, 2200) };
    }).catch(() => ({ ready: false }));
    if (state?.ready) {
      await sleep(700);
      return state;
    }
    await sleep(500);
  }
  const observation = await observe(page);
  throw new Error('flow_workspace_not_ready:' + JSON.stringify({ url: observation.url, title: observation.title, buttons: observation.buttons?.slice(0, 25), links: observation.links?.slice(0, 25), text: observation.text?.slice(0, 1600) }));
}
`;
source = replaceAsyncFunction(source, 'waitForFlowReady', 'ensureFlowProject', robustWaitForFlowReady);

const robustEnsureFlowProject = String.raw`
async function ensureFlowProject(page) {
  const context = page.context();

  const workspaceReady = async (candidate) => candidate.evaluate(() => {
    const visible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };
    const body = String(document.body?.innerText || '');
    const editors = Array.from(document.querySelectorAll('textarea,input,[contenteditable="true"]')).filter(visible);
    const composer = editors.some((el) => {
      const aria = String(el.getAttribute('aria-label') || '');
      const placeholder = String(el.getAttribute('placeholder') || '');
      const type = String(el.getAttribute('type') || '').toLowerCase();
      return type !== 'file' && (el.getAttribute('contenteditable') === 'true' || el.tagName === 'TEXTAREA' || /texto editable|editable text|prompt|describe|describ/i.test(aria + ' ' + placeholder));
    });
    return /qué quieres crear|que quieres crear|what do you want to create/i.test(body) || (composer && /nano banana|vídeo|video|fotogramas|frames|crear|create|generate/i.test(body));
  }).catch(() => false);

  const pickExistingWorkspace = async () => {
    const pages = context.pages().filter((p) => !p.isClosed());
    const ordered = [
      ...pages.filter((p) => /labs\.google/.test(p.url()) && /\/project(?:\/|$|\?)/.test(p.url())),
      ...pages.filter((p) => /labs\.google/.test(p.url()) && !/\/project(?:\/|$|\?)/.test(p.url())),
    ];
    for (const candidate of ordered) {
      if (/\/project(?:\/|$|\?)/.test(candidate.url()) || await workspaceReady(candidate)) {
        await candidate.bringToFront().catch(() => undefined);
        cdpPages.set('google_flow', candidate);
        await waitForFlowReady(candidate);
        return candidate;
      }
    }
    return null;
  };

  if (/labs\.google/.test(page.url()) && (/\/project(?:\/|$|\?)/.test(page.url()) || await workspaceReady(page))) {
    await waitForFlowReady(page);
    cdpPages.set('google_flow', page);
    return page;
  }

  const existing = await pickExistingWorkspace();
  if (existing) return existing;

  if (!/labs\.google/.test(page.url())) {
    await page.goto(providerUrls.google_flow, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } else {
    await page.bringToFront().catch(() => undefined);
  }
  await sleep(1200);

  if (await workspaceReady(page)) {
    await waitForFlowReady(page);
    cdpPages.set('google_flow', page);
    return page;
  }

  const tryOpenExistingProjectLink = async () => {
    const projectLinks = page.locator('a[href*="/project/"],a[href$="/project"],a[href*="/project?"]');
    const count = await projectLinks.count().catch(() => 0);
    for (let i = 0; i < Math.min(count, 12); i += 1) {
      const link = projectLinks.nth(i);
      if (!await link.isVisible().catch(() => false)) continue;
      await link.click({ timeout: 10000 }).catch(() => undefined);
      return true;
    }
    return false;
  };

  const tryProjectCta = async () => page.evaluate(() => {
    const visible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };
    const patterns = [
      /^(new project|nuevo proyecto)$/i,
      /create (a )?project|crear (un )?proyecto/i,
      /start creating|comenzar a crear|empieza a crear/i,
      /create with flow|crear con flow/i,
      /try flow|probar flow/i,
      /open flow|abrir flow|launch flow|iniciar flow/i,
      /new creation|nueva creación|nueva creacion/i,
    ];
    const nodes = Array.from(document.querySelectorAll('button,a,[role="button"],[role="link"],[tabindex]')).filter(visible);
    const candidates = nodes.map((el) => {
      const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
      const aria = String(el.getAttribute('aria-label') || '').trim();
      const title = String(el.getAttribute('title') || '').trim();
      const href = String(el.getAttribute('href') || '');
      const haystack = [text, aria, title].filter(Boolean).join(' | ');
      let score = 999;
      patterns.forEach((pattern, index) => { if (pattern.test(haystack)) score = Math.min(score, index); });
      if (/\/project(?:\/|$|\?)/i.test(href)) score = Math.min(score, 0);
      return { el, score, len: haystack.length || 999 };
    }).filter((item) => item.score < 999).sort((a, b) => a.score - b.score || a.len - b.len);
    const target = candidates[0]?.el;
    if (!(target instanceof HTMLElement)) return { clicked: false };
    target.scrollIntoView({ block: 'center', inline: 'center' });
    try { target.focus(); } catch {}
    try { target.click(); } catch {}
    return { clicked: true };
  }).catch(() => ({ clicked: false }));

  const waitForWorkspaceAfterAction = async (knownPages) => {
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      const pages = context.pages().filter((p) => !p.isClosed());
      const candidates = [page, ...pages.filter((p) => !knownPages.has(p)), ...pages].filter((p, index, all) => all.indexOf(p) === index);
      for (const candidate of candidates) {
        if (!/labs\.google/.test(candidate.url())) continue;
        if (/\/project(?:\/|$|\?)/.test(candidate.url()) || await workspaceReady(candidate)) {
          await candidate.bringToFront().catch(() => undefined);
          cdpPages.set('google_flow', candidate);
          await waitForFlowReady(candidate);
          return candidate;
        }
      }
      await sleep(500);
    }
    return null;
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const before = new Set(context.pages());
    let acted = await tryOpenExistingProjectLink();
    if (!acted) acted = Boolean((await tryProjectCta())?.clicked);

    if (acted) {
      const opened = await waitForWorkspaceAfterAction(before);
      if (opened) return opened;
    }

    const afterExisting = await pickExistingWorkspace();
    if (afterExisting) return afterExisting;

    if (attempt === 0) {
      await page.goto(providerUrls.google_flow, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => undefined);
      await sleep(1500);
      if (await workspaceReady(page)) {
        await waitForFlowReady(page);
        cdpPages.set('google_flow', page);
        return page;
      }
    }
  }

  const observation = await observe(page);
  console.error('flow_project_entry_observation', { url: observation.url, title: observation.title, buttons: observation.buttons?.slice(0, 30), links: observation.links?.slice(0, 30), text: observation.text?.slice(0, 1800) });
  throw new Error('flow_project_entry_unavailable:' + JSON.stringify({ url: observation.url, title: observation.title, buttons: observation.buttons?.slice(0, 25), links: observation.links?.slice(0, 25), text: observation.text?.slice(0, 1600) }));
}
`;
source = replaceAsyncFunction(source, 'ensureFlowProject', 'ensureFlowVideoMode', robustEnsureFlowProject);

const robustAttachFlowStartFrame = String.raw`
async function attachFlowStartFrame(page, file) {
  await ensureFlowFramesMode(page);
  const initial = page.getByText(/^(Inicial|Start)$/i).filter({ visible: true }).first();
  if (await initial.count().catch(() => 0)) await initial.click({ timeout: 8000 });
  else if (!await clickClickableContainingText(page, ['inicial', 'start'])) throw new Error('flow_start_frame_control_not_found');

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 15000 }).catch(async () => {
    await page.getByText(/Subir archivos multimedia|Upload media/i).first().waitFor({ state: 'visible', timeout: 8000 });
  });
  await fileInput.waitFor({ state: 'attached', timeout: 10000 });
  await fileInput.setInputFiles(file);
  await sleep(2500);

  let addButton = page.getByRole('button', { name: /Añadir a la petición|Add to prompt/i }).first();
  if (!await addButton.count().catch(() => 0)) {
    const clicked = await clickClickableContainingText(page, ['añadir a la petición', 'add to prompt']);
    if (!clicked) throw new Error('flow_add_to_prompt_control_not_found');
  } else {
    await addButton.waitFor({ state: 'visible', timeout: 15000 });
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline && !await addButton.isEnabled().catch(() => false)) await sleep(400);
    if (!await addButton.isEnabled().catch(() => false)) throw new Error('flow_add_to_prompt_disabled');
    await addButton.click({ timeout: 8000 });
  }
  await sleep(500);

  let doneSeen = false;
  let doneClosed = false;
  const doneDeadline = Date.now() + 20000;
  while (Date.now() < doneDeadline && !doneClosed) {
    const state = await page.evaluate(() => {
      const visible = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      };
      const nodes = Array.from(document.querySelectorAll('button,[role="button"],[tabindex],span,div')).filter(visible);
      const candidates = nodes.map((el) => {
        const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
        const aria = String(el.getAttribute('aria-label') || '').trim();
        const title = String(el.getAttribute('title') || '').trim();
        const exact = /^(hecho|done)$/i.test(text) || /^(hecho|done)$/i.test(aria) || /^(hecho|done)$/i.test(title);
        const clickable = el.matches('button,[role="button"],[tabindex]') || getComputedStyle(el).cursor === 'pointer';
        return { el, exact, clickable, len: text.length };
      }).filter((item) => item.exact).sort((a, b) => Number(b.clickable) - Number(a.clickable) || a.len - b.len);
      const target = candidates[0]?.el;
      if (!(target instanceof HTMLElement)) return { found: false };
      let clickable = target;
      let current = target;
      for (let i = 0; i < 7 && current instanceof HTMLElement; i += 1) {
        if (current.tagName === 'BUTTON' || current.getAttribute('role') === 'button' || current.getAttribute('tabindex') !== null || getComputedStyle(current).cursor === 'pointer') { clickable = current; break; }
        current = current.parentElement;
      }
      clickable.scrollIntoView({ block: 'center', inline: 'center' });
      try { clickable.focus(); } catch {}
      try { clickable.click(); } catch {}
      return { found: true };
    }).catch(() => ({ found: false }));

    if (state?.found) {
      doneSeen = true;
      await sleep(700);
      const stillVisible = await page.evaluate(() => {
        const visible = (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        };
        return Array.from(document.querySelectorAll('*')).some((el) => {
          if (!visible(el)) return false;
          const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
          const aria = String(el.getAttribute?.('aria-label') || '').trim();
          const title = String(el.getAttribute?.('title') || '').trim();
          return /^(hecho|done)$/i.test(text) || /^(hecho|done)$/i.test(aria) || /^(hecho|done)$/i.test(title);
        });
      }).catch(() => false);
      if (!stillVisible) doneClosed = true;
    } else {
      const editorGone = await page.evaluate(() => {
        const body = String(document.body?.innerText || '');
        const hasAdd = /Añadir a la petición|Add to prompt/i.test(body);
        const hasUpload = /Subir archivos multimedia|Upload media/i.test(body);
        return !hasAdd && !hasUpload;
      }).catch(() => false);
      if (editorGone) doneClosed = true;
      else await sleep(350);
    }
  }

  if (!doneClosed) {
    const observation = await observe(page);
    throw new Error('flow_start_frame_done_not_closed:' + JSON.stringify({ done_seen: doneSeen, buttons: observation.buttons?.slice(0, 25), text: observation.text?.slice(0, 1400) }));
  }
  await sleep(900);
}
`;
source = replaceAsyncFunction(source, 'attachFlowStartFrame', 'fillFlowPrompt', robustAttachFlowStartFrame);

const robustRunFlowMediaJob = String.raw`
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

  const before = await page.evaluate(() => ({
    videos: Array.from(document.querySelectorAll('video')).map((video) => String(video.currentSrc || video.src || '')).filter(Boolean),
    videoCount: document.querySelectorAll('video').length,
    downloadCount: Array.from(document.querySelectorAll('button,a,[role="button"],[role="link"]')).filter((el) => /descargar|download/i.test(String(el.textContent || '') + ' ' + String(el.getAttribute?.('aria-label') || ''))).length,
    promptText: Array.from(document.querySelectorAll('[contenteditable="true"],textarea,input')).map((el) => String(el.value ?? el.textContent ?? '')).join('\n'),
  })).catch(() => ({ videos: [], videoCount: 0, downloadCount: 0, promptText: '' }));
  const videoSourcesBefore = new Set(before.videos || []);

  await clickFlowCreate(page);

  let submissionAccepted = false;
  let generationVerified = false;
  let verificationReason = 'no_state_change';
  let sawBusy = false;
  const verifyDeadline = Date.now() + 240000;

  while (Date.now() < verifyDeadline && !generationVerified) {
    await sleep(1500);
    const state = await page.evaluate(() => {
      const visible = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const body = String(document.body?.innerText || '');
      const promptText = Array.from(document.querySelectorAll('[contenteditable="true"],textarea,input')).map((el) => String(el.value ?? el.textContent ?? '')).join('\n');
      const createReady = Array.from(document.querySelectorAll('button,[role="button"]')).some((el) => {
        if (!visible(el)) return false;
        const text = String(el.textContent || '').trim();
        const aria = String(el.getAttribute('aria-label') || '').trim();
        const matches = /(crear|create|generate)/i.test(text) || /(crear|create|generate)/i.test(aria);
        const disabled = el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
        return matches && !disabled;
      });
      const busySignal = /(generando|generating|creando|creating|procesando|processing|en cola|queued|cancelar|cancel generation|rendering)/i.test(body);
      const videos = Array.from(document.querySelectorAll('video')).map((video) => String(video.currentSrc || video.src || '')).filter(Boolean);
      const videoCount = document.querySelectorAll('video').length;
      const downloadCount = Array.from(document.querySelectorAll('button,a,[role="button"],[role="link"]')).filter((el) => /descargar|download/i.test(String(el.textContent || '') + ' ' + String(el.getAttribute?.('aria-label') || ''))).length;
      return { promptText, createReady, busySignal, videos, videoCount, downloadCount, body: body.slice(0, 5000) };
    }).catch(() => ({ promptText: '', createReady: true, busySignal: false, videos: [], videoCount: 0, downloadCount: 0, body: '' }));

    const promptChanged = String(state.promptText || '') !== String(before.promptText || '');
    if (state.busySignal) { submissionAccepted = true; sawBusy = true; verificationReason = 'flow_busy_signal'; }
    else if (!state.createReady) { submissionAccepted = true; verificationReason = 'create_control_busy_or_hidden'; }
    else if (promptChanged) { submissionAccepted = true; verificationReason = 'composer_changed_after_submit'; }

    if (Array.isArray(state.videos) && state.videos.some((src) => src && !videoSourcesBefore.has(src))) {
      submissionAccepted = true;
      generationVerified = true;
      verificationReason = 'new_video_source_detected';
    } else if (Number(state.videoCount || 0) > Number(before.videoCount || 0)) {
      submissionAccepted = true;
      generationVerified = true;
      verificationReason = 'video_element_count_increased';
    } else if (Number(state.downloadCount || 0) > Number(before.downloadCount || 0) && sawBusy) {
      submissionAccepted = true;
      generationVerified = true;
      verificationReason = 'download_control_appeared_after_generation';
    }
  }

  const observation = await observe(page);
  const screenshot = await snapshot(page, job.id);
  if (!submissionAccepted) {
    throw new Error('flow_create_not_accepted:' + JSON.stringify({ buttons: observation.buttons?.slice(-20), text: observation.text?.slice(-1500) }));
  }

  return {
    status: generationVerified ? 'completed' : 'waiting_user',
    output: {
      submitted: true,
      generation_verified: generationVerified,
      verification_reason: verificationReason,
      provider: 'google_flow',
      media_type: input.media_type || null,
      reference_count: referencePaths.length + referenceUrls.length,
      observation,
      screenshot_path: screenshot,
      note: generationVerified
        ? 'Google Flow aceptó la solicitud y el worker verificó una salida de video nueva.'
        : 'Google Flow aceptó la solicitud, pero no fue posible verificar automáticamente una salida nueva dentro del tiempo de espera.',
    },
  };
}
`;
source = replaceAsyncFunction(source, 'runFlowMediaJob', 'runStep', robustRunFlowMediaJob);

await fs.writeFile(runtimePath, source, 'utf8');
await import(pathToFileURL(runtimePath).href + `?v=${Date.now()}`);
