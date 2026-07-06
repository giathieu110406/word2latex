const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const navRegex = /<nav className="w-full bg-gradient-to-r from-violet-100 via-sky-50 to-indigo-100 border-b border-indigo-200\/50 text-slate-800 shadow-xs sticky top-0 z-40 select-none">[\s\S]*?<\/nav>/;
const newSidebar = `
      {/* LEFT SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 flex-col hidden md:flex shrink-0 h-full">
          <div className="p-6 flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-bold text-lg shadow-lg">w²</div>
             <div>
                <div className="font-bold text-slate-800 text-[15px] leading-tight">Word2LaTeX.io.vn</div>
                <div className="text-[10px] text-slate-500 leading-tight">Chuyển đổi LaTeX sang Word nhanh chóng</div>
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-5 px-3">
              <div>
                  <button onClick={() => setSidebarView('overview')} className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all \${sidebarView === 'overview' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}\`}>
                      <Home className="w-4 h-4" /> Tổng quan
                  </button>
              </div>
              
              <div>
                  <div className="text-[10px] font-bold text-slate-400 tracking-wider mb-1.5 px-3 uppercase">Workspace</div>
                  <button onClick={() => setSidebarView('latex')} className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all \${sidebarView === 'latex' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}\`}>
                      <Sparkles className="w-4 h-4" /> Chuyển đổi LaTeX
                  </button>
                  <button onClick={() => setSidebarView('qbuilder')} className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all \${sidebarView === 'qbuilder' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}\`}>
                      <FileText className="w-4 h-4" /> Soạn đề thi (AI)
                  </button>
                  <button onClick={() => setSidebarView('docs')} className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all \${sidebarView === 'docs' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}\`}>
                      <Folder className="w-4 h-4" /> Quản lý tài liệu
                  </button>
              </div>

              {isAdminUser(user, userDoc) && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 tracking-wider mb-1.5 px-3 uppercase">Quản trị</div>
                  <button onClick={() => setSidebarView('members')} className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all \${sidebarView === 'members' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}\`}>
                      <Users className="w-4 h-4" /> Thành viên
                  </button>
                  <button onClick={() => setSidebarView('feedbacks')} className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all \${sidebarView === 'feedbacks' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}\`}>
                      <MessageSquare className="w-4 h-4" /> Góp ý & Phản hồi
                  </button>
                  <button onClick={() => setSidebarView('notify')} className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all \${sidebarView === 'notify' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}\`}>
                      <Bell className="w-4 h-4" /> Thông báo
                  </button>
                  <button onClick={() => setSidebarView('settings')} className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all \${sidebarView === 'settings' ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}\`}>
                      <Settings className="w-4 h-4" /> Cài đặt
                  </button>
                </div>
              )}
          </div>
          
          <div className="p-4 mt-auto">
              <div className="bg-[#F8F9FE] rounded-2xl p-4 border border-indigo-50 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-200/40 to-transparent rounded-full -mr-12 -mt-12"></div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-xs uppercase">PRO PLAN</span>
                  </div>
                  <div className="text-xs font-bold text-slate-800 mb-1">Mở khóa toàn bộ tính năng</div>
                  <div className="text-[10px] text-slate-500 mb-3 leading-relaxed">Trải nghiệm không giới hạn.</div>
                  <button className="w-full bg-white text-indigo-600 rounded-xl py-2 text-xs font-bold shadow-sm border border-slate-100 flex justify-center items-center gap-1 hover:shadow-md transition-all group">
                     Nâng cấp ngay <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform"/>
                  </button>
              </div>
          </div>
          <div className="text-[10px] text-slate-400 font-medium px-6 pb-6 pt-2">© 2026 Word2LaTeX.io.vn</div>
      </aside>

      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
          {/* TOPBAR */}
          <div className="sticky top-0 z-30 w-full bg-[#F8F9FD]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
              <div className="relative w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input type="text" placeholder="Tìm nhanh..." className="w-full bg-white border border-slate-200 text-xs rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all text-slate-700 font-medium" />
              </div>
              <div className="flex items-center gap-4">
                  <button className="px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-xs flex items-center gap-2 transition-colors border border-indigo-100 shadow-xs">
                      <Diamond className="w-3.5 h-3.5" />
                      Nâng cấp PRO
                  </button>
                  <button onClick={() => setIsNotificationsOpen(true)} className="relative p-2.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shadow-xs">
                      <Bell className="w-4 h-4" />
                      {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>}
                  </button>
                  
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full shadow-xs cursor-pointer hover:bg-slate-50 transition-colors" onClick={handleLogout}>
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-200">
                          <img src={getUserAvatar()} alt="User avatar" className="w-full h-full object-cover" />
                      </div>
                      <span className="font-bold text-xs text-slate-700 hidden sm:block truncate max-w-[100px]">{userDoc?.displayName || user?.displayName || user?.email?.split("@")[0]}</span>
                      {isAdminUser(user, userDoc) || isApproved ? (
                          <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase">PRO</span>
                      ) : null}
                  </div>
              </div>
          </div>
`;

code = code.replace(navRegex, newSidebar);
fs.writeFileSync('src/App.tsx', code);
