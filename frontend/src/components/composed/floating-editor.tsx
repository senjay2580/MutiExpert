import { useState, useRef, useCallback, useEffect, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';
import TiptapEditor from '@/components/editor/TiptapEditor';

const MIN_W = 600;
const MIN_H = 460;
const DEFAULT_W = 780;
const DEFAULT_H = 580;

interface FloatingEditorProps {
  open: boolean;
  onClose: () => void;
  title: string;
  onTitleChange: (v: string) => void;
  html: string;
  onHtmlChange: (v: string) => void;
  onSave: () => void;
  saving?: boolean;
}

type FloatingEditorWindowProps = Omit<FloatingEditorProps, 'open'>;

function getCenteredPos() {
  return {
    x: Math.max(0, (window.innerWidth - DEFAULT_W) / 2),
    y: Math.max(40, (window.innerHeight - DEFAULT_H) / 2 - 40),
  };
}

export function FloatingEditor({ open, ...rest }: FloatingEditorProps) {
  if (!open) return null;
  return <FloatingEditorWindow {...rest} />;
}

function FloatingEditorWindow({
  onClose,
  title,
  onTitleChange,
  html,
  onHtmlChange,
  onSave,
  saving,
}: FloatingEditorWindowProps) {
  const [maximized, setMaximized] = useState(false);
  const [pos, setPos] = useState(() => getCenteredPos());
  const [size, setSize] = useState(() => ({ w: DEFAULT_W, h: DEFAULT_H }));
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const resizeRef = useRef({ resizing: false, startX: 0, startY: 0, origW: 0, origH: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const windowedRef = useRef({ pos, size });

  const isDirty = title.trim().length > 0 || html.trim().length > 0;

  const setWindowed = useCallback(() => {
    setMaximized(false);
    setPos(windowedRef.current.pos);
    setSize(windowedRef.current.size);
  }, []);

  const toggleMaximized = useCallback(() => {
    if (maximized) {
      setWindowed();
      return;
    }
    windowedRef.current = { pos, size };
    setMaximized(true);
  }, [maximized, pos, size, setWindowed]);

  // Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (title.trim() && html.trim() && !saving) onSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [title, html, saving, onSave]);

  /* ---- Drag (title bar) ---- */
  const onDragDown = useCallback((e: ReactPointerEvent) => {
    if (maximized) return;
    e.preventDefault();
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [maximized, pos]);

  const onDragMove = useCallback((e: ReactPointerEvent) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({ x: dragRef.current.origX + dx, y: Math.max(0, dragRef.current.origY + dy) });
  }, []);

  const onDragUp = useCallback((e: ReactPointerEvent) => {
    dragRef.current.dragging = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  /* ---- Resize (bottom-right corner) ---- */
  const onResizeDown = useCallback((e: ReactPointerEvent) => {
    if (maximized) return;
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { resizing: true, startX: e.clientX, startY: e.clientY, origW: size.w, origH: size.h };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [maximized, size]);

  const onResizeMove = useCallback((e: ReactPointerEvent) => {
    if (!resizeRef.current.resizing) return;
    const dx = e.clientX - resizeRef.current.startX;
    const dy = e.clientY - resizeRef.current.startY;
    setSize({
      w: Math.max(MIN_W, resizeRef.current.origW + dx),
      h: Math.max(MIN_H, resizeRef.current.origH + dy),
    });
  }, []);

  const onResizeUp = useCallback((e: ReactPointerEvent) => {
    resizeRef.current.resizing = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  const windowStyle = maximized
    ? { inset: 0, width: '100%', height: '100%' }
    : { left: pos.x, top: pos.y, width: size.w, height: size.h };

  const canSave = title.trim().length > 0 && html.trim().length > 0;

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[3px]" onClick={onClose} />

      {/* Window */}
      <div
        ref={containerRef}
        className={cn(
          'fixed z-[60] flex flex-col bg-background overflow-hidden',
          'border border-border/60 shadow-2xl shadow-black/20',
          maximized ? 'rounded-none' : 'rounded-2xl',
        )}
        style={windowStyle}
      >
        {/* ── macOS Title Bar ── */}
        <div
          className="flex h-11 shrink-0 items-center gap-3 border-b border-border/40 bg-muted/40 px-4 select-none"
          style={{ cursor: maximized ? 'default' : 'move' }}
          onPointerDown={onDragDown}
          onPointerMove={onDragMove}
          onPointerUp={onDragUp}
          onDoubleClick={toggleMaximized}
        >
          {/* Traffic lights */}
          <div className="flex items-center gap-[7px]">
            <button
              onClick={onClose}
              className="group size-[13px] rounded-full bg-[#FF5F57] border border-[#E14640] flex items-center justify-center hover:brightness-90 transition-all"
              title="关闭"
            >
              <Icon icon="lucide:x" width={8} height={8} className="text-[#4D0000] opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button
              onClick={setWindowed}
              className="group size-[13px] rounded-full bg-[#FEBC2E] border border-[#DFA123] flex items-center justify-center hover:brightness-90 transition-all"
              title="最小化"
            >
              <Icon icon="lucide:minus" width={8} height={8} className="text-[#995700] opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button
              onClick={toggleMaximized}
              className="group size-[13px] rounded-full bg-[#28C840] border border-[#1AAB29] flex items-center justify-center hover:brightness-90 transition-all"
              title={maximized ? '还原' : '全屏'}
            >
              <Icon icon={maximized ? 'lucide:minimize-2' : 'lucide:maximize-2'} width={7} height={7} className="text-[#006500] opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>

          {/* Center: breadcrumb path + unsaved dot */}
          <div className="flex flex-1 items-center justify-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Icon icon="lucide:folder" width={13} height={13} />
              <span>知识库</span>
              <Icon icon="lucide:chevron-right" width={11} height={11} className="opacity-50" />
              <span className="text-foreground font-medium truncate max-w-[200px]">
                {title.trim() || '未命名文章'}
              </span>
              {isDirty && (
                <span className="size-2 rounded-full bg-foreground/40 ml-1 shrink-0" title="未保存" />
              )}
            </div>
          </div>

          {/* Right: save button */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onSave}
              disabled={!canSave || saving}
              className={cn(
                'h-[26px] px-3 rounded-md text-[12px] font-medium transition-all',
                'bg-primary text-primary-foreground hover:brightness-110',
                'disabled:opacity-40 disabled:pointer-events-none',
              )}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        {/* ── Title Input ── */}
        <div className="shrink-0 px-5 pt-4 pb-1">
          <input
            autoFocus
            placeholder="输入文章标题..."
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="w-full bg-transparent text-xl font-semibold text-foreground placeholder:text-muted-foreground/50 outline-none border-none"
          />
        </div>

        {/* ── Editor Content ── */}
        <div className="flex-1 min-h-0 flex flex-col [&>div]:flex-1 [&>div]:min-h-0 [&>div]:flex [&>div]:flex-col [&_.rounded-xl]:rounded-none [&_.rounded-xl]:border-x-0 [&_.rounded-xl]:border-b-0 [&_.tiptap-content_.tiptap]:px-5 [&_.tiptap-content_.tiptap]:py-3">
          <TiptapEditor
            content={html}
            onChange={onHtmlChange}
            placeholder="开始编写文章内容..."
          />
        </div>

        {/* ── Status Bar ── */}
        <div className="flex shrink-0 items-center justify-between border-t border-border/40 bg-muted/30 px-4 py-1.5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Icon icon="lucide:file-text" width={11} height={11} />
              文章
            </span>
            {isDirty && <span className="text-amber-500">未保存的更改</span>}
          </div>
          <div className="flex items-center gap-1">
            <Icon icon="lucide:keyboard" width={11} height={11} />
            <span>Ctrl+S 保存</span>
          </div>
        </div>

        {/* Resize handle */}
        {!maximized && (
          <div
            className="absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize"
            onPointerDown={onResizeDown}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeUp}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" className="absolute bottom-0.5 right-0.5 text-muted-foreground/30">
              <path d="M14 14L8 14L14 8Z" fill="currentColor" />
              <path d="M14 14L11 14L14 11Z" fill="currentColor" opacity="0.5" />
            </svg>
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
