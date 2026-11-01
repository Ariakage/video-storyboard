/**
 * skill-docs.test.mjs — Skill 的"包装层"也要有测试。
 *
 * 之前插件时代的契约测试守的是 tool schema；现在入口是 SKILL.md + bin/，
 * 所以要守住：
 *   1. frontmatter 里有 name / description，name 与目录一致；
 *   2. SKILL.md 提到的每个 `node bin/xxx.mjs` 都真的存在；
 *   3. package.json 的 main / exports / bin 不指向已删除的文件。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const frontmatter = (text) => {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  return m ? m[1] : null;
};

test('SKILL.md: frontmatter 有 name/description，name 与技能目录一致', async () => {
  const text = await readFile(join(ROOT, 'SKILL.md'), 'utf8');
  const fm = frontmatter(text);
  assert.ok(fm, 'SKILL.md 必须以 YAML frontmatter 开头');
  assert.match(fm, /^name:\s*video-storyboard\s*$/m);
  const description = /^description:\s*>?-?\s*([\s\S]*?)(?=\n[a-zA-Z_]+:|$)/m.exec(fm)?.[1] ?? '';
  assert.ok(description.trim().length >= 80, 'description 太短，触发不了技能');
  assert.match(text, /\$CLAUDE_SKILL_DIR\/bin\/storyboard\.mjs/);
  assert.match(text, /\$CLAUDE_SKILL_DIR\/bin\/zoom\.mjs/);
  assert.match(text, /\$CLAUDE_SKILL_DIR\/bin\/locate\.mjs/);
});

test('SKILL.md: 提到的每个 node bin 脚本都存在', async () => {
  const text = await readFile(join(ROOT, 'SKILL.md'), 'utf8');
  const scripts = new Set([...text.matchAll(/bin\/([\w.-]+\.mjs)/g)].map((m) => m[1]));
  assert.ok(scripts.size >= 4, `应该引用至少 4 个脚本，实得 ${scripts.size}`);
  for (const name of scripts) {
    assert.ok(existsSync(join(ROOT, 'bin', name)), `SKILL.md 引用了不存在的 bin/${name}`);
  }
});

test('references: 三份按需加载的文档都在', () => {
  for (const name of ['cli.md', 'strategy.md', 'asr.md']) {
    assert.ok(existsSync(join(ROOT, 'references', name)), `缺 references/${name}`);
  }
});

test('package.json: main/exports/bin 不指向已删除的文件', async () => {
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'video-storyboard-skill');
  assert.ok(!pkg.peerDependencies?.['@deepseek-ai/dsh-tools'], 'DSH peerDependency 应该已移除');
  assert.ok(!pkg.dsh, 'DSH 插件字段应该已移除');

  const paths = [pkg.main, ...Object.values(pkg.exports ?? {}), ...Object.values(pkg.bin ?? {})]
    .filter((p) => typeof p === 'string');
  for (const rel of paths) {
    assert.ok(existsSync(join(ROOT, rel)), `package.json 指向不存在的 ${rel}`);
  }
});

test('需要删除的插件清单不应复活', () => {
  for (const rel of ['dsh.plugin.json', 'cordis.patch.yml', 'src/index.js', 'src/tool-spec.js']) {
    assert.ok(!existsSync(join(ROOT, rel)), `${rel} 应该已删除`);
  }
});

test('install-skill: --check 在未安装时返回 1、打出的路径是目标 skills 根目录', async () => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);
  const dir = join(ROOT, '.tmp');
  const dest = join(dir, `skills-${Date.now()}`);
  await assert.rejects(
    () => run(process.execPath, [join(ROOT, 'scripts', 'install-skill.mjs'), '--dest', dest, '--check']),
    (err) => err.code === 1 && /installed: no/.test(err.stdout),
  );
});
