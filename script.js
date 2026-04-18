// ===================== CONFIG =====================
// Enter your Gemini API key here
const GEMINI_API_KEY = "AIzaSyAmsEJvOw06zZlqPovN9dDaMFFZs91OnP8"; // <-- PASTE YOUR NEW GEMINI API KEY HERE
//console.log("The browser sees this key: ", GEMINI_API_KEY);
const MODEL = "gemini-2.5-flash"; // Updated to current active model
 
// ===================== STATE =====================
let currentUser = null;
let ideaHistory = JSON.parse(localStorage.getItem('startupHistory') || '[]');
let chatSessions = JSON.parse(localStorage.getItem('chatSessions') || '[]');
let activeChatId = null;
let activeChatMessages = [];
let isSending = false;
 
// ===================== NAV =====================
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (page === 'login') {
    document.getElementById('loginPage').classList.add('active');
  } else if (page === 'home') {
    document.getElementById('homePage').classList.add('active');
    document.getElementById('navHome').classList.add('active');
  } else if (page === 'chat') {
    document.getElementById('chatPage').classList.add('active');
    document.getElementById('navChat').classList.add('active');
    renderChatHistory();
  } else if (page === 'history') {
    document.getElementById('historyPage').classList.add('active');
    document.getElementById('navHistory').classList.add('active');
    renderHistory();
  }
}
 
// ===================== AUTH =====================
function switchTab(tab) {
  document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('signupForm').style.display = tab === 'signup' ? 'block' : 'none';
  document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('tabSignup').classList.toggle('active', tab === 'signup');
}
 
function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pwd = document.getElementById('loginPwd').value;
  if (!email || !pwd) { showToast('Please fill all fields'); return; }
  currentUser = { name: email.split('@')[0], email };
  setLoggedIn();
}
function doSignup() {
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  if (!name || !email) { showToast('Please fill all fields'); return; }
  currentUser = { name, email };
  setLoggedIn();
}
function doDemo() { currentUser = { name: 'Demo User', email: 'demo@startuplab.ai' }; setLoggedIn(); }
function setLoggedIn() {
  document.getElementById('navLogin').style.display = 'none';
  document.getElementById('navUser').style.display = 'flex';
  document.getElementById('navAvatar').textContent = currentUser.name[0].toUpperCase();
  showToast(`Welcome, ${currentUser.name}!`);
  showPage('home');
}
function logout() {
  currentUser = null;
  document.getElementById('navLogin').style.display = 'flex';
  document.getElementById('navUser').style.display = 'none';
  showPage('login');
}
 
// ===================== ANALYZE =====================
async function analyzeIdea() {
  const idea = document.getElementById('ideaInput').value.trim();
  if (!idea) { showToast('Please enter your startup idea first'); return; }
  
  if (!GEMINI_API_KEY) {
    showToast('Error: You must enter your Gemini API Key in the code first!'); 
    return;
  }
  
  showLoading();
  
  const prompt = `You are an expert startup evaluator. Analyze this startup idea and respond ONLY with valid JSON.
Idea: "${idea}"
Return this exact JSON structure:
{
  "score": <number 1-10>,
  "verdict": "<one-line verdict>",
  "summary": "<2-sentence analysis>",
  "pros": ["<pro 1>","<pro 2>","<pro 3>"],
  "cons": ["<con 1>","<con 2>","<con 3>"],
  "suggestions": ["<suggestion 1>","<suggestion 2>","<suggestion 3>"],
  "pitch": {
    "problem": "<1-2 sentences>",
    "solution": "<1-2 sentences>",
    "business_model": "<1-2 sentences>"
  }
}`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });
    
    const data = await res.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    const raw = data.candidates[0].content.parts[0].text;
    const clean = raw.replace(/```json|```/g,'').trim();
    const result = JSON.parse(clean);
    
    hideLoading();
    renderResults(idea, result);
    saveHistory(idea, result);
  } catch(e) {
    console.error(e);
    hideLoading();
    showToast('API Error: Check the browser console (F12) for details.');
  }
}
 
function renderResults(idea, r) {
  document.getElementById('ideaTag').textContent = idea.length > 40 ? idea.slice(0,40)+'…' : idea;
  const section = document.getElementById('resultsSection');
  section.classList.add('show');
  const scorePct = ((r.score / 10) * 100).toFixed(0);
  const scoreColor = r.score >= 7 ? 'var(--success)' : r.score >= 5 ? 'var(--warn)' : 'var(--danger)';
  const grid = document.getElementById('resultsGrid');
  grid.innerHTML = `
  <div class="result-card" style="animation-delay:.05s">
    <div class="card-header">
      <div class="card-icon blue"><i class="fa fa-chart-line"></i></div>
      <div class="card-title">Idea Score</div>
    </div>
    <div class="score-display">
      <div class="score-circle" style="--score-pct:${scorePct}%">
        <div class="score-num">${r.score}</div>
        <div class="score-label">/ 10</div>
      </div>
      <div class="score-details">
        <div class="score-verdict" style="color:${scoreColor}">${r.verdict}</div>
        <div class="score-summary">${r.summary}</div>
        <div class="score-bar"><div class="score-bar-fill" id="scoreBarFill" style="width:0%"></div></div>
      </div>
    </div>
  </div>
  <div class="result-card" style="animation-delay:.1s">
    <div class="card-header">
      <div class="card-icon green"><i class="fa fa-thumbs-up"></i></div>
      <div class="card-title">Strengths</div>
    </div>
    <ul class="result-list pros">${r.pros.map(p=>`<li><i class="fa fa-check"></i>${p}</li>`).join('')}</ul>
  </div>
  <div class="result-card" style="animation-delay:.15s">
    <div class="card-header">
      <div class="card-icon red"><i class="fa fa-thumbs-down"></i></div>
      <div class="card-title">Challenges</div>
    </div>
    <ul class="result-list cons">${r.cons.map(c=>`<li><i class="fa fa-times"></i>${c}</li>`).join('')}</ul>
  </div>
  <div class="result-card" style="animation-delay:.2s">
    <div class="card-header">
      <div class="card-icon warn"><i class="fa fa-lightbulb"></i></div>
      <div class="card-title">Recommendations</div>
    </div>
    <ul class="result-list tips">${r.suggestions.map(s=>`<li><i class="fa fa-arrow-right"></i>${s}</li>`).join('')}</ul>
  </div>
  <div class="result-card full" style="animation-delay:.25s">
    <div class="card-header">
      <div class="card-icon purp"><i class="fa fa-rocket"></i></div>
      <div class="card-title">Startup Pitch</div>
    </div>
    <div class="pitch-section">
      <div class="pitch-label"><i class="fa fa-exclamation-circle"></i> &nbsp;Problem</div>
      <div class="pitch-text">${r.pitch.problem}</div>
    </div>
    <div class="pitch-section">
      <div class="pitch-label"><i class="fa fa-magic"></i> &nbsp;Solution</div>
      <div class="pitch-text">${r.pitch.solution}</div>
    </div>
    <div class="pitch-section">
      <div class="pitch-label"><i class="fa fa-dollar-sign"></i> &nbsp;Business Model</div>
      <div class="pitch-text">${r.pitch.business_model}</div>
    </div>
  </div>`;
  setTimeout(()=>{ document.getElementById('scoreBarFill').style.width = scorePct+'%'; }, 200);
  section.scrollIntoView({ behavior:'smooth', block:'start' });
}
 
// ===================== HISTORY =====================
function saveHistory(idea, result) {
  ideaHistory.unshift({ id: Date.now(), idea, result, date: new Date().toISOString() });
  if (ideaHistory.length > 50) ideaHistory.pop();
  localStorage.setItem('startupHistory', JSON.stringify(ideaHistory));
}
 
function renderHistory() {
  const grid = document.getElementById('historyGrid');
  if (!ideaHistory.length) {
    grid.innerHTML = `<div class="empty-history"><i class="fa fa-folder-open"></i><p>No history yet. Analyze your first idea!</p></div>`;
    return;
  }
  grid.innerHTML = ideaHistory.map((h,i)=>`
  <div class="history-card" style="animation-delay:${i*.05}s" onclick="loadHistoryItem(${h.id})">
    <div class="history-card-header">
      <div class="history-idea">${h.idea.length > 60 ? h.idea.slice(0,60)+'…' : h.idea}</div>
      <div class="history-score">⚡ ${h.result.score}/10</div>
    </div>
    <div class="history-date"><i class="fa fa-clock"></i> ${new Date(h.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
    <div class="history-preview">${h.result.verdict}</div>
  </div>`).join('');
}
 
function loadHistoryItem(id) {
  const item = ideaHistory.find(h=>h.id===id);
  if (!item) return;
  showPage('home');
  document.getElementById('ideaInput').value = item.idea;
  renderResults(item.idea, item.result);
}
 
// ===================== CHAT =====================
function toggleSidebar() {
  document.getElementById('chatSidebar').classList.toggle('open');
}
function newChat() {
  activeChatId = Date.now();
  activeChatMessages = [];
  document.getElementById('chatMessages').innerHTML = `
  <div class="chat-empty" id="chatEmpty">
    <i class="fa fa-robot"></i>
    <h3>AI Startup Advisor</h3>
    <p>Ask me anything about startup strategy, markets, funding, or have me evaluate your idea.</p>
  </div>`;
}
function renderChatHistory() {
  const list = document.getElementById('chatHistoryList');
  if (!chatSessions.length) { list.innerHTML = `<div style="padding:12px 10px;font-size:.82rem;color:var(--muted)">No chats yet</div>`; return; }
  list.innerHTML = chatSessions.slice(0,20).map(s=>`
  <div class="history-item ${s.id===activeChatId?'active':''}" onclick="loadChatSession(${s.id})">
    <i class="fa fa-comment-dots"></i>${s.title}
  </div>`).join('');
}
 
function loadChatSession(id) {
  const s = chatSessions.find(c=>c.id===id); if(!s) return;
  activeChatId = id;
  activeChatMessages = s.messages || [];
  const box = document.getElementById('chatMessages');
  box.innerHTML = '';
  activeChatMessages.forEach(m=>appendMessage(m.role, m.content, false));
  renderChatHistory();
}
 
function appendMessage(role, content, animate=true) {
  const empty = document.getElementById('chatEmpty');
  if (empty) empty.remove();
  const box = document.getElementById('chatMessages');
  const time = new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
  const div = document.createElement('div');
  div.className = `msg-row ${role}`;
  div.innerHTML = `
  <div class="msg-avatar">${role==='user'?(currentUser?currentUser.name[0].toUpperCase():'U'):'🤖'}</div>
  <div>
    <div class="msg-bubble">${role==='ai'&&animate?'<span class="typing-content"></span>':escapeHtml(content)}</div>
    <div class="msg-time">${time}</div>
  </div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  if (role==='ai' && animate) {
    typeText(div.querySelector('.typing-content'), content, 18, ()=>{ box.scrollTop=box.scrollHeight; });
  }
  return div;
}
 
function typeText(el, text, speed, cb) {
  let i = 0;
  const tick = ()=>{
    el.textContent = text.slice(0, i++);
    if (i <= text.length) setTimeout(tick, speed);
    else if (cb) cb();
  };
  tick();
}
 
function showTypingIndicator() {
  const box = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'msg-row ai'; div.id = 'typingIndicator';
  div.innerHTML = `<div class="msg-avatar">🤖</div><div class="msg-bubble"><div class="typing-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div></div>`;
  box.appendChild(div); box.scrollTop = box.scrollHeight;
}
function removeTypingIndicator() { const el = document.getElementById('typingIndicator'); if(el) el.remove(); }
 
async function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || isSending) return;
  isSending = true;
  document.getElementById('sendBtn').disabled = true;
  input.value = '';
  input.style.height = 'auto';
 
  if (!activeChatId) { activeChatId = Date.now(); activeChatMessages = []; }
  appendMessage('user', text);
  activeChatMessages.push({ role:'user', content: text });
 
  showTypingIndicator();
 
  if (!GEMINI_API_KEY) {
    removeTypingIndicator();
    appendMessage('ai', "Error: I cannot reply because the Gemini API key is missing in the code!");
    isSending = false;
    document.getElementById('sendBtn').disabled = false;
    return;
  }
 
  try {
    const systemPrompt = `You are an expert AI startup advisor with deep knowledge of entrepreneurship, venture capital, product-market fit, and growth strategies. Be concise, insightful, and actionable. Format responses clearly but conversationally.`;
    
    const contents = activeChatMessages.map(m => ({
      role: m.role === 'ai' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: contents 
      })
    });
    
    const data = await res.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    const reply = data.candidates[0].content.parts[0].text;
    
    removeTypingIndicator();
    appendMessage('ai', reply);
    activeChatMessages.push({ role:'ai', content: reply });
    saveChatSession(text);
  } catch(e) {
    console.error(e);
    removeTypingIndicator();
    
    if (e.message && e.message.includes("high demand")) {
        appendMessage('ai', "I'm currently assisting a lot of founders right now and the servers are a bit overloaded! Give me about 30 seconds and try asking again. 🚦");
    } else {
        appendMessage('ai', `Connection Error: Make sure your API key is correct. Check console (F12) for details.`);
    }
  }
  
  isSending = false;
  document.getElementById('sendBtn').disabled = false;
}

function saveChatSession(firstMsg) {
  const title = firstMsg.length > 30 ? firstMsg.slice(0,30)+'…' : firstMsg;
  const idx = chatSessions.findIndex(s=>s.id===activeChatId);
  if (idx>=0) chatSessions[idx] = { id:activeChatId, title:chatSessions[idx].title, messages:activeChatMessages };
  else chatSessions.unshift({ id:activeChatId, title, messages:activeChatMessages });
  if (chatSessions.length > 20) chatSessions.pop();
  localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
  renderChatHistory();
}
 
// ===================== LOADING =====================
function showLoading() {
  document.getElementById('loadingOverlay').classList.add('show');
  const steps = ['ls1','ls2','ls3','ls4'];
  steps.forEach((id,i)=>{ setTimeout(()=>document.getElementById(id).classList.add('visible'), i*700); });
}
function hideLoading() {
  document.getElementById('loadingOverlay').classList.remove('show');
  ['ls1','ls2','ls3','ls4'].forEach(id=>document.getElementById(id).classList.remove('visible'));
}
 
// ===================== UTILS =====================
function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 3000);
}
function escapeHtml(t) { return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }
 
// Auto-resize textareas
document.querySelectorAll('textarea').forEach(ta=>{
  ta.addEventListener('input',()=>{ ta.style.height='auto'; ta.style.height=ta.scrollHeight+'px'; });
  ta.addEventListener('keydown', e=>{
    if(e.key==='Enter' && !e.shiftKey) {
      e.preventDefault();
      if (ta.id==='chatInput') sendMessage();
      else if (ta.id==='ideaInput') analyzeIdea();
    }
  });
});