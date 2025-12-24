
import React, { useState, useEffect } from 'react';
import { Turn, ModelConfig } from '../types';

interface ChatTurnProps {
  turn: Turn;
  configs: ModelConfig[];
  onToggleSelection: (turnId: string, modelId: string) => void;
  isLast: boolean;
}

export const ChatTurn: React.FC<ChatTurnProps> = ({ turn, configs, onToggleSelection, isLast }) => {
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null);
  
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

  const handleCardClick = (modelId: string, e: React.MouseEvent) => {
    // Only open modal if double clicked or if specifically clicking the content area
    // This allows single clicks for selection without popping the modal every time
    // But for this UI, we'll keep the single click expand as the primary "read more" trigger 
    // but make the card itself scrollable so they don't *have* to expand.
    if ((e.target as HTMLElement).closest('label')) return;
    // setExpandedModelId(modelId); // Optional: disabled for now to favor in-column scrolling
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

      {/* Model Responses Grid (4 Columns + Screen Adapting Height) */}
      <div className="px-2 sm:px-4 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {activeConfigs.map(config => {
            const response = turn.candidates[config.id];
            const isSelected = turn.selectedModelIds.includes(config.id);

            return (
              <div 
                key={config.id} 
                className={`flex flex-col rounded-2xl border transition-all duration-300 overflow-hidden relative min-h-[300px] h-[40vh] lg:h-[55vh] ${
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

                {/* Adaptive Body with Internal Scroll */}
                <div 
                  className="p-4 text-sm text-gray-300 leading-relaxed overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-700 hover:scrollbar-thumb-gray-600 scrollbar-track-transparent custom-scroll-area"
                  onDoubleClick={() => setExpandedModelId(config.id)}
                  title="Double click to expand"
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

                {/* Optional: Expand Button Overlay */}
                <button 
                  onClick={() => setExpandedModelId(config.id)}
                  className="absolute bottom-3 right-3 p-1.5 bg-gray-800/80 hover:bg-gray-700 border border-gray-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white"
                  style={{ opacity: 'var(--expand-btn-opacity, 0)' }} // Using a simple CSS variable or just rely on CSS
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                </button>
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
