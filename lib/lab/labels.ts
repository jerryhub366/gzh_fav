export const STATUS_LABEL = {
  draft: '陪练中',
  challenged: '待收卡',
  open: '等复盘',
  resolved: '已复盘',
} as const;

export const OUTCOME_LABEL = {
  right: '判断对了',
  wrong: '判断错了',
  partial: '部分对',
  unclear: '无法判断',
} as const;

export const STANCE_LABEL = { agree: '同意', disagree: '不同意', unsure: '不确定' } as const;

export function today() {
  return new Date().toISOString().slice(0, 10);
}
