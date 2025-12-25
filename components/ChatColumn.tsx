
import React, { useState, useEffect } from 'react';
import { Turn, ModelConfig } from '../types';

interface ChatTurnProps {
  turn: Turn;
  configs: ModelConfig[];
  onToggleSelection: (turnId: string, modelId: string) => void;
  onRegenerate: (turnId: string, modelId: string) => void;
  onFeedback: (turnId: string, modelId: string, feedback: 'like' | 'dislike' | null) => void;
  isLast: boolean;
}

export const ChatTurn: React.FC<ChatTurnProps> = ({ turn, configs, onToggleSelection, onRegenerate, onFeedback, isLast }) => {
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  
  // Sort configs to maintain consistent order, but only show those present in this turn
  const activeConfigs = configs.filter(c => turn.candidates[c.id]);

  // Prevent scrolling when modal is open
  useEffect(() => {
    if (expandedModelId) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [expandedModelId]);

  const handleCopy = (modelId: string, content: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(content).then(() => {
      setCopyingId(modelId);
      setTimeout(() => setCopyingId(null), 2000);
    });
  };

  return (
    <div className="flex flex-col gap-4 py-8 border-b border-gray-800/50 last:border-0">
      {/* User Message */}
      <div className="flex flex-col items-end px-4 mb-4">
        <div className="max-w-[90%] sm:max-w-[75%] lg:max-w-[60%]">
           <div className="bg-blue-600 text-white rounded-2xl rounded-br-sm px-5 py-3 text-sm shadow-lg">
            {turn.userMessage.attachments && turn.userMessage.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3 justify-end">
                  {turn.userMessage.attachments.map((att, i) => (
                    <div key={i} className="rounded-lg overflow-hidden border border-white/20 shadow-sm">
                      {att.type === 'image' ? (
                        <img src={att.url} alt="User upload" className="h-20 w-20 object-cover" />
                      ) : (
                        <video src={att.url} className="h-20 w-20 bg-black object-cover" />
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="whitespace-pre-wrap break-words leading-relaxed font-medium">{turn.userMessage.content}</div>
           </div>
        </div>
      </div>

      {/* Model Responses Grid */}
      <div className="px-2 sm:px-4 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {activeConfigs.map(config => {
            const response = turn.candidates[config.id];
            const isSelected = turn.selectedModelIds.includes(config.id);
            const isLike = response.feedback === 'like';
            const isDislike = response.feedback === 'dislike';

            return (
              <div 
                key={config.id} 
                className={`flex flex-col rounded-2xl border transition-all duration-300 overflow-hidden relative min-h-[300px] h-[45vh] lg:h-[60vh] group ${
                  isSelected 
                    ? 'bg-gray-800/90 border-gray-600 shadow-xl ring-1 ring-gray-700/50' 
                    : 'bg-gray-900/40 border-gray-800 opacity-60 grayscale-[0.3] hover:opacity-100 hover:grayscale-0'
                }`}
              >
                {/* Header */}
                <div className={`flex items-center justify-between p-3 border-b border-gray-700/30 shrink-0 ${isSelected ? 'bg-gray-800' : 'bg-transparent'}`}>
                   <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-white text-[11px] font-bold ${config.color} shrink-0 shadow-md`}>
                        {config.avatar}
                      </div>
                      <div className="flex flex-col leading-tight overflow-hidden">
                        <span className="font-bold text-xs text-gray-100 truncate">{config.name}</span>
                        <span className="text-[9px] text-gray-500 truncate uppercase tracking-tighter">{config.provider}</span>
                      </div>
                   </div>
                   
                   <label className="flex items-center gap-1.5 cursor-pointer z-10" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => onToggleSelection(turn.id, config.id)}
                        className="peer sr-only"
                      />
                      <div className="w-8 h-4.5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-600 relative"></div>
                   </label>
                </div>

                {/* Adaptive Body */}
                <div 
                  className="p-4 text-sm text-gray-300 leading-relaxed overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-700 hover:scrollbar-thumb-gray-600 scrollbar-track-transparent custom-scroll-area"
                  onDoubleClick={() => setExpandedModelId(config.id)}
                >
                   <div className="break-words pb-4">
                     {response.content ? (
                        <div className="whitespace-pre-wrap">{response.content}</div>
                     ) : (
                        response.status === 'loading' ? (
                          <div className="flex flex-col gap-3 animate-pulse py-2">
                            <div className="h-2.5 bg-gray-700 rounded w-full"></div>
                            <div className="h-2.5 bg-gray-700 rounded w-4/5"></div>
                            <div className="h-2.5 bg-gray-700 rounded w-full"></div>
                            <div className="h-2.5 bg-gray-700 rounded w-3/4"></div>
                          </div>
                        ) : null
                     )}
                     {response.status === 'streaming' && (
                        <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse rounded-sm"></span>
                     )}
                     {response.status === 'error' && (
                        <div className="text-red-400 bg-red-400/10 p-3 rounded-lg border border-red-400/20 text-xs">
                           生成回答时发生错误，请重试。
                        </div>
                     )}
                   </div>
                </div>

                {/* Action Toolbar */}
                <div className="px-3 py-2 border-t border-gray-700/20 bg-gray-950/20 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleCopy(config.id, response.content, e)}
                      className={`p-1.5 rounded-lg transition-all ${copyingId === config.id ? 'text-emerald-400 bg-emerald-400/10' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'}`}
                      title="复制回答"
                    >
                      {copyingId === config.id ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onRegenerate(turn.id, config.id); }}
                      className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-all"
                      title="重推回答"
                      disabled={response.status === 'loading' || response.status === 'streaming'}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onFeedback(turn.id, config.id, isLike ? null : 'like'); }}
                      className={`p-1.5 rounded-lg transition-all ${isLike ? 'text-blue-400 bg-blue-400/10 shadow-sm' : 'text-gray-500 hover:text-blue-400 hover:bg-gray-800'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill={isLike ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5v2.25a.75.75 0 00.75.75h2.25a2.25 2.25 0 012.25 2.25v.75a2.25 2.25 0 01-2.25 2.25h-.75a.75.75 0 00-.75.75V15a2.25 2.25 0 01-2.25 2.25h-4.5a2.25 2.25 0 01-1.5-.572l-1.613-1.45a2.25 2.25 0 00-1.5-.578H6.633c-1.246 0-2.25-1.004-2.25-2.25v-3c0-1.246 1.004-2.25 2.25-2.25z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onFeedback(turn.id, config.id, isDislike ? null : 'dislike'); }}
                      className={`p-1.5 rounded-lg transition-all ${isDislike ? 'text-red-400 bg-red-400/10 shadow-sm' : 'text-gray-500 hover:text-red-400 hover:bg-gray-800'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill={isDislike ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 13.5l-3.836-3.836a2.625 2.625 0 010-3.712L7.5 2.112a2.625 2.625 0 013.712 0L13.5 5.926l3.836-3.836a2.625 2.625 0 013.712 0l3.836 3.836a2.625 2.625 0 010 3.712L21 13.5l-3.836 3.836a2.625 2.625 0 01-3.712 0L13.5 13.5z" style={{ display: 'none' }} /* Note: I'll use a better path for dislike below */ />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.367 13.5c-.806 0-1.533.446-2.031 1.08a9.041 9.041 0 01-2.861 2.4c-.723.384-1.35.956-1.653 1.715a4.498 4.498 0 00-.322 1.672V21a.75.75 0 01-.75.75A2.25 2.25 0 017.5 19.5v-2.25a.75.75 0 00-.75-.75H4.5a2.25 2.25 0 01-2.25-2.25v-.75a2.25 2.25 0 012.25-2.25h.75a.75.75 0 00.75-.75V9a2.25 2.25 0 012.25-2.25h4.5a2.25 2.25 0 011.5.572l1.613 1.45a2.25 2.25 0 001.5.578h1.217c1.246 0 2.25 1.004 2.25 2.25v3c0 1.246-1.004 2.25-2.25 2.25z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail Modal Overlay */}
      {expandedModelId && (() => {
        const config = activeConfigs.find(c => c.id === expandedModelId);
        const response = turn.candidates[expandedModelId];
        const isSelected = turn.selectedModelIds.includes(expandedModelId);
        
        if (!config || !response) return null;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
             <div 
                className="bg-gray-900 border border-gray-700 rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden"
                onClick={(e) => e.stopPropagation()}
             >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                   <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl font-bold ${config.color} shadow-lg ring-1 ring-white/10`}>
                        {config.avatar}
                      </div>
                      <div>
                        <h3 className="font-black text-gray-100 text-xl tracking-tight">{config.name}</h3>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">{config.provider} • {config.description}</p>
                      </div>
                   </div>
                   <button 
                     onClick={() => setExpandedModelId(null)}
                     className="p-2.5 rounded-full hover:bg-gray-800 text-gray-500 hover:text-white transition-all transform hover:rotate-90"
                   >
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                       <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                     </svg>
                   </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-8 text-base sm:text-lg text-gray-200 leading-relaxed scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                   <div className="whitespace-pre-wrap break-words max-w-none prose prose-invert font-light">
                     {response.content}
                     {response.status === 'streaming' && <span className="typing-cursor ml-1">▋</span>}
                   </div>
                </div>

                {/* Modal Footer */}
                <div className="p-6 border-t border-gray-800 bg-gray-950/40 flex justify-between items-center">
                    <div className="text-[10px] text-gray-500 px-3 py-1 bg-gray-800 rounded-full font-mono uppercase tracking-widest">
                      {response.content.length} characters
                    </div>
                    <label className="flex items-center gap-4 cursor-pointer group bg-blue-600/10 hover:bg-blue-600/20 px-6 py-3 rounded-2xl border border-blue-500/30 transition-all shadow-inner">
                      <span className="text-sm font-bold text-blue-400 group-hover:text-blue-300">
                        {isSelected ? 'Selected for Next Turn' : 'Enable for Next Turn'}
                      </span>
                      <div className="relative flex items-center">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => onToggleSelection(turn.id, config.id)}
                          className="peer sr-only"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 shadow-md"></div>
                      </div>
                   </label>
                </div>
             </div>
             
             {/* Backdrop Close Click */}
             <div className="absolute inset-0 -z-10" onClick={() => setExpandedModelId(null)}></div>
          </div>
        );
      })()}
    </div>
  );
};
