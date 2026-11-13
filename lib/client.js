;((window) => {
  /**
   * dsh-bird-robin 浏览器半边。
   * 只做三件事：①按 host 状态给 <html> 打数据属性（换肤作用域）；
   * ②注册三个插槽（标题栏徽章 / 开场卡 / 设置页）；
   * ③提供一个纯 React 的设置面板，所有读写都走 host 的 /dsh-bird-robin 接口。
   * 不改动任何组件内部 DOM，不读取内部 class 名；卸载时属性与样式一并撤掉。
   */

  const FALLBACK_TIERS = [
    { id: 'off', label: '关闭', description: '完全使用原生助手人格，仅保留皮肤。' },
    { id: 'light', label: '轻语', description: '只改语气与称呼，最省 token。' },
    { id: 'standard', label: '演唱', description: '自然的知更鸟口吻，不写动作。' },
    { id: 'stage', label: '谢幕演出', description: '完整舞台感，工程输出仍严格克制。' },
  ];

  const ATTR = 'data-dsh-bird-robin';
  const BG_ATTR = 'data-dsh-bird-robin-bg';
  const STYLE_ID = 'dsh-bird-robin-style';

  const CSS = `
html[${ATTR}="on"] {
  --dbr-gold: #d8a94a;
  --dbr-gold-soft: #f1d9a4;
  --dbr-ink: #2b2438;
  --dbr-muted: #6d6579;
  --dbr-card-bg: rgba(255, 252, 246, 0.94);
  --dbr-card-border: rgba(216, 169, 74, 0.55);
  --dbr-card-shadow: 0 18px 44px rgba(88, 66, 24, 0.18);
  --dsw-alias-brand-primary: #c1932f;
  --dsw-alias-link: #a97c27;
  --dsw-specific-bubble-highlight: #f4e4c0;
}
html[${ATTR}="on"] body[data-ds-dark-theme] {
  --dbr-ink: #f2ede4;
  --dbr-muted: #a8a1b6;
  --dbr-card-bg: rgba(33, 29, 41, 0.95);
  --dbr-card-border: rgba(216, 169, 74, 0.40);
  --dbr-card-shadow: 0 18px 44px rgba(0, 0, 0, 0.52);
  --dsw-alias-brand-primary: #e6c078;
  --dsw-alias-link: #f1d9a4;
  --dsw-specific-bubble-highlight: #46381f;
}
html[${BG_ATTR}="on"] body {
  background-image:
    radial-gradient(1100px 520px at 12% -8%, color-mix(in srgb, #f1d9a4 26%, transparent), transparent 62%),
    radial-gradient(900px 480px at 92% 4%, color-mix(in srgb, #bcd9ee 22%, transparent), transparent 60%);
  background-attachment: fixed;
}

.dbr-badge {
  display: inline-flex; align-items: center; gap: 6px;
  height: 26px; padding: 0 10px; margin-left: 8px;
  border: 1px solid var(--dbr-card-border); border-radius: 999px;
  background: var(--dbr-card-bg); color: var(--dbr-ink);
  font-size: 12px; line-height: 1; cursor: pointer; user-select: none;
  transition: transform .12s ease, box-shadow .12s ease;
}
.dbr-badge:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(180, 140, 60, .22); }
.dbr-badge__dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dbr-gold); }

.dbr-card {
  position: fixed; right: 24px; bottom: 96px; z-index: 60;
  width: min(360px, calc(100vw - 48px));
  border: 1px solid var(--dbr-card-border); border-radius: 16px;
  background: var(--dbr-card-bg); color: var(--dbr-ink);
  box-shadow: var(--dbr-card-shadow); backdrop-filter: blur(10px);
  padding: 16px 18px; font-size: 13px; line-height: 1.65;
}
.dbr-card__title { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.dbr-card__glyph { color: var(--dbr-gold); }
.dbr-card__body { margin: 8px 0 12px; white-space: pre-wrap; }
.dbr-card__foot { display: flex; justify-content: flex-end; gap: 8px; }

.dbr-btn {
  border: 1px solid var(--dbr-card-border); background: transparent; color: var(--dbr-ink);
  border-radius: 8px; padding: 5px 12px; font-size: 12px; cursor: pointer;
}
.dbr-btn:hover { background: rgba(216, 169, 74, .14); }
.dbr-btn--primary { background: var(--dbr-gold); border-color: var(--dbr-gold); color: #2b2438; font-weight: 600; }

.dbr-panel { display: flex; flex-direction: column; gap: 14px; font-size: 13px; color: var(--dbr-ink, inherit); }
.dbr-section { border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.25)); border-radius: 12px; padding: 12px 14px; }
.dbr-section__title { font-weight: 600; margin-bottom: 8px; }
.dbr-section__hint { font-size: 12px; color: var(--dbr-muted, inherit); margin-bottom: 8px; }

.dbr-tiers { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.dbr-tier {
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.25));
  border-radius: 10px; padding: 8px 10px; cursor: pointer; background: transparent; color: inherit;
  text-align: left; font-size: 12px; line-height: 1.45;
}
.dbr-tier[data-active="true"] { border-color: var(--dbr-gold); box-shadow: inset 0 0 0 1px var(--dbr-gold); }
.dbr-tier__name { font-weight: 600; font-size: 13px; margin-bottom: 2px; }
.dbr-tier__desc { color: var(--dbr-muted, inherit); }

.dbr-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 0; }
.dbr-row__label { display: flex; flex-direction: column; gap: 2px; }
.dbr-row__label small { color: var(--dbr-muted, inherit); font-size: 11px; }
.dbr-inline { display: flex; align-items: center; gap: 8px; }

.dbr-input {
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.3)); border-radius: 8px;
  padding: 5px 10px; font-size: 12px; background: transparent; color: inherit; min-width: 0;
}
.dbr-input--wide { width: 100%; }

.dbr-pre {
  margin: 6px 0 0; padding: 10px; border-radius: 10px; font-size: 11px; line-height: 1.6;
  background: rgba(128,128,128,.08); white-space: pre-wrap; max-height: 220px; overflow: auto;
  font-family: var(--dsh-font-family-code, ui-monospace, monospace);
}
.dbr-assets { display: flex; flex-direction: column; gap: 8px; }
.dbr-asset { display: flex; align-items: center; gap: 10px; }
.dbr-asset__thumb { width: 36px; height: 36px; border-radius: 8px; object-fit: cover; border: 1px solid var(--dbr-card-border); }
.dbr-asset__meta { flex: 1; min-width: 0; font-size: 12px; }
.dbr-asset__meta small { display: block; color: var(--dbr-muted, inherit); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dbr-note { font-size: 11px; color: var(--dbr-muted, inherit); }
.dbr-status { font-size: 12px; color: var(--dbr-muted, inherit); }
.dbr-status--error { color: #e0533f; }
.dbr-list { margin: 4px 0 0; padding-left: 18px; }
`;

  const store = {
    loading: true,
    error: '',
    data: null,
    busy: false,
    greeting: '',
  };
  const listeners = new Set();

  function emit() {
    for (const fn of [...listeners]) {
      try {
        fn();
      } catch (error) {
        console.warn('[dsh-bird-robin] listener failed', error);
      }
    }
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function apiBase() {
    try {
      const url = new URL(document.baseURI);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '/dsh-bird-robin';
      return url.pathname.replace(/\/+$/, '') + '/dsh-bird-robin';
    } catch {
      return '/dsh-bird-robin';
    }
  }

  const API = apiBase();

  async function request(path, init) {
    const response = await fetch(API + path, {
      credentials: 'same-origin',
      ...init,
      headers: init?.body === undefined ? { ...(init?.headers ?? {}) } : { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error('接口返回非 JSON：' + text.slice(0, 120));
    }
    if (!response.ok || payload?.ok === false) throw new Error(payload?.error || 'HTTP ' + response.status);
    return payload;
  }

  function applyAttributes() {
    const config = store.data?.config;
    const root = document.documentElement;
    if (!config || config.visual?.enabled === false) {
      root.removeAttribute(ATTR);
    } else {
      root.setAttribute(ATTR, 'on');
    }
    if (!config || !config.visual?.background) root.removeAttribute(BG_ATTR);
    else root.setAttribute(BG_ATTR, 'on');
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) {
      applyAttributes();
      return;
    }
    const tag = document.createElement('style');
    tag.id = STYLE_ID;
    tag.textContent = CSS;
    document.head.appendChild(tag);
    applyAttributes();
  }

  async function refresh() {
    try {
      store.data = await request('');
      store.error = '';
    } catch (error) {
      store.error = error instanceof Error ? error.message : String(error);
    } finally {
      store.loading = false;
      applyAttributes();
      emit();
    }
  }

  async function patchConfig(patch) {
    store.busy = true;
    emit();
    try {
      const payload = await request('/config', { method: 'POST', body: JSON.stringify(patch) });
      store.data = { ...(store.data ?? {}), config: payload.config, effectiveTier: payload.effectiveTier };
      store.error = '';
      await refresh();
    } catch (error) {
      store.error = error instanceof Error ? error.message : String(error);
      emit();
    } finally {
      store.busy = false;
      emit();
    }
  }

  function makeUi(react, jsxRuntime) {
    const { useState, useEffect, useCallback } = react;
    const { jsx, jsxs } = jsxRuntime;

    function useStore() {
      const [, setTick] = useState(0);
      useEffect(() => {
        const off = subscribe(() => setTick((n) => n + 1));
        return off;
      }, []);
      return store;
    }

    function tiersOf(data) {
      return data?.tiers?.length ? data.tiers : FALLBACK_TIERS;
    }

    function TierPicker({ data, onPick }) {
      const tiers = tiersOf(data);
      const active = data?.config?.tier ?? 'stage';
      return jsx('div', {
        className: 'dbr-tiers',
        children: tiers.map((tier) =>
          jsxs(
            'button',
            {
              type: 'button',
              className: 'dbr-tier',
              'data-active': String(active === tier.id),
              onClick: () => onPick(tier.id),
              children: [
                jsx('div', { className: 'dbr-tier__name', children: tier.label }),
                jsx('div', { className: 'dbr-tier__desc', children: tier.description }),
              ],
            },
            tier.id,
          ),
        ),
      });
    }

    function Toggle({ label, hint, checked, onChange }) {
      return jsxs('div', {
        className: 'dbr-row',
        children: [
          jsxs('span', {
            className: 'dbr-row__label',
            children: [jsx('span', { children: label }), hint ? jsx('small', { children: hint }) : null],
          }),
          jsx('input', {
            type: 'checkbox',
            checked: Boolean(checked),
            onChange: (event) => onChange(event.target.checked),
          }),
        ],
      });
    }

    function AssetSection({ data, onImport, onRemove }) {
      const [url, setUrl] = useState('');
      const [author, setAuthor] = useState('');
      const assets = data?.assets ?? [];
      const guide = data?.guide;
      return jsxs('div', {
        className: 'dbr-section',
        children: [
          jsx('div', { className: 'dbr-section__title', children: '素材（仅存本机）' }),
          jsx('div', {
            className: 'dbr-section__hint',
            children: guide?.note || '插件不内置官方美术素材；导入的图片只保存在本机。',
          }),
          jsx('input', {
            className: 'dbr-input dbr-input--wide',
            placeholder: '图片直链（https://… .png / .jpg / .webp）',
            value: url,
            onChange: (event) => setUrl(event.target.value),
          }),
          jsxs('div', {
            className: 'dbr-row',
            children: [
              jsx('input', {
                className: 'dbr-input dbr-input--wide',
                placeholder: '来源或作者（可选，记入 provenance）',
                value: author,
                onChange: (event) => setAuthor(event.target.value),
              }),
              jsx('button', {
                type: 'button',
                className: 'dbr-btn dbr-btn--primary',
                onClick: () => {
                  if (url.trim() === '') return;
                  onImport({ url, author });
                  setUrl('');
                  setAuthor('');
                },
                children: '导入',
              }),
            ],
          }),
          assets.length === 0
            ? jsx('div', { className: 'dbr-note', children: '还没有导入素材。' })
            : jsx('div', {
                className: 'dbr-assets',
                children: assets.map((asset) =>
                  jsxs(
                    'div',
                    {
                      className: 'dbr-asset',
                      children: [
                        jsx('img', {
                          className: 'dbr-asset__thumb',
                          src: API + '/asset/' + encodeURIComponent(asset.id) + '?v=' + asset.mtime,
                          alt: asset.id,
                        }),
                        jsxs('span', {
                          className: 'dbr-asset__meta',
                          children: [
                            jsx('span', { children: asset.id }),
                            jsx('small', {
                              children:
                                Math.round(asset.bytes / 1024) + ' KB' + (asset.source ? ' · ' + asset.source : ''),
                            }),
                          ],
                        }),
                        jsx('button', {
                          type: 'button',
                          className: 'dbr-btn',
                          onClick: () => onRemove(asset.id),
                          children: '删除',
                        }),
                      ],
                    },
                    asset.id,
                  ),
                ),
              }),
          guide?.rules?.length
            ? jsx('div', {
                className: 'dbr-note',
                children: jsx('ul', {
                  className: 'dbr-list',
                  children: guide.rules.map((rule, index) => jsx('li', { children: rule }, index)),
                }),
              })
            : null,
        ],
      });
    }

    function SettingsPanel() {
      const data = useStore();
      const config = data?.data?.config;
      const tiers = tiersOf(data?.data);
      const [address, setAddress] = useState('');
      useEffect(() => {
        if (config && address === '') setAddress(config.address);
      }, [config, address]);

      if (data.loading && !config) {
        return jsx('div', { className: 'dbr-panel', children: '正在读取知更鸟配置…' });
      }
      if (!config) {
        return jsxs('div', {
          className: 'dbr-panel',
          children: [
            jsx('div', { className: 'dbr-status dbr-status--error', children: '读取失败：' + (data.error || '未知原因') }),
            jsx('button', { type: 'button', className: 'dbr-btn', onClick: () => refresh(), children: '重试' }),
          ],
        });
      }

      const effective = tiers.find((t) => t.id === data.data.effectiveTier);
      const persona = data.data.persona ?? '';

      return jsxs('div', {
        className: 'dbr-panel',
        children: [
          jsxs('div', {
            className: 'dbr-section',
            children: [
              jsx('div', { className: 'dbr-section__title', children: '人格档位' }),
              jsx('div', {
                className: 'dbr-section__hint',
                children: '默认档位；开启场景自适后，写代码与多步任务会自动收敛。',
              }),
              jsx(TierPicker, { data: data.data, onPick: (id) => patchConfig({ tier: id, enabled: id !== 'off' }) }),
              jsxs('div', {
                className: 'dbr-row',
                children: [
                  jsxs('span', {
                    className: 'dbr-row__label',
                    children: [
                      jsx('span', { children: '当前生效' }),
                      jsx('small', {
                        children:
                          (effective?.label ?? data.data.effectiveTier) +
                          (data.data.cap ? '（场景收敛：' + data.data.cap + '）' : '') +
                          (config.enabled ? '' : '（已关闭，界面皮肤仍生效）'),
                      }),
                    ],
                  }),
                  jsx('span', { className: 'dbr-status', children: data.busy ? '保存中…' : '' }),
                ],
              }),
            ],
          }),
          jsxs('div', {
            className: 'dbr-section',
            children: [
              jsx('div', { className: 'dbr-section__title', children: '行为' }),
              jsx(Toggle, {
                label: '场景自适应',
                hint: '写代码 / 多步任务时自动收敛档位',
                checked: config.sceneAdaptation,
                onChange: (value) => patchConfig({ sceneAdaptation: value }),
              }),
              jsx(Toggle, {
                label: '称呼每轮最多一次',
                hint: '关闭后不限频次，容易变成口癖',
                checked: config.addressOncePerTurn,
                onChange: (value) => patchConfig({ addressOncePerTurn: value }),
              }),
              jsx(Toggle, {
                label: '动作描写预算',
                hint: '每 3 段最多一处、≤12 字；代码与参数内禁止',
                checked: config.actionBudget,
                onChange: (value) => patchConfig({ actionBudget: value }),
              }),
              jsxs('div', {
                className: 'dbr-row',
                children: [
                  jsx('span', { className: 'dbr-row__label', children: '称呼' }),
                  jsxs('span', {
                    className: 'dbr-inline',
                    children: [
                      jsx('input', {
                        className: 'dbr-input',
                        value: address,
                        maxLength: 24,
                        onChange: (event) => setAddress(event.target.value),
                        placeholder: '亲爱的听众',
                      }),
                      jsx('button', {
                        type: 'button',
                        className: 'dbr-btn',
                        onClick: () => patchConfig({ address }),
                        children: '保存',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          jsxs('div', {
            className: 'dbr-section',
            children: [
              jsx('div', { className: 'dbr-section__title', children: '界面' }),
              jsx(Toggle, {
                label: '主题配色',
                hint: '只覆盖主题变量（金 / 天蓝），不改组件结构',
                checked: config.visual.enabled,
                onChange: (value) => patchConfig({ visual: { enabled: value } }),
              }),
              jsx(Toggle, {
                label: '标题栏徽章',
                hint: '显示当前档位，点击循环切换',
                checked: config.visual.headerBadge,
                onChange: (value) => patchConfig({ visual: { headerBadge: value } }),
              }),
              jsx(Toggle, {
                label: '开场卡',
                hint: '每次打开页面问候一次，可关闭',
                checked: config.visual.openingCard,
                onChange: (value) => patchConfig({ visual: { openingCard: value } }),
              }),
              jsx(Toggle, {
                label: '背景氛围',
                hint: '给页面底色叠一层极淡渐变',
                checked: config.visual.background,
                onChange: (value) => patchConfig({ visual: { background: value } }),
              }),
            ],
          }),
          jsx(AssetSection, {
            data: data.data,
            onImport: async (body) => {
              store.busy = true;
              emit();
              try {
                await request('/assets', { method: 'POST', body: JSON.stringify(body) });
                store.error = '';
                await refresh();
              } catch (error) {
                store.error = error instanceof Error ? error.message : String(error);
              } finally {
                store.busy = false;
                emit();
              }
            },
            onRemove: async (id) => {
              try {
                await request('/assets/' + encodeURIComponent(id), { method: 'DELETE' });
                await refresh();
              } catch (error) {
                store.error = error instanceof Error ? error.message : String(error);
                emit();
              }
            },
          }),
          jsxs('div', {
            className: 'dbr-section',
            children: [
              jsx('div', { className: 'dbr-section__title', children: '人格段预览' }),
              jsx('div', {
                className: 'dbr-section__hint',
                children:
                  '当前生效文本（' +
                  (data.data.personaChars ?? 0) +
                  ' / ' +
                  (data.data.personaMaxChars ?? 1600) +
                  ' 字）；每一轮对话都会带上它。',
              }),
              jsx('pre', { className: 'dbr-pre', children: persona || '（off 档不注册人格段）' }),
            ],
          }),
          data.error
            ? jsx('div', { className: 'dbr-status dbr-status--error', children: data.error })
            : jsx('div', {
                className: 'dbr-note',
                children: '配置：' + (data.data.paths?.config ?? '') + ' · 素材：' + (data.data.paths?.assets ?? ''),
              }),
        ],
      });
    }

    function HeaderBadge() {
      const data = useStore();
      const config = data?.data?.config;
      if (!config || !config.visual?.headerBadge) return null;
      const tiers = tiersOf(data.data);
      const current = tiers.find((t) => t.id === data.data.effectiveTier) ?? tiers[2];
      const order = ['off', 'light', 'standard', 'stage'];
      const cycle = () => {
        const index = order.indexOf(config.tier);
        const next = order[(index + 1) % order.length];
        void patchConfig({ tier: next, enabled: next !== 'off' });
      };
      return jsxs('button', {
        type: 'button',
        className: 'dbr-badge',
        title: '知更鸟人格：' + current.label + '（点击切换档位）',
        onClick: cycle,
        children: [jsx('span', { className: 'dbr-badge__dot' }), jsx('span', { children: current.label })],
      });
    }

    function OpeningCard() {
      const data = useStore();
      const config = data?.data?.config;
      const [dismissed, setDismissed] = useState(() => {
        try {
          return sessionStorage.getItem('dsh-bird-robin-opening') === '1';
        } catch {
          return false;
        }
      });
      const [greeting, setGreeting] = useState('');

      useEffect(() => {
        if (data.loading || greeting !== '') return;
        request('/greeting')
          .then((payload) => setGreeting(payload.greeting))
          .catch(() => setGreeting(''));
      }, [data.loading, greeting]);

      if (!config || !config.visual?.openingCard || dismissed || greeting === '') return null;

      const close = () => {
        setDismissed(true);
        try {
          sessionStorage.setItem('dsh-bird-robin-opening', '1');
        } catch (error) {
          void error;
        }
      };

      return jsxs('div', {
        className: 'dbr-card',
        role: 'dialog',
        'aria-label': '知更鸟',
        children: [
          jsxs('div', {
            className: 'dbr-card__title',
            children: [jsx('span', { className: 'dbr-card__glyph', children: '♪' }), jsx('span', { children: '知更鸟' })],
          }),
          jsx('div', { className: 'dbr-card__body', children: greeting }),
          jsxs('div', {
            className: 'dbr-card__foot',
            children: [
              jsx('button', { type: 'button', className: 'dbr-btn', onClick: close, children: '知道了' }),
              jsx('button', {
                type: 'button',
                className: 'dbr-btn dbr-btn--primary',
                onClick: close,
                children: '开始',
              }),
            ],
          }),
        ],
      });
    }

    return { SettingsPanel, HeaderBadge, OpeningCard };
  }

  function makeFactory() {
    return (require) => {
      const module = { exports: {} };
      const react = require('react');
      const jsxRuntime = require('react/jsx-runtime');
      const ui = makeUi(react, jsxRuntime);

      const name = 'dsh-bird-robin';
      const inject = ['slots'];

      function registerSlot(ctx, slotName, id, order, component, label) {
        try {
          ctx.effect(
            () => {
              ctx.slots.inject(slotName, function* () {
                const definition = { name: slotName, id, order };
                if (typeof label === 'function') definition.label = label;
                yield ctx.slots.register(definition, component);
              });
              return () => {};
            },
            'dsh-bird-robin: ' + slotName,
          );
        } catch (error) {
          console.warn('[dsh-bird-robin] 插槽 ' + slotName + ' 注册失败，已跳过', error);
        }
      }

      function apply(ctx) {
        installStyle();
        void refresh();

        registerSlot(ctx, 'settings.section', 'bird-robin', 40, ui.SettingsPanel, () => '知更鸟');
        registerSlot(ctx, 'conversation.header.leading', 'bird-robin-badge', 20, ui.HeaderBadge);
        registerSlot(ctx, 'shell.overlay', 'bird-robin-card', 1200, ui.OpeningCard);

        ctx.effect(
          () => () => {
            try {
              document.documentElement.removeAttribute(ATTR);
              document.documentElement.removeAttribute(BG_ATTR);
              const tag = document.getElementById(STYLE_ID);
              if (tag) tag.remove();
            } catch (error) {
              void error;
            }
          },
          'dsh-bird-robin: uninstall styles',
        );
      }

      module.exports = { name, inject, apply };
      return module.exports;
    };
  }

  window.__ModuleLoader__.load({ id: 'dsh-bird-robin', factory: makeFactory() });
})(window);
