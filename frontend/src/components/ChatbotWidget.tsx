import React, { useState, useEffect, useRef } from 'react';
import { fetchApi } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { parseExcelOrCsvFile } from '../utils/exportUtils';
import { useOptionalRegistrarData } from '../modules/RegistrarDataContext';
import {
  Send,
  X,
  Trash2,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Download,
  FileSpreadsheet,
  BookOpen,
  Sparkles
} from 'lucide-react';

interface ChatAttachment {
  id: string;
  name: string;
  size: string;
  type: 'image' | 'file';
  url?: string;
  file?: File;
}

interface FileExport {
  filename: string;
  format?: 'word' | 'excel' | 'text' | 'pdf';
  csv_data?: string;
  data?: string;
  label?: string;
}

interface StudentAction {
  student_id: string;
  student_name?: string;
  program?: string;
  target_term?: string;
  semester?: '1' | '2' | 'summer';
  year_level?: number;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  attachments?: ChatAttachment[];
  fileExport?: FileExport;
  studentAction?: StudentAction;
}

interface ChatbotWidgetProps {
  initialOpen?: boolean;
  onClose?: () => void;
  hideFloatingButton?: boolean;
  isFullScreen?: boolean;
  hideHeader?: boolean;
  clearTrigger?: number;
  onNavigateTab?: (tab: string, studentId?: string, targetTerm?: string, semester?: '1' | '2' | 'summer') => void;
}

/**
 * Client-side helper to extract academic term and semester from query or message text
 */
export function extractClientTermAndSemester(query: string, studentYear?: number | null) {
  const q = (query || '').toLowerCase();
  let detectedYear: number | null = null;
  if (/\b(1st|first|1)\s*(yr|year)\b/i.test(q) || /\b(year|yr)\s*1\b/i.test(q)) detectedYear = 1;
  else if (/\b(2nd|second|2)\s*(yr|year)\b/i.test(q) || /\b(year|yr)\s*2\b/i.test(q)) detectedYear = 2;
  else if (/\b(3rd|third|3)\s*(yr|year)\b/i.test(q) || /\b(year|yr)\s*3\b/i.test(q)) detectedYear = 3;
  else if (/\b(4th|fourth|4)\s*(yr|year)\b/i.test(q) || /\b(year|yr)\s*4\b/i.test(q)) detectedYear = 4;

  let detectedSem: '1' | '2' | 'summer' | null = null;
  if (/\b(1st|first|1)\s*(sem|semester)\b/i.test(q) || /\b(sem|semester)\s*1\b/i.test(q)) detectedSem = '1';
  else if (/\b(2nd|second|2)\s*(sem|semester)\b/i.test(q) || /\b(sem|semester)\s*2\b/i.test(q)) detectedSem = '2';
  else if (/\b(summer|midyear)\b/i.test(q)) detectedSem = 'summer';

  const effectiveYear = detectedYear || (studentYear && studentYear >= 1 && studentYear <= 4 ? studentYear : null);
  let targetTerm: string | null = null;
  if (effectiveYear && detectedSem && detectedSem !== 'summer') {
    const yrLabel = effectiveYear === 1 ? '1st' : effectiveYear === 2 ? '2nd' : effectiveYear === 3 ? '3rd' : '4th';
    const semLabel = detectedSem === '2' ? '2nd' : '1st';
    targetTerm = `${yrLabel} Year • ${semLabel} Sem`;
  }

  return { year: effectiveYear, semester: detectedSem, target_term: targetTerm };
}

/**
 * Renders inline markdown formatting: `code`, **bold**, *italic*
 */
function renderInlineFormatting(text: string, isUser: boolean = false): React.ReactNode {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={`c-${match.index}`}
          style={{
            background: isUser ? 'rgba(255, 255, 255, 0.22)' : '#F1F5F9',
            border: isUser ? '1px solid rgba(255, 255, 255, 0.35)' : '1px solid #E2E8F0',
            color: isUser ? '#FFFFFF' : '#1E40AF',
            padding: '2px 6px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '0.86em',
            fontWeight: 700
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={`b-${match.index}`} style={{ fontWeight: 700, color: isUser ? '#FFFFFF' : '#0F172A' }}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={`i-${match.index}`} style={{ fontStyle: 'italic', opacity: isUser ? 0.95 : 0.85 }}>
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

/**
 * Component to format message content into clean headings, markdown tables,
 * structured bullet lists, and key-value sections.
 */
interface FormattedMessageProps {
  text: string;
  isUser: boolean;
  isCompact?: boolean;
}

const FormattedMessage: React.FC<FormattedMessageProps> = ({ text, isUser, isCompact = false }) => {
  if (!text) return null;

  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 1. Detect Markdown Table block (lines starting and ending with '|')
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        // Parse header and rows
        const rawHeader = tableLines[0];
        const headers = rawHeader
          .split('|')
          .slice(1, -1)
          .map(h => h.trim());

        // Skip separator row if it contains dashes e.g. | :--- | :---: |
        let startIndex = 1;
        if (tableLines.length > 1 && /^[|:\-\s]+$/.test(tableLines[1])) {
          startIndex = 2;
        }

        const dataRows = tableLines.slice(startIndex).map(line =>
          line
            .split('|')
            .slice(1, -1)
            .map(c => c.trim())
        );

        blocks.push(
          <div
            key={`tbl-${i}`}
            style={{
              overflowX: 'auto',
              margin: '0.75rem 0',
              borderRadius: '8px',
              border: isUser ? '1px solid rgba(255,255,255,0.3)' : '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: isCompact ? '0.74rem' : '0.8rem',
                textAlign: 'left'
              }}
            >
              <thead>
                <tr style={{ background: isUser ? 'rgba(255,255,255,0.2)' : '#1E3A8A', color: '#FFFFFF' }}>
                  {headers.map((h, hIdx) => (
                    <th
                      key={hIdx}
                      style={{
                        padding: isCompact ? '6px 8px' : '8px 12px',
                        fontWeight: 700,
                        letterSpacing: '0.3px',
                        borderRight: hIdx < headers.length - 1 ? '1px solid rgba(255,255,255,0.15)' : 'none',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {renderInlineFormatting(h, isUser)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    style={{
                      background: isUser ? 'transparent' : rIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
                      borderTop: isUser ? '1px solid rgba(255,255,255,0.15)' : '1px solid #E2E8F0'
                    }}
                  >
                    {row.map((cell, cIdx) => {
                      const isPassed = /\bpassed\b/i.test(cell);
                      const isFailed = /\bfailed\b/i.test(cell);

                      return (
                        <td
                          key={cIdx}
                          style={{
                            padding: isCompact ? '6px 8px' : '7px 12px',
                            color: isUser ? '#FFFFFF' : '#1E293B',
                            verticalAlign: 'middle',
                            borderRight: cIdx < row.length - 1 ? (isUser ? '1px solid rgba(255,255,255,0.1)' : '1px solid #F1F5F9') : 'none'
                          }}
                        >
                          {isPassed || isFailed ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                fontSize: isCompact ? '0.68rem' : '0.72rem',
                                fontWeight: 700,
                                background: isPassed ? '#DCFCE7' : '#FEE2E2',
                                color: isPassed ? '#166534' : '#991B1B',
                                border: isPassed ? '1px solid #BBF7D0' : '1px solid #FECACA'
                              }}
                            >
                              {cell}
                            </span>
                          ) : (
                            renderInlineFormatting(cell, isUser)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 2. Headings
    if (trimmed.startsWith('### ')) {
      const headingText = trimmed.replace(/^###\s*/, '');
      blocks.push(
        <div
          key={`h3-${i}`}
          style={{
            fontSize: isCompact ? '0.92rem' : '1.02rem',
            fontWeight: 800,
            color: isUser ? '#FFFFFF' : '#0F172A',
            margin: '0.75rem 0 0.35rem 0',
            lineHeight: 1.35,
            borderBottom: isUser ? '1px solid rgba(255,255,255,0.2)' : '1px solid #E2E8F0',
            paddingBottom: '0.3rem'
          }}
        >
          {renderInlineFormatting(headingText, isUser)}
        </div>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('#### ')) {
      const headingText = trimmed.replace(/^####\s*/, '');
      blocks.push(
        <div
          key={`h4-${i}`}
          style={{
            fontSize: isCompact ? '0.84rem' : '0.9rem',
            fontWeight: 700,
            color: isUser ? '#F1F5F9' : '#1E293B',
            margin: '0.6rem 0 0.25rem 0',
            lineHeight: 1.35
          }}
        >
          {renderInlineFormatting(headingText, isUser)}
        </div>
      );
      i++;
      continue;
    }

    // 3. Divider
    if (trimmed === '---' || trimmed === '***') {
      blocks.push(
        <hr
          key={`hr-${i}`}
          style={{
            border: 'none',
            borderTop: isUser ? '1px solid rgba(255,255,255,0.2)' : '1px solid #E2E8F0',
            margin: '0.75rem 0'
          }}
        />
      );
      i++;
      continue;
    }

    // 4. Bullet Points (•, -, *)
    if (/^[•\-\*]\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^[•\-\*]\s+/, '');
      blocks.push(
        <div
          key={`bp-${i}`}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            margin: '0.25rem 0',
            lineHeight: 1.5,
            fontSize: isCompact ? '0.8rem' : '0.88rem'
          }}
        >
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: isUser ? '#FFFFFF' : '#2563EB',
              marginTop: '0.5rem',
              flexShrink: 0
            }}
          />
          <div style={{ flex: 1 }}>{renderInlineFormatting(itemText, isUser)}</div>
        </div>
      );
      i++;
      continue;
    }

    // 5. Numbered Lists (1., 2., etc.)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      const num = numMatch[1];
      const itemText = numMatch[2];
      blocks.push(
        <div
          key={`num-${i}`}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            margin: '0.3rem 0',
            lineHeight: 1.5,
            fontSize: isCompact ? '0.8rem' : '0.88rem'
          }}
        >
          <span
            style={{
              minWidth: isCompact ? '18px' : '20px',
              height: isCompact ? '18px' : '20px',
              borderRadius: '4px',
              background: isUser ? 'rgba(255,255,255,0.25)' : '#EFF6FF',
              color: isUser ? '#FFFFFF' : '#2563EB',
              fontWeight: 700,
              fontSize: isCompact ? '0.68rem' : '0.72rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: isUser ? 'none' : '1px solid #BFDBFE'
            }}
          >
            {num}
          </span>
          <div style={{ flex: 1 }}>{renderInlineFormatting(itemText, isUser)}</div>
        </div>
      );
      i++;
      continue;
    }

    // 6. Italic notes at bottom e.g. *Use the buttons below...*
    if (trimmed.startsWith('*') && trimmed.endsWith('*') && !trimmed.startsWith('**')) {
      const noteText = trimmed.slice(1, -1);
      blocks.push(
        <div
          key={`note-${i}`}
          style={{
            margin: '0.45rem 0',
            fontSize: isCompact ? '0.72rem' : '0.78rem',
            fontStyle: 'italic',
            color: isUser ? 'rgba(255,255,255,0.85)' : '#64748B',
            lineHeight: 1.45
          }}
        >
          {renderInlineFormatting(noteText, isUser)}
        </div>
      );
      i++;
      continue;
    }

    // 7. Regular paragraph / empty line
    if (!trimmed) {
      blocks.push(<div key={`sp-${i}`} style={{ height: '0.35rem' }} />);
    } else {
      blocks.push(
        <div
          key={`p-${i}`}
          style={{
            margin: '0.2rem 0',
            lineHeight: 1.55,
            fontSize: isCompact ? '0.82rem' : '0.9rem'
          }}
        >
          {renderInlineFormatting(rawLine, isUser)}
        </div>
      );
    }
    i++;
  }

  return <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>{blocks}</div>;
};

export const ChatbotWidget: React.FC<ChatbotWidgetProps> = ({
  initialOpen = false,
  onClose,
  hideFloatingButton = false,
  isFullScreen = false,
  hideHeader = false,
  clearTrigger = 0,
  onNavigateTab
}) => {
  const { user } = useAuth();
  const registrarData = useOptionalRegistrarData();
  const refreshAcademicGrades = registrarData?.refreshAcademicGrades;
  const refreshStudents = registrarData?.refreshStudents;
  const activeAcademicYear = registrarData?.activeAcademicYear;
  const [isOpen, setIsOpen] = useState(initialOpen);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const floatingFileInputRef = useRef<HTMLInputElement>(null);
  const floatingImageInputRef = useRef<HTMLInputElement>(null);

  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);

  useEffect(() => {
    if (initialOpen) setIsOpen(true);
  }, [initialOpen]);

  const handleClose = () => {
    setIsOpen(false);
    if (!user) {
      setMessages(createFreshWelcome());
      setAttachments([]);
      setQuery('');
      try {
        localStorage.removeItem('gct_chat_history_guest');
      } catch (e) {}
    }
    if (onClose) onClose();
  };

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const isGuest = !user;
  const isStudent = user?.role === 'student';
  const isRegistrar = !isGuest && !isStudent;

  const roleTitle = isGuest
    ? 'GCT AI Assistant'
    : isStudent
    ? 'GCT Student AI Advisor'
    : 'GCT Registrar AI Assistant';

  const roleSubtitle = isGuest
    ? 'Admissions, Enrollment & Portal Guide'
    : isStudent
    ? 'Grounded in your student record'
    : 'Grounded in institutional database';

  const defaultWelcome = isGuest
    ? 'Welcome to Garcia College of Technology! I am your official GCT AI Assistant. Ask me how to register as a student, how enrollment works, or about our BSIT curriculum.\n\n*Note: Student records and grades require logging in.*'
    : isStudent
    ? `Hello ${user?.full_name || 'Student'}! I am your official GCT Academic Advising Assistant. Ask me about your passed grades, subject prerequisites, current GWA, next semester recommendations, or request an academic advising opinion!`
    : `Hello ${user?.full_name || 'Registrar Staff'}! I am your GCT Registrar Operations Assistant. Search any student record by Student ID or Name, request Excel/Word reports, check pending approvals, or evaluate curriculum rules!`;

  const userIdentifier = user?.id || user?.student_id || user?.username || null;
  const storageKey = userIdentifier ? `gct_chat_history_${userIdentifier}` : null;

  const createFreshWelcome = (): ChatMessage[] => [
    {
      id: 'welcome-msg-' + (user?.role || 'guest') + '-' + Date.now(),
      sender: 'bot',
      text: defaultWelcome,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ];

  const getInitialMessages = (): ChatMessage[] => {
    // If not logged in (on login/register), NEVER load or retain any conversation history
    if (!user || !storageKey) {
      try {
        localStorage.removeItem('gct_chat_history_guest');
      } catch (e) {}
      return createFreshWelcome();
    }
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not restore chat history:', e);
    }
    return createFreshWelcome();
  };

  const [messages, setMessages] = useState<ChatMessage[]>(getInitialMessages);

  // Sync to localStorage whenever messages change (ONLY for authenticated users, NEVER on login screen)
  useEffect(() => {
    if (!user || !storageKey) {
      try {
        localStorage.removeItem('gct_chat_history_guest');
      } catch (e) {}
      return;
    }
    try {
      if (messages && messages.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(messages));
      }
    } catch (e) {
      console.warn('Could not persist chat history:', e);
    }
  }, [messages, storageKey, user]);

  // When user identity or role changes, load their corresponding history (or start fresh on login)
  useEffect(() => {
    if (!user || !storageKey) {
      try {
        localStorage.removeItem('gct_chat_history_guest');
      } catch (e) {}
      setMessages(createFreshWelcome());
      return;
    }

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch (e) {}
    setMessages(createFreshWelcome());
  }, [storageKey, user]);

  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);

  const handleRequestClearHistory = () => {
    setShowClearConfirmModal(true);
  };

  const handleConfirmClearHistory = () => {
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {}
    }
    try {
      localStorage.removeItem('gct_chat_history_guest');
    } catch (e) {}
    setMessages(createFreshWelcome());
    setAttachments([]);
    setShowClearConfirmModal(false);
  };

  // Handle external clear trigger from parent header (Staff/Admin Dashboard)
  useEffect(() => {
    if (clearTrigger > 0) {
      setShowClearConfirmModal(true);
    }
  }, [clearTrigger]);

  const quickPrompts = isGuest
    ? [
        'How do I create a student account?',
        'What programs does GCT offer?',
        'What are the requirements for enrollment?',
        'Registrar office hours & campus location'
      ]
    : isStudent
    ? [
        'What is my cumulative GWA and standing?',
        'What subjects am I eligible for next semester?',
        'What is your opinion on my academic standing and workload?',
        'Download my official academic record'
      ]
    : [
        'What is your evaluation and opinion on student records?',
        'How many student registrations are pending approval?',
        'What are the institutional passing thresholds and prerequisite rules?',
        'Download all registered students directory in Excel'
      ];

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, isImageOnly = false) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newItems: ChatAttachment[] = Array.from(selectedFiles).map(file => {
      const isImg = isImageOnly || file.type.startsWith('image/');
      return {
        id: 'att-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        name: file.name,
        size: formatFileSize(file.size),
        type: isImg ? 'image' : 'file',
        url: isImg ? URL.createObjectURL(file) : undefined,
        file
      };
    });

    setAttachments(prev => [...prev, ...newItems]);
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const downloadExportedFile = (file: FileExport) => {
    try {
      const content = file.data || file.csv_data || '';
      const isWord = file.format === 'word' || file.filename.endsWith('.doc') || file.filename.endsWith('.docx');
      const isText = file.format === 'text' || file.filename.endsWith('.txt');

      let mimeType = 'text/csv;charset=utf-8;';
      if (isWord) {
        mimeType = 'application/msword;charset=utf-8;';
      } else if (isText) {
        mimeType = 'text/plain;charset=utf-8;';
      }

      const blob = new Blob(['\uFEFF' + content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', file.filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const promptText = textToSend || query.trim();
    if ((!promptText && attachments.length === 0) || loading) return;

    const currentAttachments = [...attachments];

    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setQuery('');
    setAttachments([]);
    setLoading(true);

    try {
      let importedGradeCount = 0;
      let importedStudentCount = 0;
      const affectedStudentIds = new Set<string>();
      const importSummaries: string[] = [];

      // Detect spreadsheet attachments (.xlsx, .xls, .csv)
      const spreadsheetAttachments = currentAttachments.filter(att =>
        att.file && (
          att.name.endsWith('.xlsx') ||
          att.name.endsWith('.xls') ||
          att.name.endsWith('.csv') ||
          (att.file.type && (att.file.type.includes('csv') || att.file.type.includes('spreadsheet') || att.file.type.includes('excel')))
        )
      );

      if (spreadsheetAttachments.length > 0) {
        for (const att of spreadsheetAttachments) {
          if (!att.file) continue;
          try {
            const rawRows = await parseExcelOrCsvFile(att.file);
            if (!Array.isArray(rawRows) || rawRows.length === 0) continue;

            const findVal = (row: any, ...possibleKeys: string[]) => {
              const keys = Object.keys(row);
              for (const pk of possibleKeys) {
                const matchKey = keys.find(k => k.trim().toLowerCase() === pk.toLowerCase());
                if (matchKey && row[matchKey] !== undefined && row[matchKey] !== null && row[matchKey] !== '') {
                  return row[matchKey];
                }
              }
              return '';
            };

            const gradeRecordsPayload: any[] = [];
            const studentProfilesPayload: any[] = [];

            rawRows.forEach(row => {
              const studentId = String(findVal(row, 'Student ID', 'student_id', 'ID', 'StudentID', 'StudentNo', 'Student No', 'Student Number', 'ID Number', 'id') || '').trim();
              const name = String(findVal(row, 'Name', 'Student Name', 'Full Name', 'FullName', 'student_name', 'StudentName') || '').trim();
              const course = String(findVal(row, 'Course', 'Program', 'Degree', 'course', 'program') || 'BSIT').trim();
              const year = Number(findVal(row, 'Year', 'Year Level', 'Yr', 'year_level', 'year', 'YearLevel')) || 1;
              const code = String(findVal(row, 'Cat No.', 'Cat No', 'Subject Code', 'Code', 'Subject', 'subject_code', 'Course Code', 'SubjectCode', 'code', 'cat_no') || '').trim();
              const title = String(findVal(row, 'Descriptive Title', 'Title', 'Subject Title', 'Description', 'Subject Description', 'subject_title', 'title') || '').trim();
              const units = Number(findVal(row, 'Units', 'Unit', 'Credit Units', 'units', 'credit_units')) || 3;
              const gradeVal = findVal(row, 'Grade', 'Grade (%)', 'Final Grade', 'grade', 'rating', 'Final Rating', 'final_grade');
              const semVal = String(findVal(row, 'Semester', 'semester', 'Sem', 'sem')).trim();
              const ayVal = String(findVal(row, 'Academic Year', 'academic_year', 'AY', 'ay')).trim();
              let term = String(findVal(row, 'Term', 'Academic Term', 'term')).trim();
              if (!term && ayVal) {
                const semClean = /2nd|second/i.test(semVal) ? '2nd Sem' : /summer/i.test(semVal) ? 'Summer' : '1st Sem';
                term = `${ayVal} ${semClean}`;
              } else if (!term) {
                term = `${activeAcademicYear || '2025-2026'} 1st Sem`;
              }

              if (studentId && code) {
                const parsedGrade = gradeVal !== '' && gradeVal !== null && gradeVal !== undefined ? parseFloat(String(gradeVal)) : null;
                gradeRecordsPayload.push({
                  student_id: studentId,
                  studentName: name || undefined,
                  course: course || 'BSIT',
                  year_level: year || 1,
                  code: code,
                  title: title || undefined,
                  units: units || 3,
                  grade: parsedGrade !== null && !isNaN(parsedGrade) ? parsedGrade : null,
                  term: term
                });
                affectedStudentIds.add(studentId);
              } else if (studentId && name) {
                studentProfilesPayload.push({
                  student_id: studentId,
                  name: name,
                  program: course || 'BSIT',
                  year: year || 1
                });
                affectedStudentIds.add(studentId);
              }
            });

            if (gradeRecordsPayload.length > 0) {
              await fetchApi('/academic-records/batch', {
                method: 'POST',
                body: JSON.stringify({ records: gradeRecordsPayload })
              });
              importedGradeCount += gradeRecordsPayload.length;
              importSummaries.push(`Stored **${gradeRecordsPayload.length} grade records** from \`${att.name}\` into database`);
            }

            if (studentProfilesPayload.length > 0) {
              for (const sp of studentProfilesPayload) {
                try {
                  await fetchApi('/students', {
                    method: 'POST',
                    body: JSON.stringify(sp)
                  });
                  importedStudentCount++;
                } catch (e) {
                  // duplicate or already exists
                }
              }
              if (importedStudentCount > 0) {
                importSummaries.push(`Synced **${importedStudentCount} student profile(s)** into database`);
              }
            }
          } catch (fileErr: any) {
            console.error('Error importing spreadsheet in chatbot:', fileErr);
            importSummaries.push(`Failed to import \`${att.name}\`: ${fileErr?.message || 'Invalid format'}`);
          }
        }

        if (importedGradeCount > 0 || importedStudentCount > 0) {
          if (refreshAcademicGrades) await refreshAcademicGrades();
          if (refreshStudents) await refreshStudents();
        }
      }

      // If user uploaded a file without additional prompt text, reply with confirmation
      if (!promptText && importSummaries.length > 0) {
        const studentListStr = Array.from(affectedStudentIds).join(', ') || 'N/A';
        const directBotText = `### ✅ File Import Successfully Saved to Database!\n\n` +
          importSummaries.map(s => `- ${s}`).join('\n') +
          `\n\n- **Target Student(s):** ${studentListStr}` +
          `\n- **Database Tables Updated:** \`academic_records\` & \`grade_records\` (Supabase)` +
          `\n- **Standing & Prerequisites:** Recalculated and synchronized across the system.` +
          `\n\nAll missing grades from your file are now stored permanently in the database. You can ask me to evaluate their academic standing, calculate GWA, or generate subject recommendations for the next semester!`;

        const botMsg: ChatMessage = {
          id: 'bot-' + Date.now(),
          sender: 'bot',
          text: directBotText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, botMsg]);
        setLoading(false);
        return;
      }

      let queryPayload = promptText;
      if (importSummaries.length > 0) {
        queryPayload = `[System Notice: File import stored ${importedGradeCount} grade records into database for student(s) ${Array.from(affectedStudentIds).join(', ')}]\n${promptText}`;
      } else if (currentAttachments.length > 0) {
        const fileNames = currentAttachments.map(a => `${a.name} (${a.type})`).join(', ');
        queryPayload = promptText
          ? `${promptText}\n[Attached: ${fileNames}]`
          : `[Attached files: ${fileNames}]`;
      }

      const res = await fetchApi(
        '/chatbot/query',
        {
          method: 'POST',
          body: JSON.stringify({ query: queryPayload })
        },
        user || { id: 'guest', role: 'guest', full_name: 'Visitor' }
      );

      const rawAction = res.student_action || undefined;
      let finalAction = rawAction;
      if (rawAction) {
        const clientAnalysis = extractClientTermAndSemester(promptText, rawAction.year_level);
        finalAction = {
          ...rawAction,
          target_term: rawAction.target_term || clientAnalysis.target_term || undefined,
          semester: rawAction.semester || clientAnalysis.semester || undefined,
          year_level: rawAction.year_level || clientAnalysis.year || undefined
        };
      }

      let botResponseText = res.response || 'No response received.';
      if (importSummaries.length > 0) {
        const importBanner = `### ✅ File Import Saved to Database\n` +
          importSummaries.map(s => `- ${s}`).join('\n') +
          `\n- **Target Student(s):** ${Array.from(affectedStudentIds).join(', ') || 'N/A'}\n` +
          `- **Database Tables:** \`academic_records\` & \`grade_records\` synced\n\n---\n\n`;
        botResponseText = importBanner + botResponseText;
      }

      const botMsg: ChatMessage = {
        id: 'bot-' + Date.now(),
        sender: 'bot',
        text: botResponseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fileExport: res.file_export || undefined,
        studentAction: finalAction
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: 'bot-err-' + Date.now(),
        sender: 'bot',
        text: `Error connecting to GCT Assistant: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const renderClearConfirmModal = () => {
    if (!showClearConfirmModal) return null;
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          padding: '1rem',
          animation: 'fadeIn 0.15s ease-out'
        }}
        onClick={() => setShowClearConfirmModal(false)}
      >
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            maxWidth: '430px',
            width: '100%',
            padding: '1.75rem',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
            border: '1px solid #E2E8F0',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.15rem'
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: '#FEE2E2',
                border: '1px solid #FECACA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Trash2 size={22} color="#DC2626" />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.3 }}>
                Delete Chat History?
              </h3>
              <p style={{ margin: '0.45rem 0 0', fontSize: '0.84rem', color: '#475569', lineHeight: 1.5 }}>
                Are you sure you want to delete all messages in this conversation?
              </p>
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.78rem', color: '#64748B', lineHeight: 1.4 }}>
                This action cannot be undone. All previous inquiries, generated reports, and responses will be permanently cleared.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.35rem' }}>
            <button
              type="button"
              onClick={() => setShowClearConfirmModal(false)}
              style={{
                padding: '0.55rem 1.1rem',
                background: '#F1F5F9',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#E2E8F0';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#F1F5F9';
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmClearHistory}
              style={{
                padding: '0.55rem 1.15rem',
                background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 700,
                color: '#FFFFFF',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.opacity = '0.92';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              <Trash2 size={14} />
              Yes, Delete History
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (isFullScreen) {
    return (
      <>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            flex: 1,
            minHeight: 0,
            background: '#FFFFFF',
            borderRadius: 0,
            border: 'none',
            boxShadow: 'none',
            overflow: 'hidden',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
          }}
        >
        {/* Full Screen Header (rendered only if parent didn't already provide it) */}
        {!hideHeader && (
          <div
            style={{
              padding: '1.25rem 1.75rem',
              background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 50%, #1D4ED8 100%)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', margin: 0, lineHeight: 1.2 }}>
                {roleTitle}
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#DBEAFE', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem', fontWeight: 500 }}>
                {roleSubtitle}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span
                style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#34D399',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  padding: '5px 14px',
                  borderRadius: '20px',
                  fontSize: '0.76rem',
                  fontWeight: 700
                }}
              >
                ● Active GCT AI Knowledge Engine
              </span>

              <button
                type="button"
                onClick={handleRequestClearHistory}
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.2s ease'
                }}
                title="Clear Conversation"
              >
                <Trash2 size={14} /> Clear History
              </button>
            </div>
          </div>
        )}

        {/* Messages Scroll Area */}
        <div
          style={{
            flex: 1,
            padding: '1.5rem 2rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            minHeight: 0,
            background: '#F8FAFC'
          }}
        >
          {messages.map(msg => (
            <div
              key={msg.id}
              style={{
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '82%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              <div
                style={{
                  padding: '0.9rem 1.3rem',
                  borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: msg.sender === 'user'
                    ? 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)'
                    : '#FFFFFF',
                  color: msg.sender === 'user' ? '#FFFFFF' : '#0F172A',
                  border: msg.sender === 'bot' ? '1px solid #E2E8F0' : 'none',
                  fontSize: '0.92rem',
                  lineHeight: 1.55,
                  wordBreak: 'break-word',
                  whiteSpace: msg.sender === 'user' ? 'pre-wrap' : 'normal',
                  boxShadow: msg.sender === 'user'
                    ? '0 4px 14px rgba(37, 99, 235, 0.25)'
                    : '0 2px 8px rgba(0, 0, 0, 0.04)'
                }}
              >
                {/* Bot Message Header */}
                {msg.sender === 'bot' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.55rem', paddingBottom: '0.35rem', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '6px', background: '#1E3A8A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Sparkles size={11} color="#FFFFFF" />
                    </div>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155', letterSpacing: '0.2px' }}>
                      {roleTitle}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#94A3B8', marginLeft: 'auto' }}>
                      GCT Verified
                    </span>
                  </div>
                )}

                {/* Render Attachments if any */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: msg.text ? '0.65rem' : 0 }}>
                    {msg.attachments.map(att => (
                      att.type === 'image' && att.url ? (
                        <div
                          key={att.id}
                          style={{
                            borderRadius: '10px',
                            overflow: 'hidden',
                            border: msg.sender === 'user' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid #CBD5E1',
                            background: '#000000',
                            maxWidth: '220px'
                          }}
                        >
                          <img
                            src={att.url}
                            alt={att.name}
                            style={{ maxHeight: '150px', width: '100%', objectFit: 'cover', display: 'block' }}
                          />
                          <div style={{
                            padding: '3px 8px',
                            background: 'rgba(0,0,0,0.65)',
                            color: '#FFFFFF',
                            fontSize: '0.68rem',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {att.name}
                          </div>
                        </div>
                      ) : (
                        <div
                          key={att.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.45rem 0.8rem',
                            borderRadius: '8px',
                            background: msg.sender === 'user' ? 'rgba(255, 255, 255, 0.18)' : '#F1F5F9',
                            color: msg.sender === 'user' ? '#FFFFFF' : '#1E293B',
                            fontSize: '0.8rem',
                            fontWeight: 600
                          }}
                        >
                          <FileText size={16} />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {att.name}
                            </span>
                            <span style={{ fontSize: '0.66rem', opacity: 0.85 }}>{att.size}</span>
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                )}

                {msg.text && <FormattedMessage text={msg.text} isUser={msg.sender === 'user'} isCompact={false} />}

                {/* Downloadable Multi-Format File Attachment Button (Word, Excel, Text) */}
                {msg.fileExport && (() => {
                  const isWord = msg.fileExport.format === 'word' || msg.fileExport.filename.endsWith('.doc') || msg.fileExport.filename.endsWith('.docx');
                  const isText = msg.fileExport.format === 'text' || msg.fileExport.filename.endsWith('.txt');

                  const cardBg = isWord ? '#EFF6FF' : isText ? '#F8FAFC' : '#F0FDF4';
                  const cardBorder = isWord ? '#BFDBFE' : isText ? '#CBD5E1' : '#BBF7D0';
                  const primaryColor = isWord ? '#2563EB' : isText ? '#475569' : '#16A34A';
                  const hoverColor = isWord ? '#1D4ED8' : isText ? '#334155' : '#15803D';
                  const labelColor = isWord ? '#1E40AF' : isText ? '#1E293B' : '#166534';
                  const subColor = isWord ? '#3B82F6' : isText ? '#64748B' : '#15803D';
                  const subText = isWord 
                    ? 'Formatted Microsoft Word (.doc) Document Ready' 
                    : isText 
                    ? 'Formatted Plain Text (.txt) File Ready' 
                    : 'Formatted Excel / CSV Spreadsheet Ready';

                  return (
                    <div
                      style={{
                        marginTop: '0.85rem',
                        padding: '0.75rem 1rem',
                        background: msg.sender === 'user' ? 'rgba(255, 255, 255, 0.15)' : cardBg,
                        border: msg.sender === 'user' ? '1px solid rgba(255, 255, 255, 0.3)' : `1px solid ${cardBorder}`,
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        {isWord || isText ? (
                          <FileText size={24} color={msg.sender === 'user' ? '#FFFFFF' : primaryColor} />
                        ) : (
                          <FileSpreadsheet size={24} color={msg.sender === 'user' ? '#FFFFFF' : primaryColor} />
                        )}
                        <div>
                          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: msg.sender === 'user' ? '#FFFFFF' : labelColor }}>
                            {msg.fileExport.label || msg.fileExport.filename}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: msg.sender === 'user' ? '#DBEAFE' : subColor }}>
                            {subText}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadExportedFile(msg.fileExport!)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.45rem 0.95rem',
                          background: primaryColor,
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: `0 2px 8px ${isWord ? 'rgba(37, 99, 235, 0.25)' : isText ? 'rgba(71, 85, 105, 0.25)' : 'rgba(22, 163, 74, 0.25)'}`,
                          transition: 'all 0.2s ease'
                        }}
                        title={`Download ${isWord ? 'Word document' : isText ? 'Text file' : 'Excel spreadsheet'}`}
                        onMouseEnter={e => e.currentTarget.style.background = hoverColor}
                        onMouseLeave={e => e.currentTarget.style.background = primaryColor}
                      >
                        <Download size={15} />
                        <span>Download {isWord ? 'Word' : isText ? 'Text' : 'Excel'}</span>
                      </button>
                    </div>
                  );
                })()}

                {/* Direct Action Links to Academic Records & Recommendations */}
                {msg.studentAction && onNavigateTab && (() => {
                  const clientAnalysis = extractClientTermAndSemester(msg.text, msg.studentAction?.year_level);
                  const targetTerm = msg.studentAction?.target_term || clientAnalysis.target_term || undefined;
                  const semester = msg.studentAction?.semester || clientAnalysis.semester || undefined;

                  return (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        display: 'flex',
                        gap: '0.5rem',
                        flexWrap: 'wrap'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => onNavigateTab('student_academic_records', msg.studentAction!.student_id, targetTerm, semester)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.45rem 0.85rem',
                          background: '#EFF6FF',
                          border: '1px solid #93C5FD',
                          color: '#1D4ED8',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 1px 3px rgba(37, 99, 235, 0.1)',
                          transition: 'all 0.2s ease'
                        }}
                        title={`Open ${msg.studentAction.student_id} in Academic Records`}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = '#DBEAFE';
                          e.currentTarget.style.borderColor = '#60A5FA';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = '#EFF6FF';
                          e.currentTarget.style.borderColor = '#93C5FD';
                        }}
                      >
                        <BookOpen size={14} />
                        <span>
                          Open in Academic Records ({msg.studentAction.student_id}
                          {targetTerm ? ` • ${targetTerm}` : ''})
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onNavigateTab('recommendations', msg.studentAction!.student_id, targetTerm, semester)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.45rem 0.85rem',
                          background: '#FAF5FF',
                          border: '1px solid #D8B4FE',
                          color: '#7E22CE',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 1px 3px rgba(126, 34, 206, 0.1)',
                          transition: 'all 0.2s ease'
                        }}
                        title={`Open ${msg.studentAction.student_id} in Subject Recommendations`}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = '#F3E8FF';
                          e.currentTarget.style.borderColor = '#C084FC';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = '#FAF5FF';
                          e.currentTarget.style.borderColor = '#D8B4FE';
                        }}
                      >
                        <Sparkles size={14} />
                        <span>
                          Open in Subject Recommendations
                          {semester ? ` (${semester === '1' ? '1st Sem' : semester === '2' ? '2nd Sem' : 'Summer'})` : ''}
                        </span>
                      </button>
                    </div>
                  );
                })()}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.3rem', fontWeight: 500 }}>
                {msg.timestamp}
              </span>
            </div>
          ))}

          {loading && (
            <div
              style={{
                alignSelf: 'flex-start',
                padding: '0.75rem 1.15rem',
                background: '#FFFFFF',
                borderRadius: '12px',
                fontSize: '0.86rem',
                color: '#64748B',
                border: '1px solid #E2E8F0',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)'
              }}
            >
              {isGuest
                ? 'Consulting GCT Admissions & Academic Guide...'
                : isRegistrar
                ? 'Querying institutional database & rules...'
                : 'Analyzing curriculum & student records...'}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Prompts */}
        <div
          style={{
            padding: '0.65rem 1.5rem',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            gap: '0.5rem',
            overflowX: 'auto',
            flexShrink: 0,
            background: '#FFFFFF'
          }}
        >
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(qp)}
              style={{
                background: '#F1F5F9',
                border: '1px solid #CBD5E1',
                borderRadius: '9999px',
                padding: '0.4rem 0.9rem',
                color: '#334155',
                fontSize: '0.78rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#2563EB';
                e.currentTarget.style.borderColor = '#93C5FD';
                e.currentTarget.style.background = '#EFF6FF';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#334155';
                e.currentTarget.style.borderColor = '#CBD5E1';
                e.currentTarget.style.background = '#F1F5F9';
              }}
            >
              {qp}
            </button>
          ))}
        </div>

        {/* Staged Attachments Preview Bar */}
        {attachments.length > 0 && (
          <div
            style={{
              padding: '0.5rem 1.5rem',
              background: '#F8FAFC',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              gap: '0.6rem',
              overflowX: 'auto',
              alignItems: 'center',
              flexShrink: 0
            }}
          >
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap' }}>
              Attached ({attachments.length}):
            </span>
            {attachments.map(att => (
              <div
                key={att.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.76rem',
                  color: '#1E293B',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                {att.type === 'image' && att.url ? (
                  <img src={att.url} alt={att.name} style={{ width: '22px', height: '22px', borderRadius: '4px', objectFit: 'cover' }} />
                ) : (
                  <FileText size={15} color="#2563EB" />
                )}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                    {att.name}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: '#64748B' }}>{att.size}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '2px', display: 'flex', marginLeft: '0.2rem' }}
                  title="Remove attachment"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Full Screen Input Bar */}
        <div
          style={{
            padding: '0.9rem 1.5rem 1rem 1.5rem',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            background: '#FFFFFF',
            flexShrink: 0,
            boxShadow: '0 -4px 16px rgba(15, 23, 42, 0.04)'
          }}
        >
          {/* Hidden File Pickers */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={e => handleFileSelect(e, false)}
            style={{ display: 'none' }}
            multiple
            accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.csv,image/*"
          />
          <input
            type="file"
            ref={imageInputRef}
            onChange={e => handleFileSelect(e, true)}
            style={{ display: 'none' }}
            multiple
            accept="image/*"
          />

          {/* Attachment Buttons */}
          <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.75rem 1rem',
                background: '#F1F5F9',
                border: '1px solid #CBD5E1',
                borderRadius: '12px',
                color: '#334155',
                fontSize: '0.86rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              title="Attach Document or File (.pdf, .doc, .csv, .txt)"
              onMouseEnter={e => {
                e.currentTarget.style.background = '#EFF6FF';
                e.currentTarget.style.borderColor = '#93C5FD';
                e.currentTarget.style.color = '#2563EB';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#F1F5F9';
                e.currentTarget.style.borderColor = '#CBD5E1';
                e.currentTarget.style.color = '#334155';
              }}
            >
              <Paperclip size={18} />
              <span>File</span>
            </button>

            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.75rem 1rem',
                background: '#F1F5F9',
                border: '1px solid #CBD5E1',
                borderRadius: '12px',
                color: '#334155',
                fontSize: '0.86rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              title="Attach Image (.png, .jpg, .webp)"
              onMouseEnter={e => {
                e.currentTarget.style.background = '#EFF6FF';
                e.currentTarget.style.borderColor = '#93C5FD';
                e.currentTarget.style.color = '#2563EB';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#F1F5F9';
                e.currentTarget.style.borderColor = '#CBD5E1';
                e.currentTarget.style.color = '#334155';
              }}
            >
              <ImageIcon size={18} />
              <span>Image</span>
            </button>
          </div>

          {/* Type Message Input Field */}
          <input
            type="text"
            placeholder={
              isGuest
                ? 'Ask about registration, enrollment, GCT programs...'
                : isRegistrar
                ? 'Search student record (by ID or name), request Excel/Word reports...'
                : 'Ask academic advisor about your eligible subjects & grades...'
            }
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            style={{
              flex: 1,
              padding: '0.8rem 1.15rem',
              fontSize: '0.92rem',
              background: '#F8FAFC',
              color: '#0F172A',
              border: '1px solid #CBD5E1',
              borderRadius: '12px',
              outline: 'none',
              transition: 'all 0.2s ease'
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = '#2563EB';
              e.currentTarget.style.background = '#FFFFFF';
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = '#CBD5E1';
              e.currentTarget.style.background = '#F8FAFC';
            }}
          />

          {/* Send Button */}
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={loading || (!query.trim() && attachments.length === 0)}
            style={{
              padding: '0.8rem 1.5rem',
              background: loading || (!query.trim() && attachments.length === 0)
                ? '#94A3B8'
                : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: loading || (!query.trim() && attachments.length === 0) ? 'not-allowed' : 'pointer',
              boxShadow: loading || (!query.trim() && attachments.length === 0) ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.25)',
              transition: 'all 0.2s ease'
            }}
            aria-label="Send message"
          >
            <Send size={18} />
            <span>Send</span>
          </button>
        </div>
      </div>
      {renderClearConfirmModal()}
    </>
  );
}

  return (
    <>
      {/* Floating GCT Logo Chatbot Trigger Button */}
      {!isOpen && !hideFloatingButton && (
        <button
          onClick={() => {
            if (!user) {
              setMessages(createFreshWelcome());
              setAttachments([]);
              setQuery('');
              try {
                localStorage.removeItem('gct_chat_history_guest');
              } catch (e) {}
            }
            setIsOpen(true);
          }}
          className="chatbot-floating-logo-btn"
          aria-label="Open GCT AI Assistant"
          title="Open GCT AI Assistant"
        >
          <img
            src="/logo.png"
            alt="Garcia College of Technology Logo"
            className="chatbot-floating-logo-img"
          />
          <span className="chatbot-online-badge">
            <span className="chatbot-online-dot"></span>
          </span>
          <span className="chatbot-floating-tooltip">Ask GCT AI</span>
        </button>
      )}

      {/* Floating Chat Modal Drawer (Light Theme) */}
      {isOpen && (
        <div
          className="chatbot-drawer-modal"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '400px',
            maxWidth: 'calc(100vw - 32px)',
            height: '600px',
            maxHeight: 'calc(100vh - 48px)',
            background: '#FFFFFF',
            borderRadius: '16px',
            boxShadow: '0 12px 36px rgba(15, 23, 42, 0.16)',
            border: '1px solid #E2E8F0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 9999,
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '0.85rem 1.15rem',
            background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 55%, #1D4ED8 100%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#FFFFFF', margin: 0, lineHeight: 1.2 }}>
                    {roleTitle}
                  </h3>
                </div>
                <span style={{ fontSize: '0.7rem', color: '#DBEAFE', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.1rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }}></span>
                  {roleSubtitle}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                type="button"
                onClick={handleRequestClearHistory}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s ease'
                }}
                aria-label="Clear Chat History"
                title="Clear Chat History"
              >
                <Trash2 size={15} />
              </button>
              <button
                type="button"
                onClick={handleClose}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                aria-label="Close Chat"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Messages Scroll Body */}
          <div style={{
            flex: 1,
            padding: '1rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            minHeight: 0,
            background: '#F8FAFC'
          }}>
            {messages.map(msg => (
              <div
                key={msg.id}
                style={{
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '88%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: msg.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  background: msg.sender === 'user'
                    ? 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)'
                    : '#FFFFFF',
                  color: msg.sender === 'user' ? '#FFFFFF' : '#0F172A',
                  border: msg.sender === 'bot' ? '1px solid #E2E8F0' : 'none',
                  fontSize: '0.84rem',
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                  whiteSpace: msg.sender === 'user' ? 'pre-wrap' : 'normal',
                  boxShadow: msg.sender === 'user' ? '0 2px 8px rgba(37, 99, 235, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.04)'
                }}>
                  {/* Bot Message Header */}
                  {msg.sender === 'bot' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.45rem', paddingBottom: '0.3rem', borderBottom: '1px solid #F1F5F9' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#1E3A8A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Sparkles size={9} color="#FFFFFF" />
                      </div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#334155', letterSpacing: '0.2px' }}>
                        {roleTitle}
                      </span>
                      <span style={{ fontSize: '0.62rem', color: '#94A3B8', marginLeft: 'auto' }}>
                        Verified
                      </span>
                    </div>
                  )}

                  {/* Floating Attachments Rendering */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: msg.text ? '0.5rem' : 0 }}>
                      {msg.attachments.map(att => (
                        att.type === 'image' && att.url ? (
                          <div
                            key={att.id}
                            style={{
                              borderRadius: '8px',
                              overflow: 'hidden',
                              border: msg.sender === 'user' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid #CBD5E1',
                              maxWidth: '180px'
                            }}
                          >
                            <img
                              src={att.url}
                              alt={att.name}
                              style={{ maxHeight: '110px', width: '100%', objectFit: 'cover', display: 'block' }}
                            />
                            <div style={{
                              padding: '2px 6px',
                              background: 'rgba(0,0,0,0.65)',
                              color: '#FFFFFF',
                              fontSize: '0.62rem',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {att.name}
                            </div>
                          </div>
                        ) : (
                          <div
                            key={att.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              padding: '0.35rem 0.6rem',
                              borderRadius: '6px',
                              background: msg.sender === 'user' ? 'rgba(255, 255, 255, 0.2)' : '#F1F5F9',
                              color: msg.sender === 'user' ? '#FFFFFF' : '#1E293B',
                              fontSize: '0.74rem',
                              fontWeight: 600
                            }}
                          >
                            <FileText size={14} />
                            <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {att.name}
                            </span>
                          </div>
                        )
                      ))}
                    </div>
                  )}

                  {msg.text && <FormattedMessage text={msg.text} isUser={msg.sender === 'user'} isCompact={true} />}

                  {/* Floating Download Button */}
                  {msg.fileExport && (() => {
                    const isWord = msg.fileExport.format === 'word' || msg.fileExport.filename.endsWith('.doc') || msg.fileExport.filename.endsWith('.docx');
                    const isText = msg.fileExport.format === 'text' || msg.fileExport.filename.endsWith('.txt');
                    const cardBg = isWord ? '#EFF6FF' : isText ? '#F8FAFC' : '#F0FDF4';
                    const cardBorder = isWord ? '#BFDBFE' : isText ? '#CBD5E1' : '#BBF7D0';
                    const primaryColor = isWord ? '#2563EB' : isText ? '#475569' : '#16A34A';
                    const labelColor = isWord ? '#1E40AF' : isText ? '#1E293B' : '#166534';
                    const tagText = isWord ? 'Word Document' : isText ? 'Text File' : 'Excel / CSV Record';

                    return (
                      <div style={{
                        marginTop: '0.65rem',
                        padding: '0.55rem 0.75rem',
                        background: cardBg,
                        border: `1px solid ${cardBorder}`,
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {isWord || isText ? (
                            <FileText size={18} color={primaryColor} />
                          ) : (
                            <FileSpreadsheet size={18} color={primaryColor} />
                          )}
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: labelColor }}>
                            {tagText}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => downloadExportedFile(msg.fileExport!)}
                          style={{
                            padding: '0.35rem 0.7rem',
                            background: primaryColor,
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          <Download size={13} /> Download
                        </button>
                      </div>
                    );
                  })()}

                  {/* Floating Action Buttons */}
                  {msg.studentAction && onNavigateTab && (() => {
                    const clientAnalysis = extractClientTermAndSemester(msg.text, msg.studentAction?.year_level);
                    const targetTerm = msg.studentAction?.target_term || clientAnalysis.target_term || undefined;
                    const semester = msg.studentAction?.semester || clientAnalysis.semester || undefined;

                    return (
                      <div style={{ marginTop: '0.55rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => onNavigateTab('student_academic_records', msg.studentAction!.student_id, targetTerm, semester)}
                          style={{
                            padding: '0.35rem 0.65rem',
                            background: '#EFF6FF',
                            border: '1px solid #93C5FD',
                            color: '#1D4ED8',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                          title={`Open ${msg.studentAction.student_id} in Academic Records`}
                        >
                          <BookOpen size={12} />
                          <span>
                            Records ({msg.studentAction.student_id}
                            {targetTerm ? ` • ${targetTerm}` : ''})
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigateTab('recommendations', msg.studentAction!.student_id, targetTerm, semester)}
                          style={{
                            padding: '0.35rem 0.65rem',
                            background: '#FAF5FF',
                            border: '1px solid #D8B4FE',
                            color: '#7E22CE',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                          title={`Open ${msg.studentAction.student_id} in Subject Recommendations`}
                        >
                          <Sparkles size={12} />
                          <span>
                            Recs
                            {semester ? ` (${semester === '1' ? '1st Sem' : semester === '2' ? '2nd Sem' : 'Summer'})` : ''}
                          </span>
                        </button>
                      </div>
                    );
                  })()}
                </div>
                <span style={{ fontSize: '0.65rem', color: '#64748B', marginTop: '0.2rem', fontWeight: 500 }}>
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {loading && (
              <div style={{ alignSelf: 'flex-start', padding: '0.55rem 0.85rem', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '0.78rem', color: '#64748B' }}>
                {isGuest
                  ? 'Consulting GCT Admissions & Academic Guide...'
                  : isRegistrar
                  ? 'Querying institutional database & rules...'
                  : 'Analyzing curriculum & student records...'}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div style={{
            padding: '0.5rem 0.75rem',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            gap: '0.35rem',
            overflowX: 'auto',
            flexShrink: 0,
            background: '#FFFFFF'
          }}>
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(qp)}
                style={{
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  borderRadius: '9999px',
                  padding: '0.3rem 0.65rem',
                  color: '#334155',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  flexShrink: 0
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#2563EB';
                  e.currentTarget.style.borderColor = '#93C5FD';
                  e.currentTarget.style.background = '#EFF6FF';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = '#334155';
                  e.currentTarget.style.borderColor = '#CBD5E1';
                  e.currentTarget.style.background = '#F1F5F9';
                }}
              >
                {qp}
              </button>
            ))}
          </div>

          {/* Staged Attachments for Floating Widget */}
          {attachments.length > 0 && (
            <div
              style={{
                padding: '0.35rem 0.75rem',
                background: '#F8FAFC',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                gap: '0.4rem',
                overflowX: 'auto',
                alignItems: 'center',
                flexShrink: 0
              }}
            >
              {attachments.map(att => (
                <div
                  key={att.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    padding: '0.2rem 0.45rem',
                    fontSize: '0.7rem',
                    color: '#1E293B'
                  }}
                >
                  {att.type === 'image' && att.url ? (
                    <img src={att.url} alt={att.name} style={{ width: '18px', height: '18px', borderRadius: '3px', objectFit: 'cover' }} />
                  ) : (
                    <FileText size={13} color="#2563EB" />
                  )}
                  <span style={{ maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {att.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Floating Input Footer */}
          <div style={{
            padding: '0.65rem 0.75rem',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: '#FFFFFF',
            flexShrink: 0
          }}>
            <input
              type="file"
              ref={floatingFileInputRef}
              onChange={e => handleFileSelect(e, false)}
              style={{ display: 'none' }}
              multiple
              accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.csv,image/*"
            />
            <input
              type="file"
              ref={floatingImageInputRef}
              onChange={e => handleFileSelect(e, true)}
              style={{ display: 'none' }}
              multiple
              accept="image/*"
            />

            <button
              type="button"
              onClick={() => floatingFileInputRef.current?.click()}
              style={{
                padding: '0.5rem',
                background: '#F1F5F9',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                color: '#475569',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Attach File"
            >
              <Paperclip size={15} />
            </button>

            <button
              type="button"
              onClick={() => floatingImageInputRef.current?.click()}
              style={{
                padding: '0.5rem',
                background: '#F1F5F9',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                color: '#475569',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Attach Image"
            >
              <ImageIcon size={15} />
            </button>

            <input
              type="text"
              placeholder={
                isGuest
                  ? 'Ask about registration...'
                  : isRegistrar
                  ? 'Ask or search student...'
                  : 'Ask academic advisor...'
              }
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              style={{
                flex: 1,
                padding: '0.55rem 0.8rem',
                fontSize: '0.84rem',
                background: '#F8FAFC',
                color: '#0F172A',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                outline: 'none'
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = '#2563EB';
                e.currentTarget.style.background = '#FFFFFF';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = '#CBD5E1';
                e.currentTarget.style.background = '#F8FAFC';
              }}
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={loading || (!query.trim() && attachments.length === 0)}
              style={{
                padding: '0.55rem 0.95rem',
                background: loading || (!query.trim() && attachments.length === 0)
                  ? '#94A3B8'
                  : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                flexShrink: 0,
                cursor: loading || (!query.trim() && attachments.length === 0) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              aria-label="Send message"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
      {renderClearConfirmModal()}
    </>
  );
};
