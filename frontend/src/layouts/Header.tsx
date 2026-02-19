import { Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const pageTitles: Record<string, string> = {
  '/dashboard': '仪表盘',
  '/knowledge': '行业知识库',
  '/chat': 'AI 对话',
  '/analytics': '数据分析',
  '/settings': '系统管理',
};

function getPageTitle(pathname: string): string {
  const base = '/' + pathname.split('/')[1];
  return pageTitles[base] ?? '';
}

export default function Header() {
  const location = useLocation();
  const title = getPageTitle(location.pathname);

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-6 shrink-0"
      style={{
        height: 'var(--topbar-height)',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      <h1
        className="text-[14px] font-semibold tracking-tight"
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </h1>

      <div className="flex items-center gap-2">
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] cursor-pointer transition-colors"
          style={{
            color: 'var(--text-muted)',
            background: 'var(--bg-sunken)',
            border: '1px solid var(--border-default)',
            transitionDuration: 'var(--duration-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-strong)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-default)';
          }}
        >
          <Search size={14} strokeWidth={1.8} />
          <span>搜索...</span>
          <kbd
            className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-muted)',
            }}
          >
            Ctrl+K
          </kbd>
        </button>
      </div>
    </header>
  );
}
