import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'dshbr-'));
process.env.DSH_HOME = HOME;

const { apply, name } = await import('../lib/index.js');

/** 造一个只实现插件用到的那几面的假 ctx：不启动宿主，纯装配验证。 */
function makeCtx() {
  const sections = [];
  const commands = [];
  const routes = [];
  const listeners = [];
  const provided = new Map();

  const makeScoped = (services) => ({
    ...services,
    effect(fn) {
      const dispose = fn();
      return typeof dispose === 'function' ? dispose : () => {};
    },
  });

  const ctx = {
    logger: { warn() {} },
    on(event, handler) {
      listeners.push({ event, handler });
      return () => {
        const index = listeners.findIndex((entry) => entry.handler === handler);
        if (index >= 0) listeners.splice(index, 1);
      };
    },
    provide(key, value) {
      provided.set(key, value);
    },
    effect(fn) {
      const dispose = fn();
      return typeof dispose === 'function' ? dispose : () => {};
    },
    inject(deps, fn) {
      const services = {};
      if (deps.includes('systemPrompt')) {
        services.systemPrompt = {
          getSectionOrder(key) {
            return { DEPLOYMENT_PERSONA_SUFFIX: 10200 }[key];
          },
          section(definition) {
            sections.push(definition);
            return () => {};
          },
        };
      }
      if (deps.includes('commands')) {
        services.commands = {
          register(definition) {
            commands.push(definition);
            return () => {};
          },
        };
      }
      if (deps.includes('webServer')) {
        services.webServer = {
          register(route) {
            routes.push(route);
            return () => {};
          },
        };
      }
      fn(makeScoped(services));
    },
  };

  return { ctx, sections, commands, routes, listeners, provided };
}

/** 用真实 EventEmitter 模拟 req；res 记录状态码与响应体。 */
async function callRoute(route, { method = 'GET', url = '/', body, origin } = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = { host: '127.0.0.1:1234' };
  if (origin !== undefined) req.headers.origin = origin;
  req.destroy = () => {};

  const result = { status: 0, headers: {}, body: '' };
  const res = {
    writeHead(status, headers) {
      result.status = status;
      result.headers = headers ?? {};
    },
    end(chunk) {
      if (chunk !== undefined) result.body += String(chunk);
      res.__done?.();
    },
    on() {},
  };

  const finished = new Promise((resolve) => {
    res.__done = resolve;
  });

  const pending = route.handler(req, res);

  if (body !== undefined) req.emit('data', Buffer.from(body));
  req.emit('end');

  await Promise.all([pending, finished]);
  return {
    status: result.status,
    headers: result.headers,
    json: result.body === '' ? null : JSON.parse(result.body),
  };
}

test('插件导出 name 与 apply', () => {
  assert.equal(name, 'dsh-bird-robin');
  assert.equal(typeof apply, 'function');
});

test('装配后注册人格段、命令、路由，并提供 birdRobin 服务', () => {
  const { ctx, sections, commands, routes, provided } = makeCtx();
  apply(ctx);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].name, 'bird-robin:persona');
  assert.ok(sections[0].order < 10200, '人格段应排在部署人格后缀之前');
  assert.equal(commands.length, 1);
  assert.equal(commands[0].name, 'robin');
  assert.equal(routes.length, 1);
  assert.equal(routes[0].kind, 'prefix');
  assert.equal(routes[0].path, '/dsh-bird-robin');
  assert.ok(provided.has('birdRobin'));
  assert.ok(fs.existsSync(path.join(HOME, 'bird-robin')), '素材目录应被创建');
});

test('默认档位 stage，persona 段非空且在预算内', async () => {
  const { ctx, routes } = makeCtx();
  apply(ctx);
  const snapshot = await callRoute(routes[0], { method: 'GET', url: '/dsh-bird-robin' });
  assert.equal(snapshot.status, 200);
  assert.equal(snapshot.json.config.tier, 'stage');
  assert.ok(snapshot.json.persona.length > 0);
  assert.ok(snapshot.json.personaChars <= snapshot.json.personaMaxChars);
  assert.equal(snapshot.json.tiers.length, 4);
  assert.equal(snapshot.json.effectiveTier, 'stage');
});

test('问候语轮换，不重复同一条', async () => {
  const { ctx, routes } = makeCtx();
  apply(ctx);
  const first = await callRoute(routes[0], { method: 'GET', url: '/dsh-bird-robin/greeting' });
  const second = await callRoute(routes[0], { method: 'GET', url: '/dsh-bird-robin/greeting' });
  assert.equal(first.json.ok, true);
  assert.notEqual(first.json.greeting, second.json.greeting);
});

test('POST /config 生效、被归一化并落盘', async () => {
  const { ctx, routes } = makeCtx();
  apply(ctx);
  const route = routes[0];
  const written = await callRoute(route, {
    method: 'POST',
    url: '/dsh-bird-robin/config',
    body: JSON.stringify({ tier: 'light', address: '开拓者', evil: 'drop-me' }),
  });
  assert.equal(written.status, 200);
  assert.equal(written.json.config.tier, 'light');
  assert.equal(written.json.config.address, '开拓者');
  assert.equal(written.json.effectiveTier, 'light');
  assert.ok(!('evil' in written.json.config));

  const after = await callRoute(route, { method: 'GET', url: '/dsh-bird-robin' });
  assert.equal(after.json.config.tier, 'light');
  assert.ok(after.json.persona.includes('开拓者'));

  const persisted = JSON.parse(fs.readFileSync(path.join(HOME, '.dshbr-config.json'), 'utf8'));
  assert.equal(persisted.tier, 'light');
  assert.equal(persisted.address, '开拓者');

  await callRoute(route, { method: 'POST', url: '/dsh-bird-robin/config', body: JSON.stringify({ tier: 'stage' }) });
});

test('跨站 POST 被 403 拒绝', async () => {
  const { ctx, routes } = makeCtx();
  apply(ctx);
  const blocked = await callRoute(routes[0], {
    method: 'POST',
    url: '/dsh-bird-robin/config',
    origin: 'https://evil.example',
    body: JSON.stringify({ tier: 'off' }),
  });
  assert.equal(blocked.status, 403);
});

test('素材导入拒绝非法协议与内网地址', async () => {
  const { ctx, routes } = makeCtx();
  apply(ctx);
  const route = routes[0];

  const badScheme = await callRoute(route, {
    method: 'POST',
    url: '/dsh-bird-robin/assets',
    body: JSON.stringify({ url: 'file:///etc/passwd' }),
  });
  assert.equal(badScheme.status, 400);

  const privateHost = await callRoute(route, {
    method: 'POST',
    url: '/dsh-bird-robin/assets',
    body: JSON.stringify({ url: 'http://127.0.0.1:9/a.png' }),
  });
  assert.equal(privateHost.status, 400);
  assert.ok(String(privateHost.json.error).includes('内网'));
});

test('未知接口返回 404 JSON', async () => {
  const { ctx, routes } = makeCtx();
  apply(ctx);
  const unknown = await callRoute(routes[0], { method: 'GET', url: '/dsh-bird-robin/nope' });
  assert.equal(unknown.status, 404);
  assert.equal(unknown.json.ok, false);
});

test('/robin 命令：状态、切换、非法值、pin/unpin', () => {
  const { ctx, commands } = makeCtx();
  apply(ctx);
  const command = commands[0];

  const status = command.handler({ rawInput: '' });
  assert.equal(status.kind, 'success');
  assert.ok(status.text.includes('知更鸟人格'));

  const changed = command.handler({ rawInput: 'light' });
  assert.equal(changed.kind, 'success');
  assert.ok(changed.text.includes('轻语'));

  const bad = command.handler({ rawInput: 'ultra' });
  assert.equal(bad.kind, 'error');

  assert.equal(command.handler({ rawInput: 'pin' }).kind, 'success');
  assert.ok(command.handler({ rawInput: 'unpin' }).text.includes('场景自适应'));

  const globalDefault = command.handler({ rawInput: 'default stage' });
  assert.ok(globalDefault.text.includes('谢幕演出'));
});

test('tool/call 触发场景收敛到 codingCapTier，turn/end 清理桶', () => {
  const { ctx, listeners, sections } = makeCtx();
  apply(ctx);
  const entry = listeners.find((l) => l.event === 'session/event');
  assert.ok(entry, '应监听 session/event');

  assert.equal(sections[0].text().includes('每 3 个自然段'), true, '初始应为 stage');

  entry.handler({ header: { id: 's1' } }, { type: 'tool/call', data: { name: 'write' } });
  const capped = sections[0].text();
  assert.equal(capped.includes('每 3 个自然段'), false, '收敛后不应再有动作描写条款');

  entry.handler({ header: { id: 's1' } }, { type: 'turn/end', data: {} });
});
