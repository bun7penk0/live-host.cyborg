document.addEventListener("DOMContentLoaded", () => {
    // ==========================================
    // 🔥 SYSTEM MODE (Backend หรือ Direct)
    // ==========================================
    const BACKEND_URL = "https://cyborg-backend-production.up.railway.app";
    
    // โหลดโหมดจาก sessionStorage (default = backend)
    let currentMode = sessionStorage.getItem('apiMode') || 'backend';
    let GEMINI_KEY = sessionStorage.getItem('geminiKey') || '';
    let ELEVENLABS_KEY = sessionStorage.getItem('elevenLabsKey') || '';
    const ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

    // ==========================================
    // หน้าตั้งค่า API Key & Mode
    // ==========================================
    const apiSettings = document.getElementById('apiSettings');
    const directKeySection = document.getElementById('directKeySection');
    const modeRadios = document.querySelectorAll('input[name="apiMode"]');

    // แสดง/ซ่อน Section ตามโหมด
    function updateModeUI() {
        if (currentMode === 'direct') {
            directKeySection.style.display = 'flex';
        } else {
            directKeySection.style.display = 'none';
        }
    }

    // เปลี่ยนโหมดเมื่อกด Radio
    modeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentMode = e.target.value;
            updateModeUI();
        });
    });

    // ตรวจสอบว่าพร้อมใช้งานหรือยัง
    function checkKeys() {
        if (currentMode === 'backend') {
            // โหมด Backend ไม่ต้องใช้ Key
            apiSettings.classList.add('hidden');
        } else {
            // โหมด Direct ต้องมี Key ครบ
            if (GEMINI_KEY && ELEVENLABS_KEY) {
                apiSettings.classList.add('hidden');
            } else {
                apiSettings.classList.remove('hidden');
            }
        }
    }

    // บันทึก Key + Mode
    document.getElementById('btnSaveKeys').addEventListener('click', () => {
        const gemini = document.getElementById('geminiKeyInput').value.trim();
        const eleven = document.getElementById('elevenLabsKeyInput').value.trim();
        
        if (currentMode === 'direct') {
            if (!gemini || !eleven) {
                alert("กรุณากรอก API Key ให้ครบทั้ง 2 ช่องครับ");
                return;
            }
            GEMINI_KEY = gemini;
            ELEVENLABS_KEY = eleven;
            sessionStorage.setItem('geminiKey', gemini);
            sessionStorage.setItem('elevenLabsKey', eleven);
        }
        
        sessionStorage.setItem('apiMode', currentMode);
        apiSettings.classList.add('hidden');
        alert(`✅ บันทึกโหมด "${currentMode === 'backend' ? 'Backend' : 'Direct API'}" เรียบร้อย!`);
    });

    // ลบ Key ทั้งหมด
    document.getElementById('btnClearKeys').addEventListener('click', () => {
        if (confirm("ลบ Key และกลับไปใช้ Backend ใช่ไหมครับ?")) {
            sessionStorage.removeItem('geminiKey');
            sessionStorage.removeItem('elevenLabsKey');
            sessionStorage.removeItem('apiMode');
            GEMINI_KEY = '';
            ELEVENLABS_KEY = '';
            currentMode = 'backend';
            document.getElementById('geminiKeyInput').value = '';
            document.getElementById('elevenLabsKeyInput').value = '';
            document.querySelector('input[name="apiMode"][value="backend"]').checked = true;
            updateModeUI();
            checkKeys();
        }
    });

    // เริ่มต้น
    document.querySelector(`input[name="apiMode"][value="${currentMode}"]`).checked = true;
    updateModeUI();
    checkKeys();
document.addEventListener("DOMContentLoaded", () => {
    // ==========================================
    // 0. API KEYS (เก็บใน sessionStorage)
    // ==========================================
    let GEMINI_KEY = sessionStorage.getItem('geminiKey') || '';
    let ELEVENLABS_KEY = sessionStorage.getItem('elevenLabsKey') || '';
    const ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

    // ตรวจสอบว่ามี Key หรือยัง ถ้าไม่มีให้แสดงหน้าตั้งค่า
    const apiSettings = document.getElementById('apiSettings');
    function checkKeys() {
        if (!GEMINI_KEY || !ELEVENLABS_KEY) {
            apiSettings.classList.remove('hidden');
        } else {
            apiSettings.classList.add('hidden');
        }
    }
    checkKeys();

    // ปุ่มบันทึก Key
    document.getElementById('btnSaveKeys').addEventListener('click', () => {
        const gemini = document.getElementById('geminiKeyInput').value.trim();
        const eleven = document.getElementById('elevenLabsKeyInput').value.trim();
        
        if (!gemini || !eleven) {
            alert("กรุณากรอก API Key ให้ครบทั้ง 2 ช่องครับ");
            return;
        }
        
        GEMINI_KEY = gemini;
        ELEVENLABS_KEY = eleven;
        sessionStorage.setItem('geminiKey', gemini);
        sessionStorage.setItem('elevenLabsKey', eleven);
        
        apiSettings.classList.add('hidden');
        alert("✅ บันทึก Key เรียบร้อย! เริ่มใช้งานได้เลย");
    });

    // ปุ่มลบ Key
    document.getElementById('btnClearKeys').addEventListener('click', () => {
        if (confirm("ลบ API Key ทั้งหมดใช่ไหมครับ?")) {
            sessionStorage.removeItem('geminiKey');
            sessionStorage.removeItem('elevenLabsKey');
            GEMINI_KEY = '';
            ELEVENLABS_KEY = '';
            document.getElementById('geminiKeyInput').value = '';
            document.getElementById('elevenLabsKeyInput').value = '';
            alert("🗑️ ลบ Key เรียบร้อย (จะกลับมาใหม่เมื่อกรอกอีกครั้ง)");
            checkKeys();
        }
    });

    // ==========================================
    // 1. DOM Elements
    // ==========================================
    const mouthPart = document.getElementById('mouthPart');
    const btnToggleDrag = document.getElementById('btnToggleDrag');
    const wrapper = document.getElementById('characterWrapper');
    const studioContainer = document.getElementById('studioContainer');
    const scriptInput = document.getElementById('scriptInput');
    const liveStatus = document.getElementById('liveStatus');
    const chatOverlay = document.getElementById('chatOverlay');
    const soundWave = document.getElementById('soundWave');
    const mockChatInput = document.getElementById('mockChatInput'); 
    
    let isDragMode = false, isDragging = false, posX = 0, posY = -30;
    let isSpeaking = false, isProcessingQueue = false;

    // ==========================================
    // 2. Audio Unlock
    // ==========================================
    let audioUnlocked = false;
    function unlockAudio() {
        if (audioUnlocked) return;
        const s = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
        s.play().then(() => audioUnlocked = true).catch(() => {});
    }
    document.body.addEventListener('click', unlockAudio, { once: true });
    document.body.addEventListener('touchstart', unlockAudio, { once: true });

    // ==========================================
    // 3. Matrix (ย่อ)
    // ==========================================
    const canvas = document.getElementById('matrixCanvas');
    const ctx = canvas.getContext('2d');
    let matrixInterval, isMatrixOn = true, matrixSpeed = 50;
    const matrixChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*";
    const fontSize = 16;
    let columns, drops;
    
    function initMatrix() {
        canvas.width = studioContainer.clientWidth;
        canvas.height = studioContainer.clientHeight;
        columns = Math.floor(canvas.width / fontSize);
        drops = Array(columns).fill(1);
    }
    function drawMatrix() {
        ctx.fillStyle = "rgba(0,0,0,0.05)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#00E5FF";
        ctx.font = `${fontSize}px monospace`;
        for (let i = 0; i < drops.length; i++) {
            ctx.fillText(matrixChars[Math.floor(Math.random()*matrixChars.length)], i*fontSize, drops[i]*fontSize);
            if (drops[i]*fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
            drops[i]++;
        }
    }
    function startMatrix() { initMatrix(); matrixInterval = setInterval(drawMatrix, matrixSpeed); }
    
    document.getElementById('btnMatrixToggle')?.addEventListener('click', () => {
        isMatrixOn = !isMatrixOn;
        canvas.classList.toggle('hidden', !isMatrixOn);
        if (isMatrixOn) startMatrix(); else clearInterval(matrixInterval);
    });
    startMatrix();

    // ==========================================
    // 4. Mouth Position
    // ==========================================
    function updateMouthPosition() {
        mouthPart.style.left = `calc(50% + ${posX}px)`;
        mouthPart.style.top = `calc(50% + ${posY}px)`;
        mouthPart.style.transform = `translate(-50%,-50%)`;
    }
    function loadPositions() {
        const saved = localStorage.getItem('mouthPos');
        if (saved) { const p = JSON.parse(saved); posX = p.x; posY = p.y; }
        updateMouthPosition();
    }
    function savePositions() { localStorage.setItem('mouthPos', JSON.stringify({ x: posX, y: posY })); }
    window.savePositions = savePositions;

    btnToggleDrag?.addEventListener('click', () => {
        isDragMode = !isDragMode;
        btnToggleDrag.classList.toggle('active', isDragMode);
        btnToggleDrag.textContent = isDragMode ? "🛑 ปิดโหมดลาก" : "👉 เปิดโหมดลากปาก";
        mouthPart.style.pointerEvents = isDragMode ? 'auto' : 'none';
        mouthPart.style.outline = isDragMode ? '2px dashed yellow' : 'none';
        if (!isDragMode) savePositions();
    });
    mouthPart?.addEventListener('pointerdown', (e) => {
        if (!isDragMode) return;
        isDragging = true;
        mouthPart.setPointerCapture(e.pointerId);
    });
    mouthPart?.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const r = studioContainer.getBoundingClientRect();
        posX = (e.clientX - r.left) - (r.width / 2);
        posY = (e.clientY - r.top) - (r.height / 2);
        updateMouthPosition();
    });
    mouthPart?.addEventListener('pointerup', () => {
        if (isDragging) { isDragging = false; savePositions(); }
    });
    loadPositions();

    // ==========================================
    // 5. 🔥 AI APIs (Direct Call - ไม่ใช้ Backend)
    // ==========================================
    
    // เรียก Gemini โดยตรง
    async function callGemini(userMessage) {
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        system_instruction: {
                            parts: [{ text: "คุณคือพี่โอม พิธีกร AI ครึ่งคนครึ่งไซบอร์ก ให้ตอบสั้นๆ สุภาพ เป็นกันเอง" }]
                        },
                        contents: [{ parts: [{ text: userMessage }] }]
                    })
                }
            );
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            return data.candidates[0].content.parts[0].text;
        } catch (err) {
            console.error("Gemini Error:", err);
            return "ขอโทษครับ พี่โอมคิดไม่ออกตอนนี้";
        }
    }

    // เรียก ElevenLabs โดยตรง
    async function callElevenLabs(text) {
        try {
            const response = await fetch(
                `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
                {
                    method: 'POST',
                    headers: {
                        'xi-api-key': ELEVENLABS_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: text,
                        model_id: "eleven_multilingual_v2"
                    })
                }
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.blob();
        } catch (err) {
            console.error("ElevenLabs Error:", err);
            return null;
        }
    }

    // ==========================================
    // 6. Speech Processing
    // ==========================================
    function startTalkingAnim() {
        wrapper.classList.add('talking');
        if (soundWave) soundWave.classList.add('active');
        if (liveStatus) { liveStatus.textContent = "LIVE"; liveStatus.style.background = "#f44336"; }
    }
    function stopTalkingAnim() {
        wrapper.classList.remove('talking');
        if (soundWave) soundWave.classList.remove('active');
        if (liveStatus) { liveStatus.textContent = "STANDBY"; liveStatus.style.background = "#9e9e9e"; }
        isSpeaking = false;
        isProcessingQueue = false;
        resetSilenceTimer();
    }

    let elevenCalls = [];
    function canUseElevenLabs() {
        const now = Date.now();
        elevenCalls = elevenCalls.filter(t => (now - t) < 60000);
        if (elevenCalls.length >= 3) return false;
        elevenCalls.push(now);
        return true;
    }

    async function playAudio(text) {
        if (isSpeaking) window.speechSynthesis.cancel();
        isSpeaking = true;
        addChatBubble("พี่โอม", text, true);
        startTalkingAnim();

        // ถ้าไม่มี Key หรือใช้ครบ 3 ครั้ง ให้ Web Speech
        if (!ELEVENLABS_KEY || !canUseElevenLabs()) {
            return new Promise((resolve) => fallbackWebSpeech(text, resolve));
        }

        const blob = await callElevenLabs(text);
        if (!blob) return new Promise((resolve) => fallbackWebSpeech(text, resolve));

        return new Promise((resolve) => {
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.onended = () => { URL.revokeObjectURL(url); stopTalkingAnim(); resolve(); };
            audio.onerror = () => { URL.revokeObjectURL(url); fallbackWebSpeech(text, resolve); };
            audio.play().catch(() => fallbackWebSpeech(text, resolve));
        });
    }

    function fallbackWebSpeech(text, resolve) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'th-TH';
            u.onend = () => { stopTalkingAnim(); resolve(); };
            u.onerror = () => { stopTalkingAnim(); resolve(); };
            window.speechSynthesis.speak(u);
        } else {
            stopTalkingAnim();
            resolve();
        }
    }

    async function processQueue() {
        if (speechQueue.length === 0) { isProcessingQueue = false; return; }
        isProcessingQueue = true;
        const item = speechQueue.dequeue();
        await playAudio(item.text);
        processQueue();
    }

    // ==========================================
    // 7. Priority Queue
    // ==========================================
    class PriorityQueue {
        constructor() { this.items = []; }
        enqueue(text, priority) {
            this.items.push({ text, priority });
            this.items.sort((a, b) => a.priority - b.priority);
        }
        dequeue() { return this.items.shift(); }
        get length() { return this.items.length; }
        clear() { this.items = []; }
    }
    const speechQueue = new PriorityQueue();

    // ==========================================
    // 8. Chat
    // ==========================================
    window.sendMockChat = async function() {
        const text = mockChatInput.value.trim();
        if (!text) return;
        addChatBubble("ผู้ชม", text);
        mockChatInput.value = '';
        clearTimeout(silenceTimer);
        lastConversationTime = Date.now();

        const reply = await callGemini(text);
        speechQueue.enqueue(reply, 1);
        if (!isProcessingQueue) processQueue();
    };

    function addChatBubble(user, text, isBot = false) {
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${isBot ? 'bot-reply' : ''}`;
        bubble.innerHTML = `<span class="user-name">${user}:</span> ${text}`;
        chatOverlay.appendChild(bubble);
        chatOverlay.scrollTop = chatOverlay.scrollHeight;
        while (chatOverlay.children.length > 2) chatOverlay.removeChild(chatOverlay.firstChild);
        setTimeout(() => {
            if (bubble.parentNode) {
                bubble.style.transition = 'opacity 0.5s';
                bubble.style.opacity = '0';
                setTimeout(() => bubble.remove(), 500);
            }
        }, 5000);
    }

    // ==========================================
    // 9. Speech Library (ย่อ)
    // ==========================================
    const speechLibrary = {
        greeting: ["สวัสดีครับทุกคน ยินดีต้อนรับเข้าสู่ไลฟ์ครับ", "แวะเข้ามาทักทายกันได้นะครับ", "วันนี้เป็นอย่างไรกันบ้างครับ"],
        like: ["ฝากกดไลก์ให้กันหน่อยนะครับ", "กดหัวใจคนละดวงเป็นกำลังใจนะครับ", "กดไลก์หกเจ็ดตามด้วยนะครับ"],
        follow: ["ฝากกดติดตามกันไว้ด้วยนะครับ", "ขอบคุณทุกคนที่ติดตามกันครับ"],
        conversation: ["วันนี้อยากคุยเรื่องอะไรกันครับ", "ทุกคนคิดอย่างไรกับเรื่องนี้ครับ"],
        humor: ["เงียบแบบนี้สงสัยกำลังแอบฟังกันอยู่แน่เลยครับ", "วันนี้ใครยิ้มแล้วบ้างครับ"],
        night: ["ดึกแล้วอย่าลืมพักผ่อนนะครับ", "หลับฝันดีนะครับทุกคน"],
        thanks: ["ขอบคุณสำหรับทุกกำลังใจครับ", "ขอบคุณที่เข้ามาพูดคุยกันนะครับ"]
    };

    function getRandomSpeech(category) {
        const list = speechLibrary[category];
        if (!list) return null;
        return list[Math.floor(Math.random() * list.length)];
    }

    // ==========================================
    // 10. Standby Timer
    // ==========================================
    let silenceTimer;
    let lastConversationTime = 0;
    const DELAYS = [7000, 15000, 20000, 30000];

    function resetSilenceTimer() {
        clearTimeout(silenceTimer);
        if (isSpeaking || isDragging) return;
        
        const since = Date.now() - lastConversationTime;
        let delay;
        if (since < 30000) delay = 30000;
        else if (since > 120000) delay = 7000;
        else delay = DELAYS[Math.floor(Math.random() * DELAYS.length)];

        silenceTimer = setTimeout(() => {
            if (!isSpeaking && !isDragging && speechQueue.length === 0) {
                const categories = ['greeting', 'like', 'follow', 'conversation', 'humor', 'night'];
                const cat = categories[Math.floor(Math.random() * categories.length)];
                const speech = getRandomSpeech(cat);
                if (speech) {
                    speechQueue.enqueue(speech, 5);
                    if (!isProcessingQueue) processQueue();
                }
            }
        }, delay);
    }
    resetSilenceTimer();

    // ==========================================
    // 11. Buttons
    // ==========================================
    document.getElementById('btnTestTalk')?.addEventListener('click', () => {
        const text = scriptInput.value.trim();
        if (text) {
            speechQueue.enqueue(text, 1);
            if (!isProcessingQueue) processQueue();
        }
        clearTimeout(silenceTimer);
    });
    document.getElementById('btnTestBlink')?.addEventListener('click', () => {
        wrapper.classList.add('blinking');
        setTimeout(() => wrapper.classList.remove('blinking'), 150);
    });

    // ==========================================
    // 12. ลบ Key อัตโนมัติเมื่อปิดหน้า
    // ==========================================
    window.addEventListener('beforeunload', () => {
        // ถ้าต้องการให้ Key หายเมื่อปิดแท็บจริงๆ ให้ใช้ sessionStorage
        // (ทำอยู่แล้วโดยปริยาย - sessionStorage จะหายเองเมื่อปิดแท็บ)
        console.log("👋 ปิดหน้าเว็บ - Key จะถูกลบอัตโนมัติ");
    });

    console.log("🚀 AI Host Ready (Standalone Mode)");
});
