
import React, { useState, useMemo } from 'react';
import { ChatSession } from '../types';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  sessions, 
  activeSessionId, 
  onSelectSession, 
  onNewChat, 
  onDeleteSession,
  onRenameSession,
  isOpen,
  onClose
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => 
      s.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [sessions, searchQuery]);

  const startEditing = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditValue(title);
  };

  const handleRename = (id: string) => {
    if (editValue.trim()) {
      onRenameSession(id, editValue.trim());
    }
    setEditingId(null);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* New Chat Button */}
        <div className="p-4 space-y-3">
          <button
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-900/20 transition-all active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            开启新对话
          </button>

          {/* Search Input */}
          <div className="relative group">
            <input
              type="text"
              placeholder="搜索对话历史..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-9 pr-3 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
            />
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 absolute left-3 top-2.5 text-gray-500 group-focus-within:text-blue-400 transition-colors">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-800">
          <div className="px-3 mb-2">
            <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">历史对话</h2>
          </div>
          
          {filteredSessions.length === 0 ? (
            <div className="px-3 py-10 text-center">
              <p className="text-xs text-gray-600">
                {searchQuery ? '未找到相关对话' : '暂无历史记录'}
              </p>
            </div>
          ) : (
            filteredSessions.map(session => (
              <div
                key={session.id}
                onClick={() => {
                  if (editingId !== session.id) {
                    onSelectSession(session.id);
                    onClose();
                  }
                }}
                className={`
                  group relative flex flex-col p-3 rounded-xl cursor-pointer transition-all border
                  ${activeSessionId === session.id 
                    ? 'bg-gray-800 border-gray-700 shadow-md' 
                    : 'bg-transparent border-transparent hover:bg-gray-800/40 hover:border-gray-800'
                  }
                `}
              >
                <div className="flex justify-between items-start gap-2">
                  {editingId === session.id ? (
                    <input
                      autoFocus
                      className="text-sm font-medium bg-gray-700 border border-blue-500 rounded px-1.5 py-0.5 w-full text-blue-100 outline-none"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleRename(session.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRename(session.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className={`text-sm font-medium truncate flex-1 ${activeSessionId === session.id ? 'text-blue-100' : 'text-gray-400'}`}>
                      {session.title || '新对话'}
                    </span>
                  )}
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={(e) => startEditing(session.id, session.title, e)}
                      className="p-1 text-gray-600 hover:text-blue-400 rounded-md hover:bg-blue-400/10"
                      title="重命名"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => onDeleteSession(session.id, e)}
                      className="p-1 text-gray-600 hover:text-red-400 rounded-md hover:bg-red-400/10"
                      title="删除会话"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
                <span className="text-[10px] text-gray-600 mt-1">
                  {new Date(session.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-800/50 bg-gray-950/20">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs text-gray-400 font-mono">
               US
             </div>
             <div className="flex-1 overflow-hidden">
                <p className="text-xs font-bold text-gray-300 truncate">访客用户</p>
                <p className="text-[10px] text-gray-600 truncate">本地存储已启用</p>
             </div>
          </div>
        </div>
      </aside>
    </>
  );
};
