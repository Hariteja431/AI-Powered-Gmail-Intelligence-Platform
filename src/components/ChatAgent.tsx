'use client';
import { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';

export default function ChatAgent({ onSourceClick }: { onSourceClick?: (threadId: string) => void }) {
  const [messages, setMessages] = useState<{role: 'user'|'assistant', content: string, sources?: any[]}[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const hasAutoIndexed = useRef(false);

  useEffect(() => {
    if (!hasAutoIndexed.current) {
      hasAutoIndexed.current = true;
      handleBackfill(true);
    }
  }, []);

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

  const handleBackfill = async (isAuto = false) => {
    setIsBackfilling(true);
    try {
      const res = await fetch('/api/embeddings/backfill', { method: 'POST' });
      const data = await res.json();
      if (!isAuto) {
        if (data.count === 0 && !data.hasMore) {
          alert('All emails are already indexed!');
        } else {
          alert(`Successfully indexed ${data.count} emails! Click again to index the next batch.`);
        }
      }
    } catch (e) {
      if (!isAuto) alert('Error backfilling');
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
          onClick={() => handleBackfill(false)}
          disabled={isBackfilling}
          className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded disabled:opacity-50"
        >
          {isBackfilling ? 'Indexing...' : 'Index Emails'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 px-6">
            <svg className="w-16 h-16 mb-4 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Inbox AI Assistant</h3>
            <p className="text-sm mb-4">Ask me anything about your emails. I use AI to search and find answers based on your indexed messages.</p>
            <div className="bg-indigo-50 text-indigo-800 p-3 rounded-lg text-xs max-w-sm text-left border border-indigo-100 shadow-sm mt-2">
              <span className="font-semibold block mb-1">💡 How Indexing works:</span>
              To save your API tokens, we only automatically index your first 20 emails. 
              If you want the AI to search deeper into your inbox history, just click the <strong>"Index Emails"</strong> button above to load the next batch of 20 emails!
            </div>
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
                  {Array.from(new Map(m.sources.map(s => [s.thread_id, s])).values()).map((src: any, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => onSourceClick && onSourceClick(src.thread_id)}
                      className="bg-white hover:bg-gray-100 border rounded px-1.5 py-0.5 truncate max-w-[250px] cursor-pointer transition-colors text-left" 
                      title={src.subject}
                    >
                      {src.subject}
                    </button>
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
