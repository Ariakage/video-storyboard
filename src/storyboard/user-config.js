/**
 * user-config.js — 核心读取 video.json 的轻量入口（只读、只关心路径类字段）。
 *
 * 上游（dsh-video-storyboard）把这个文件钉在 `~/.dsh/video.json`；本仓库是通用 Skill，
 * 配置目录解析已经收敛在 `config.js`（`~/.video-storyboard`，`~/.dsh` 有旧配置时兼容沿用），
 * 所以这里只做转发 —— 导出名字保持与上游一致，核心模块的 import 不用改。
 */

import { existsSync, readFileSync } from 'node:fs';
import { configHome, configPath, VIDEO_CONFIG_FILE } from './config.js';

/** 保留上游的导出名；实际解析走 configHome()（VIDEO_STORYBOARD_HOME > DSH_HOME > 旧 ~/.dsh > ~/.video-storyboard）。 */
export function dshHome(env = process.env) {
  return configHome(env);
}

export function videoConfigPath(env = process.env) {
  return configPath(VIDEO_CONFIG_FILE, env);
}

/** 坏文件/非对象都按空配置处理；核心不应该因为设置文件损坏而拒绝工作。 */
export function readVideoFile(env = process.env) {
  const path = videoConfigPath(env);
  if (!existsSync(path)) return {};
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

/** 按 `"a.b.c"` 路径读一个字符串；不存在/非字符串/空白都返回 ''。 */
export function configuredText(data, path) {
  const value = String(path).split('.')
    .reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), data);
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

/**
 * 按 `"a.b.c"` 路径读一个数字；不存在/非数字/越界都返回 null。
 * 嵌套路径是为了 `storyboard.cutFloor` 这种分组字段（和 `storyboard.auto` 同一层）。
 */
export function configuredNumber(data, path, { min = -Infinity, max = Infinity } = {}) {
  const raw = String(path).split('.')
    .reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), data);
  const n = Number(raw);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}
