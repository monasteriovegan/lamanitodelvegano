import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const srcDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (m) => m.slice(1)));
const sourcePath = path.join(srcDir, 'index.js');
const runtimePath = path.join(srcDir, '.index-local-runtime.mjs');

let source = await fs.readFile(sourcePath, 'utf8');

function injectAsyncFunction(text, originalName, nextName, patchedFn) {
  const startMarker = `async function ${originalName}(`;
  const endMarker = `\n\nasync function ${nextName}(`;
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`local_runner_patch_target_not_found:${originalName}`);
  const replacement = patchedFn.toString().replace(/^async function [^(]+\(/, `async function ${originalName}(`);
  return text.slice(0, start) + replacement + text.slice(end);
}

async function patchedWaitForFlowReady(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => undefined);
  const deadline = Date.now() + 50000;
  while (Date.now() < deadline) {
    const ready = await page.evaluate(() => {
      const visible = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      };
      const body = String(document.body?.innerText || '');
      const editors = Array.from(document.querySelectorAll('textarea,input,[contenteditable="true"],[role="textbox"]')).filter(visible);
      const composer = editors.some((el) => {
        const aria = String(el.getAttribute('aria-label') || '');
        const placeholder = String(el.getAttribute('placeholder') || '');
        const type = String(el.getAttribute('type') || '').toLowerCase();
        return type !== 'file' && (el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox' || el.tagName === 'TEXTAREA' || /texto editable|editable text|prompt|describe|describ/i.test(`${aria} ${placeholder}`));
      });
      return /qué quieres crear|que quieres crear|what do you want to create/i.test(body)
        || (composer && /vídeo|video|fotogramas|frames|crear|create|generate|agente|agent/i.test(body));
    }).catch(() => false);
    if (ready) {
      await sleep(600);
      return;
    }
    await sleep(500);
  }
  const observation = await observe(page);
  throw new Error('flow_workspace_not_ready:' + JSON.stringify({
    url: observation.url,
    title: observation.title,
    buttons: observation.buttons?.slice(0, 25),
    links: observation.links?.slice(0, 25),
    text: observation.text?.slice(0, 1600),
  }));
}

async function patchedEnsureFlowProject(page) {
  const context = page.context();

  const workspaceReady = async (candidate) => candidate.evaluate(() => {
    const visible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };
    const body = String(document.body?.innerText || '');
    const editors = Array.from(document.querySelectorAll('textarea,input,[contenteditable="true"],[role="textbox"]')).filter(visible);
    const composer = editors.some((el) => {
      const type = String(el.getAttribute('type') || '').toLowerCase();
      return type !== 'file' && (el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox' || el.tagName === 'TEXTAREA');
    });
    return /qué quieres crear|que quieres crear|what do you want to create/i.test(body)
      || (composer && /vídeo|video|fotogramas|frames|crear|create|generate|agente|agent/i.test(body));
  }).catch(() => false);

  const activate = async (candidate) => {
    await candidate.bringToFront().catch(() => undefined);
    cdpPages.set('google_flow', candidate);
    await waitForFlowReady(candidate);
    return candidate;
  };

  const pages = context.pages().filter((p) => !p.isClosed());
  const ordered = [
    ...pages.filter((p) => /labs\.google/.test(p.url()) && /\/project(?:\/|$|\?)/.test(p.url())),
    ...pages.filter((p) => /labs\.google/.test(p.url()) && !/\/project(?:\/|$|\?)/.test(p.url())),
  ];
  for (const candidate of ordered) {
    if (/\/project(?:\/|$|\?)/.test(candidate.url()) || await workspaceReady(candidate)) return activate(candidate);
  }

  if (!/labs\.google/.test(page.url())) {
    await page.goto(providerUrls.google_flow, { waitUntil: 'domcontentloaded', timeout: 60000 });
  }
  await sleep(1200);
  if (await workspaceReady(page)) return activate(page);

  const before = new Set(context.pages());
  let acted = false;
  const projectLink = page.locator('a[href*="/project/"]').filter({ visible: true }).first();
  if (await projectLink.count().catch(() => 0)) {
    await projectLink.click({ timeout: 10000 }).catch(() => undefined);
    acted = true;
  }
  if (!acted) {
    acted = await page.evaluate(() => {
      const visible = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const rx = /new project|nuevo proyecto|create project|crear proyecto|start creating|comenzar a crear|create with flow|crear con flow|try flow|probar flow|new creation|nueva creaci[oó]n/i;
      const nodes = Array.from(document.querySelectorAll('button,a,[role="button"],[role="link"],[tabindex]')).filter(visible);
      const target = nodes.find((el) => rx.test(`${String(el.textContent || '')} ${String(el.getAttribute('aria-label') || '')} ${String(el.getAttribute('title') || '')}`));
      if (!(target instanceof HTMLElement)) return false;
      target.scrollIntoView({ block: 'center', inline: 'center' });
      target.click();
      return true;
    }).catch(() => false);
  }

  if (acted) {
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      const currentPages = context.pages().filter((p) => !p.isClosed());
      const candidates = [...currentPages.filter((p) => !before.has(p)), ...currentPages];
      for (const candidate of candidates) {
        if (!/labs\.google/.test(candidate.url())) continue;
        if (/\/project(?:\/|$|\?)/.test(candidate.url()) || await workspaceReady(candidate)) return activate(candidate);
      }
      await sleep(500);
    }
  }

  const observation = await observe(page);
  throw new Error('flow_project_entry_unavailable:' + JSON.stringify({
    url: observation.url,
    title: observation.title,
    buttons: observation.buttons?.slice(0, 25),
    links: observation.links?.slice(0, 25),
    text: observation.text?.slice(0, 1600),
  }));
}

async function patchedAttachFlowStartFrame(page, file) {
  await ensureFlowFramesMode(page);
  const initial = page.getByText(/^(Inicial|Start)$/i).first();
  if (await initial.count().catch(() => 0) && await initial.isVisible().catch(() => false)) {
    await initial.click({ timeout: 8000 });
  } else if (!await clickClickableContainingText(page, ['inicial', 'start'])) {
    throw new Error('flow_start_frame_control_not_found');
  }

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 15000 }).catch(async () => {
    await page.getByText(/Subir archivos multimedia|Upload media/i).first().waitFor({ state: 'visible', timeout: 8000 });
  });
  await fileInput.waitFor({ state: 'attached', timeout: 10000 });
  await fileInput.setInputFiles(file);
  await sleep(2500);

  const addButton = page.getByRole('button', { name: /Añadir a la petición|Add to prompt/i }).first();
  await addButton.waitFor({ state: 'visible', timeout: 18000 });
  const addDeadline = Date.now() + 25000;
  while (Date.now() < addDeadline && !await addButton.isEnabled().catch(() => false)) await sleep(400);
  if (!await addButton.isEnabled().catch(() => false)) throw new Error('flow_add_to_prompt_disabled');
  await addButton.click({ timeout: 8000 });
  await sleep(500);

  let doneClosed = false;
  const doneDeadline = Date.now() + 20000;
  while (Date.now() < doneDeadline && !doneClosed) {
    const clicked = await page.evaluate(() => {
      const visible = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const nodes = Array.from(document.querySelectorAll('button,[role="button"],[tabindex],span,div')).filter(visible);
      const exact = nodes.filter((el) => {
        const values = [el.textContent, el.getAttribute('aria-label'), el.getAttribute('title')].map((v) => String(v || '').replace(/\s+/g, ' ').trim());
        return values.some((v) => /^(hecho|done)$/i.test(v));
      });
      const target = exact.find((el) => el.matches('button,[role="button"],[tabindex]')) || exact[0];
      if (!(target instanceof HTMLElement)) return false;
      let clickable = target;
      let current = target;
      for (let i = 0; i < 6 && current instanceof HTMLElement; i += 1) {
        if (current.matches('button,[role="button"],[tabindex]') || getComputedStyle(current).cursor === 'pointer') { clickable = current; break; }
        current = current.parentElement;
      }
      clickable.scrollIntoView({ block: 'center', inline: 'center' });
      clickable.click();
      return true;
    }).catch(() => false);

    if (clicked) await sleep(700);
    const editorGone = await page.evaluate(() => {
      const body = String(document.body?.innerText || '');
      return !/Añadir a la petición|Add to prompt/i.test(body) && !/Subir archivos multimedia|Upload media/i.test(body);
    }).catch(() => false);
    if (editorGone) doneClosed = true;
    else await sleep(350);
  }

  if (!doneClosed) {
    const observation = await observe(page);
    throw new Error('flow_start_frame_done_not_closed:' + JSON.stringify({ buttons: observation.buttons?.slice(0, 25), text: observation.text?.slice(0, 1400) }));
  }
  await sleep(900);
}

async function patchedFillFlowPrompt(page, prompt) {
  await waitForFlowReady(page);
  const expected = String(prompt || '').trim();
  if (!expected) throw new Error('flow_prompt_required');
  const probe = expected.toLowerCase().replace(/\s+/g, ' ').slice(0, Math.min(80, expected.length));

  const markComposer = async () => page.evaluate(() => {
    const attr = 'data-synthetiq-flow-composer';
    document.querySelectorAll(`[${attr}]`).forEach((el) => el.removeAttribute(attr));
    const visible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };
    const placeholderRx = /qué quieres crear|que quieres crear|what do you want to create/i;
    const placeholderNodes = Array.from(document.querySelectorAll('div,span,p,label')).filter((el) => visible(el) && placeholderRx.test(String(el.textContent || '').trim()));
    const editors = Array.from(document.querySelectorAll('textarea,input:not([type="file"]),[contenteditable="true"],[role="textbox"]')).filter(visible);
    const scored = editors.map((el) => {
      const rect = el.getBoundingClientRect();
      const aria = String(el.getAttribute('aria-label') || '');
      const placeholder = String(el.getAttribute('placeholder') || '');
      const role = String(el.getAttribute('role') || '');
      const type = String(el.getAttribute('type') || '').toLowerCase();
      const ownText = String(el.textContent || '').trim();
      let score = 0;
      if (placeholderRx.test(`${aria} ${placeholder} ${ownText}`)) score += 140;
      if (el.getAttribute('contenteditable') === 'true') score += 45;
      if (role === 'textbox') score += 40;
      if (el.tagName === 'TEXTAREA') score += 35;
      if (rect.width >= 280) score += 25;
      if (rect.top >= window.innerHeight * 0.50) score += 35;
      if (rect.left >= 180) score += 15;
      if (/search|buscar|filtro|filter/i.test(`${aria} ${placeholder}`) || type === 'search') score -= 180;
      for (const node of placeholderNodes) {
        const pRect = node.getBoundingClientRect();
        if (el.contains(node) || node.contains(el)) score += 160;
        const dx = Math.max(0, Math.max(rect.left - pRect.right, pRect.left - rect.right));
        const dy = Math.max(0, Math.max(rect.top - pRect.bottom, pRect.top - rect.bottom));
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 220) score += Math.max(0, 90 - distance / 3);
      }
      return { el, score, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, aria, placeholder, tag: el.tagName, role, type };
    }).sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (!best || best.score < 20 || !(best.el instanceof HTMLElement)) return { found: false, candidates: scored.slice(0, 6).map(({ score, rect, aria, placeholder, tag, role, type }) => ({ score, rect, aria, placeholder, tag, role, type })) };
    best.el.setAttribute(attr, '1');
    return { found: true, score: best.score, rect: best.rect, aria: best.aria, placeholder: best.placeholder, tag: best.tag, role: best.role, type: best.type };
  }).catch(() => ({ found: false }));

  const composerState = async () => page.evaluate(() => {
    const target = document.querySelector('[data-synthetiq-flow-composer="1"]');
    if (!(target instanceof HTMLElement)) return { exists: false, text: '', active: '' };
    const text = 'value' in target ? String(target.value || '') : String(target.innerText || target.textContent || '');
    const active = document.activeElement instanceof HTMLElement ? `${document.activeElement.tagName}:${document.activeElement.getAttribute('role') || ''}:${document.activeElement.getAttribute('contenteditable') || ''}` : '';
    return { exists: true, text, active };
  }).catch(() => ({ exists: false, text: '', active: '' }));

  const promptRegistered = async () => {
    const state = await composerState();
    const normalized = String(state.text || '').toLowerCase().replace(/\s+/g, ' ');
    if (probe && normalized.includes(probe)) return true;
    return page.evaluate((needle) => {
      const visible = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      return Array.from(document.querySelectorAll('textarea,input:not([type="file"]),[contenteditable="true"],[role="textbox"]')).filter(visible).some((el) => {
        const value = 'value' in el ? String(el.value || '') : String(el.innerText || el.textContent || '');
        return value.toLowerCase().replace(/\s+/g, ' ').includes(needle);
      });
    }, probe).catch(() => false);
  };

  const writeMarked = async () => {
    const target = page.locator('[data-synthetiq-flow-composer="1"]').first();
    if (!await target.count().catch(() => 0) || !await target.isVisible().catch(() => false)) return false;
    const meta = await target.evaluate((el) => ({ tag: el.tagName, editable: el.getAttribute('contenteditable') === 'true', role: el.getAttribute('role') || '' })).catch(() => null);
    if (!meta) return false;
    if (meta.tag === 'INPUT' || meta.tag === 'TEXTAREA') {
      await target.fill(expected, { timeout: 10000 }).catch(() => undefined);
    } else {
      await target.click({ timeout: 8000 }).catch(() => undefined);
      await page.keyboard.press('Control+A').catch(() => undefined);
      await page.keyboard.press('Backspace').catch(() => undefined);
      await page.keyboard.insertText(expected).catch(() => undefined);
    }
    await sleep(700);
    return promptRegistered();
  };

  let marked = await markComposer();
  let registered = marked?.found ? await writeMarked() : false;

  if (!registered) {
    const placeholder = page.getByText(/¿?Qué quieres crear\??|What do you want to create\??/i).filter({ visible: true }).last();
    if (await placeholder.count().catch(() => 0)) {
      await placeholder.click({ timeout: 8000 }).catch(() => undefined);
      await page.keyboard.insertText(expected).catch(() => undefined);
      await sleep(800);
      registered = await promptRegistered();
    }
  }

  if (!registered) {
    marked = await markComposer();
    const injected = await page.evaluate((value) => {
      const target = document.querySelector('[data-synthetiq-flow-composer="1"]');
      if (!(target instanceof HTMLElement)) return false;
      try { target.focus(); } catch {}
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        const proto = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(target, value); else target.value = value;
      } else {
        target.textContent = value;
      }
      try { target.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: value })); } catch {}
      try { target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value })); } catch { target.dispatchEvent(new Event('input', { bubbles: true })); }
      try { target.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
      return true;
    }, expected).catch(() => false);
    if (injected) {
      await sleep(900);
      registered = await promptRegistered();
    }
  }

  if (!registered) {
    const observation = await observe(page);
    const state = await composerState();
    throw new Error('flow_prompt_not_registered:' + JSON.stringify({ marked, composer: state, inputs: observation.inputs, text: observation.text?.slice(-1600) }));
  }

  const enableDeadline = Date.now() + 15000;
  while (Date.now() < enableDeadline) {
    const enabled = await page.evaluate(() => {
      const visible = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      return Array.from(document.querySelectorAll('button,[role="button"]')).filter(visible).some((el) => {
        const haystack = `${String(el.textContent || '')} ${String(el.getAttribute('aria-label') || '')} ${String(el.getAttribute('title') || '')}`;
        const disabled = el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
        return /(crear|create|generate)/i.test(haystack) && !disabled;
      });
    }).catch(() => false);
    if (enabled) return;
    await sleep(400);
  }

  const observation = await observe(page);
  const state = await composerState();
  throw new Error('flow_composer_not_ready:' + JSON.stringify({ composer: state, buttons: observation.buttons?.slice(-20), text: observation.text?.slice(-1600) }));
}

async function patchedClickFlowCreate(page) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    const roleButtons = page.getByRole('button', { name: /crear|create|generate/i });
    const count = await roleButtons.count().catch(() => 0);
    for (let i = count - 1; i >= 0; i -= 1) {
      const candidate = roleButtons.nth(i);
      if (await candidate.isVisible().catch(() => false) && await candidate.isEnabled().catch(() => false)) {
        await candidate.click({ timeout: 10000 });
        return;
      }
    }

    const clicked = await page.evaluate(() => {
      const visible = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const nodes = Array.from(document.querySelectorAll('button,[role="button"]')).filter(visible);
      const target = nodes.find((el) => {
        const haystack = `${String(el.textContent || '')} ${String(el.getAttribute('aria-label') || '')} ${String(el.getAttribute('title') || '')}`;
        const disabled = el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
        return /(crear|create|generate)/i.test(haystack) && !disabled;
      });
      if (!(target instanceof HTMLElement)) return false;
      target.scrollIntoView({ block: 'center', inline: 'center' });
      target.click();
      return true;
    }).catch(() => false);
    if (clicked) return;
    await sleep(350);
  }

  const observation = await observe(page);
  throw new Error('flow_create_disabled:' + JSON.stringify({ buttons: observation.buttons?.slice(-20), text: observation.text?.slice(-1600) }));
}

async function patchedRunFlowMediaJob(page, job, input) {
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
  await sleep(450);

  const before = await page.evaluate(() => ({
    videos: Array.from(document.querySelectorAll('video')).map((video) => String(video.currentSrc || video.src || '')).filter(Boolean),
    videoCount: document.querySelectorAll('video').length,
    downloadCount: Array.from(document.querySelectorAll('button,a,[role="button"],[role="link"]')).filter((el) => /descargar|download/i.test(`${String(el.textContent || '')} ${String(el.getAttribute?.('aria-label') || '')}`)).length,
    promptText: Array.from(document.querySelectorAll('[contenteditable="true"],[role="textbox"],textarea,input')).map((el) => String(el.value ?? el.textContent ?? '')).join('\n'),
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
      const promptText = Array.from(document.querySelectorAll('[contenteditable="true"],[role="textbox"],textarea,input')).map((el) => String(el.value ?? el.textContent ?? '')).join('\n');
      const createReady = Array.from(document.querySelectorAll('button,[role="button"]')).some((el) => {
        if (!visible(el)) return false;
        const haystack = `${String(el.textContent || '')} ${String(el.getAttribute('aria-label') || '')}`;
        const disabled = el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
        return /(crear|create|generate)/i.test(haystack) && !disabled;
      });
      const busySignal = /(generando|generating|creando|creating|procesando|processing|en cola|queued|cancelar|cancel generation|rendering)/i.test(body);
      const videos = Array.from(document.querySelectorAll('video')).map((video) => String(video.currentSrc || video.src || '')).filter(Boolean);
      const videoCount = document.querySelectorAll('video').length;
      const downloadCount = Array.from(document.querySelectorAll('button,a,[role="button"],[role="link"]')).filter((el) => /descargar|download/i.test(`${String(el.textContent || '')} ${String(el.getAttribute?.('aria-label') || '')}`)).length;
      return { promptText, createReady, busySignal, videos, videoCount, downloadCount };
    }).catch(() => ({ promptText: '', createReady: true, busySignal: false, videos: [], videoCount: 0, downloadCount: 0 }));

    const promptChanged = String(state.promptText || '') !== String(before.promptText || '');
    if (state.busySignal) {
      submissionAccepted = true;
      sawBusy = true;
      verificationReason = 'flow_busy_signal';
    } else if (!state.createReady) {
      submissionAccepted = true;
      verificationReason = 'create_control_busy_or_hidden';
    } else if (promptChanged) {
      submissionAccepted = true;
      verificationReason = 'composer_changed_after_submit';
    }

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
    throw new Error('flow_create_not_accepted:' + JSON.stringify({ buttons: observation.buttons?.slice(-20), text: observation.text?.slice(-1600) }));
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

source = injectAsyncFunction(source, 'waitForFlowReady', 'ensureFlowProject', patchedWaitForFlowReady);
source = injectAsyncFunction(source, 'ensureFlowProject', 'ensureFlowVideoMode', patchedEnsureFlowProject);
source = injectAsyncFunction(source, 'attachFlowStartFrame', 'fillFlowPrompt', patchedAttachFlowStartFrame);
source = injectAsyncFunction(source, 'fillFlowPrompt', 'clickFlowCreate', patchedFillFlowPrompt);
source = injectAsyncFunction(source, 'clickFlowCreate', 'runFlowMediaJob', patchedClickFlowCreate);
source = injectAsyncFunction(source, 'runFlowMediaJob', 'runStep', patchedRunFlowMediaJob);

await fs.writeFile(runtimePath, source, 'utf8');
await import(pathToFileURL(runtimePath).href + `?v=${Date.now()}`);
