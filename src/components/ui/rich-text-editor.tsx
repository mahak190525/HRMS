import React, { useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Heading } from '@tiptap/extension-heading';
import { BulletList } from '@tiptap/extension-bullet-list';
import { OrderedList } from '@tiptap/extension-ordered-list';
import { ListItem } from '@tiptap/extension-list-item';
import { Blockquote } from '@tiptap/extension-blockquote';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { TextAlign } from '@tiptap/extension-text-align';
import { 
  Bold, 
  Italic, 
  Strikethrough, 
  Code, 
  Heading1, 
  Heading2, 
  Heading3,
  List, 
  ListOrdered, 
  Quote, 
  Undo, 
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Palette,
  Type
} from 'lucide-react';
import { Button } from './button';
import { Separator } from './separator';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from './dropdown-menu';
import { cn } from '../../lib/utils';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
  minHeight?: number;
  stickyToolbar?: boolean;
}

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null;
  }

  // Helper function to safely execute editor commands
  const executeCommand = (command: () => void) => {
    if (editor && !editor.isDestroyed && editor.isEditable) {
      try {
        command();
      } catch (error) {
        console.error('Editor command failed:', error);
      }
    }
  };

  const textColors = [
    '#000000', '#374151', '#6B7280', '#9CA3AF',
    '#EF4444', '#F97316', '#F59E0B', '#EAB308',
    '#84CC16', '#22C55E', '#10B981', '#14B8A6',
    '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1',
    '#8B5CF6', '#A855F7', '#D946EF', '#EC4899'
  ];

  const fontSizes = [
    { label: 'Small', value: '12px' },
    { label: 'Normal', value: '14px' },
    { label: 'Medium', value: '16px' },
    { label: 'Large', value: '18px' },
    { label: 'Extra Large', value: '24px' }
  ];

  return (
    <div className="border-b border-gray-200 p-2 flex flex-wrap gap-1 bg-gray-50">
      {/* Text Formatting */}
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive('bold') && "bg-gray-200"
          )}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive('italic') && "bg-gray-200"
          )}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive('strike') && "bg-gray-200"
          )}
        >
          <Strikethrough className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive('code') && "bg-gray-200"
          )}
        >
          <Code className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-8" />

      {/* Headings */}
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => executeCommand(() => 
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          )}
          className={cn(
            "h-8 w-8 p-0",
            editor?.isActive('heading', { level: 1 }) && "bg-gray-200"
          )}
          disabled={!editor || editor.isDestroyed}
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => executeCommand(() => 
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          )}
          className={cn(
            "h-8 w-8 p-0",
            editor?.isActive('heading', { level: 2 }) && "bg-gray-200"
          )}
          disabled={!editor || editor.isDestroyed}
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => executeCommand(() => 
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          )}
          className={cn(
            "h-8 w-8 p-0",
            editor?.isActive('heading', { level: 3 }) && "bg-gray-200"
          )}
          disabled={!editor || editor.isDestroyed}
        >
          <Heading3 className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-8" />

      {/* Lists */}
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => executeCommand(() => 
            editor.chain().focus().toggleBulletList().run()
          )}
          className={cn(
            "h-8 w-8 p-0",
            editor?.isActive('bulletList') && "bg-gray-200"
          )}
          disabled={!editor || editor.isDestroyed}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => executeCommand(() => 
            editor.chain().focus().toggleOrderedList().run()
          )}
          className={cn(
            "h-8 w-8 p-0",
            editor?.isActive('orderedList') && "bg-gray-200"
          )}
          disabled={!editor || editor.isDestroyed}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => executeCommand(() => 
            editor.chain().focus().toggleBlockquote().run()
          )}
          className={cn(
            "h-8 w-8 p-0",
            editor?.isActive('blockquote') && "bg-gray-200"
          )}
          disabled={!editor || editor.isDestroyed}
        >
          <Quote className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-8" />

      {/* Alignment */}
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive({ textAlign: 'left' }) && "bg-gray-200"
          )}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive({ textAlign: 'center' }) && "bg-gray-200"
          )}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive({ textAlign: 'right' }) && "bg-gray-200"
          )}
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive({ textAlign: 'justify' }) && "bg-gray-200"
          )}
        >
          <AlignJustify className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-8" />

      {/* Text Color */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Palette className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48">
          <div className="grid grid-cols-5 gap-1 p-2">
            {textColors.map((color) => (
              <button
                key={color}
                className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                onClick={() => executeCommand(() => 
                  editor.chain().focus().setColor(color).run()
                )}
                title={color}
              />
            ))}
          </div>
          <DropdownMenuItem
            onClick={() => executeCommand(() => 
              editor.chain().focus().unsetColor().run()
            )}
            className="justify-center"
          >
            Remove Color
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Font Size */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Type className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {fontSizes.map((size) => (
            <DropdownMenuItem
              key={size.value}
              onClick={() => executeCommand(() => 
                editor.chain().focus().setMark('textStyle', { fontSize: size.value }).run()
              )}
            >
              {size.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            onClick={() => executeCommand(() => 
              editor.chain().focus().unsetMark('textStyle').run()
            )}
          >
            Reset Size
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="h-8" />

      {/* Undo/Redo */}
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          className="h-8 w-8 p-0"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          className="h-8 w-8 p-0"
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content,
  onChange,
  placeholder = "Start writing...",
  className,
  editable = true,
  minHeight = 200,
  stickyToolbar = false
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable default extensions that we'll configure explicitly
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
      }),
      // Explicitly configure extensions for better control
      Heading.configure({
        levels: [1, 2, 3],
      }),
      BulletList.configure({
        keepMarks: true,
        keepAttributes: false,
      }),
      OrderedList.configure({
        keepMarks: true,
        keepAttributes: false,
      }),
      ListItem,
      Blockquote,
      TextStyle,
      Color,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm max-w-none focus:outline-none',
          'min-h-[200px] p-4',
          className
        ),
      },
    },
  });

  // Update content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Debug editor extensions
  useEffect(() => {
    if (editor) {
      console.log('Editor extensions loaded:', editor.extensionManager.extensions.map(ext => ext.name));
      console.log('Editor can toggle heading:', editor.can().toggleHeading({ level: 1 }));
      console.log('Editor can toggle bullet list:', editor.can().toggleBulletList());
    }
  }, [editor]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    // Handle common keyboard shortcuts
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'b':
          event.preventDefault();
          editor?.chain().focus().toggleBold().run();
          break;
        case 'i':
          event.preventDefault();
          editor?.chain().focus().toggleItalic().run();
          break;
        case 'u':
          event.preventDefault();
          editor?.chain().focus().toggleStrike().run();
          break;
        case 'z':
          if (event.shiftKey) {
            event.preventDefault();
            editor?.chain().focus().redo().run();
          } else {
            event.preventDefault();
            editor?.chain().focus().undo().run();
          }
          break;
      }
    }
  }, [editor]);

  if (!editor) {
    return (
      <div className="border rounded-lg">
        <div className="h-12 bg-gray-50 border-b animate-pulse" />
        <div className="p-4 space-y-2">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
        </div>
      </div>
    );
  }

  if (stickyToolbar && editable) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        {/* Sticky Toolbar */}
        <div className="flex-shrink-0 border-b bg-white">
          <MenuBar editor={editor} />
        </div>
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div 
            className="relative"
            style={{ minHeight }}
            onKeyDown={handleKeyDown}
          >
            <EditorContent 
              editor={editor} 
              className={cn(
                "prose prose-sm max-w-none p-4",
                !editable && "prose-gray-600"
              )}
            />
            {editor.isEmpty && (
              <div className="absolute top-4 left-4 text-gray-400 pointer-events-none">
                {placeholder}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("border rounded-lg overflow-hidden", className)}>
      {editable && <MenuBar editor={editor} />}
      <div 
        className="relative"
        style={{ minHeight }}
        onKeyDown={handleKeyDown}
      >
        <EditorContent 
          editor={editor} 
          className={cn(
            "prose prose-sm max-w-none",
            !editable && "prose-gray-600"
          )}
        />
        {editor.isEmpty && editable && (
          <div className="absolute top-4 left-4 text-gray-400 pointer-events-none">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
};

// Read-only version for displaying policy content
export const PolicyContentViewer: React.FC<{
  content: string;
  className?: string;
}> = ({ content, className }) => {
  return (
    <RichTextEditor
      content={content}
      onChange={() => {}} // No-op for read-only
      editable={false}
      className={className}
    />
  );
};

export default RichTextEditor;
