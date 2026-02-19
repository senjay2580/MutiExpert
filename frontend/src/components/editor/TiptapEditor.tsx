import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, List, ListOrdered, Heading2, Link as LinkIcon, Undo, Redo, Code,
} from 'lucide-react';

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function TiptapEditor({ content, onChange, placeholder = '开始编写...' }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="tiptap-content"
      />
    </div>
  );
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const btnClass = 'p-1.5 rounded-md cursor-pointer transition-colors';

  const btn = (active: boolean) => ({
    background: active ? 'var(--accent-subtle)' : 'transparent',
    color: active ? 'var(--accent-text)' : 'var(--text-muted)',
  });

  const addLink = () => {
    const url = window.prompt('输入链接 URL');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div
      className="flex items-center gap-0.5 px-2 py-1.5 flex-wrap"
      style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border-default)' }}
    >
      <button className={btnClass} style={btn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={15} strokeWidth={2} />
      </button>
      <button className={btnClass} style={btn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={15} strokeWidth={2} />
      </button>
      <button className={btnClass} style={btn(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 size={15} strokeWidth={2} />
      </button>
      <button className={btnClass} style={btn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List size={15} strokeWidth={2} />
      </button>
      <button className={btnClass} style={btn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered size={15} strokeWidth={2} />
      </button>
      <button className={btnClass} style={btn(editor.isActive('codeBlock'))} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Code size={15} strokeWidth={2} />
      </button>
      <button className={btnClass} style={btn(editor.isActive('link'))} onClick={addLink}>
        <LinkIcon size={15} strokeWidth={2} />
      </button>
      <div className="w-px h-4 mx-1" style={{ background: 'var(--border-default)' }} />
      <button className={btnClass} style={btn(false)} onClick={() => editor.chain().focus().undo().run()}>
        <Undo size={15} strokeWidth={2} />
      </button>
      <button className={btnClass} style={btn(false)} onClick={() => editor.chain().focus().redo().run()}>
        <Redo size={15} strokeWidth={2} />
      </button>
    </div>
  );
}
