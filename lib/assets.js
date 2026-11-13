import fs from 'node:fs';
import path from 'node:path';
import { ASSET_DIR, ensureDirs, recordProvenance, loadProvenance } from './config.js';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPE = /^image\/(png|jpeg|webp|gif|avif)$/i;
const ALLOWED_EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' };

export const IMPORT_GUIDE = Object.freeze({
  note: '插件不内置任何官方美术或语音素材。以下仅为「去哪里找」的类别提示，具体页面请自行核对可访问性与使用条款；导入的图片只保存在本机。',
  categories: [
    { id: 'official-character', label: '官方角色页 / 官方发布会公开图', hint: '官方站点与官方账号发布的角色介绍、立绘与活动图' },
    { id: 'official-wiki', label: '官方或社区 Wiki 的角色插图', hint: '注意核对图片来源标注与授权说明' },
    { id: 'self-made', label: '自制或已授权的同人图', hint: '请保留作者与授权信息，导入时一并填写' },
  ],
  rules: [
    '禁止导入来源不明、带有他人水印或明确禁止转载的图片。',
    '导入即写入本机素材目录，不会上传到任何服务器。',
    '插件发布物中不含这些图片；npm 包只有代码与自制占位图。',
  ],
});

function safeId(value) {
  const id = String(value ?? '').trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return '';
  return id;
}

export function assetPathOf(id) {
  const safe = safeId(id);
  if (safe === '') return '';
  for (const ext of ['.png', '.jpg', '.webp', '.gif', '.avif']) {
    const file = path.join(ASSET_DIR, safe + ext);
    if (fs.existsSync(file)) return file;
  }
  return '';
}

export function listAssets() {
  ensureDirs();
  let names = [];
  try {
    names = fs.readdirSync(ASSET_DIR);
  } catch {
    return [];
  }
  const provenance = loadProvenance();
  const byFile = new Map(provenance.map((p) => [p.file, p]));
  return names
    .filter((name) => /^[A-Za-z0-9_-]{1,64}\.(png|jpg|webp|gif|avif)$/.test(name))
    .map((name) => {
      const id = name.replace(/\.[a-z0-9]+$/i, '');
      const meta = byFile.get(name) ?? {};
      let bytes = 0;
      let mtime = 0;
      try {
        const stat = fs.statSync(path.join(ASSET_DIR, name));
        bytes = stat.size;
        mtime = stat.mtimeMs;
      } catch {
        /* 已被外部删除，仍列出来让用户看到并清理 */
      }
      return {
        id,
        file: name,
        bytes,
        mtime,
        source: typeof meta.source === 'string' ? meta.source : '',
        author: typeof meta.author === 'string' ? meta.author : '',
        addedAt: typeof meta.addedAt === 'number' ? meta.addedAt : 0,
      };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

export function removeAsset(id) {
  const file = assetPathOf(id);
  if (file === '') return false;
  try {
    fs.unlinkSync(file);
    return true;
  } catch {
    return false;
  }
}

export async function importFromUrl(input, fetchImpl) {
  const url = String(input?.url ?? '').trim();
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: '链接格式不正确' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: '只支持 http / https 链接' };
  }
  const id = safeId(input?.id) || 'asset-' + Date.now().toString(36);
  const doFetch = fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== 'function') return { ok: false, error: '当前运行时没有 fetch，无法下载' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  let response;
  try {
    response = await doFetch(parsed.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'dsh-bird-robin/0.1 (+local asset import)' },
    });
  } catch (error) {
    clearTimeout(timer);
    return { ok: false, error: '下载失败：' + (error instanceof Error ? error.message : String(error)) };
  }
  clearTimeout(timer);
  if (!response.ok) return { ok: false, error: `下载失败：HTTP ${response.status}` };

  const type = String(response.headers.get('content-type') ?? '').split(';')[0].trim();
  if (!ALLOWED_TYPE.test(type)) return { ok: false, error: '不是受支持的图片类型：' + (type || 'unknown') };
  const ext = ALLOWED_EXT[type.toLowerCase()] ?? '.png';

  let bytes;
  try {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) return { ok: false, error: '图片超过 8MB，请先压缩' };
    bytes = Buffer.from(buffer);
  } catch (error) {
    return { ok: false, error: '读取图片失败：' + (error instanceof Error ? error.message : String(error)) };
  }

  ensureDirs();
  const fileName = id + ext;
  fs.writeFileSync(path.join(ASSET_DIR, fileName), bytes);
  const entry = {
    id,
    file: fileName,
    source: parsed.toString(),
    author: String(input?.author ?? '').slice(0, 120),
    note: String(input?.note ?? '').slice(0, 240),
    addedAt: Date.now(),
    bytes: bytes.length,
  };
  recordProvenance(entry);
  return { ok: true, asset: entry };
}
