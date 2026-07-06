const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const submitLogic = `
  const handleAiChatSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiChatInput.trim() || isAiChatLoading) return;

    const userMsg = aiChatInput.trim();
    setAiChatInput("");
    setAiChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsAiChatLoading(true);

    try {
      const response = await fetch('/api/ai?action=chat-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...aiChatMessages, { role: 'user', text: userMsg }] })
      });
      const data = await response.json();
      if (data.success) {
        setAiChatMessages(prev => [...prev, { role: 'model', text: data.text }]);
      } else {
        triggerToast(data.error || "Lỗi khi gọi AI", false);
      }
    } catch (err: any) {
      triggerToast("Lỗi kết nối AI", false);
    } finally {
      setIsAiChatLoading(false);
    }
  };
`;

code = code.replace("return (\n    <div className=\"h-screen", submitLogic + "\n  return (\n    <div className=\"h-screen");
fs.writeFileSync('src/App.tsx', code);
