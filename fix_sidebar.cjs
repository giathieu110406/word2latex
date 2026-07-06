const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const regex = /\{\/\* LEFT SIDEBAR \*\/\}([\s\S]*?)\{\/\* MAIN CONTENT WRAPPER \*\/\}/;
const newSidebar = `
      {/* LEFT SIDEBAR */}
      <aside className={\`bg-white border-r border-slate-200 flex-col hidden md:flex shrink-0 h-full relative transition-all duration-300 \${isSidebarPinned ? 'w-64' : 'w-20 items-center'}\`}>
          <div className={\`p-6 flex items-center group \${isSidebarPinned ? 'gap-3 justify-between' : 'justify-center w-full'}\`}>
             <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-bold text-lg shadow-lg shrink-0">w²</div>
                 {isSidebarPinned && (
                 <div>
                    <div className="font-bold text-slate-800 text-[15px] leading-tight">Word2LaTeX.io.vn</div>
                    <div className="text-[10px] text-slate-500 leading-tight">Chuyển đổi LaTeX sang Word</div>
                 </div>
                 )}
             </div>
             
             {/* Pin button */}
             <button onClick={() => setIsSidebarPinned(!isSidebarPinned)} className={\`absolute -right-3 top-6 bg-white border border-slate-200 rounded-full p-1 text-slate-400 hover:text-indigo-600 hover:shadow-md transition-all z-50 \${isSidebarPinned ? 'opacity-0 group-hover:opacity-100' : ''}\`} title={isSidebarPinned ? "Thu gọn menu" : "Ghim menu"}>
                {isSidebarPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
             </button>
          </div>
          
          <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-5 px-3 overflow-x-hidden w-full">
              <div className="w-full">
                  <button onClick={() => setSidebarView('overview')} className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all \${sidebarView === 'overview' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'} \${!isSidebarPinned ? 'justify-center' : ''}\`} title={!isSidebarPinned ? "Tổng quan" : undefined}>
                      <Home className="w-4 h-4 shrink-0" /> {isSidebarPinned && <span className="truncate whitespace-nowrap">Tổng quan</span>}
                  </button>
              </div>
              
              <div className="w-full">
                  {isSidebarPinned && <div className="text-[10px] font-bold text-slate-400 tracking-wider mb-1.5 px-3 uppercase truncate">Workspace</div>}
                  <button onClick={() => setSidebarView('latex')} className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all \${sidebarView === 'latex' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'} \${!isSidebarPinned ? 'justify-center' : ''}\`} title={!isSidebarPinned ? "Chuyển đổi LaTeX" : undefined}>
                      <Sparkles className="w-4 h-4 shrink-0" /> {isSidebarPinned && <span className="truncate whitespace-nowrap">Chuyển đổi LaTeX</span>}
                  </button>
                  <button onClick={() => setSidebarView('qbuilder')} className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all \${sidebarView === 'qbuilder' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'} \${!isSidebarPinned ? 'justify-center' : ''}\`} title={!isSidebarPinned ? "Soạn đề thi (AI)" : undefined}>
                      <FileText className="w-4 h-4 shrink-0" /> {isSidebarPinned && <span className="truncate whitespace-nowrap">Soạn đề thi (AI)</span>}
                  </button>
                  <button onClick={() => setSidebarView('docs')} className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all \${sidebarView === 'docs' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'} \${!isSidebarPinned ? 'justify-center' : ''}\`} title={!isSidebarPinned ? "Quản lý tài liệu" : undefined}>
                      <Folder className="w-4 h-4 shrink-0" /> {isSidebarPinned && <span className="truncate whitespace-nowrap">Quản lý tài liệu</span>}
                  </button>
              </div>

              {isAdminUser(user, userDoc) && (
                <div className="w-full">
                  {isSidebarPinned && <div className="text-[10px] font-bold text-slate-400 tracking-wider mb-1.5 px-3 uppercase truncate">Quản trị</div>}
                  <button onClick={() => setSidebarView('members')} className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all \${sidebarView === 'members' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'} \${!isSidebarPinned ? 'justify-center' : ''}\`} title={!isSidebarPinned ? "Thành viên" : undefined}>
                      <Users className="w-4 h-4 shrink-0" /> {isSidebarPinned && <span className="truncate whitespace-nowrap">Thành viên</span>}
                  </button>
                  <button onClick={() => setSidebarView('feedbacks')} className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all \${sidebarView === 'feedbacks' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'} \${!isSidebarPinned ? 'justify-center' : ''}\`} title={!isSidebarPinned ? "Góp ý & Phản hồi" : undefined}>
                      <MessageSquare className="w-4 h-4 shrink-0" /> {isSidebarPinned && <span className="truncate whitespace-nowrap">Góp ý & Phản hồi</span>}
                  </button>
                  <button onClick={() => setSidebarView('notify')} className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all \${sidebarView === 'notify' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'} \${!isSidebarPinned ? 'justify-center' : ''}\`} title={!isSidebarPinned ? "Thông báo" : undefined}>
                      <Bell className="w-4 h-4 shrink-0" /> {isSidebarPinned && <span className="truncate whitespace-nowrap">Thông báo</span>}
                  </button>
                  <button onClick={() => setSidebarView('settings')} className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all \${sidebarView === 'settings' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'} \${!isSidebarPinned ? 'justify-center' : ''}\`} title={!isSidebarPinned ? "Cài đặt" : undefined}>
                      <Settings className="w-4 h-4 shrink-0" /> {isSidebarPinned && <span className="truncate whitespace-nowrap">Cài đặt</span>}
                  </button>
                </div>
              )}
          </div>
          
          <div className="p-4 mt-auto w-full">
              {isSidebarPinned ? (
              <div className="bg-[#F8F9FE] rounded-2xl p-4 border border-indigo-50 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-200/40 to-transparent rounded-full -mr-12 -mt-12"></div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-xs uppercase">PRO PLAN</span>
                  </div>
                  <div className="text-xs font-bold text-slate-800 mb-1">Mở khóa toàn bộ tính năng</div>
                  <div className="text-[10px] text-slate-500 mb-3 leading-relaxed">Trải nghiệm không giới hạn.</div>
                  <button className="w-full bg-white text-indigo-600 rounded-xl py-2 text-xs font-bold shadow-sm border border-slate-100 flex justify-center items-center gap-1 hover:shadow-md transition-all group">
                     Nâng cấp <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform"/>
                  </button>
              </div>
              ) : (
                <div className="flex justify-center mb-2">
                    <button className="bg-gradient-to-tr from-indigo-600 to-purple-500 text-white p-2.5 rounded-xl shadow-md hover:shadow-lg transition-all" title="Nâng cấp PRO">
                        <Diamond className="w-4 h-4" />
                    </button>
                </div>
              )}
          </div>
          {isSidebarPinned && <div className="text-[10px] text-slate-400 font-medium px-6 pb-6 pt-2 whitespace-nowrap truncate w-full">© 2026 Word2LaTeX.io.vn</div>}
      </aside>

      {/* MAIN CONTENT WRAPPER */}`;

code = code.replace(regex, newSidebar);

// Make sure the main layout wraps with full screen height and scrollable right side
code = code.replace(
  '<div className="min-h-screen bg-[#F8F9FD] text-slate-800 antialiased font-sans flex flex-row overflow-hidden w-full h-full">',
  '<div className="h-screen w-full bg-[#F8F9FD] text-slate-800 antialiased font-sans flex flex-row overflow-hidden">'
);

fs.writeFileSync('src/App.tsx', code);
