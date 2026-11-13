import fs from 'node:fs';
import {
  personaText,
  capTier,
  TIERS,
  TIER_LABELS,
  TIER_DESCRIPTIONS,
  CODING_TOOLS,
  HEAVY_TURN_TOOL_COUNT,
  normalizeAddress,
  PERSONA_TEXT_MAX,
} from './persona.js';
import {
  loadConfig,
  saveConfig,
  normalizeConfig,
  DEFAULT_CONFIG,
  ensureDirs,
  DSH_HOME,
  CONFIG_FILE,
  ASSET_DIR,
  loadProvenance,
} from './config.js';
import { IMPORT_GUIDE, assetPathOf, importFromUrl, listAssets, removeAsset } from './assets.js';

export const name = 'dsh-bird-robin';

const ROUTE_PREFIX = '/dsh-bird-robin';
const CAP_TTL_MS = 10 * 60 * 1000;

const GREETINGS = [
  '亲爱的听众，我在这儿。今天想先听什么？',
  '灯光已经调好了，亲爱的听众——从哪一段开始？',
  '亲爱的听众，把要做的事说给我听吧，我陪你一段一段来。',
  '亲爱的听众，先深呼吸；剩下的，我们慢慢唱完。',
];

const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase();
  if (/^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.)/.test(host)) return true;
  if (host === '[::1]' || host === '::1' || host === '[::]') return true;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) return true;
  const m = /^172\.(\d{1,3})\./.exec(host);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (typeof origin !== 'string' || origin === '') return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function sessionKeyOf(session) {
  const s = session;
  return String(s?.header?.id ?? s?.id ?? 'unknown');
}

export function apply(ctx) {
  ensureDirs();

  const state = {
    config: loadConfig(),
    capTier: null,
    capUntil: 0,
    turnTools: new Map(),
    greetingIndex: 0,
  };

  const warn = (message) => {
    try {
      ctx.logger?.warn?.('[dsh-bird-robin] ' + message);
    } catch (error) {
      void error;
    }
  };

  function currentCap() {
    if (!state.config.sceneAdaptation) return null;
    if (state.capTier === null) return null;
    if (Date.now() > state.capUntil) {
      state.capTier = null;
      return null;
    }
    return state.capTier;
  }

  function effectiveTier() {
    if (!state.config.enabled) return 'off';
    return capTier(state.config.tier, currentCap());
  }

  function snapshot() {
    const tier = effectiveTier();
    return {
      ok: true,
      config: state.config,
      effectiveTier: tier,
      cap: currentCap(),
      tiers: TIERS.map((id) => ({ id, label: TIER_LABELS[id], description: TIER_DESCRIPTIONS[id] })),
      greeting: GREETINGS[state.greetingIndex % GREETINGS.length],
      persona: personaText(tier, state.config.address),
      personaChars: personaText(tier, state.config.address).length,
      personaMaxChars: PERSONA_TEXT_MAX,
      paths: { home: DSH_HOME, config: CONFIG_FILE, assets: ASSET_DIR },
      assets: listAssets(),
      guide: IMPORT_GUIDE,
    };
  }

  function persist() {
    state.config = saveConfig(state.config);
    return state.config;
  }

  function setCap(tier) {
    if (tier === null || tier === undefined || tier === 'off') {
      state.capTier = null;
      state.capUntil = 0;
      return;
    }
    state.capTier = tier;
    state.capUntil = Date.now() + CAP_TTL_MS;
  }

  function patchConfig(patch) {
    const next = patch !== null && typeof patch === 'object' ? patch : {};
    state.config = normalizeConfig({
      ...state.config,
      ...next,
      visual: { ...state.config.visual, ...(next.visual ?? {}) },
      assets: { ...state.config.assets, ...(next.assets ?? {}) },
    });
    return persist();
  }

  // ── 系统提示词：人格段 ──────────────────────────────────────────
  ctx.inject(['systemPrompt'], (scoped) => {
    scoped.effect(
      () =>
        scoped.systemPrompt.section({
          name: 'bird-robin:persona',
          order: scoped.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_SUFFIX') - 100,
          text: () => personaText(effectiveTier(), state.config.address),
        }),
      'dsh-bird-robin: persona section',
    );
  });

  // ── 命令 /robin ─────────────────────────────────────────────────
  ctx.inject(['commands'], (scoped) => {
    scoped.effect(
      () =>
        scoped.commands.register({
          name: 'robin',
          description: '知更鸟人格：/robin <off|light|standard|stage|status|pin|unpin|default>',
          input: { hint: '[off|light|standard|stage|status|pin|unpin|default <档>]' },
          handler: ({ rawInput }) => {
            const text = String(rawInput ?? '').trim().toLowerCase();
            if (text === '' || text === 'status') {
              const cap = currentCap();
              return {
                kind: 'success',
                text:
                  `知更鸟人格：${state.config.enabled ? '已开启' : '已关闭'} · 默认档 ${TIER_LABELS[state.config.tier]}` +
                  (cap ? ` · 当前收敛为 ${TIER_LABELS[cap]}` : '') +
                  ` · 生效 ${TIER_LABELS[effectiveTier()]} · 称呼「${state.config.address}」`,
              };
            }
            if (text === 'pin') {
              setCap(null);
              state.config.sceneAdaptation = false;
              persist();
              return { kind: 'success', text: `已暂停场景收敛，保持 ${TIER_LABELS[state.config.tier]}。` };
            }
            if (text === 'unpin') {
              state.config.sceneAdaptation = true;
              persist();
              return { kind: 'success', text: '已恢复场景自适应。' };
            }
            if (text.startsWith('default')) {
              const target = text.split(/\s+/)[1];
              if (!TIERS.includes(target)) {
                return { kind: 'error', text: '用法：/robin default <off|light|standard|stage>' };
              }
              state.config.tier = target;
              state.config.enabled = target !== 'off';
              persist();
              return { kind: 'success', text: `全局默认档已改为 ${TIER_LABELS[target]}。` };
            }
            if (TIERS.includes(text)) {
              state.config.tier = text;
              state.config.enabled = text !== 'off';
              setCap(null);
              persist();
              return { kind: 'success', text: `本会话档位：${TIER_LABELS[text]}。` };
            }
            return { kind: 'error', text: '用法：/robin <off|light|standard|stage|status|pin|unpin|default>' };
          },
        }),
      'dsh-bird-robin: /robin command',
    );
  });

  // ── 会话事件：场景收敛 ──────────────────────────────────────────
  ctx.effect(
    () => {
      const off = ctx.on('session/event', (session, event) => {
        const type = event?.type;
        if (type === 'tool/call') {
          const toolName = event?.data?.name;
          if (typeof toolName !== 'string' || toolName === '') return;
          const key = sessionKeyOf(session);
          const bucket = state.turnTools.get(key) ?? new Set();
          bucket.add(toolName);
          state.turnTools.set(key, bucket);
          if (!state.config.sceneAdaptation) return;
          if (CODING_TOOLS.has(toolName) && state.capTier === null) setCap(state.config.codingCapTier);
          return;
        }
        if (type === 'turn/end') {
          const key = sessionKeyOf(session);
          const bucket = state.turnTools.get(key);
          state.turnTools.delete(key);
          if (!bucket || !state.config.sceneAdaptation) return;
          const coding = [...bucket].some((tool) => CODING_TOOLS.has(tool));
          if (coding) setCap(state.config.codingCapTier);
          else if (bucket.size >= HEAVY_TURN_TOOL_COUNT) setCap(state.config.heavyTaskCapTier);
        }
      });
      return () => {
        try {
          if (typeof off === 'function') off();
        } catch (error) {
          void error;
        }
      };
    },
    'dsh-bird-robin: session events',
  );

  // ── HTTP 路由 ───────────────────────────────────────────────────
  ctx.inject(['webServer'], (scoped) => {
    scoped.effect(
      () =>
        scoped.webServer.register({
          kind: 'prefix',
          path: ROUTE_PREFIX,
          handler: async (req, res) => {
            const url = new URL(req.url ?? '/', 'http://localhost');
            const rest = url.pathname.slice(ROUTE_PREFIX.length).replace(/^\/+/, '');
            const method = (req.method ?? 'GET').toUpperCase();

            try {
              if (rest === '' && method === 'GET') {
                sendJson(res, 200, snapshot());
                return;
              }

              if (rest === 'greeting' && method === 'GET') {
                const greeting = GREETINGS[state.greetingIndex % GREETINGS.length];
                state.greetingIndex = (state.greetingIndex + 1) % GREETINGS.length;
                sendJson(res, 200, { ok: true, greeting, tier: effectiveTier() });
                return;
              }

              if (rest === 'config' && method === 'GET') {
                sendJson(res, 200, { ok: true, config: state.config, effectiveTier: effectiveTier(), cap: currentCap() });
                return;
              }

              if (rest === 'config' && method === 'POST') {
                if (!sameOrigin(req)) {
                  sendJson(res, 403, { ok: false, error: '跨站请求被拒绝' });
                  return;
                }
                const raw = await readBody(req);
                let parsed;
                try {
                  parsed = JSON.parse(raw);
                } catch {
                  sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON' });
                  return;
                }
                const config = patchConfig(parsed);
                sendJson(res, 200, { ok: true, config, effectiveTier: effectiveTier() });
                return;
              }

              if (rest === 'address' && method === 'POST') {
                if (!sameOrigin(req)) {
                  sendJson(res, 403, { ok: false, error: '跨站请求被拒绝' });
                  return;
                }
                const raw = await readBody(req);
                let parsed;
                try {
                  parsed = JSON.parse(raw);
                } catch {
                  sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON' });
                  return;
                }
                const config = patchConfig({ address: normalizeAddress(parsed?.address) });
                sendJson(res, 200, { ok: true, config, address: config.address });
                return;
              }

              if (rest === 'assets' && method === 'GET') {
                sendJson(res, 200, { ok: true, assets: listAssets(), guide: IMPORT_GUIDE });
                return;
              }

              if (rest === 'assets' && method === 'POST') {
                if (!sameOrigin(req)) {
                  sendJson(res, 403, { ok: false, error: '跨站请求被拒绝' });
                  return;
                }
                const raw = await readBody(req);
                let parsed;
                try {
                  parsed = JSON.parse(raw);
                } catch {
                  sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON' });
                  return;
                }
                let target;
                try {
                  target = new URL(String(parsed?.url ?? ''));
                } catch {
                  sendJson(res, 400, { ok: false, error: '链接格式不正确' });
                  return;
                }
                if (parsed?.allowPrivate !== true && isPrivateHost(target.hostname)) {
                  sendJson(res, 400, {
                    ok: false,
                    error: '默认禁止从本机或内网地址导入；确需如此请显式勾选“允许内网来源”',
                  });
                  return;
                }
                const result = await importFromUrl({ ...parsed, url: target.toString() }, globalThis.fetch);
                sendJson(res, result.ok ? 200 : 400, result);
                return;
              }

              if (rest.startsWith('assets/') && method === 'DELETE') {
                if (!sameOrigin(req)) {
                  sendJson(res, 403, { ok: false, error: '跨站请求被拒绝' });
                  return;
                }
                const id = decodeURIComponent(rest.slice('assets/'.length));
                const removed = removeAsset(id);
                sendJson(res, removed ? 200 : 404, { ok: removed, error: removed ? undefined : '素材不存在' });
                return;
              }

              if (rest.startsWith('asset/') && method === 'GET') {
                const id = decodeURIComponent(rest.slice('asset/'.length));
                const file = assetPathOf(id);
                if (file === '') {
                  sendJson(res, 404, { ok: false, error: '素材不存在' });
                  return;
                }
                const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
                const bytes = fs.readFileSync(file);
                res.writeHead(200, {
                  'content-type': MIME_BY_EXT[ext] ?? 'application/octet-stream',
                  'cache-control': 'no-store',
                  'content-length': bytes.length,
                });
                res.end(bytes);
                return;
              }

              if (rest === 'provenance' && method === 'GET') {
                sendJson(res, 200, { ok: true, provenance: loadProvenance() });
                return;
              }

              sendJson(res, 404, { ok: false, error: '未知接口：' + method + ' /' + rest });
            } catch (error) {
              warn('route failed: ' + (error instanceof Error ? error.message : String(error)));
              sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
            }
          },
        }),
      'dsh-bird-robin: http routes',
    );
  });

  // ── 对外服务 ────────────────────────────────────────────────────
  try {
    ctx.provide('birdRobin', {
      getConfig: () => state.config,
      patchConfig,
      effectiveTier,
      personaText: () => personaText(effectiveTier(), state.config.address),
      listAssets,
      defaults: DEFAULT_CONFIG,
      maxPersonaChars: PERSONA_TEXT_MAX,
    });
  } catch (error) {
    warn('provide birdRobin failed: ' + (error instanceof Error ? error.message : String(error)));
  }
}

export default { name, apply };
