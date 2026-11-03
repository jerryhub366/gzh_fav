import type { Run } from '../../../lib/lab/tools/runs';
import { toolBySlug } from '../../../lib/lab/tools/registry';

const STATUS: Record<string, string> = { running: '生成中…', done: '', error: '失败' };

function when(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function RunRow({ run, showTool, active }: { run: Run; showTool?: boolean; active?: boolean }) {
  const tool = toolBySlug(run.tool);
  return (
    <a
      href={`/lab/tools/${run.tool}?run=${run.id}`}
      className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-sm ${
        active ? 'border-blue-400 bg-blue-50/60 dark:bg-blue-950/30' : 'border-gray-200 dark:border-gray-700 hover:border-gray-400'
      }`}
    >
      <span className="font-medium text-gray-900 dark:text-white truncate">{run.company}</span>
      {showTool && <span className="text-gray-500 shrink-0">· {tool?.name || run.tool}</span>}
      <span className={`ml-auto shrink-0 text-xs ${run.status === 'error' ? 'text-red-500' : 'text-gray-400'}`}>
        {STATUS[run.status] || when(run.createdAt)}
      </span>
    </a>
  );
}
