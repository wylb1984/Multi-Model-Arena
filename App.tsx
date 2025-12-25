
import React, { useState, useRef, useEffect } from 'react';
import { AVAILABLE_MODELS } from './constants';
import { Turn, Attachment, Message, ChatSession } from './types';
import { ChatTurn } from './components/ChatColumn';
import { InputArea } from './components/InputArea';
import { Sidebar } from './components/Sidebar';
import { streamModelResponse, getHistoryForModel } from './services/geminiService';

const STORAGE_KEY = 'ai_arena_sessions';

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeModelIds, setActiveModelIds] = useState<string[]>(
    AVAILABLE_MODELS.map(m => m.id)
  );
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ChatSession[];
        setSessions(parsed);
        if (parsed.length > 0) {
          setActiveSessionId(parsed[0].id);
        }
      } catch (e) {
        console.error("Failed to load sessions", e);
      }
    }
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  // Current active session turns
  const activeSession = sessions.find(s => s.id === activeSessionId);
  const turns = activeSession?.turns || [];

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, isGenerating]);

  const handleNewChat = () => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: '新对话',
      turns: [],
      updatedAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    setActiveModelIds(AVAILABLE_MODELS.map(m => m.id));
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
    const session = sessions.find(s => s.id === id);
    if (session && session.turns.length > 0) {
      setActiveModelIds(session.turns[session.turns.length - 1].selectedModelIds);
    }
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定要删除这段对话记录吗？")) return;
    
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (activeSessionId === id) {
        setActiveSessionId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  };

  const handleToggleSelection = (turnId: string, modelId: string) => {
    if (isGenerating && turnId === turns[turns.length - 1]?.id) return;

    setSessions(prev => prev.map(session => {
      if (session.id !== activeSessionId) return session;
      
      const newTurns = session.turns.map((turn, index) => {
        if (turn.id !== turnId) return turn;
        
        const isSelected = turn.selectedModelIds.includes(modelId);
        const newSelectedIds = isSelected
          ? turn.selectedModelIds.filter(id => id !== modelId)
          : [...turn.selectedModelIds, modelId];

        // Sync global active state if it's the last turn
        if (index === session.turns.length - 1) {
          setActiveModelIds(newSelectedIds);
        }
        
        return { ...turn, selectedModelIds: newSelectedIds };
      });

      return { ...session, turns: newTurns };
    }));
  };

  const toggleActiveModel = (modelId: string) => {
    if (isGenerating) return;

    const isCurrentlyActive = activeModelIds.includes(modelId);
    const newActiveIds = isCurrentlyActive 
        ? activeModelIds.filter(id => id !== modelId)
        : [...activeModelIds, modelId];
    
    setActiveModelIds(newActiveIds);

    // Also sync the visual checkbox of the last turn if it exists
    if (activeSessionId) {
      setSessions(prev => prev.map(s => {
        if (s.id !== activeSessionId || s.turns.length === 0) return s;
        const lastIndex = s.turns.length - 1;
        const lastTurn = s.turns[lastIndex];
        const newSelectedIds = isCurrentlyActive 
          ? lastTurn.selectedModelIds.filter(id => id !== modelId)
          : Array.from(new Set([...lastTurn.selectedModelIds, modelId]));
        
        const newTurns = [...s.turns];
        newTurns[lastIndex] = { ...lastTurn, selectedModelIds: newSelectedIds };
        return { ...s, turns: newTurns };
      }));
    }
  };

  const handleSend = async (text: string, attachments: Attachment[]) => {
    if (isGenerating) return;

    let currentSessionId = activeSessionId;
    
    // Create new session if none exists
    if (!currentSessionId) {
      const newId = `session-${Date.now()}`;
      const newSession: ChatSession = {
        id: newId,
        title: text.slice(0, 20) + (text.length > 20 ? '...' : ''),
        turns: [],
        updatedAt: Date.now()
      };
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newId);
      currentSessionId = newId;
    }

    if (activeModelIds.length === 0) {
      alert("请至少选择一个模型进行对话。");
      return;
    }

    setIsGenerating(true);
    const timestamp = Date.now();
    const turnId = `turn-${timestamp}`;

    const targetModelIds = [...activeModelIds];
    const targetModels = AVAILABLE_MODELS.filter(m => targetModelIds.includes(m.id));

    const userMsg: Message = { 
      role: 'user', 
      content: text, 
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp 
    };

    const newTurn: Turn = {
      id: turnId,
      timestamp,
      userMessage: userMsg,
      candidates: {},
      selectedModelIds: targetModelIds,
    };

    targetModelIds.forEach(id => {
      newTurn.candidates[id] = {
        modelId: id,
        content: '',
        status: 'loading'
      };
    });

    // Update session state with new turn
    setSessions(prev => prev.map(s => {
      if (s.id !== currentSessionId) return s;
      return {
        ...s,
        title: s.turns.length === 0 ? text.slice(0, 25).trim() + (text.length > 25 ? '...' : '') : s.title,
        turns: [...s.turns, newTurn],
        updatedAt: Date.now()
      };
    }));

    // Start generating for each model
    const promises = targetModels.map(async (model) => {
      try {
        // Fetch the current turns for history reconstruction
        // Note: we use currentSession reference from state
        const sess = sessions.find(s => s.id === currentSessionId);
        const previousHistory = getHistoryForModel(model.id, sess?.turns || []);
        const fullHistory = [...previousHistory, userMsg];

        const updateModelStatus = (status: 'streaming' | 'complete' | 'error', content?: string) => {
          setSessions(prev => prev.map(s => {
            if (s.id !== currentSessionId) return s;
            const newTurns = s.turns.map(t => {
              if (t.id !== turnId) return t;
              return {
                ...t,
                candidates: {
                  ...t.candidates,
                  [model.id]: { 
                    ...t.candidates[model.id], 
                    status,
                    content: content !== undefined ? content : t.candidates[model.id].content 
                  }
                }
              };
            });
            return { ...s, turns: newTurns, updatedAt: Date.now() };
          }));
        };

        updateModelStatus('streaming');

        await streamModelResponse(model, fullHistory, (chunkText) => {
          updateModelStatus('streaming', chunkText);
        });

        updateModelStatus('complete');

      } catch (error) {
        console.error(`Error in model ${model.name}:`, error);
        setSessions(prev => prev.map(s => {
          if (s.id !== currentSessionId) return s;
          const newTurns = s.turns.map(t => {
            if (t.id !== turnId) return t;
            return {
              ...t,
              candidates: {
                ...t.candidates,
                [model.id]: { ...t.candidates[model.id], status: 'error' }
              }
            };
          });
          return { ...s, turns: newTurns };
        }));
      }
    });

    await Promise.all(promises);
    setIsGenerating(false);
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* Sidebar for session management */}
      <Sidebar 
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 shrink-0 border-b border-gray-800 flex items-center px-4 sm:px-6 justify-between bg-gray-900 shadow-sm z-30">
          <div className="flex items-center gap-3">
              {/* Sidebar Toggle (Mobile/Tablet) */}
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 -ml-2 text-gray-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
              
              <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20 hidden xs:flex">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
              </div>
              <h1 className="font-bold text-lg tracking-tight hidden sm:block">AI Arena</h1>
          </div>

          {/* Model Selector in Header */}
          <div className="flex items-center gap-1 sm:gap-2 bg-gray-800/50 p-1 rounded-xl border border-gray-700/50">
            {AVAILABLE_MODELS.map(model => {
              const isActive = activeModelIds.includes(model.id);
              return (
                <button
                  key={model.id}
                  onClick={() => toggleActiveModel(model.id)}
                  className={`
                    relative flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg transition-all duration-200 border
                    ${isActive 
                      ? 'bg-gray-700 border-gray-600 text-white shadow-sm' 
                      : 'bg-transparent border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                    }
                  `}
                  title={isActive ? `Disable ${model.name}` : `Enable ${model.name}`}
                >
                  <div className={`
                    w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all
                    ${isActive ? model.color : 'bg-gray-600 grayscale'}
                  `}>
                    {model.avatar}
                  </div>
                  <span className={`text-xs font-medium hidden md:inline ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                    {model.name}
                  </span>
                  
                  {isActive && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500 border border-gray-900"></span>
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="w-8 hidden sm:block"></div>
        </header>

        {/* Main Content Area */}
        <main 
          ref={scrollRef}
          className="flex-1 overflow-y-auto w-full relative scroll-smooth pb-4"
        >
           <div className="max-w-[1400px] mx-auto w-full px-2 sm:px-6">
              {turns.length === 0 && (
                 <div className="flex flex-col items-center justify-center h-[60vh] text-gray-600 px-6 text-center animate-in fade-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-gray-900 rounded-3xl flex items-center justify-center mb-6 shadow-2xl border border-gray-800">
                      <span className="text-3xl">⚔️</span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-200 mb-3">Model Arena</h2>
                    <p className="max-w-md text-gray-400 leading-relaxed">
                      在同一屏幕下对比主流大模型的回答。
                      <br/>
                      支持 <span className="text-blue-400">通义千问</span>、<span className="text-emerald-400">Kimi</span>、<span className="text-indigo-400">DeepSeek</span> 和 <span className="text-pink-400">豆包</span>。
                      <br/><br/>
                      在上方选择模型开启对话，点击左侧图标可查看历史会话。
                    </p>
                 </div>
              )}

              {turns.map((turn, index) => (
                <ChatTurn
                  key={turn.id}
                  turn={turn}
                  configs={AVAILABLE_MODELS}
                  onToggleSelection={handleToggleSelection}
                  isLast={index === turns.length - 1}
                />
              ))}
           </div>
        </main>

        {/* Input Footer */}
        <InputArea onSend={handleSend} disabled={isGenerating} />
      </div>
    </div>
  );
}
