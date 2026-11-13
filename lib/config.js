import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
export const CONFIG_FILE = path.join(DSH_HOME, '.dshbr-config.json');
export const DATA_DIR = path.join(DSH_HOME, 'bird-robin');
export const ASSET_DIR = path.join(DATA_DIR, 'assets');
export const PROVENANCE_FILE = path.join(DATA_DIR, 'provenance.json');

export const CONFIG_VERSION = 1;

export const DEFAULT_CONFIG = Object.freeze({
  version: CONFIG_VERSION,
  enabled: true,
  tier: 'stage',
  sceneAdaptation: true,
  codingCapTier: 'light',
  heavyTaskCapTier: 'light',
  address: '亲爱的听众',
  addressOncePerTurn: true,
  actionBudget: true,
  visual: Object.freeze({
    enabled: true,
    headerBadge: true,
    overlayButton: true,
    openingCard: true,
    bubble: true,
    background: false,
    accent: 'robin',
  }),
  assets: Object.freeze({
    avatarId: 'default',
    backgroundId: 'default',
  }),
});

const TIERS = new Set(['off', 'light', 'standard', 'stage']);
const ACCENTS = new Set(['robin', 'nightingale', 'dawn']);

function bool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function pickTier(value, fallback) {
  return typeof value === 'string' && TIERS.has(value) ? value : fallback;
}

function str(value, fallback, maxLength) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (trimmed === '') return fallback;
  return trimmed.slice(0, maxLength);
}

export function normalizeConfig(input) {
  const raw = input !== null && typeof input === 'object' ? input : {};
  const visualRaw = raw.visual !== null && typeof raw.visual === 'object' ? raw.visual : {};
  const assetsRaw = raw.assets !== null && typeof raw.assets === 'object' ? raw.assets : {};
  const base = DEFAULT_CONFIG;
  return {
    version: CONFIG_VERSION,
    enabled: bool(raw.enabled, base.enabled),
    tier: pickTier(raw.tier, base.tier),
    sceneAdaptation: bool(raw.sceneAdaptation, base.sceneAdaptation),
    codingCapTier: pickTier(raw.codingCapTier, base.codingCapTier),
    heavyTaskCapTier: pickTier(raw.heavyTaskCapTier, base.heavyTaskCapTier),
    address: str(raw.address, base.address, 24),
    addressOncePerTurn: bool(raw.addressOncePerTurn, base.addressOncePerTurn),
    actionBudget: bool(raw.actionBudget, base.actionBudget),
    visual: {
      enabled: bool(visualRaw.enabled, base.visual.enabled),
      headerBadge: bool(visualRaw.headerBadge, base.visual.headerBadge),
      overlayButton: bool(visualRaw.overlayButton, base.visual.overlayButton),
      openingCard: bool(visualRaw.openingCard, base.visual.openingCard),
      bubble: bool(visualRaw.bubble, base.visual.bubble),
      background: bool(visualRaw.background, base.visual.background),
      accent: ACCENTS.has(visualRaw.accent) ? visualRaw.accent : base.visual.accent,
    },
    assets: {
      avatarId: str(assetsRaw.avatarId, base.assets.avatarId, 64),
      backgroundId: str(assetsRaw.backgroundId, base.assets.backgroundId, 64),
    },
  };
}

export function loadConfig() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return normalizeConfig(parsed);
  } catch {
    return normalizeConfig(undefined);
  }
}

export function saveConfig(config) {
  const normalized = normalizeConfig(config);
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  const tmp = CONFIG_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(normalized, null, 2), 'utf8');
  fs.renameSync(tmp, CONFIG_FILE);
  return normalized;
}

export function ensureDirs() {
  fs.mkdirSync(ASSET_DIR, { recursive: true });
}

export function loadProvenance() {
  try {
    const parsed = JSON.parse(fs.readFileSync(PROVENANCE_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordProvenance(entry) {
  const list = loadProvenance();
  list.unshift(entry);
  const trimmed = list.slice(0, 200);
  fs.mkdirSync(path.dirname(PROVENANCE_FILE), { recursive: true });
  fs.writeFileSync(PROVENANCE_FILE, JSON.stringify(trimmed, null, 2), 'utf8');
  return trimmed;
}
