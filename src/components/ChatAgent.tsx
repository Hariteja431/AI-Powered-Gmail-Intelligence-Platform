'use client';
import { useState } from 'react';
import Markdown from 'react-markdown';

export default function ChatAgent() {
  const [messages, setMessages] = useState<{role: 'user'|'assistant', content: string, sources?: any[]}[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMsg, history: messages })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.answer,
        sources: data.sources 
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackfill = async () => {
    setIsBackfilling(true);
    try {
      const res = await fetch('/api/embeddings/backfill', { method: 'POST' });
      const data = await res.json();
      alert(data.message);
    } catch (e) {
      alert('Error backfilling');
    } finally {
      setIsBackfilling(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white">
      <div className="p-4 border-b bg-indigo-50 flex justify-between items-center shrink-0">
        <h2 className="font-semibold text-indigo-900 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
          Inbox AI
        </h2>
        <button 
          onClick={handleBackfill}
          disabled={isBackfilling}
          className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded disabled:opacity-50"
        >
          {isBackfilling ? 'Indexing...' : 'Index Emails'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-10 text-sm">
            <p>Ask me anything about your emails.</p>
            <p className="mt-2 text-xs">Remember to "Index Emails" first so I can search them!</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] rounded-lg p-3 text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-900 shadow-sm'}`}>
                {m.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none text-gray-900">
                    <Markdown>{m.content}</Markdown>
                  </div>
                ) : (
                  m.content
                )}
              </div>
              {m.sources && m.sources.length > 0 && (
                <div className="text-[10px] text-gray-500 mt-1 ml-1 flex flex-wrap gap-1 max-w-full">
                  {Array.from(new Set(m.sources.map(s => s.subject))).map((subj, idx) => (
                    <span key={idx} className="bg-white border rounded px-1.5 py-0.5 truncate max-w-[250px]" title={subj as string}>
                      {subj as string}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex items-start">
            <div className="bg-white border shadow-sm rounded-lg p-3 text-sm text-gray-500 flex items-center">
              <svg className="animate-spin mr-2 h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Thinking...
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t bg-white shrink-0">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-gray-900"
            placeholder="Search inbox..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={isLoading}
          />
          <button 
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full w-9 h-9 flex items-center justify-center disabled:opacity-50 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
          </button>
        </form>
      </div>
    </div>
  );
}
