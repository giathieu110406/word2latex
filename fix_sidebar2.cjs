const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// I'll first add the sidebarExpanded logic
const stateCode = `  const [isSidebarPinned, setIsSidebarPinned] = useState<boolean>(true);
  const [isSidebarHovered, setIsSidebarHovered] = useState<boolean>(false);
  const sidebarExpanded = isSidebarPinned || isSidebarHovered;`;
code = code.replace(
  '  const [isSidebarPinned, setIsSidebarPinned] = useState<boolean>(true);\n  const [isSidebarHovered, setIsSidebarHovered] = useState<boolean>(false);',
  stateCode
);

const regex = /\{\/\* LEFT SIDEBAR \*\/\}([\s\S]*?)\{\/\* MAIN CONTENT WRAPPER \*\/\}/;
const newSidebar = `
      {/* LEFT SIDEBAR */}
      <aside 
          onMouseEnter={() => setIsSidebarHovered(true)} 
          onMouseLeave={() => setIsSidebarHovered(false)}
          className={\`bg-white border-r border-slate-200 flex-col hidden md:flex shrink-0 h-full relative transition-all duration-300 z-50 \${sidebarExpanded ? 'w-64' : 'w-20 items-center'}\`}
      >
          <div className={\`p-6 flex items-center group \${sidebarExpanded ? 'gap-3 justify-between' : 'justify-center w-full'}\`}>
             <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-bold text-lg shadow-lg shrink-0">w²</div>
                 {sidebarExpanded && (
                 <div>
                    <div className="font-bold text-slate-800 text-[15px] leading-tight">Word2LaTeX.io.vn</div>
                    <div className="text-[10px] text-slate-500 leading-tight">Chuyển đổi LaTeX sang Word</div>
                 </div>
                 )}
             </div>
             
             {/* Pin button */}
             <button onClick={() => setIsSidebarPinned(!isSidebarPinned)} className={\`absolute -right-3 top-6 bg-white border border-slate-200 rounded-full p-1 text-slate-400 hover:text-indigo-600 hover:shadow-md transition-all z-50 \${sidebarExpanded ? 'opacity-0 group-hover:opacity-100' : 'hidden'}\`} title={isSidebarPinned ? "Bỏ ghim menu" : "Ghim menu"}>
                {isSidebarPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
             </button>
          </div>
          
          <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-5 px-3 overflow-x-hidden w-full">
              <div className="w-full">
                  <button onClick={() => setSidebarView('overview')} className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all \${sidebarView === 'overview' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'} \${!sidebarExpanded ? 'justify-center' : ''}\`} title={!sidebarExpanded ? "Tổng quan" : undefined}>
                      <Home className="w-4 h-4 shrink-0" /> {sidebarExpanded && <span className="truncate whitespace-nowrap">Tổng quan</span>}
                  </button>
              </div>
              
              <div className="w-full">
                  {sidebarExpanded && <div className="text-[10px] font-bold text-slate-400 tracking-wider mb-1.5 px-3 uppercase truncate">Workspace</div>}
                  <button onClick={() => setSidebarView('latex')} className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all \${sidebarView === 'latex' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'} \${!sidebarExpanded ? 'justify-center' : ''}\`} title={!sidebarExpanded ? "Chuyển đổi LaTeX" : undefined}>
                      <Sparkles className="w-4 h-4 shrink-0" /> {sidebarExpanded && <span className="truncate whitespace-nowrap">Chuyển đổi LaTeX</span>}
                  </button>
                  <button onClick={() => setSidebarView('qbuilder')} className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all \${sidebarView === 'qbuilder' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'} \${!sidebarExpanded ? 'justify-center' : ''}\`} title={!sidebarExpanded ? "Soạn đề thi (AI)" : undefined}>
                      <FileText className="w-4 h-4 shrink-0" /> {sidebarExpanded && <span className="truncate whitespace-nowrap">Soạn đề thi (AI)</span>}
                  </button>
                  <button onClick={() => setSidebarView('docs')} className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all \${sidebarView === 'docs' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'} \${!sidebarExpanded ? 'justify-center' : ''}\`} title={!sidebarExpanded ? "Quản lý tài liệu" : undefined}>
                      <Folder className="w-4 h-4 shrink-0" /> {sidebarExpanded && <span className="truncate whitespace-nowrap">Quản lý tài liệu</span>}
                  </button>
              </div>

              {isAdminUser(user, userDoc) && (
                <div className="w-full">
                  {sidebarExpanded && <div className="text-[10px] font-bold text-slate-400 tracking-wider mb-1.5 px-3 uppercase truncate">Quản trị</div>}
                  <button onClick={() => setSidebarView('members')} className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all \${sidebarView === 'members' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'} \${!sidebarExpanded ? 'justify-center' : ''}\`} title={!sidebarExpanded ? "Thành viên" : undefined}>
                      <Users className="w-4 h-4 shrink-0" /> {sidebarExpanded && <span className="truncate whitespace-nowrap">Thành viên</span>}
                  </button>
                  <button onClick={() => setSidebarView('feedbacks')} className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all \${sidebarView === 'feedbacks' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'} \${!sidebarExpanded ? 'justify-center' : ''}\`} title={!sidebarExpanded ? "Góp ý & Phản hồi" : undefined}>
                      <MessageSquare className="w-4 h-4 shrink-0" /> {sidebarExpanded && <span className="truncate whitespace-nowrap">Góp ý & Phản hồi</span>}
                  </button>
                  <button onClick={() => setSidebarView('notify')} className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all \${sidebarView === 'notify' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'} \${!sidebarExpanded ? 'justify-center' : ''}\`} title={!sidebarExpanded ? "Thông báo" : undefined}>
                      <Bell className="w-4 h-4 shrink-0" /> {sidebarExpanded && <span className="truncate whitespace-nowrap">Thông báo</span>}
                  </button>
                  <button onClick={() => setSidebarView('settings')} className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all \${sidebarView === 'settings' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'} \${!sidebarExpanded ? 'justify-center' : ''}\`} title={!sidebarExpanded ? "Cài đặt" : undefined}>
                      <Settings className="w-4 h-4 shrink-0" /> {sidebarExpanded && <span className="truncate whitespace-nowrap">Cài đặt</span>}
                  </button>
                </div>
              )}
          </div>
          
          <div className="p-4 mt-auto w-full">
              {sidebarExpanded ? (
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
          {sidebarExpanded && <div className="text-[10px] text-slate-400 font-medium px-6 pb-6 pt-2 whitespace-nowrap truncate w-full">© 2026 Word2LaTeX.io.vn</div>}
      </aside>

      {/* MAIN CONTENT WRAPPER */}`;

code = code.replace(regex, newSidebar);
fs.writeFileSync('src/App.tsx', code);
