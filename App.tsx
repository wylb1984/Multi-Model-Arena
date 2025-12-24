
import React, { useState, useRef, useEffect } from 'react';
import { AVAILABLE_MODELS } from './constants';
import { Turn, Attachment, Message } from './types';
import { ChatTurn } from './components/ChatColumn';
import { InputArea } from './components/InputArea';
import { streamModelResponse, getHistoryForModel } from './services/geminiService';

export default function App() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeModelIds, setActiveModelIds] = useState<string[]>(
    AVAILABLE_MODELS.map(m => m.id)
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, isGenerating]);

  const handleToggleSelection = (turnId: string, modelId: string) => {
    if (isGenerating && turnId === turns[turns.length - 1]?.id) return;

    let newIsSelected = false;

    setTurns(prev => prev.map((turn, index) => {
      if (turn.id !== turnId) return turn;
      
      const isSelected = turn.selectedModelIds.includes(modelId);
      let newSelectedIds;
      if (isSelected) {
        newSelectedIds = turn.selectedModelIds.filter(id => id !== modelId);
        newIsSelected = false;
      } else {
        newSelectedIds = [...turn.selectedModelIds, modelId];
        newIsSelected = true;
      }
      
      // If this is the last turn, sync the global active state
      if (index === prev.length - 1) {
         setActiveModelIds(current => {
             if (newIsSelected && !current.includes(modelId)) return [...current, modelId];
             if (!newIsSelected && current.includes(modelId)) return current.filter(id => id !== modelId);
             return current;
         });
      }

      return { ...turn, selectedModelIds: newSelectedIds };
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
    if (turns.length > 0) {
        setTurns(prev => {
            const lastIndex = prev.length - 1;
            const lastTurn = prev[lastIndex];
            
            const newSelectedIds = isCurrentlyActive 
                ? lastTurn.selectedModelIds.filter(id => id !== modelId)
                : Array.from(new Set([...lastTurn.selectedModelIds, modelId]));
            
            const newLastTurn = { ...lastTurn, selectedModelIds: newSelectedIds };
            return [...prev.slice(0, lastIndex), newLastTurn];
        });
    }
  };

  const handleSend = async (text: string, attachments: Attachment[]) => {
    if (isGenerating) return;

    if (activeModelIds.length === 0) {
      alert("Please select at least one model to generate a response.");
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

    setTurns(prev => [...prev, newTurn]);

    const currentTurns = [...turns]; 

    const promises = targetModels.map(async (model) => {
      try {
        const previousHistory = getHistoryForModel(model.id, currentTurns);
        const fullHistory = [...previousHistory, userMsg];

        setTurns(prev => prev.map(t => {
          if (t.id !== turnId) return t;
          return {
            ...t,
            candidates: {
              ...t.candidates,
              [model.id]: { ...t.candidates[model.id], status: 'streaming' }
            }
          };
        }));

        await streamModelResponse(model, fullHistory, (chunkText) => {
          setTurns(prev => prev.map(t => {
            if (t.id !== turnId) return t;
            return {
              ...t,
              candidates: {
                ...t.candidates,
                [model.id]: { 
                  ...t.candidates[model.id], 
                  content: chunkText 
                }
              }
            };
          }));
        });

        setTurns(prev => prev.map(t => {
          if (t.id !== turnId) return t;
          return {
            ...t,
            candidates: {
              ...t.candidates,
              [model.id]: { ...t.candidates[model.id], status: 'complete' }
            }
          };
        }));

      } catch (error) {
        console.error(`Error in model ${model.name}:`, error);
        setTurns(prev => prev.map(t => {
          if (t.id !== turnId) return t;
          return {
            ...t,
            candidates: {
              ...t.candidates,
              [model.id]: { ...t.candidates[model.id], status: 'error' }
            }
          };
        }));
      }
    });

    await Promise.all(promises);
    setIsGenerating(false);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      {/* Top Header */}
      <header className="h-16 shrink-0 border-b border-gray-800 flex items-center px-4 sm:px-6 justify-between bg-gray-900 shadow-sm z-30">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
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

      {/* Main Content - Expanded for 4-column display */}
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
                    在同一屏幕下对比 <span className="text-blue-400 font-medium">通义千问</span>、<span className="text-emerald-400 font-medium">Kimi</span>、<span className="text-indigo-400 font-medium">DeepSeek</span> 和 <span className="text-pink-400 font-medium">豆包</span> 的实时回答。
                    <br/><br/>
                    在上方选择模型开启对话。
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
  );
}
