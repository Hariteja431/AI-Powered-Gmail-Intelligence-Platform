'use client';

import { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import ThreadView from './ThreadView';
import ChatAgent from './ChatAgent';

const CATEGORIES = [
  { name: 'All', icon: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4' },
  { name: 'Newsletters', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z' },
  { name: 'Job/Recruitment', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { name: 'Finance', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { name: 'Notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  { name: 'Personal', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { name: 'Work/Professional', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { name: 'Uncategorized', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }
];

export default function Dashboard({ user }: { user: { email: string } }) {
  const [status, setStatus] = useState<string>('idle');
  const [messageCount, setMessageCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [isCategorizing, setIsCategorizing] = useState<boolean>(false);
  const [threads, setThreads] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [categorizedCount, setCategorizedCount] = useState<number>(0);
  
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [digest, setDigest] = useState<string | null>(null);
  const [generatingDigestType, setGeneratingDigestType] = useState<'inbox' | 'newsletters' | null>(null);

  // Layout toggles for mobile
  const [showSidebar, setShowSidebar] = useState(false);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/sync/status');
        const data = await res.json();
        if (data.status) setStatus(data.status);
        if (data.message_count !== undefined) setMessageCount(data.message_count);
        
        if (data.status === 'syncing') {
          setIsSyncing(true);
        } else {
          setIsSyncing(false);
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchStatus();
    interval = setInterval(fetchStatus, 3000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchThreads = async () => {
    try {
      const res = await fetch(`/api/threads?category=${encodeURIComponent(activeCategory)}`);
      const data = await res.json();
      if (data.threads) {
        setThreads(data.threads);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchThreads();
    setSelectedThreadId(null);
  }, [activeCategory, messageCount]);

  const handleSync = async () => {
    setIsSyncing(true);
    setStatus('syncing');
    try {
      await fetch('/api/sync', { method: 'POST' });
    } catch (e) {
      console.error(e);
      setIsSyncing(false);
    }
  };

  const handleCategorize = async () => {
    setIsCategorizing(true);
    try {
      const res = await fetch('/api/categorize', { method: 'POST' });
      const data = await res.json();
      if (data.count > 0) {
        setCategorizedCount(prev => prev + data.count);
        fetchThreads();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCategorizing(false);
    }
  };

  const handleGenerateDigest = async (type: 'inbox' | 'newsletters') => {
    setGeneratingDigestType(type);
    try {
      const res = await fetch('/api/digest', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      const data = await res.json();
      setDigest(data.digest);
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingDigestType(null);
    }
  };

  return (
    <div className="flex h-full w-full bg-white relative">
      
      {/* Mobile Sidebar Toggle */}
      <button 
        className="md:hidden absolute top-4 left-4 z-50 p-2 bg-white rounded-md shadow-md border"
        onClick={() => setShowSidebar(!showSidebar)}
      >
        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
      </button>

      {/* Left Sidebar (Navigation & Tools) */}
      <aside className={`absolute md:relative z-40 bg-gray-50/50 border-r border-gray-200 w-64 h-full flex flex-col transition-transform transform ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        
        {/* Sync Action Area */}
        <div className="p-4">
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl shadow-sm transition-all disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isSyncing ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Syncing Inbox...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                Sync Emails
              </>
            )}
          </button>
        </div>

        {/* Categories Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-2">Folders</h3>
          {CATEGORIES.map(cat => (
            <button
              key={cat.name}
              onClick={() => { setActiveCategory(cat.name); setShowSidebar(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeCategory === cat.name 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={cat.icon}></path>
              </svg>
              {cat.name}
            </button>
          ))}

          {/* AI Tools Section */}
          <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-8">AI Tools</h3>
          
          <button 
            onClick={handleCategorize}
            disabled={isCategorizing || isSyncing}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50"
          >
            {isCategorizing ? (
              <svg className="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : (
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            )}
            Run Categorization
          </button>

          <button 
            onClick={() => handleGenerateDigest('inbox')}
            disabled={generatingDigestType !== null}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50/50 hover:bg-purple-100 rounded-lg transition-colors mt-1 disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            {generatingDigestType === 'inbox' ? 'Generating...' : 'Inbox Digest'}
          </button>

          <button 
            onClick={() => handleGenerateDigest('newsletters')}
            disabled={generatingDigestType !== null}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-teal-700 bg-teal-50/50 hover:bg-teal-100 rounded-lg transition-colors mt-1 disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path></svg>
            {generatingDigestType === 'newsletters' ? 'Deduplicating...' : 'Newsletter Digest'}
          </button>
        </div>

        {/* Stats Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
          <div className="flex justify-between mb-1">
            <span>Stored Messages</span>
            <span className="font-medium text-gray-700">{messageCount}</span>
          </div>
          <div className="flex justify-between">
            <span>Categorized Today</span>
            <span className="font-medium text-indigo-600">+{categorizedCount}</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area (Inbox List or Thread View) */}
      <section className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
        
        {digest && !selectedThreadId ? (
          <div className="absolute inset-0 z-20 bg-white overflow-y-auto p-8">
            <div className="max-w-3xl mx-auto">
              <div className="flex justify-between items-center mb-8 border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-900">AI Generated Digest</h2>
                <button onClick={() => setDigest(null)} className="text-gray-500 hover:text-gray-900">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
              <div className="prose prose-blue max-w-none prose-h3:text-lg prose-h3:mt-6 prose-a:text-blue-600">
                <Markdown>{digest}</Markdown>
              </div>
            </div>
          </div>
        ) : null}

        {selectedThreadId ? (
          <ThreadView threadId={selectedThreadId} onClose={() => setSelectedThreadId(null)} />
        ) : (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Inbox Header */}
            <div className="h-14 border-b border-gray-100 flex items-center justify-between px-6 shrink-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                {activeCategory}
                <span className="bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs font-medium">{threads.length}</span>
              </h2>
              <button 
                className="lg:hidden text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full"
                onClick={() => setShowChat(!showChat)}
              >
                AI Assistant
              </button>
            </div>

            {/* Email List */}
            <div className="flex-1 overflow-y-auto">
              {threads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <svg className="w-16 h-16 mb-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                  <p>No emails in {activeCategory}</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {threads.map(thread => (
                    <div 
                      key={thread.id} 
                      onClick={() => setSelectedThreadId(thread.id)}
                      className="group flex items-center gap-4 px-6 py-3 hover:bg-gray-50/80 cursor-pointer transition-colors"
                    >
                      <div className="w-48 shrink-0 flex items-center gap-2">
                        {/* Checkbox placeholder */}
                        <div className="w-4 h-4 rounded border border-gray-300 group-hover:border-gray-400"></div>
                        <span className="font-semibold text-gray-900 truncate">{thread.subject?.split(' - ')[0] || '(No Subject)'}</span>
                      </div>
                      
                      <div className="flex-1 flex items-center min-w-0">
                        {activeCategory === 'All' && thread.category && (
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 text-gray-500 mr-3">
                            {thread.category}
                          </span>
                        )}
                        <span className="font-medium text-gray-800 truncate mr-2">{thread.subject}</span>
                        <span className="text-gray-500 truncate">- {thread.snippet}</span>
                      </div>
                      
                      <div className="w-24 shrink-0 text-right text-sm text-gray-500 font-medium">
                        {new Date(thread.last_message_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Right Sidebar (Chat Agent) */}
      <aside className={`absolute lg:relative right-0 z-30 h-full w-80 lg:w-96 bg-white border-l border-gray-200 transition-transform transform ${showChat ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'} shadow-2xl lg:shadow-none flex flex-col`}>
        <div className="h-14 border-b border-gray-100 flex items-center justify-between px-4 bg-gray-50/50 shrink-0">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
            RAG Assistant
          </h2>
          <button className="lg:hidden p-1 text-gray-400 hover:text-gray-600" onClick={() => setShowChat(false)}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <div className="flex-1 overflow-hidden relative">
          {/* ChatAgent is position absolute inside its own file currently, let's just render it. 
              We'll update ChatAgent to take 100% height instead of fixed placement. */}
          <ChatAgent />
        </div>
      </aside>
      
      {/* Mobile Overlay */}
      {(showSidebar || showChat) && (
        <div 
          className="lg:hidden absolute inset-0 bg-black/20 z-20" 
          onClick={() => { setShowSidebar(false); setShowChat(false); }}
        />
      )}

    </div>
  );
}
