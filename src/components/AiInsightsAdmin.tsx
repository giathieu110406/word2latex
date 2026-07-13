import React, { useState, useEffect, useMemo } from "react";
import { db } from "../firebase";
import { collection, query, orderBy, getDocs, where, doc, updateDoc, deleteDoc, limit } from "firebase/firestore";
import { BrainCircuit, RefreshCw, AlertTriangle, ShieldCheck, BarChart3, Edit2, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function AiInsightsAdmin({ uid }: { uid: string }) {
  const [insights, setInsights] = useState<any[]>([]);
  const [prompts, setPrompts] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"insights" | "prompts" | "dashboard">("dashboard");
  const [editingPrompt, setEditingPrompt] = useState<{ id: string, content: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleRunAnalysis = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/ai-improvement", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.processedCount > 0) {
          alert(`Phân tích thành công! Đã xử lý ${data.processedCount} logs thô và tạo ra ${data.newInsightsCount} phân tích mới.`);
        } else {
          alert("Không có logs mới cần phân tích (tất cả các log trước đó đã được xử lý xong).");
        }
        await loadData();
      } else {
        alert(`Gặp lỗi khi phân tích: ${data.error || data.message || "Lỗi chưa rõ"}`);
      }
    } catch (e) {
      console.error(e);
      alert("Lỗi khi kết nối với máy chủ để chạy phân tích.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (!uid) return;
      
      // Load insights
      try {
        const res = await fetch("/api/ai?action=get-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
        const data = await res.json();
        if (data.success && data.insights) {
          setInsights(data.insights);
        }
      } catch (e) {
        console.warn("Failed to load ai_insights from server", e);
      }
      
      // Load prompts
      try {
        const res = await fetch("/api/ai?action=get-prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
        const data = await res.json();
        if (data.success && data.prompts) {
          setPrompts(data.prompts);
        }
      } catch (e) {
        console.warn("Failed to load system_prompts from server", e);
      }
      
      // Load API usage stats from server
      try {
        const res = await fetch("/api/ai?action=get-usage-stats", {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
        const data = await res.json();
        if (data.success && data.stats) {
          setStats(data.stats);
        }
      } catch (e) {
        console.warn("Failed to load API usage stats from server", e);
      }
    } catch (err) {
      console.warn("Failed to load admin data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [uid]);

  const handleUpdatePrompt = async () => {
    if (!editingPrompt) return;
    try {
      const res = await fetch("/api/ai?action=update-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingPrompt.id, content: editingPrompt.content })
      });
      if (!res.ok) throw new Error("Lỗi máy chủ khi cập nhật");
      const data = await res.json();
      if (data.success) {
        setPrompts(prompts.map(p => p.id === editingPrompt.id ? { ...p, content: editingPrompt.content } : p));
        setEditingPrompt(null);
        alert("Cập nhật Prompt thành công!");
      } else {
        throw new Error(data.error || "Không thể cập nhật prompt");
      }
    } catch (err: any) {
      console.error("Failed to update prompt", err);
      alert(`Lỗi khi cập nhật prompt: ${err.message || err}`);
    }
  };

  const handleDeleteInsight = async (insightId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xoá insight này?")) return;
    try {
      const res = await fetch("/api/ai?action=delete-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: insightId })
      });
      if (!res.ok) throw new Error("Lỗi máy chủ khi xoá");
      const data = await res.json();
      if (data.success) {
        setInsights(insights.filter(i => i.id !== insightId));
      } else {
        throw new Error(data.error || "Không thể xoá insight");
      }
    } catch (err: any) {
      console.error("Failed to delete insight", err);
      alert(`Không thể xoá insight: ${err.message || err}`);
    }
  };

  const chartData = useMemo(() => {
    return stats.map(s => {
      const d = new Date(s.timestamp);
      return {
        name: `${d.getDate()}/${d.getMonth() + 1}`,
        "AI hỏi đáp": s["AI hỏi đáp"] || 0,
        "AI canvas": s["AI canvas"] || 0,
        "Dán AI": s["Dán AI"] || 0,
        "Markitdown": s["Markitdown"] || 0,
        "AI thay thế số liệu": s["AI thay thế số liệu"] || 0,
        "Trích xuất văn bản": s["Trích xuất văn bản"] || 0,
        "Tổng cộng": s.requests || 0
      };
    });
  }, [stats]);

  const totals = useMemo(() => {
    const sum = {
      requests: 0,
      chat: 0,
      canvas: 0,
      paste: 0,
      markitdown: 0,
      shuffle: 0,
      ocr: 0
    };
    stats.forEach(s => {
      sum.requests += s.requests || 0;
      sum.chat += s["AI hỏi đáp"] || 0;
      sum.canvas += s["AI canvas"] || 0;
      sum.paste += s["Dán AI"] || 0;
      sum.markitdown += s["Markitdown"] || 0;
      sum.shuffle += s["AI thay thế số liệu"] || 0;
      sum.ocr += s["Trích xuất văn bản"] || 0;
    });
    return sum;
  }, [stats]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-800">Admin Area</h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleRunAnalysis}
            disabled={isAnalyzing || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-bold rounded-lg hover:bg-violet-700 disabled:opacity-50 transition"
          >
            <BrainCircuit className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-pulse' : ''}`} />
            {isAnalyzing ? 'Đang phân tích...' : 'Chạy phân tích AI'}
          </button>
          <button 
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`px-4 py-2 font-semibold ${activeTab === "dashboard" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
        >
          <div className="flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Tổng quan API</div>
        </button>
        <button
          onClick={() => setActiveTab("insights")}
          className={`px-4 py-2 font-semibold ${activeTab === "insights" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
        >
          <div className="flex items-center gap-2"><BrainCircuit className="w-4 h-4" /> Phân tích AI</div>
        </button>
        <button
          onClick={() => setActiveTab("prompts")}
          className={`px-4 py-2 font-semibold ${activeTab === "prompts" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
        >
          <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Quản lý Prompts</div>
        </button>
      </div>

      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-3xl p-5 shadow-sm">
              <span className="text-xs text-indigo-100 font-bold uppercase tracking-wider">Tổng lượt gọi API</span>
              <p className="text-3xl font-black mt-2">{totals.requests}</p>
            </div>
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">AI Hỏi Đáp</span>
              <p className="text-3xl font-black text-slate-800 mt-2">{totals.chat}</p>
            </div>
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">AI Canvas</span>
              <p className="text-3xl font-black text-slate-800 mt-2">{totals.canvas}</p>
            </div>
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Dán AI</span>
              <p className="text-3xl font-black text-slate-800 mt-2">{totals.paste}</p>
            </div>
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Markitdown</span>
              <p className="text-3xl font-black text-slate-800 mt-2">{totals.markitdown}</p>
            </div>
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">AI Thay Số Liệu</span>
              <p className="text-3xl font-black text-slate-800 mt-2">{totals.shuffle}</p>
            </div>
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Trích Xuất Ảnh</span>
              <p className="text-3xl font-black text-slate-800 mt-2">{totals.ocr}</p>
            </div>
          </div>

          {/* Chart Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-500" /> Tần suất gọi API theo tính năng (7 Ngày)
            </h3>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-slate-400">Đang tải dữ liệu...</div>
            ) : chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-400 italic">Chưa có dữ liệu thống kê gọi API</div>
            ) : (
              <div className="h-80 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                    <YAxis orientation="left" stroke="#8b5cf6" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#f1f5f9' }} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="AI hỏi đáp" name="AI hỏi đáp" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="AI canvas" name="AI canvas" stackId="a" fill="#10b981" />
                    <Bar dataKey="Dán AI" name="Dán AI" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="Markitdown" name="Markitdown" stackId="a" fill="#ec4899" />
                    <Bar dataKey="AI thay thế số liệu" name="AI thay thế số liệu" stackId="a" fill="#8b5cf6" />
                    <Bar dataKey="Trích xuất văn bản" name="Trích xuất văn bản" stackId="a" fill="#6366f1" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "insights" && (
        <div className="space-y-4">
          {insights.length === 0 && !loading && (
            <p className="text-slate-500 italic">Chưa có dữ liệu phân tích nào.</p>
          )}
          {insights.map(insight => (
            <div key={insight.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-600 rounded">
                  {new Date(insight.createdAt || Date.now()).toLocaleString('vi-VN')}
                </span>
                <button onClick={() => handleDeleteInsight(insight.id)} className="text-red-500 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="text-sm text-slate-700 whitespace-pre-wrap">{insight.analysis || insight.content || "Không có nội dung"}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "prompts" && (
        <div className="space-y-4">
          {prompts.length === 0 && !loading && (
            <p className="text-slate-500 italic">Chưa có prompt nào được cấu hình.</p>
          )}
          {prompts.map(prompt => (
            <div key={prompt.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <h4 className="font-bold text-slate-800">{prompt.id}</h4>
                <button 
                  onClick={() => setEditingPrompt({ id: prompt.id, content: prompt.content })}
                  className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
                >
                  <Edit2 className="w-4 h-4" /> Sửa
                </button>
              </div>
              
              {editingPrompt?.id === prompt.id ? (
                <div className="space-y-3">
                  <textarea 
                    value={editingPrompt.content}
                    onChange={(e) => setEditingPrompt({ ...editingPrompt, content: e.target.value })}
                    className="w-full h-32 p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={handleUpdatePrompt}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
                    >
                      Lưu thay đổi
                    </button>
                    <button 
                      onClick={() => setEditingPrompt(null)}
                      className="px-4 py-2 bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-300"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              ) : (
                <pre className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">
                  {prompt.content}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
