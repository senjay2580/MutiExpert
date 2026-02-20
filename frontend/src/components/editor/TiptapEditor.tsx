import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Icon } from '@iconify/react';

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
    <div className="rounded-xl overflow-hidden flex flex-col" style={{ border: '1px solid var(--border-default)' }}>
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="tiptap-content flex-1 min-h-0 overflow-y-auto"
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
        <Icon icon="streamline-color:text-style" width={15} height={15} />
      </button>
      <button className={btnClass} style={btn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Icon icon="streamline-color:paragraph" width={15} height={15} />
      </button>
      <button className={btnClass} style={btn(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Icon icon="streamline-color:heading-2-paragraph-styles-heading" width={15} height={15} />
      </button>
      <button className={btnClass} style={btn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <Icon icon="streamline-color:bullet-list" width={15} height={15} />
      </button>
      <button className={btnClass} style={btn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <Icon icon="streamline-color:ascending-number-order" width={15} height={15} />
      </button>
      <button className={btnClass} style={btn(editor.isActive('codeBlock'))} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Icon icon="streamline-color:curly-brackets" width={15} height={15} />
      </button>
      <button className={btnClass} style={btn(editor.isActive('link'))} onClick={addLink}>
        <Icon icon="streamline-color:link-chain" width={15} height={15} />
      </button>
      <div className="w-px h-4 mx-1" style={{ background: 'var(--border-default)' }} />
      <button className={btnClass} style={btn(false)} onClick={() => editor.chain().focus().undo().run()}>
        <Icon icon="streamline-color:return-2" width={15} height={15} />
      </button>
      <button className={btnClass} style={btn(false)} onClick={() => editor.chain().focus().redo().run()}>
        <Icon icon="streamline-color:ai-redo-spark" width={15} height={15} />
      </button>
    </div>
  );
}
