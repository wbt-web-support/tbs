"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Focus from '@tiptap/extension-focus';
import Gapcursor from '@tiptap/extension-gapcursor';
import Dropcursor from '@tiptap/extension-dropcursor';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Youtube from '@tiptap/extension-youtube';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { DOMSerializer } from '@tiptap/pm/model';

import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  Strikethrough, 
  List, 
  ListOrdered, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Link as LinkIcon,
  Quote,
  Code,
  Undo,
  Redo,
  Table as TableIcon,
  Image as ImageIcon,
  Highlighter,
  Minus,
  Check,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Youtube as YoutubeIcon,
  Heading1,
  Heading2,
  Heading3,
  Code2,
  Palette,
  ChevronDown,
  Loader2,
  CheckCircle2,
  Plus,
  X,
  Sparkles,
  FileText,
  Download,
  History,
  RotateCcw,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCallback, useState, useEffect, useRef } from 'react';
import AIDropdown from '@/components/ui/ai-dropdown';

const lowlight = createLowlight(common);

export interface ReusableTiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  className?: string;
  placeholder?: string;
  showToolbar?: boolean;
  showBubbleMenu?: boolean;
  showSlashCommands?: boolean;
  showStatusBar?: boolean;
  editorHeight?: string;
  autoSave?: boolean;
  autoSaveDelay?: number;
  onSave?: (content: string) => Promise<void>;
  isReadOnly?: boolean;
  editorClassName?: string;
  showExportButton?: boolean;
  showToolbarAI?: boolean;
  compactToolbar?: boolean;
  // History feature props
  enableHistory?: boolean;
  historyId?: string;
  onSaveHistory?: (content: string, historyId: string) => Promise<void>;
  onLoadHistory?: (historyId: string) => Promise<string[]>;
  onRestoreHistory?: (content: string, historyId: string) => Promise<void>;
  showHistoryButton?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

export default function ReusableTiptapEditor({ 
  content, 
  onChange, 
  className,
  placeholder = "Start writing... Type '/' for commands",
  showToolbar = true,
  showBubbleMenu = true,
  showSlashCommands = true,
  showStatusBar = true,
  editorHeight = "calc(100vh-140px)",
  autoSave = true,
  autoSaveDelay = 1000,
  onSave,
  isReadOnly = false,
  editorClassName,
  showExportButton = true,
  showToolbarAI = true,
  compactToolbar = false,
  // History feature props
  enableHistory = false,
  historyId,
  onSaveHistory,
  onLoadHistory,
  onRestoreHistory,
  showHistoryButton = true,
  onFocus,
  onBlur
}: ReusableTiptapEditorProps) {
  // Compact toolbar sizing
  const btnSize = compactToolbar ? "h-7 w-7 p-0" : "h-9 w-9 p-0";
  const iconSize = compactToolbar ? "h-3.5 w-3.5" : "h-4 w-4";
  const sepHeight = compactToolbar ? "h-5" : "h-6";

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const insertMenuRef = useRef<HTMLDivElement>(null);
  const [showFloatingMenu, setShowFloatingMenu] = useState(false);
  const [floatingMenuPosition, setFloatingMenuPosition] = useState({ x: 0, y: 0 });
  const floatingMenuRef = useRef<HTMLDivElement>(null);
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [bubbleMenuMode, setBubbleMenuMode] = useState<'main' | 'link' | 'image' | 'ai'>('main');
  const [floatingInputPosition, setFloatingInputPosition] = useState({ x: 0, y: 0 });
  const [showFloatingInput, setShowFloatingInput] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [historyList, setHistoryList] = useState<Array<{content: string, timestamp: string}>>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [savingHistory, setSavingHistory] = useState(false);
  const historyTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Menu commands for keyboard navigation
  const menuCommands = [
    {
      icon: Heading1,
      title: "Heading 1",
      action: () => {
        editor?.chain().focus().deleteRange({
          from: editor.state.selection.$anchor.pos - editor.state.selection.$anchor.parentOffset,
          to: editor.state.selection.to
        }).toggleHeading({ level: 1 }).run();
      }
    },
    {
      icon: Heading2,
      title: "Heading 2", 
      action: () => {
        editor?.chain().focus().deleteRange({
          from: editor.state.selection.$anchor.pos - editor.state.selection.$anchor.parentOffset,
          to: editor.state.selection.to
        }).toggleHeading({ level: 2 }).run();
      }
    },
    {
      icon: List,
      title: "Bullet List",
      action: () => {
        editor?.chain().focus().deleteRange({
          from: editor.state.selection.$anchor.pos - editor.state.selection.$anchor.parentOffset,
          to: editor.state.selection.to
        }).toggleBulletList().run();
      }
    },
    {
      icon: ListOrdered,
      title: "Numbered List",
      action: () => {
        editor?.chain().focus().deleteRange({
          from: editor.state.selection.$anchor.pos - editor.state.selection.$anchor.parentOffset,
          to: editor.state.selection.to
        }).toggleOrderedList().run();
      }
    },
    {
      icon: Check,
      title: "Task List", 
      action: () => {
        editor?.chain().focus().deleteRange({
          from: editor.state.selection.$anchor.pos - editor.state.selection.$anchor.parentOffset,
          to: editor.state.selection.to
        }).toggleTaskList().run();
      }
    },
    {
      icon: Code2,
      title: "Code Block",
      action: () => {
        editor?.chain().focus().deleteRange({
          from: editor.state.selection.$anchor.pos - editor.state.selection.$anchor.parentOffset,
          to: editor.state.selection.to
        }).toggleCodeBlock().run();
      }
    },
    {
      icon: Quote,
      title: "Blockquote",
      action: () => {
        editor?.chain().focus().deleteRange({
          from: editor.state.selection.$anchor.pos - editor.state.selection.$anchor.parentOffset,
          to: editor.state.selection.to
        }).toggleBlockquote().run();
      }
    },
    {
      icon: TableIcon,
      title: "Table",
      action: () => {
        editor?.chain().focus().deleteRange({
          from: editor.state.selection.$anchor.pos - editor.state.selection.$anchor.parentOffset,
          to: editor.state.selection.to
        }).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      }
    },
    {
      icon: ImageIcon,
      title: "Image",
      action: () => {
        editor?.chain().focus().deleteRange({
          from: editor.state.selection.$anchor.pos - editor.state.selection.$anchor.parentOffset,
          to: editor.state.selection.to
        }).run();
        setBubbleMenuMode('image');
        setImageUrl('');
      }
    }
  ];

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline cursor-pointer hover:text-blue-800',
        },
      }),
      Underline,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto',
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'not-prose bg-gray-900 text-gray-100 p-4 rounded-lg my-4 overflow-x-auto',
        },
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Typography,
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') {
            return "What's the title?";
          }
          return placeholder;
        },
      }),
      CharacterCount,
      Focus.configure({
        className: 'has-focus',
        mode: 'all',
      }),
      Gapcursor,
      Dropcursor,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Subscript,
      Superscript,
      Youtube.configure({
        controls: false,
        nocookie: true,
        width: 640,
        height: 480,
      }),
      HorizontalRule,
    ],
    content,
    editable: !isReadOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      
      if (autoSave && onSave) {
        // Auto-save logic
        setSavingStatus('saving');
        
        // Clear existing timeout
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        
        // Debounce save
        saveTimeoutRef.current = setTimeout(async () => {
          try {
            await onSave(html);
            setSavingStatus('saved');
            
            // Reset to idle after 2 seconds
            setTimeout(() => {
              setSavingStatus('idle');
            }, 2000);
          } catch (error) {
            console.error('Auto-save failed:', error);
            setSavingStatus('idle');
          }
        }, autoSaveDelay);
      }
      
      // History saving logic
      if (enableHistory && onSaveHistory && historyId) {
        // Clear existing history timeout
        if (historyTimeoutRef.current) {
          clearTimeout(historyTimeoutRef.current);
        }
        
        // Debounce history save (longer delay than auto-save)
        historyTimeoutRef.current = setTimeout(async () => {
          try {
            setSavingHistory(true);
            await onSaveHistory(html, historyId);
          } catch (error) {
            console.error('History save failed:', error);
          } finally {
            setSavingHistory(false);
          }
        }, (autoSaveDelay || 1000) + 2000); // Save history 2 seconds after content save
      }
      
      // Always call onChange for immediate updates
      onChange(html);
    },
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-lg prose-slate max-w-none focus:outline-none min-h-[400px] px-8 py-12',
          editorClassName
        ),
      },
    },
  });

  // Update editor content when the prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  // Focus/blur callbacks for parent (e.g. AI assistant focus tracking)
  useEffect(() => {
    if (!editor || (!onFocus && !onBlur)) return;
    const focusHandler = () => onFocus?.();
    const blurHandler = () => onBlur?.();
    editor.on('focus', focusHandler);
    editor.on('blur', blurHandler);
    return () => {
      editor.off('focus', focusHandler);
      editor.off('blur', blurHandler);
    };
  }, [editor, onFocus, onBlur]);

  // DOCX Export Function
  const handleExportDocx = useCallback(async () => {
    if (!editor || exportingDocx) return;

    setExportingDocx(true);
    
    try {
      const htmlContent = editor.getHTML();
      
      // Generate a filename based on the first heading or use a default
      let filename = 'document';
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          filename = node.textContent.slice(0, 50).replace(/[^a-zA-Z0-9]/g, '_');
          return true;
        }
        return false;
      });

      const response = await fetch('/api/editor/export-docx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: htmlContent,
          filename: filename,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to export DOCX');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}_${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('DOCX export failed:', error);
      alert('Failed to export DOCX. Please try again.');
    } finally {
      setExportingDocx(false);
    }
  }, [editor, exportingDocx]);

  const addImage = useCallback(() => {
    if (editor) {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        setBubbleMenuMode('image');
      } else {
        const coords = editor.view.coordsAtPos(from);
        const editorRect = editor.view.dom.getBoundingClientRect();
        const containerRect = editor.view.dom.closest('.max-w-5xl')?.getBoundingClientRect() || editorRect;
        
        setFloatingInputPosition({
          x: coords.left - containerRect.left + 20,
          y: coords.top - containerRect.top + 25
        });
        setBubbleMenuMode('image');
        setShowFloatingInput(true);
      }
      setImageUrl('');
    }
  }, [editor]);

  const handleImageSubmit = useCallback(() => {
    if (imageUrl && editor) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
      setBubbleMenuMode('main');
      setShowFloatingInput(false);
      setImageUrl('');
    }
  }, [imageUrl, editor]);

  const handleCancelImage = useCallback(() => {
    setBubbleMenuMode('main');
    setShowFloatingInput(false);
    setImageUrl('');
  }, []);

  const addYoutube = useCallback(() => {
    const url = window.prompt('Enter YouTube URL:');
    if (url && editor) {
      editor.commands.setYoutubeVideo({
        src: url,
        width: 640,
        height: 480,
      });
    }
  }, [editor]);

  const addLink = useCallback(() => {
    if (editor) {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        setBubbleMenuMode('link');
      } else {
        const coords = editor.view.coordsAtPos(from);
        const editorRect = editor.view.dom.getBoundingClientRect();
        const containerRect = editor.view.dom.closest('.max-w-5xl')?.getBoundingClientRect() || editorRect;
        
        setFloatingInputPosition({
          x: coords.left - containerRect.left + 20,
          y: coords.top - containerRect.top + 25
        });
        setBubbleMenuMode('link');
        setShowFloatingInput(true);
      }
      setLinkUrl('');
    }
  }, [editor]);

  const handleLinkSubmit = useCallback(() => {
    if (linkUrl && editor) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
      setBubbleMenuMode('main');
      setShowFloatingInput(false);
      setLinkUrl('');
    }
  }, [linkUrl, editor]);

  const handleCancelLink = useCallback(() => {
    setBubbleMenuMode('main');
    setShowFloatingInput(false);
    setLinkUrl('');
  }, []);

  const addTable = useCallback(() => {
    if (editor) {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    }
  }, [editor]);

  const setColor = useCallback((color: string) => {
    if (editor) {
      editor.chain().focus().setColor(color).run();
      setShowColorPicker(false);
    }
  }, [editor]);

  // Helper: get HTML from a document slice (for selected content)
  const getSelectedHTML = useCallback(() => {
    if (!editor) return '';
    const { from, to } = editor.state.selection;
    if (from === to) return '';
    const slice = editor.state.doc.slice(from, to);
    const tempDiv = document.createElement('div');
    const fragment = slice.content;
    const serializer = DOMSerializer.fromSchema(editor.schema);
    const dom = serializer.serializeFragment(fragment);
    tempDiv.appendChild(dom);
    return tempDiv.innerHTML;
  }, [editor]);

  // AI Enhancement Functions
  const handleAIAction = useCallback(async (action: 'simplify' | 'grammar' | 'shorter' | 'longer' | 'format', selectedOnly = false) => {
    if (!editor || aiLoading) return;

    setAiLoading(true);

    // Disable editing while AI is processing
    editor.setEditable(false);

    try {
      let contentToEnhance = '';
      let selectedHtml = '';
      let fullContext = '';

      if (selectedOnly) {
        const { from, to } = editor.state.selection;
        if (from === to) return;

        // Get selected content as HTML to preserve formatting
        selectedHtml = getSelectedHTML();
        contentToEnhance = selectedHtml;
        fullContext = editor.getHTML();
      } else {
        contentToEnhance = editor.getHTML();
      }

      const response = await fetch('/api/editor/ai-enhance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: contentToEnhance,
          action: action,
          selectedText: selectedOnly ? selectedHtml : null,
          context: selectedOnly ? fullContext : null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to enhance content');
      }

      const data = await response.json();

      if (selectedOnly) {
        // Replace selected text with HTML content
        const { from, to } = editor.state.selection;
        editor.chain()
          .focus()
          .deleteRange({ from, to })
          .insertContent(data.enhancedContent)
          .run();

        setTimeout(() => {
          if (onChange) {
            onChange(editor.getHTML());
          }
        }, 100);
      } else {
        // Replace entire content
        editor.commands.setContent(data.enhancedContent);

        if (onChange) {
          onChange(data.enhancedContent);
        }
      }

    } catch (error) {
      console.error('AI enhancement failed:', error);
      alert(`AI enhancement failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setAiLoading(false);

      // Re-enable editing after AI processing
      if (editor && !isReadOnly) {
        editor.setEditable(true);
      }
    }
  }, [editor, aiLoading, getSelectedHTML, onChange, isReadOnly]);

  // History Functions
  const handleLoadHistory = useCallback(async () => {
    if (!enableHistory || !onLoadHistory || !historyId) return;
    
    try {
      setLoadingHistory(true);
      const history = await onLoadHistory(historyId);
      const formattedHistory = history.map((item) => {
        // Try to parse JSON with created_at, fallback to raw content
        try {
          const parsed = JSON.parse(item);
          return {
            content: parsed.content,
            timestamp: new Date(parsed.created_at).toLocaleString()
          };
        } catch {
          return { content: item, timestamp: '' };
        }
      });
      setHistoryList(formattedHistory);
      setShowHistoryPanel(true);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoadingHistory(false);
    }
  }, [enableHistory, onLoadHistory, historyId]);

  const handleRestoreHistory = useCallback(async (content: string) => {
    if (!enableHistory || !onRestoreHistory || !historyId || !editor) return;

    try {
      // Save the current (latest) content to history first so user can revert back
      if (onSaveHistory) {
        const currentHtml = editor.getHTML();
        if (currentHtml?.trim() && currentHtml !== content) {
          // Cancel any pending debounced history save
          if (historyTimeoutRef.current) {
            clearTimeout(historyTimeoutRef.current);
            historyTimeoutRef.current = undefined;
          }
          await onSaveHistory(currentHtml, historyId);
        }
      }

      await onRestoreHistory(content, historyId);
      editor.commands.setContent(content);
      onChange(content);
      setShowHistoryPanel(false);
    } catch (error) {
      console.error('Failed to restore history:', error);
    }
  }, [enableHistory, onRestoreHistory, onSaveHistory, historyId, editor, onChange]);

  const handleToolbarAI = useCallback(async (action: 'simplify' | 'grammar' | 'shorter' | 'longer' | 'format') => {
    await handleAIAction(action, false);
  }, [handleAIAction]);

  const handleBubbleAI = useCallback(async (action: 'simplify' | 'grammar' | 'shorter' | 'longer' | 'format') => {
    await handleAIAction(action, true);
    setBubbleMenuMode('main'); // Return to main menu after AI action
  }, [handleAIAction]);

  const handleBubbleAIClick = useCallback(() => {
    setBubbleMenuMode('ai');
  }, []);

  const handleBubbleAICancel = useCallback(() => {
    setBubbleMenuMode('main');
  }, []);

  // Handle slash commands (floating menu when typing "/")
  useEffect(() => {
    if (!editor || !showSlashCommands) return;

    const updateFloatingMenu = () => {
      const { state, view } = editor;
      const { selection } = state;
      const { $anchor } = selection;

      if (selection.from !== selection.to) {
        setShowFloatingMenu(false);
        return;
      }

      const currentNode = $anchor.parent;
      const nodeText = currentNode.textContent;
      
      const isValidSlashCommand = currentNode.type.name === 'paragraph' && 
          nodeText === '/' &&
          selection.from === selection.to &&
          $anchor.parentOffset === nodeText.length;
      
      if (isValidSlashCommand) {
        const coords = view.coordsAtPos(selection.from);
        const editorRect = view.dom.getBoundingClientRect();
        const containerRect = view.dom.closest('.max-w-5xl')?.getBoundingClientRect() || editorRect;
        
        setFloatingMenuPosition({ 
          x: coords.left - containerRect.left + 20, 
          y: coords.top - containerRect.top + 25 
        });
        setShowFloatingMenu(true);
        setSelectedMenuIndex(0);
      } else {
        setShowFloatingMenu(false);
      }
    };

    editor.on('selectionUpdate', updateFloatingMenu);
    editor.on('transaction', updateFloatingMenu);

    return () => {
      editor.off('selectionUpdate', updateFloatingMenu);
      editor.off('transaction', updateFloatingMenu);
    };
  }, [editor, showSlashCommands]);

  // Handle keyboard navigation for slash commands
  useEffect(() => {
    if (!showFloatingMenu || !editor || !showSlashCommands) return;

    const editorElement = editor.view.dom;
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!showFloatingMenu) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          setSelectedMenuIndex(prev => 
            prev < menuCommands.length - 1 ? prev + 1 : 0
          );
          return false;
        case 'ArrowUp':
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          setSelectedMenuIndex(prev => 
            prev > 0 ? prev - 1 : menuCommands.length - 1
          );
          return false;
        case 'Enter':
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          
          setTimeout(() => {
            menuCommands[selectedMenuIndex].action();
            setShowFloatingMenu(false);
          }, 0);
          return false;
        case 'Escape':
          event.preventDefault();
          event.stopPropagation();
          setShowFloatingMenu(false);
          return false;
      }
    };

    editorElement.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      editorElement.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [showFloatingMenu, selectedMenuIndex, editor, menuCommands, showSlashCommands]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (floatingMenuRef.current && !floatingMenuRef.current.contains(event.target as Node)) {
        setShowFloatingMenu(false);
      }
      if (showFloatingInput && !(event.target as Element).closest('.absolute.z-50')) {
        setShowFloatingInput(false);
        setBubbleMenuMode('main');
      }
      
      // Close insert menu when clicking outside
      if (showInsertMenu && insertMenuRef.current && !insertMenuRef.current.contains(event.target as Node)) {
        setShowInsertMenu(false);
      }

      // Reset bubble menu mode when clicking outside bubble menu
      if (bubbleMenuMode !== 'main' && !(event.target as Element).closest('[data-bubble-menu]')) {
        setBubbleMenuMode('main');
      }
    };

    if (showFloatingMenu || showFloatingInput || bubbleMenuMode !== 'main' || showInsertMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFloatingMenu, showFloatingInput, bubbleMenuMode, showInsertMenu]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current);
      }
    };
  }, []);

  if (!editor) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-gray-500">Loading editor...</div>
      </div>
    );
  }

  return (
    <div className={cn("w-full flex flex-col bg-white", className)} style={{ height: editorHeight }}>
      {/* Fixed Toolbar */}
      {showToolbar && (
        <div className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <div className={cn("px-3", compactToolbar ? "py-1" : "py-2")}>
            <div className="flex justify-between items-center absolute bottom-2 right-2">
              <div className="flex items-center gap-2">
                {autoSave && savingStatus === 'saving' && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </div>
                )}
                {autoSave && savingStatus === 'saved' && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Saved</span>
                  </div>
                )}
              </div>
            </div>
            <div className={cn("flex flex-wrap items-center", compactToolbar ? "gap-0.5" : "gap-2")}>
              {/* Headings */}
              <div className="flex items-center gap-1">
                <select
                  onChange={(e) => {
                    const level = parseInt(e.target.value);
                    if (level === 0) {
                      editor?.chain().focus().setParagraph().run();
                    } else {
                      editor?.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
                    }
                  }}
                  value={
                    editor?.isActive('heading', { level: 1 }) ? 1 :
                    editor?.isActive('heading', { level: 2 }) ? 2 :
                    editor?.isActive('heading', { level: 3 }) ? 3 :
                    editor?.isActive('heading', { level: 4 }) ? 4 :
                    editor?.isActive('heading', { level: 5 }) ? 5 :
                    editor?.isActive('heading', { level: 6 }) ? 6 : 0
                  }
                  disabled={aiLoading}
                  className={cn(
                    "px-2 pr-7 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                    compactToolbar ? "h-7 text-xs" : "h-9",
                    aiLoading && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <option value={0}>Paragraph</option>
                  <option value={1}>Heading 1</option>
                  <option value={2}>Heading 2</option>
                  <option value={3}>Heading 3</option>
                  <option value={4}>Heading 4</option>
                  <option value={5}>Heading 5</option>
                  <option value={6}>Heading 6</option>
                </select>
              </div>

              <div className={cn("w-px bg-gray-300", sepHeight)} />

              {/* Text Formatting */}
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  className={cn(btnSize, editor?.isActive('bold') && "bg-blue-100 text-blue-700")}
                  title="Bold (Ctrl+B)"
                >
                  <Bold className={iconSize} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  className={cn(btnSize, editor?.isActive('italic') && "bg-blue-100 text-blue-700")}
                  title="Italic (Ctrl+I)"
                >
                  <Italic className={iconSize} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleUnderline().run()}
                  className={cn(btnSize, editor?.isActive('underline') && "bg-blue-100 text-blue-700")}
                  title="Underline (Ctrl+U)"
                >
                  <UnderlineIcon className={iconSize} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleStrike().run()}
                  className={cn(btnSize, editor?.isActive('strike') && "bg-blue-100 text-blue-700")}
                  title="Strikethrough"
                >
                  <Strikethrough className={iconSize} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleHighlight().run()}
                  className={cn(btnSize, editor?.isActive('highlight') && "bg-yellow-100 text-yellow-700")}
                  title="Highlight"
                >
                  <Highlighter className={iconSize} />
                </Button>
              </div>

              <div className={cn("w-px bg-gray-300", sepHeight)} />

              {/* Text Alignment */}
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().setTextAlign('left').run()}
                  className={cn(btnSize, editor?.isActive({ textAlign: 'left' }) && "bg-blue-100 text-blue-700")}
                  title="Align Left"
                >
                  <AlignLeft className={iconSize} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().setTextAlign('center').run()}
                  className={cn(btnSize, editor?.isActive({ textAlign: 'center' }) && "bg-blue-100 text-blue-700")}
                  title="Align Center"
                >
                  <AlignCenter className={iconSize} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().setTextAlign('right').run()}
                  className={cn(btnSize, editor?.isActive({ textAlign: 'right' }) && "bg-blue-100 text-blue-700")}
                  title="Align Right"
                >
                  <AlignRight className={iconSize} />
                </Button>
              </div>

              <div className={cn("w-px bg-gray-300", sepHeight)} />

              {/* Lists */}
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  className={cn(btnSize, editor?.isActive('bulletList') && "bg-blue-100 text-blue-700")}
                  title="Bullet List"
                >
                  <List className={iconSize} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                  className={cn(btnSize, editor?.isActive('orderedList') && "bg-blue-100 text-blue-700")}
                  title="Numbered List"
                >
                  <ListOrdered className={iconSize} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleTaskList().run()}
                  className={cn(btnSize, editor?.isActive('taskList') && "bg-blue-100 text-blue-700")}
                  title="Task List"
                >
                  <Check className={iconSize} />
                </Button>
              </div>

              <div className={cn("w-px bg-gray-300", sepHeight)} />

              {/* Link */}
              <Button
                variant="ghost"
                size="sm"
                onClick={addLink}
                className={cn(btnSize, editor.isActive('link') && "bg-blue-100 text-blue-700")}
                title="Add Link"
              >
                <LinkIcon className={iconSize} />
              </Button>

              <div className={cn("w-px bg-gray-300", sepHeight)} />

              {/* Insert Dropdown */}
              <div className="relative" ref={insertMenuRef}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInsertMenu(!showInsertMenu)}
                  className={cn(compactToolbar ? "h-7 px-1.5 gap-0.5" : "h-9 px-2 gap-1")}
                  title="Insert"
                >
                  <Plus className={iconSize} />
                  <span className="text-xs">Insert</span>
                  <ChevronDown className={compactToolbar ? "h-2.5 w-2.5" : "h-3 w-3"} />
                </Button>
                {showInsertMenu && (
                  <div className="absolute top-10 left-0 bg-white border border-gray-200 rounded-lg shadow-xl p-1.5 z-50 min-w-[200px]">
                    <button
                      onClick={() => { addImage(); setShowInsertMenu(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center gap-2.5"
                    >
                      <ImageIcon className="h-4 w-4 text-gray-500" />
                      Image
                    </button>
                    <button
                      onClick={() => { addTable(); setShowInsertMenu(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center gap-2.5"
                    >
                      <TableIcon className="h-4 w-4 text-gray-500" />
                      Table
                    </button>
                    <button
                      onClick={() => { addYoutube(); setShowInsertMenu(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center gap-2.5"
                    >
                      <YoutubeIcon className="h-4 w-4 text-gray-500" />
                      YouTube Video
                    </button>
                    <hr className="my-1 border-gray-100" />
                    <button
                      onClick={() => { editor?.chain().focus().toggleBlockquote().run(); setShowInsertMenu(false); }}
                      className={cn("w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center gap-2.5", editor?.isActive('blockquote') && "bg-blue-50 text-blue-700")}
                    >
                      <Quote className="h-4 w-4 text-gray-500" />
                      Blockquote
                    </button>
                    <button
                      onClick={() => { editor?.chain().focus().toggleCodeBlock().run(); setShowInsertMenu(false); }}
                      className={cn("w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center gap-2.5", editor?.isActive('codeBlock') && "bg-blue-50 text-blue-700")}
                    >
                      <Code2 className="h-4 w-4 text-gray-500" />
                      Code Block
                    </button>
                    <button
                      onClick={() => { editor?.chain().focus().setHorizontalRule().run(); setShowInsertMenu(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center gap-2.5"
                    >
                      <Minus className="h-4 w-4 text-gray-500" />
                      Horizontal Line
                    </button>
                    {editor?.isActive('table') && (
                      <>
                        <hr className="my-1 border-gray-100" />
                        <div className="px-3 py-1 text-xs font-medium text-gray-400 uppercase tracking-wide">Table</div>
                        <button
                          onClick={() => { editor?.chain().focus().addRowAfter().run(); setShowInsertMenu(false); }}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 rounded flex items-center gap-2.5"
                        >
                          <Plus className="h-3.5 w-3.5 text-gray-400" />
                          Add Row
                        </button>
                        <button
                          onClick={() => { editor?.chain().focus().addColumnAfter().run(); setShowInsertMenu(false); }}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 rounded flex items-center gap-2.5"
                        >
                          <Plus className="h-3.5 w-3.5 text-gray-400" />
                          Add Column
                        </button>
                        <button
                          onClick={() => { editor?.chain().focus().deleteRow().run(); setShowInsertMenu(false); }}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-red-50 text-red-600 rounded flex items-center gap-2.5"
                        >
                          <Minus className="h-3.5 w-3.5" />
                          Delete Row
                        </button>
                        <button
                          onClick={() => { editor?.chain().focus().deleteColumn().run(); setShowInsertMenu(false); }}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-red-50 text-red-600 rounded flex items-center gap-2.5"
                        >
                          <Minus className="h-3.5 w-3.5" />
                          Delete Column
                        </button>
                        <button
                          onClick={() => { editor?.chain().focus().deleteTable().run(); setShowInsertMenu(false); }}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-red-50 text-red-600 rounded flex items-center gap-2.5"
                        >
                          <Minus className="h-3.5 w-3.5" />
                          Delete Table
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Text Colors */}
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className={btnSize}
                  title="Text Color"
                >
                  <Palette className={iconSize} />
                </Button>
                {showColorPicker && (
                  <div className="absolute top-10 left-0 bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-50 min-w-[280px]">
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Text Colors</h4>
                      <div className="grid grid-cols-8 gap-2">
                        {[
                          '#000000', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#F3F4F6', '#FFFFFF', '#EF4444',
                          '#F97316', '#EAB308', '#84CC16', '#22C55E', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6',
                          '#A855F7', '#EC4899', '#F43F5E', '#DC2626', '#EA580C', '#CA8A04', '#65A30D', '#16A34A',
                          '#0891B2', '#2563EB', '#4F46E5', '#7C3AED', '#9333EA', '#DB2777', '#E11D48', '#B91C1C'
                        ].map((color) => (
                          <button
                            key={color}
                            className="w-8 h-8 rounded-lg border-2 border-gray-200 hover:border-gray-400 hover:scale-110 transition-all duration-200 shadow-sm"
                            style={{ backgroundColor: color }}
                            onClick={() => setColor(color)}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        editor?.chain().focus().unsetColor().run();
                        setShowColorPicker(false);
                      }}
                      className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      Remove Color
                    </button>
                  </div>
                )}
              </div>

              <div className={cn("w-px bg-gray-300", sepHeight)} />

              {/* AI Enhancement */}
              {showToolbarAI && (
                <>
                  <div className="flex items-center gap-1">
                    <AIDropdown
                      onAction={handleToolbarAI}
                      isLoading={aiLoading}
                      variant="toolbar"
                    />
                  </div>
                  <div className={cn("w-px bg-gray-300", sepHeight)} />
                </>
              )}

              {/* History */}
              {enableHistory && showHistoryButton && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLoadHistory}
                    disabled={loadingHistory || aiLoading}
                    className={compactToolbar ? "h-7 px-1.5" : "h-9 px-3"}
                    title="View History"
                  >
                    {loadingHistory ? (
                      <Loader2 className={cn(iconSize, "animate-spin")} />
                    ) : (
                      <History className={iconSize} />
                    )}
                    <span className="ml-1 text-xs">History</span>
                  </Button>
                </div>
              )}

              {/* Export */}
              {showExportButton && (
                <>
                  <div className={cn("w-px bg-gray-300", sepHeight)} />
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleExportDocx}
                      disabled={exportingDocx || aiLoading}
                      className={compactToolbar ? "h-7 px-1.5" : "h-9 px-3"}
                      title="Export as DOCX"
                    >
                      {exportingDocx ? (
                        <Loader2 className={cn(iconSize, "animate-spin")} />
                      ) : (
                        <Download className={iconSize} />
                      )}
                      <span className="ml-1 text-xs">DOCX</span>
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Editor Container */}
      <div className="flex-1 overflow-y-auto bg-white relative">
        <div className="max-w-5xl mx-auto relative">
          <EditorContent 
            editor={editor} 
            className={cn(
              "focus-within:outline-none transition-opacity duration-200",
              aiLoading && "opacity-60 pointer-events-none"
            )}
            style={{ minHeight: editorHeight }}
          />
          
          {/* AI Processing Overlay */}
          {aiLoading && (
            <div className="fixed inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="px-6 py-4 flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-gray-700">AI is enhancing your content...</span>
              </div>
            </div>
          )}
          
          {/* Slash Commands Menu */}
          {showFloatingMenu && editor && showSlashCommands && !aiLoading && (
            <div
              ref={floatingMenuRef}
              className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-1 min-w-[180px]"
              style={{
                left: `${floatingMenuPosition.x}px`,
                top: `${floatingMenuPosition.y}px`,
              }}
            >
              <div className="space-y-0.5">
                <div className="flex items-center text-xs text-gray-500 px-2 py-1 border-b border-gray-100">
                  <span>Commands</span>
                  <span className="ml-auto text-xs">↑↓ • Enter • Esc</span>
                </div>
                
                {menuCommands.map((command, index) => {
                  const IconComponent = command.icon;
                  const isSelected = index === selectedMenuIndex;
                  
                  return (
                    <button
                      key={index}
                      onClick={() => {
                        command.action();
                        setShowFloatingMenu(false);
                      }}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 transition-colors",
                        isSelected 
                          ? "bg-blue-100 text-blue-900" 
                          : "hover:bg-gray-100"
                      )}
                    >
                      <IconComponent className={cn(
                        "h-4 w-4",
                        isSelected ? "text-blue-600" : "text-gray-600"
                      )} />
                      <span className="font-medium">{command.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bubble Menu for Text Selection */}
        {editor && showBubbleMenu && !aiLoading && (
          <BubbleMenu 
            editor={editor}
            shouldShow={({ state, from, to }) => {
              return from !== to;
            }}
          >
            <div className="bg-white border border-gray-200 rounded-lg shadow-xl p-2" data-bubble-menu>
              {bubbleMenuMode === 'main' && (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={editor?.isActive('bold') ? 'default' : 'ghost'}
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                    className="h-8 w-8 p-0"
                    title="Bold"
                  >
                    <Bold className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={editor?.isActive('italic') ? 'default' : 'ghost'}
                    onClick={() => editor?.chain().focus().toggleItalic().run()}
                    className="h-8 w-8 p-0"
                    title="Italic"
                  >
                    <Italic className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={editor?.isActive('underline') ? 'default' : 'ghost'}
                    onClick={() => editor?.chain().focus().toggleUnderline().run()}
                    className="h-8 w-8 p-0"
                    title="Underline"
                  >
                    <UnderlineIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={editor?.isActive('strike') ? 'default' : 'ghost'}
                    onClick={() => editor?.chain().focus().toggleStrike().run()}
                    className="h-8 w-8 p-0"
                    title="Strikethrough"
                  >
                    <Strikethrough className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={editor?.isActive('highlight') ? 'default' : 'ghost'}
                    onClick={() => editor?.chain().focus().toggleHighlight().run()}
                    className="h-8 w-8 p-0"
                    title="Highlight"
                  >
                    <Highlighter className="h-4 w-4" />
                  </Button>
                  
                  <div className="w-px h-6 bg-gray-300 mx-1" />
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={addLink}
                    className="h-8 w-8 p-0"
                    title="Add Link"
                  >
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={addImage}
                    className="h-8 w-8 p-0"
                    title="Add Image"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => editor?.chain().focus().toggleCode().run()}
                    className={cn("h-8 w-8 p-0", editor?.isActive('code') && "bg-blue-100")}
                    title="Inline Code"
                  >
                    <Code className="h-4 w-4" />
                  </Button>

                  <div className="w-px h-6 bg-gray-300 mx-1" />
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleBubbleAIClick}
                    disabled={aiLoading}
                    className="h-8 w-8 p-0 bg-gradient-to-r from-blue-500 to-blue-800 text-white hover:bg-blue-600 hover:text-white"
                    title="AI Enhancement"
                  >
                    {aiLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}

              {bubbleMenuMode === 'link' && (
                <div className="flex items-center gap-2 min-w-[300px]">
                  <LinkIcon className="h-4 w-4 text-gray-500" />
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="Enter URL..."
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleLinkSubmit();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        handleCancelLink();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={handleLinkSubmit}
                    disabled={!linkUrl.trim()}
                    className="h-7 px-2"
                  >
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelLink}
                    className="h-7 px-2"
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {bubbleMenuMode === 'image' && (
                <div className="flex items-center gap-2 min-w-[300px]">
                  <ImageIcon className="h-4 w-4 text-gray-500" />
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Enter image URL..."
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleImageSubmit();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        handleCancelImage();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={handleImageSubmit}
                    disabled={!imageUrl.trim()}
                    className="h-7 px-2"
                  >
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelImage}
                    className="h-7 px-2"
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {bubbleMenuMode === 'ai' && (
                <div className="flex items-center gap-1 min-w-[320px]">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleBubbleAI('simplify')}
                    disabled={aiLoading}
                    className="h-8 px-2 flex items-center gap-1"
                    title="Simplify text"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span className="text-xs">Simplify</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleBubbleAI('grammar')}
                    disabled={aiLoading}
                    className="h-8 px-2 flex items-center gap-1"
                    title="Fix spelling & grammar"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    <span className="text-xs">Grammar</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleBubbleAI('shorter')}
                    disabled={aiLoading}
                    className="h-8 px-2 flex items-center gap-1"
                    title="Make shorter"
                  >
                    <Minus className="h-3 w-3" />
                    <span className="text-xs">Shorter</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleBubbleAI('longer')}
                    disabled={aiLoading}
                    className="h-8 px-2 flex items-center gap-1"
                    title="Make longer"
                  >
                    <Plus className="h-3 w-3" />
                    <span className="text-xs">Longer</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleBubbleAI('format')}
                    disabled={aiLoading}
                    className="h-8 px-2 flex items-center gap-1"
                    title="Format document"
                  >
                    <FileText className="h-3 w-3" />
                    <span className="text-xs">Format</span>
                  </Button>
                  
                  <div className="w-px h-6 bg-gray-300 mx-1" />
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleBubbleAICancel}
                    className="h-8 px-2"
                    title="Back to main menu"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </BubbleMenu>
        )}

        {/* Floating Input for Link/Image without text selection */}
        {showFloatingInput && bubbleMenuMode !== 'main' && bubbleMenuMode !== 'ai' && (
          <div
            className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-2"
            style={{
              left: `${floatingInputPosition.x}px`,
              top: `${floatingInputPosition.y}px`,
            }}
          >
            {bubbleMenuMode === 'link' && (
              <div className="flex items-center gap-2 min-w-[300px]">
                <LinkIcon className="h-4 w-4 text-gray-500" />
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="Enter URL..."
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleLinkSubmit();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      handleCancelLink();
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleLinkSubmit}
                  disabled={!linkUrl.trim()}
                  className="h-7 px-2"
                >
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelLink}
                  className="h-7 px-2"
                >
                  Cancel
                </Button>
              </div>
            )}

            {bubbleMenuMode === 'image' && (
              <div className="flex items-center gap-2 min-w-[300px]">
                <ImageIcon className="h-4 w-4 text-gray-500" />
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Enter image URL..."
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleImageSubmit();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      handleCancelImage();
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleImageSubmit}
                  disabled={!imageUrl.trim()}
                  className="h-7 px-2"
                >
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelImage}
                  className="h-7 px-2"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* History Panel */}
      {showHistoryPanel && enableHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-3/4 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Document History</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistoryPanel(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* History List */}
            <div className="flex-1 overflow-auto p-4">
              {historyList.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No history available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyList.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="h-4 w-4" />
                          <span>{item.timestamp}</span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleRestoreHistory(item.content)}
                          className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Restore
                        </Button>
                      </div>
                      <div 
                        className="text-sm text-gray-700 bg-gray-50 p-3 rounded border max-h-24 overflow-hidden"
                        dangerouslySetInnerHTML={{ 
                          __html: item.content.length > 200 
                            ? item.content.substring(0, 200) + '...' 
                            : item.content 
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 text-center">
                History is automatically saved as you type. Click "Restore" to revert to a previous version.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer Stats */}
      {editor && showStatusBar && (
        <div className="sticky bottom-0 border-t border-gray-200 px-6 py-3 text-sm text-gray-500 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <div className="max-w-5xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-4">
              <span>{editor.storage.characterCount.characters()} characters</span>
              <span>{editor.storage.characterCount.words()} words</span>
            </div>
            <div className="text-gray-400 text-xs">
              Use keyboard shortcuts: <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">Ctrl+B</kbd> Bold, <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">Ctrl+I</kbd> Italic
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 