import test from 'node:test';
import assert from 'node:assert/strict';
import { personaText, capTier, nextTier, normalizeAddress, TIERS, PERSONA_TEXT_MAX } from '../lib/persona.js';
import { normalizeConfig, DEFAULT_CONFIG } from '../lib/config.js';

test('off 档不产生任何人格文本', () => {
  assert.equal(personaText('off'), '');
  assert.equal(personaText('off', '开拓者'), '');
});

test('off 之外的档位都带称呼与硬性约束', () => {
  for (const tier of ['light', 'standard', 'stage']) {
    const text = personaText(tier, '亲爱的听众');
    assert.ok(text.includes('亲爱的听众'), tier + ' 应包含称呼');
    assert.ok(text.includes('硬性约束'), tier + ' 应包含硬性约束段');
    assert.ok(text.length <= PERSONA_TEXT_MAX, tier + ' 不应超过字数上限');
  }
});

test('档位越高文本越长（单调）', () => {
  const lengths = ['off', 'light', 'standard', 'stage'].map((t) => personaText(t).length);
  for (let i = 2; i < lengths.length; i += 1) assert.ok(lengths[i] > lengths[i - 1]);
});

test('称呼可替换且被裁剪到 24 字', () => {
  const long = '开'.repeat(80);
  assert.equal(normalizeAddress(long).length, 24);
  assert.equal(normalizeAddress('   '), '亲爱的听众');
  assert.ok(personaText('light', '开拓者').includes('开拓者'));
});

test('capTier 只会向下收敛，off 永远 off', () => {
  assert.equal(capTier('stage', 'light'), 'light');
  assert.equal(capTier('light', 'standard'), 'light');
  assert.equal(capTier('off', 'stage'), 'off');
  assert.equal(capTier('standard', null), 'standard');
  assert.equal(capTier('stage', undefined), 'stage');
});

test('nextTier 在边界处饱和', () => {
  assert.equal(nextTier('off', -1), 'off');
  assert.equal(nextTier('stage', 1), 'stage');
  assert.equal(nextTier('standard', 1), 'stage');
});

test('配置归一化：非法值回落到默认，未知字段被丢弃', () => {
  const config = normalizeConfig({
    tier: 'ultra',
    enabled: 'yes',
    address: '   ',
    visual: { accent: 'rainbow', headerBadge: false },
    assets: { avatarId: 'x'.repeat(200) },
    evil: true,
  });
  assert.equal(config.tier, DEFAULT_CONFIG.tier);
  assert.equal(config.enabled, DEFAULT_CONFIG.enabled);
  assert.equal(config.address, DEFAULT_CONFIG.address);
  assert.equal(config.visual.accent, DEFAULT_CONFIG.visual.accent);
  assert.equal(config.visual.headerBadge, false);
  assert.equal(config.assets.avatarId.length, 64);
  assert.ok(!('evil' in config));
});

test('四个档位都在 TIERS 里且顺序固定', () => {
  assert.deepEqual(TIERS, ['off', 'light', 'standard', 'stage']);
});
