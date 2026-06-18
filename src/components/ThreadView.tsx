'use client';

import { useState, useEffect } from 'react';
import Markdown from 'react-markdown';

export default function ThreadView({ threadId, onClose }: { threadId: string, onClose: () => void }) {
  const [thread, setThread] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summarizingMessageIds, setSummarizingMessageIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const [instruction, setInstruction] = useState('');
  const [draft, setDraft] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  const [activeTab, setActiveTab] = useState<'reply' | 'chat'>('reply');
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);
  const [chatMessages, setChatMessages] = useState<{role: 'user'|'assistant', content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleChatSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsChatLoading(true);

    try {
      const threadContext = messages.map(m => `From: ${m.from_name || m.from_email}\nText: ${m.body_plain}`).join('\n\n');
      
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMsg, history: chatMessages, threadContext })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setChatMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (e: any) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  useEffect(() => {
    const fetchThread = async () => {
      try {
        const res = await fetch(`/api/threads/${threadId}`);
        const data = await res.json();
        setThread(data.thread);
        setMessages(data.messages || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchThread();
  }, [threadId]);

  const generateSummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const res = await fetch(`/api/threads/${threadId}`, { method: 'POST' });
      const data = await res.json();
      setSummary(data.summary);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const summarizeMessage = async (messageId: string) => {
    setSummarizingMessageIds(prev => ({ ...prev, [messageId]: true }));
    try {
      const res = await fetch(`/api/messages/${messageId}/summarize`, { method: 'POST' });
      const data = await res.json();
      if (data.summary) {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, email_summary: data.summary } : m));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSummarizingMessageIds(prev => ({ ...prev, [messageId]: false }));
    }
  };

  const handleDraft = async () => {
    setIsDrafting(true);
    setSendSuccess(false);
    try {
      const res = await fetch('/api/compose/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, instruction })
      });
      const data = await res.json();
      if (data.draft) setDraft(data.draft);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDrafting(false);
    }
  };

  const handleSend = async () => {
    setIsSending(true);
    try {
      const res = await fetch('/api/compose/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, body: draft })
      });
      const data = await res.json();
      if (data.result) {
        setSendSuccess(true);
        setDraft('');
        setInstruction('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  if (!thread) {
    return <div className="flex-1 flex items-center justify-center bg-white text-gray-500">Thread not found</div>;
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white relative">
      
      {/* Header */}
      <div className="h-16 px-4 border-b border-gray-100 flex items-center gap-4 bg-white shrink-0 sticky top-0 z-10">
        <button 
          onClick={onClose} 
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
          title="Back to inbox"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
        </button>
        <h2 className="text-xl font-medium text-gray-900 truncate pr-4">{thread.subject}</h2>
        {thread.category && (
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded bg-gray-100 text-gray-500">
            {thread.category}
          </span>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-4xl mx-auto py-6 px-4 md:px-8 space-y-8">
          
          {/* AI Summary Card */}
          <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                </div>
                AI Summary
              </h3>
              {!summary && (
                <button 
                  onClick={generateSummary}
                  disabled={isGeneratingSummary}
                  className="text-sm bg-white hover:bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center shadow-sm"
                >
                  {isGeneratingSummary && (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {isGeneratingSummary ? 'Analyzing Thread...' : 'Summarize Thread'}
                </button>
              )}
            </div>
            {summary ? (
              <div className="text-sm text-gray-800 prose prose-blue max-w-none">
                <Markdown>{summary}</Markdown>
              </div>
            ) : (
              <p className="text-sm text-blue-700/70">Generate an AI summary to quickly catch up on this thread.</p>
            )}
          </div>

          {/* Messages */}
          <div className="space-y-6">
            {messages.map((msg, i) => (
              <div key={msg.id} className="bg-white">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold uppercase shrink-0">
                      {(msg.from_name || msg.from_email).charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 leading-none mb-1">{msg.from_name || msg.from_email.split('@')[0]}</p>
                      <p className="text-xs text-gray-500">&lt;{msg.from_email}&gt;</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-gray-500 font-medium">{new Date(msg.internal_date).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                    {!msg.email_summary && (
                      <button 
                        onClick={() => summarizeMessage(msg.id)}
                        disabled={summarizingMessageIds[msg.id]}
                        className="text-xs flex items-center gap-1 bg-purple-50 hover:bg-purple-100 text-purple-700 px-2 py-1 rounded transition-colors disabled:opacity-50"
                        title="Summarize this single email"
                      >
                        {summarizingMessageIds[msg.id] ? (
                          <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        )}
                        ✨ Summarize
                      </button>
                    )}
                  </div>
                </div>

                {msg.email_summary && (
                  <div className="ml-13 mb-4 bg-purple-50/50 border border-purple-100 rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-purple-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                      Message Summary
                    </h4>
                    <p className="text-sm text-gray-700">{msg.email_summary}</p>
                  </div>
                )}
                
                <div className="mt-3 md:ml-13 mb-6">
                  <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm w-full">
                    {msg.body_html ? (
                      <iframe 
                        title={`email-body-${msg.id}`}
                        srcDoc={`<meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body { margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; word-wrap: break-word; } img { max-width: 100% !important; height: auto !important; } table { max-width: 100% !important; box-sizing: border-box; }</style>${msg.body_html}`}
                        className="w-full min-h-[500px] border-none bg-white"
                        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                      />
                    ) : (
                      <div className="whitespace-pre-wrap break-words p-4 text-sm text-gray-800">{msg.body_plain || 'No body available.'}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Action Area */}
      <div className="border-t border-gray-200 bg-white shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-4 pt-2 max-w-4xl mx-auto w-full items-center justify-between">
          <div className="flex">
            <button 
              onClick={() => { setActiveTab('reply'); setIsPanelExpanded(true); }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'reply' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Reply with AI
            </button>
            <button 
              onClick={() => { setActiveTab('chat'); setIsPanelExpanded(true); }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'chat' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
              Chat about Email
            </button>
          </div>
          <button 
            onClick={() => setIsPanelExpanded(!isPanelExpanded)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            title={isPanelExpanded ? "Collapse panel" : "Expand panel"}
          >
            {isPanelExpanded ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg>
            )}
          </button>
        </div>

        {/* Tab Content */}
        {isPanelExpanded && (
        <div className="p-4 max-w-4xl mx-auto w-full">
          {activeTab === 'reply' ? (
            <>
              {sendSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-xl text-sm mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  Reply sent successfully via Gmail!
                </div>
              )}
              
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Instruct AI to draft a reply (e.g. 'Say yes and suggest meeting Tuesday at 2pm')" 
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm bg-gray-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                    value={instruction}
                    onChange={e => setInstruction(e.target.value)}
                    disabled={isDrafting || isSending}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && instruction && !isDrafting && !isSending) {
                        handleDraft();
                      }
                    }}
                  />
                </div>
                <button 
                  onClick={handleDraft}
                  disabled={isDrafting || isSending || !instruction}
                  className="bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-xl text-sm font-medium disabled:opacity-50 transition-all shadow-sm flex items-center shrink-0"
                >
                  {isDrafting ? 'Drafting...' : 'Generate Draft'}
                </button>
              </div>

              {draft && (
                <div className="mt-4 animate-in slide-in-from-bottom-2 fade-in duration-200">
                  <textarea 
                    className="w-full border border-gray-300 rounded-xl p-4 text-sm min-h-[200px] font-sans bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    disabled={isSending}
                  />
                  <div className="flex justify-between items-center mt-3">
                    <p className="text-xs text-gray-500">You can edit the AI draft above before sending.</p>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setDraft('')}
                        disabled={isSending}
                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                      >
                        Discard
                      </button>
                      <button 
                        onClick={handleSend}
                        disabled={isSending || !draft}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium shadow-sm disabled:opacity-50 transition-all flex items-center"
                      >
                        {isSending ? 'Sending...' : 'Send via Gmail'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col max-h-[40vh] min-h-[300px]">
              <div className="flex-1 overflow-y-auto mb-3 space-y-4 pr-2">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm py-8">
                    <svg className="w-12 h-12 mb-3 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                    <p className="font-medium text-gray-900 mb-1">Chat about this email thread</p>
                    <p>Ask questions, request translations, or get clarifications.</p>
                  </div>
                ) : (
                  chatMessages.map((m, i) => (
                    <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl p-3.5 text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-gray-100 text-gray-900 rounded-bl-none shadow-sm'}`}>
                        {m.role === 'assistant' ? (
                          <div className="prose prose-sm max-w-none text-gray-900">
                            <Markdown>{m.content}</Markdown>
                          </div>
                        ) : (
                          m.content
                        )}
                      </div>
                    </div>
                  ))
                )}
                {isChatLoading && (
                  <div className="flex items-start">
                    <div className="bg-gray-100 shadow-sm rounded-2xl rounded-bl-none p-3.5 text-sm text-gray-500 flex items-center">
                      <svg className="animate-spin mr-2 h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Thinking...
                    </div>
                  </div>
                )}
              </div>
              <form onSubmit={handleChatSend} className="flex gap-2 shrink-0">
                <input
                  type="text"
                  className="flex-1 border border-gray-300 rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm text-gray-900 transition-all"
                  placeholder="Ask a question about this email..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  disabled={isChatLoading}
                />
                <button 
                  type="submit"
                  disabled={!chatInput.trim() || isChatLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center w-11 h-11"
                >
                  <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                </button>
              </form>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
