import React, { useEffect } from 'react';
import { useEditor, EditorContent, EditorContext, type Editor } from '@tiptap/react';

// --- Tiptap Core Extensions ---
import { StarterKit } from '@tiptap/starter-kit';
import { Image } from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TextAlign } from '@tiptap/extension-text-align';
import { Typography } from '@tiptap/extension-typography';
import { Highlight } from '@tiptap/extension-highlight';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';

// --- UI Primitives ---
import { Button } from '@/components/tiptap-ui-primitive/button';
import { Spacer } from '@/components/tiptap-ui-primitive/spacer';
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from '@/components/tiptap-ui-primitive/toolbar';

// --- Tiptap Node ---
import { ImageUploadNode } from '@/components/tiptap-node/image-upload-node/image-upload-node-extension';
import { HorizontalRule } from '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension';

// --- Tiptap UI ---
import { HeadingDropdownMenu } from '@/components/tiptap-ui/heading-dropdown-menu';
import { ListDropdownMenu } from '@/components/tiptap-ui/list-dropdown-menu';
import { BlockquoteButton } from '@/components/tiptap-ui/blockquote-button';
import { CodeBlockButton } from '@/components/tiptap-ui/code-block-button';
import {
  ColorHighlightPopover,
  ColorHighlightPopoverContent,
  ColorHighlightPopoverButton,
} from '@/components/tiptap-ui/color-highlight-popover';
import {
  LinkPopover,
  LinkContent,
  LinkButton,
} from '@/components/tiptap-ui/link-popover';
import { MarkButton } from '@/components/tiptap-ui/mark-button';
import { TextAlignButton } from '@/components/tiptap-ui/text-align-button';
import { UndoRedoButton } from '@/components/tiptap-ui/undo-redo-button';

// --- Icons ---
import { ArrowLeftIcon } from '@/components/tiptap-icons/arrow-left-icon';
import { HighlighterIcon } from '@/components/tiptap-icons/highlighter-icon';
import { LinkIcon } from '@/components/tiptap-icons/link-icon';

// --- Hooks ---
import { useIsMobile } from '@/hooks/use-mobile';

// --- Lib ---
import { handleImageUpload, MAX_FILE_SIZE } from '@/lib/tiptap-utils';

// --- Styles ---
import '@/components/tiptap-templates/simple/simple-editor.scss';

// Custom styles for policy editor
const editorStyles = `
  .policy-simple-editor {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }
  
  .policy-simple-editor .tiptap-toolbar {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    flex-shrink: 0;
    box-sizing: border-box;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
    padding: 0.5rem;
  }
  
  .policy-simple-editor .tiptap-toolbar > * {
    flex-shrink: 0;
  }
  
  .policy-simple-editor .simple-editor-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
    width: 100%;
    position: relative;
    max-height: calc(100vh - 200px);
    scroll-behavior: smooth;
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 #f1f5f9;
  }
  
  .policy-simple-editor .simple-editor-content::-webkit-scrollbar {
    width: 8px;
  }
  
  .policy-simple-editor .simple-editor-content::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 4px;
  }
  
  .policy-simple-editor .simple-editor-content::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }
  
  .policy-simple-editor .simple-editor-content::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
  
  .policy-simple-editor .simple-editor-content .ProseMirror {
    min-height: 400px;
    outline: none;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow-wrap: break-word;
    word-wrap: break-word;
    height: auto;
    margin: 0;
  }
  
  .policy-simple-editor .simple-editor-content .ProseMirror:focus {
    outline: none;
  }
  
  .policy-simple-editor .simple-editor-content .ProseMirror * {
    max-width: 100%;
    box-sizing: border-box;
  }
  
  .policy-simple-editor .simple-editor-wrapper {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  
  /* Ensure toolbar groups don't overflow */
  .policy-simple-editor .tiptap-toolbar-group {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
  }
  
  .policy-simple-editor .tiptap-toolbar-separator {
    width: 1px;
    height: 1.5rem;
    background: #d1d5db;
    flex-shrink: 0;
    margin: 0 0.5rem;
  }
  
  /* Heading styles - target TipTap's default heading elements */
  .policy-simple-editor .ProseMirror h1 {
    font-size: 2rem;
    font-weight: 700;
    line-height: 1.2;
    margin-top: 1.5rem;
    margin-bottom: 1rem;
  }
  
  .policy-simple-editor .ProseMirror h2 {
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.3;
    margin-top: 1.25rem;
    margin-bottom: 0.75rem;
  }
  
  .policy-simple-editor .ProseMirror h3 {
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.4;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
  }
  
  .policy-simple-editor .ProseMirror h4 {
    font-size: 1.125rem;
    font-weight: 600;
    line-height: 1.4;
    margin-top: 0.75rem;
    margin-bottom: 0.5rem;
  }
  
  .policy-simple-editor .ProseMirror h5 {
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.5;
    margin-top: 0.75rem;
    margin-bottom: 0.5rem;
  }
  
  .policy-simple-editor .ProseMirror h6 {
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.5;
    margin-top: 0.5rem;
    margin-bottom: 0.25rem;
  }
  
  /* List styles - target TipTap's default list elements */
  .policy-simple-editor .ProseMirror ul {
    margin: 1rem 0;
    padding-left: 1.5rem;
    list-style-type: disc;
  }
  
  .policy-simple-editor .ProseMirror ol {
    margin: 1rem 0;
    padding-left: 1.5rem;
    list-style-type: decimal;
  }
  
  .policy-simple-editor .ProseMirror li {
    margin: 0.25rem 0;
  }
  
  .policy-simple-editor .ProseMirror ul[data-type="taskList"] {
    list-style-type: none;
    padding-left: 0;
  }
  
  .policy-simple-editor .ProseMirror ul[data-type="taskList"] li {
    display: flex;
    align-items: flex-start;
  }
  
  /* Blockquote styles - target TipTap's default blockquote */
  .policy-simple-editor .ProseMirror blockquote {
    border-left: 4px solid #e5e7eb;
    padding-left: 1rem;
    margin: 1rem 0;
    font-style: italic;
    color: #6b7280;
  }
  
  /* Override any prose or typography constraints for full width */
  .policy-simple-editor .ProseMirror,
  .policy-simple-editor .ProseMirror * {
    max-width: 100% !important;
  }
  
  .policy-simple-editor .ProseMirror > * {
    width: 100%;
  }
  
  .policy-simple-editor .ProseMirror p {
    width: 100%;
    max-width: 100%;
  }
`;

interface PolicySimpleEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
  stickyToolbar?: boolean;
}

const MainToolbarContent = ({
  onHighlighterClick,
  onLinkClick,
  isMobile,
  editor,
}: {
  onHighlighterClick: () => void;
  onLinkClick: () => void;
  isMobile: boolean;
  editor: Editor | null | undefined;
}) => {
  return (
    <div className="flex items-center w-full overflow-x-auto">
      <Spacer />

      <ToolbarGroup className="tiptap-toolbar-group">
        <UndoRedoButton action="undo" editor={editor} />
        <UndoRedoButton action="redo" editor={editor} />
        
      </ToolbarGroup>

      <ToolbarSeparator className="tiptap-toolbar-separator" />

      <ToolbarGroup className="tiptap-toolbar-group">
        <HeadingDropdownMenu
          editor={editor}
          levels={[1, 2, 3, 4, 5, 6]}
          hideWhenUnavailable={false}
          portal={isMobile}
          onOpenChange={(isOpen) => {
            console.log('Heading dropdown', isOpen ? 'opened' : 'closed');
            console.log('Editor state when dropdown opened:', {
              isFocused: editor?.isFocused,
              isEditable: editor?.isEditable,
              selection: editor?.state.selection,
            });
          }}
        />
        <ListDropdownMenu
          types={['bulletList', 'orderedList', 'taskList']}
          portal={isMobile}
          editor={editor || undefined}
          hideWhenUnavailable={true}
          onOpenChange={(isOpen) => console.log('List dropdown', isOpen ? 'opened' : 'closed')}
        />
        <BlockquoteButton 
          editor={editor}
          hideWhenUnavailable={true}
        />
        <CodeBlockButton 
          editor={editor}
          hideWhenUnavailable={true}
        />
      </ToolbarGroup>

      <ToolbarSeparator className="tiptap-toolbar-separator" />

      <ToolbarGroup className="tiptap-toolbar-group">
        <MarkButton type="bold" editor={editor} />
        <MarkButton type="italic" editor={editor} />
        <MarkButton type="strike" editor={editor} />
        <MarkButton type="code" editor={editor} />
        <MarkButton type="underline" editor={editor} />
        {!isMobile ? (
          <ColorHighlightPopover editor={editor} />
        ) : (
          <ColorHighlightPopoverButton onClick={onHighlighterClick} />
        )}
        {!isMobile ? <LinkPopover editor={editor} /> : <LinkButton onClick={onLinkClick} />}
      </ToolbarGroup>

      <ToolbarSeparator className="tiptap-toolbar-separator" />

      <ToolbarGroup className="tiptap-toolbar-group">
        <MarkButton type="superscript" editor={editor} />
        <MarkButton type="subscript" editor={editor} />
      </ToolbarGroup>

      <ToolbarSeparator className="tiptap-toolbar-separator" />

      <ToolbarGroup className="tiptap-toolbar-group">
        <TextAlignButton align="left" editor={editor} />
        <TextAlignButton align="center" editor={editor} />
        <TextAlignButton align="right" editor={editor} />
        <TextAlignButton align="justify" editor={editor} />
      </ToolbarGroup>

      <Spacer />
    </div>
  );
};

const MobileToolbarContent = ({
  type,
  onBack,
}: {
  type: 'highlighter' | 'link';
  onBack: () => void;
}) => (
  <div className="flex items-center w-full overflow-x-auto">
    <ToolbarGroup className="tiptap-toolbar-group">
      <Button data-style="ghost" onClick={onBack}>
        <ArrowLeftIcon className="tiptap-button-icon" />
        {type === 'highlighter' ? (
          <HighlighterIcon className="tiptap-button-icon" />
        ) : (
          <LinkIcon className="tiptap-button-icon" />
        )}
      </Button>
    </ToolbarGroup>

    <ToolbarSeparator className="tiptap-toolbar-separator" />

    {type === 'highlighter' ? (
      <ColorHighlightPopoverContent />
    ) : (
      <LinkContent />
    )}
  </div>
);

export const PolicySimpleEditor: React.FC<PolicySimpleEditorProps> = ({
  content,
  onChange,
  placeholder = 'Start writing...',
  className,
  editable = true,
  stickyToolbar = false,
}) => {
  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = React.useState<'main' | 'highlighter' | 'link'>('main');

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editable,
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        autocomplete: 'off',
        autocorrect: 'off',
        autocapitalize: 'off',
        'aria-label': placeholder,
        class: 'simple-editor min-h-[400px] p-4 w-full max-w-full',
      },
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
        blockquote: {},
      }),
      HorizontalRule,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Image,
      Typography,
      Superscript,
      Subscript,
      ImageUploadNode.configure({
        accept: 'image/*',
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: handleImageUpload,
        onError: (error) => console.error('Upload failed:', error),
      }),
    ],
  });

  // Update content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Debug editor capabilities
  useEffect(() => {
    if (editor) {
      console.log('Editor initialized with extensions:', editor.extensionManager.extensions.map(ext => ext.name));
      console.log('Editor commands available:', Object.keys(editor.commands));
      
      // Test heading capabilities
      for (let level = 1; level <= 6; level++) {
        console.log(`Can toggle H${level}:`, editor.can().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }));
      }
      
      // Test list capabilities
      console.log('Can toggle bullet list:', editor.can().toggleBulletList());
      console.log('Can toggle ordered list:', editor.can().toggleOrderedList());
      console.log('Can toggle task list:', editor.can().toggleTaskList());
      
      // Test blockquote capability
      console.log('Can toggle blockquote:', editor.can().toggleBlockquote());
      
      // Test if heading extension is loaded
      const headingExt = editor.extensionManager.extensions.find(ext => ext.name === 'heading');
      console.log('Heading extension loaded:', !!headingExt);
      if (headingExt) {
        console.log('Heading extension options:', headingExt.options);
      }
    }
  }, [editor]);

  useEffect(() => {
    if (!isMobile && mobileView !== 'main') {
      setMobileView('main');
    }
  }, [isMobile, mobileView]);

  // Inject custom styles
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = editorStyles;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

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

  return (
    <div className={`policy-simple-editor simple-editor-wrapper h-full w-full flex flex-col overflow-hidden ${stickyToolbar ? 'sticky-toolbar' : ''} ${className || ''}`}>
      <EditorContext.Provider value={{ editor }}>
        {editable && (
          <Toolbar className={`tiptap-toolbar flex-shrink-0 w-full max-w-full overflow-x-auto ${stickyToolbar ? 'sticky top-0 z-10' : ''}`}>
            {mobileView === 'main' ? (
              <MainToolbarContent
                onHighlighterClick={() => setMobileView('highlighter')}
                onLinkClick={() => setMobileView('link')}
                isMobile={isMobile}
                editor={editor}
              />
            ) : (
              <MobileToolbarContent
                type={mobileView === 'highlighter' ? 'highlighter' : 'link'}
                onBack={() => setMobileView('main')}
              />
            )}
          </Toolbar>
        )}

        <EditorContent
          editor={editor}
          role="presentation"
          className="simple-editor-content flex-1 overflow-auto w-full m-0!"
        />
      </EditorContext.Provider>
    </div>
  );
};

export default PolicySimpleEditor;
