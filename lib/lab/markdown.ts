import { Card } from './cards';
import { CARD_KINDS, DRAFT_QUESTIONS } from './principles';
import { OUTCOME_LABEL, STANCE_LABEL } from './labels';

// 导出成 Markdown，frontmatter 便于放进 Obsidian 的投资判断校准库。
export function cardToMarkdown(card: Card) {
  const d = card.data;
  const kind = CARD_KINDS.find((k) => k.key === card.kind)?.label || card.kind;
  const lines = [
    '---',
    `company: ${card.company}`,
    `kind: ${card.kind}`,
    `status: ${card.status}`,
    `probability_initial: ${d.initialProbability ?? ''}`,
    `probability_final: ${d.finalProbability ?? ''}`,
    `review_date: ${card.reviewDate ?? ''}`,
    `outcome: ${d.outcome ?? ''}`,
    `principles: ${card.principleVersion}`,
    `created: ${new Date(card.createdAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })}`,
    `source: invest-lab/${card.id}`,
    '---',
    '',
    `# ${card.company}：${card.claim}`,
    '',
    '> 思维训练记录，不构成投资建议。事实以财报、公告为准。',
    '',
    `- 类型：${kind}`,
    `- 冲动来源：${d.impulseSource.join('、') || '—'}${d.impulseNote ? `（${d.impulseNote}）` : ''}`,
    `- 概率：${d.initialProbability ?? '—'}% → ${d.finalProbability ?? '—'}%`,
    '',
    '## 先自己答',
    '',
    ...DRAFT_QUESTIONS[card.kind].flatMap((q) => [`**${q.text}**（${q.ref}）`, '', d.draftAnswers[q.key] || '—', '']),
    '## 挑战与回应',
    '',
    ...d.challenges.flatMap((c) => [
      `**${c.persona}**（${c.ref}${c.source === 'rule' ? '，规则题库' : ''}）：${c.text}`,
      '',
      `${c.rejected ? '❌ 挑战不成立：' : '↳ '}${c.reply || '—'}`,
      '',
    ]),
    '## 收敛',
    '',
    `- 关键假设：${d.keyAssumption || '—'}`,
    `- 证伪条件：${d.falsifiers || '—'}`,
    `- 下一步查证：${d.nextChecks || '—'}`,
    `- 复盘日期：${card.reviewDate || '—'}`,
    '',
  ];
  if (d.friends.length) {
    lines.push('## 朋友的押注', '');
    for (const f of d.friends) {
      lines.push(`- ${f.name}：${STANCE_LABEL[f.stance]}${f.probability != null ? ` ${f.probability}%` : ''}，${f.reason}`);
    }
    lines.push('');
  }
  if (card.status === 'resolved') {
    lines.push('## 复盘', '', `- 结果：${OUTCOME_LABEL[d.outcome] || '—'}`, `- 学到什么：${d.lesson || '—'}`, '');
  }
  return lines.join('\n');
}
