import { useState, useRef, useEffect } from 'react';
import { Menu, Plus, MessageSquare, Image as ImageIcon, Send, Square, User, Bot, FileText, Settings, Loader2, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { aiService } from './services/ai';
import { parseImage, parsePDF } from './services/documentParser';

type Message = {
  id: string;
  role: 'user' | 'ai';
  content: string;
};

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [engineState, setEngineState] = useState<{status: string, progress: number} | null>(null);
  
  // File upload state
  const [attachedFiles, setAttachedFiles] = useState<{name: string, text: string}[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, engineState]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'pdf' | 'image') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      let extractedText = '';
      if (type === 'pdf') {
        extractedText = await parsePDF(file);
      } else {
        extractedText = await parseImage(file);
      }

      setAttachedFiles(prev => [...prev, { name: file.name, text: extractedText }]);
    } catch (err: any) {
      console.error("Failed to parse file", err);
      alert(`Failed to read the file. Error: ${err.message || err}`);
    } finally {
      setIsUploading(false);
      // Reset input
      if (e.target) e.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleStop = () => {
    aiService.interrupt();
    setIsGenerating(false);
  };

  const handleSend = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isGenerating) return;

    const currentInput = input;
    setInput('');
    
    // Combine file text if present
    let contextFilesText = '';
    let userDisplayMessage = currentInput;
    
    if (attachedFiles.length > 0) {
      contextFilesText = attachedFiles.map(f => `--- File: ${f.name} ---\n${f.text}`).join('\n\n');
      if (!userDisplayMessage) {
        userDisplayMessage = "Please analyze these files and provide study notes.";
      }
      userDisplayMessage = `[Attached ${attachedFiles.length} file(s)]\n${userDisplayMessage}`;
      // Clear files after sending
      setAttachedFiles([]);
    }

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: userDisplayMessage };
    setMessages(prev => [...prev, userMessage]);
    setIsGenerating(true);

    try {
      // 1. Init engine
      await aiService.init((report) => {
        setEngineState({ status: report.text, progress: report.progress });
      });
      setEngineState(null);

      // 2. Generate response with streaming
      const aiMessageId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: aiMessageId, role: 'ai', content: '' }]);

      await aiService.generateResponse(currentInput || "Analyze the attached files.", contextFilesText, (chunk) => {
        setMessages(prev => prev.map(msg => {
          if (msg.id === aiMessageId) {
            return { ...msg, content: msg.content + chunk };
          }
          return msg;
        }));
      });

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'ai', 
        content: "Sorry, I encountered an error. Please ensure your browser supports WebGPU." 
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="app-container">
      {/* Hidden file inputs */}
      <input type="file" accept="application/pdf" ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'pdf')} />
      <input type="file" accept="image/*" ref={imageInputRef} style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'image')} />

      {/* Sidebar */}
      <aside className={`sidebar ${!sidebarOpen ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <button className="icon-btn" onClick={() => setSidebarOpen(false)}>
            <Menu size={20} />
          </button>
          {sidebarOpen && (
            <button className="icon-btn">
              <Settings size={20} />
            </button>
          )}
        </div>
        
        {sidebarOpen && (
          <div style={{ padding: '0 16px 16px' }}>
            <button className="new-chat-btn" onClick={() => setMessages([])}>
              <Plus size={16} /> New chat
            </button>
          </div>
        )}

        <div className="history-list">
          {sidebarOpen && (
            <>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', paddingLeft: '12px' }}>Recent</p>
              <div className="history-item">
                <MessageSquare size={16} /> Understanding Quantum Physics
              </div>
              <div className="history-item">
                <MessageSquare size={16} /> History of Rome - Chapter 4
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Top Nav */}
        <header className="top-nav">
          {!sidebarOpen && (
            <button className="icon-btn" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
          )}
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>ByteBrain <span style={{fontSize: '12px', padding: '2px 6px', background: 'var(--bg-tertiary)', borderRadius: '12px', marginLeft: '8px', color: '#10b981'}}>Local AI</span></h2>
        </header>

        {/* Chat Area */}
        <div className="chat-area">
          {messages.length === 0 ? (
            <div className="hero">
              <h1>Hello, I'm ByteBrain.</h1>
              <p>Your private, in-browser AI Study Companion. How can I help you learn today?</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`message-wrapper ${msg.role}`}>
                <div className={`avatar ${msg.role}`}>
                  {msg.role === 'user' ? <User size={20} color="#fff" /> : <Bot size={20} color="#fff" />}
                </div>
                <div className="message-content">
                  {msg.role === 'ai' ? (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  )}
                </div>
              </div>
            ))
          )}
          
          {engineState && (
            <div className="message-wrapper ai">
               <div className="avatar ai">
                  <Bot size={20} color="#fff" />
                </div>
                <div className="message-content" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Loader2 size={16} className="lucide-spin" /> {engineState.status}
                  </div>
                  <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--bg-primary)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(5, engineState.progress * 100)}%`, height: '100%', backgroundColor: '#6366f1', transition: 'width 0.3s' }}></div>
                  </div>
                </div>
            </div>
          )}

          {isGenerating && !engineState && (
            <div className="message-wrapper ai">
               <div className="avatar ai">
                  <Bot size={20} color="#fff" />
                </div>
                <div className="message-content" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Loader2 size={16} className="lucide-spin" /> Thinking...
                </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="input-container">
          
          {/* File Attachments Area */}
          {attachedFiles.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', padding: '0 16px 12px', flexWrap: 'wrap' }}>
              {attachedFiles.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-secondary)', padding: '6px 12px', borderRadius: '16px', fontSize: '13px', border: '1px solid var(--border)' }}>
                  <FileText size={14} color="#6366f1" />
                  <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <button onClick={() => removeFile(i)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="input-box">
            <button className="icon-btn" title="Upload Image" onClick={() => imageInputRef.current?.click()} style={{ marginBottom: '4px' }}>
              <ImageIcon size={20} />
            </button>
            <button className="icon-btn" title="Upload PDF" onClick={() => fileInputRef.current?.click()} style={{ marginBottom: '4px' }}>
              <FileText size={20} />
            </button>
            
            <textarea 
              placeholder={isUploading ? "Scanning file text..." : "Ask a question or paste your notes here..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isUploading}
              style={{ minHeight: '24px' }}
            />
            
            {isGenerating && !engineState ? (
              <button 
                className="send-btn" 
                onClick={handleStop}
                style={{ backgroundColor: '#ef4444', color: '#fff', borderRadius: '12px' }}
                title="Stop generating"
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button 
                className="send-btn" 
                onClick={handleSend}
                disabled={(!input.trim() && attachedFiles.length === 0) || isGenerating || isUploading}
                title="Send message"
              >
                <Send size={18} />
              </button>
            )}
          </div>
          <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '12px' }}>
            ByteBrain runs locally in your browser. All your data stays private.
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;
