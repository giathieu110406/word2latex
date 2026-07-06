const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const uiLogic = `
        {/* AI Chat Modal */}
        <AnimatePresence>
          {showAiChat && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-end sm:justify-center z-[100] p-0 sm:p-4">
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.95 }}
                className="bg-white w-full sm:w-[450px] sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[85vh] sm:h-[600px] max-h-screen"
              >
                {/* Header */}
                <div className="bg-indigo-600 px-4 py-3 flex items-center justify-between text-white shrink-0">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-200" />
                    <div>
                      <h3 className="font-bold text-sm">Trợ lý AI Word2LaTeX</h3>
                      <p className="text-[10px] text-indigo-200">Giải đáp thắc mắc về hệ thống</p>
                    </div>
                  </div>
                  <button onClick={() => setShowAiChat(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
                  {aiChatMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-4">
                      <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-3">
                        <Sparkles className="w-6 h-6 text-indigo-600" />
                      </div>
                      <p className="text-sm font-bold text-slate-700">Xin chào! 👋</p>
                      <p className="text-xs text-slate-500 mt-1">Tôi có thể giúp gì cho bạn về hệ thống Word2LaTeX?</p>
                    </div>
                  ) : (
                    aiChatMessages.map((msg, idx) => (
                      <div key={idx} className={\`flex \${msg.role === 'user' ? 'justify-end' : 'justify-start'}\`}>
                        <div className={\`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] \${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm'}\`}>
                          <div className={msg.role === 'user' ? "" : "markdown-body text-xs"}>
                            {msg.role === 'user' ? msg.text : <Markdown>{msg.text}</Markdown>}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {isAiChatLoading && (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] rounded-2xl rounded-bl-none px-4 py-3 bg-white border border-slate-200 text-slate-700 shadow-sm flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                    </div>
                  )}
                  <div ref={chatMessagesEndRef} />
                </div>

                {/* Input form */}
                <form onSubmit={handleAiChatSubmit} className="p-3 bg-white border-t border-slate-200 shrink-0 flex items-center gap-2">
                  <input
                    type="text"
                    value={aiChatInput}
                    onChange={(e) => setAiChatInput(e.target.value)}
                    placeholder="Hỏi về hệ thống Word2LaTeX..."
                    className="flex-1 bg-slate-100 border-none outline-none rounded-xl px-4 py-2.5 text-xs text-slate-700 focus:ring-2 focus:ring-indigo-100 transition-shadow"
                  />
                  <button
                    type="submit"
                    disabled={!aiChatInput.trim() || isAiChatLoading}
                    className="w-10 h-10 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl transition-colors shrink-0 shadow-sm"
                  >
                    <Save className="w-4 h-4 rotate-[-90deg] -ml-0.5" />
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
`;

code = code.replace("{/* Pro Upgrade Contact Modal */}", uiLogic + "\n        {/* Pro Upgrade Contact Modal */}");
fs.writeFileSync('src/App.tsx', code);
