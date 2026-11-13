import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSource = fs.readFileSync(path.join(here, '..', 'lib', 'client.js'), 'utf8');

/** 最小浏览器壳：只提供 client.js 里真正用到的 API，用来验证模块契约与插槽注册。 */
function makeShell() {
  const appended = [];
  const html = {
    attrs: new Map(),
    setAttribute(name, value) {
      this.attrs.set(name, value);
    },
    removeAttribute(name) {
      this.attrs.delete(name);
    },
  };
  const head = {
    appendChild(node) {
      appended.push(node);
    },
  };
  const document = {
    baseURI: 'http://127.0.0.1:60474/session/abc',
    documentElement: html,
    head,
    getElementById(id) {
      return appended.find((node) => node.id === id) ?? null;
    },
    createElement(tag) {
      return { tag, id: '', textContent: '', remove() {} };
    },
  };
  const fetchCalls = [];
  const fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      async text() {
        return JSON.stringify({ ok: true, config: { tier: 'stage', visual: {} }, effectiveTier: 'stage' });
      },
    };
  };
  const slotsRegistered = [];
  const injected = [];
  const ctx = {
    effect(fn) {
      return fn();
    },
    slots: {
      inject(name, generator) {
        injected.push(name);
        const iterator = generator();
        let step = iterator.next();
        while (!step.done) {
          // 生成器 yield 出来的正是 ctx.slots.register 的返回值：不真正渲染组件
          step = iterator.next({ dispose() {} });
        }
        return { dispose() {} };
      },
      register(definition) {
        slotsRegistered.push(definition);
        return { dispose() {} };
      },
    },
  };
  const resolve = (id) => {
    if (id === 'react') {
      return {
        useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
        useEffect: () => {},
        useCallback: (fn) => fn,
        useRef: () => ({ current: null }),
      };
    }
    if (id === 'react/jsx-runtime') {
      return {
        jsx: (type, props, key) => ({ type, props, key }),
        jsxs: (type, props, key) => ({ type, props, key }),
      };
    }
    throw new Error('unexpected require: ' + id);
  };
  return { document, fetch, window: {}, ctx, resolve, appended, slotsRegistered, injected, fetchCalls };
}

async function loadClient(shell) {
  const window = {
    __ModuleLoader__: {
      load({ id, factory }) {
        window.__loaded = { id, module: factory(shell.resolve) };
      },
    },
    dispatchEvent() {},
  };
  const fn = new Function('window', 'document', 'fetch', 'sessionStorage', 'CustomEvent', clientSource);
  const sessionStorage = { getItem: () => null, setItem() {} };
  fn(window, shell.document, shell.fetch, sessionStorage, class CustomEvent {});
  return window.__loaded;
}

test('client.js 以 __ModuleLoader__ 契约加载并暴露 name/inject/apply', async () => {
  const shell = makeShell();
  const loaded = await loadClient(shell);
  assert.equal(loaded.id, 'dsh-bird-robin');
  assert.equal(loaded.module.name, 'dsh-bird-robin');
  assert.deepEqual(loaded.module.inject, ['slots']);
  assert.equal(typeof loaded.module.apply, 'function');
});

test('apply 注册三个插槽、注入样式表与根属性', async () => {
  const shell = makeShell();
  const loaded = await loadClient(shell);
  loaded.module.apply(shell.ctx);

  const ids = shell.slotsRegistered.map((slot) => slot.id).sort();
  assert.deepEqual(ids, ['bird-robin', 'bird-robin-badge', 'bird-robin-card']);

  const style = shell.appended.find((node) => node.id === 'dsh-bird-robin-style');
  assert.ok(style, '应注入样式表');
  assert.ok(style.textContent.includes('[data-dsh-bird-robin="on"]'), '样式应作用于根作用域属性');
  assert.ok(!style.textContent.includes('.ConversationRoot'), '不得依赖内部 class 名');
});

test('apply 后请求走 /dsh-bird-robin 前缀，且带 same-origin 凭据', async () => {
  const shell = makeShell();
  const loaded = await loadClient(shell);
  loaded.module.apply(shell.ctx);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.ok(shell.fetchCalls.length >= 1);
  assert.equal(shell.fetchCalls[0].url, '/session/abc/dsh-bird-robin');
  assert.equal(shell.fetchCalls[0].init.credentials, 'same-origin');
});

test('插槽注册带稳定的 id 与顺序，设置页有 label', async () => {
  const shell = makeShell();
  const loaded = await loadClient(shell);
  loaded.module.apply(shell.ctx);
  const settings = shell.slotsRegistered.find((slot) => slot.name === 'settings.section');
  assert.ok(settings);
  assert.equal(settings.order, 40);
  assert.equal(typeof settings.label, 'function');
  assert.equal(settings.label(), '知更鸟');
});
