// 把 ~/.claude/skills 里的 skill 原文同步成网页工具的指令：skill 是真源，网页工具只是另一个入口。
// 改了 skill 之后跑 `npm run sync-skills`，再提交 lib/lab/tools/skills.generated.ts。
// 去掉 frontmatter 和「保存 / 输出 Markdown 文件」这类只对本地 agent 有意义的段落。
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const SKILLS = ['cash-story', 'risk', 'bear-case-research', 'company-story', 'buyside-research'];
const DROP = /^##\s*(第.步：)?(输出 Markdown 文件|保存)/;

function clean(text) {
  const body = text.replace(/^---\n[\s\S]*?\n---\n/, '');
  const out = [];
  let dropping = false;
  for (const line of body.split('\n')) {
    if (/^##\s/.test(line)) dropping = DROP.test(line);
    if (!dropping) out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const entries = SKILLS.map((name) => {
  const raw = readFileSync(join(homedir(), '.claude/skills', name, 'SKILL.md'), 'utf8');
  const text = clean(raw);
  const hash = createHash('sha1').update(text).digest('hex').slice(0, 8);
  return `  ${JSON.stringify(name)}: { hash: ${JSON.stringify(hash)}, text: ${JSON.stringify(text)} },`;
});

writeFileSync(
  new URL('../lib/lab/tools/skills.generated.ts', import.meta.url),
  `// 由 scripts/sync-skills.mjs 生成，不要手改。真源：~/.claude/skills/<name>/SKILL.md\nexport const SKILLS: Record<string, { hash: string; text: string }> = {\n${entries.join('\n')}\n};\n`,
);
console.log(`synced ${SKILLS.length} skills`);
