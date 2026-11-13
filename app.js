document.addEventListener("DOMContentLoaded", () => {
    const BACKEND_URL = "https://cyborg-backend-production.up.railway.app";

    // ==========================================
    // DOM Elements & State
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
    
    let isDragMode = false;
    let isDragging = false;
    let posX = 0, posY = -30; 
    let isSpeaking = false;
    let isProcessingQueue = false;

    // ==========================================
    // 0. Audio Unlock (ปลดล็อกเสียงเบราว์เซอร์)
    // ==========================================
    let audioUnlocked = false;
    function unlockAudio() {
        if (audioUnlocked) return;
        const silentAudio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
        silentAudio.play().then(() => { audioUnlocked = true; }).catch(() => {});
    }
    document.body.addEventListener('click', unlockAudio, { once: true });
    document.body.addEventListener('touchstart', unlockAudio, { once: true });

    // ==========================================
    // 1. Matrix Background
    // ==========================================
    const canvas = document.getElementById('matrixCanvas');
    const ctx = canvas.getContext('2d');
    let matrixInterval, isMatrixOn = true, matrixSpeed = 50;
    const matrixChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*";
    const fontSize = 16;
    let columns, drops;

    function initMatrix() {
        if (!canvas || !studioContainer) return;
        canvas.width = studioContainer.clientWidth;
        canvas.height = studioContainer.clientHeight;
        columns = Math.floor(canvas.width / fontSize);
        drops = [];
        for (let i = 0; i < columns; i++) drops[i] = 1;
    }
    function drawMatrix() {
        if (!ctx) return;
        ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#00E5FF";
        ctx.font = `${fontSize}px monospace`;
        for (let i = 0; i < drops.length; i++) {
            const text = matrixChars[Math.floor(Math.random() * matrixChars.length)];
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);
            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
            drops[i]++;
        }
    }
    function startMatrix() { initMatrix(); matrixInterval = setInterval(drawMatrix, matrixSpeed); }
    
    const btnMatrixToggle = document.getElementById('btnMatrixToggle');
    const selectMatrixSpeed = document.getElementById('matrixSpeed');
    btnMatrixToggle?.addEventListener('click', () => {
        isMatrixOn = !isMatrixOn;
        if (isMatrixOn) {
            canvas.classList.remove('hidden');
            btnMatrixToggle.textContent = "เปิด";
            btnMatrixToggle.classList.add('active');
            startMatrix();
        } else {
            canvas.classList.add('hidden');
            btnMatrixToggle.textContent = "ปิด";
            btnMatrixToggle.classList.remove('active');
            clearInterval(matrixInterval);
        }
    });
    selectMatrixSpeed?.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'slow') matrixSpeed = 100;
        if (val === 'normal') matrixSpeed = 50;
        if (val === 'fast') matrixSpeed = 20;
        if (isMatrixOn) { clearInterval(matrixInterval); startMatrix(); }
    });
    startMatrix();
    window.addEventListener('resize', () => { if (isMatrixOn) initMatrix(); });

    // ==========================================
    // 2. Mouth Position (ตำแหน่งปาก)
    // ==========================================
    function updateMouthPosition() {
        mouthPart.style.left = `calc(50% + ${posX}px)`;
        mouthPart.style.top = `calc(50% + ${posY}px)`;
        mouthPart.style.transform = `translate(-50%, -50%)`;
    }
    function loadPositions() {
        const saved = localStorage.getItem('mouthPos');
        if (saved) {
            const parsed = JSON.parse(saved);
            posX = parsed.x; posY = parsed.y;
        }
        updateMouthPosition();
    }
    function savePositions() { localStorage.setItem('mouthPos', JSON.stringify({ x: posX, y: posY })); }
    window.savePositions = savePositions;

    btnToggleDrag?.addEventListener('click', () => {
        isDragMode = !isDragMode;
        btnToggleDrag.classList.toggle('active', isDragMode);
        btnToggleDrag.textContent = isDragMode ? "🛑 ปิดโหมดลาก (บันทึก)" : "👉 เปิดโหมดลากปาก";
        mouthPart.style.pointerEvents = isDragMode ? 'auto' : 'none';
        mouthPart.style.outline = isDragMode ? '2px dashed yellow' : 'none';
        if (!isDragMode) savePositions();
    });
    mouthPart?.addEventListener('pointerdown', (e) => {
        if (!isDragMode) return;
        isDragging = true;
        mouthPart.setPointerCapture(e.pointerId);
        e.preventDefault();
    });
    mouthPart?.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const rect = studioContainer.getBoundingClientRect();
        posX = (e.clientX - rect.left) - (rect.width / 2);
        posY = (e.clientY - rect.top) - (rect.height / 2);
        updateMouthPosition();
    });
    mouthPart?.addEventListener('pointerup', () => {
        if (isDragging) { isDragging = false; savePositions(); }
    });
    loadPositions();

    // ==========================================
    // 3. Priority Queue & Duplicate Window
    // ==========================================
    class PriorityQueue {
        constructor() { this.items = []; }
        enqueue(text, priority, category) {
            this.items.push({ text, priority, category, addedAt: Date.now() });
            this.items.sort((a, b) => a.priority - b.priority);
        }
        dequeue() { return this.items.shift(); }
        get length() { return this.items.length; }
        clear() { this.items = []; }
    }
    const speechQueue = new PriorityQueue();

    const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
    let spokenHistory = JSON.parse(localStorage.getItem('spokenHistory') || '[]');

    function wasRecentlySpoken(text) {
        const now = Date.now();
        spokenHistory = spokenHistory.filter(item => (now - item.spokenAt) < DUPLICATE_WINDOW_MS);
        return spokenHistory.some(item => item.text === text);
    }
    function markAsSpoken(text) {
        spokenHistory.push({ text, spokenAt: Date.now() });
        localStorage.setItem('spokenHistory', JSON.stringify(spokenHistory));
    }

    const categoryCooldowns = { greeting: 0, like: 0, follow: 0, thanks: 0, dailyLife: 0, encouragement: 0, conversation: 0, humor: 0, night: 0, farewell: 0 };
    const CATEGORY_COOLDOWN_MS = { greeting: 3*60*1000, like: 5*60*1000, follow: 8*60*1000, thanks: 10*60*1000, dailyLife: 5*60*1000, encouragement: 10*60*1000, conversation: 5*60*1000, humor: 8*60*1000, night: 5*60*1000, farewell: 10*60*1000 };

    function canUseCategory(category) {
        const now = Date.now();
        if (now - categoryCooldowns[category] < CATEGORY_COOLDOWN_MS[category]) return false;
        categoryCooldowns[category] = now;
        return true;
    }

    // ==========================================
    // 4. Speech Processing (ระบบเสียงหลัก)
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

    let elevenLabsCallTimes = [];
    function canCallElevenLabs() {
        const now = Date.now();
        elevenLabsCallTimes = elevenLabsCallTimes.filter(t => (now - t) < 60000); // 60 วิ
        if (elevenLabsCallTimes.length >= 3) return false; // 3 ครั้ง/นาที
        elevenLabsCallTimes.push(now);
        return true;
    }

    let queueStuckTimer;
    function startQueueWatchdog() {
        clearTimeout(queueStuckTimer);
        queueStuckTimer = setTimeout(() => {
            if (isProcessingQueue && isSpeaking) {
                console.log("⚠️ คิวค้าง - ล้างคิว");
                window.speechSynthesis.cancel();
                speechQueue.clear();
                isProcessingQueue = false;
                isSpeaking = false;
                stopTalkingAnim();
            }
        }, 10000); // 10 วิ
    }

    async function processQueue() {
        if (speechQueue.length === 0) { isProcessingQueue = false; return; }
        isProcessingQueue = true;
        startQueueWatchdog();
        
        const item = speechQueue.dequeue();
        await playAudio(item.text);
        
        clearTimeout(queueStuckTimer);
        processQueue(); 
    }

    async function playAudio(text) {
        if (isSpeaking) { window.speechSynthesis.cancel(); stopTalkingAnim(); }
        isSpeaking = true;
        addChatBubble("พี่โอม", text, true);
        startTalkingAnim();
        markAsSpoken(text);

        return new Promise(async (resolve) => {
            let hasResolved = false;
            const safeResolve = () => { if (!hasResolved) { hasResolved = true; resolve(); } };

            if (!canCallElevenLabs()) {
                console.log("⚠️ Rate Limit - ใช้ Web Speech แทน");
                fallbackWebSpeech(text, safeResolve);
                return;
            }

            const timeoutId = setTimeout(() => { 
                if (!hasResolved) fallbackWebSpeech(text, safeResolve); 
            }, 4000);

            try {
                const controller = new AbortController();
                const fetchTimeout = setTimeout(() => controller.abort(), 4000);
                
                const response = await fetch(`${BACKEND_URL}/api/tts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: text }),
                    signal: controller.signal
                });
                clearTimeout(fetchTimeout);
                
                if (response.status === 429) {
                    clearTimeout(timeoutId);
                    fallbackWebSpeech(text, safeResolve);
                    return;
                }
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                const audioBlob = await response.blob();
                if (audioBlob.size < 100) throw new Error("ไฟล์เสียงว่างเปล่า");
                
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);
                
                audio.onended = () => { 
                    clearTimeout(timeoutId); 
                    URL.revokeObjectURL(audioUrl);
                    stopTalkingAnim(); 
                    safeResolve(); 
                };
                audio.onerror = () => { 
                    clearTimeout(timeoutId); 
                    URL.revokeObjectURL(audioUrl);
                    fallbackWebSpeech(text, safeResolve); 
                };
                await audio.play();
            } catch (err) {
                clearTimeout(timeoutId);
                fallbackWebSpeech(text, safeResolve);
            }
        });
    }

    function fallbackWebSpeech(text, callback) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'th-TH';
            utterance.onend = () => { stopTalkingAnim(); if (callback) callback(); };
            utterance.onerror = () => { stopTalkingAnim(); if (callback) callback(); };
            window.speechSynthesis.speak(utterance);
        } else {
            stopTalkingAnim();
            if (callback) callback();
        }
    }

    // ==========================================
    // 5. Chat & UI
    // ==========================================
    window.sendMockChat = async function() {
        const text = mockChatInput.value.trim();
        if (!text) return;
        
        addChatBubble("ผู้ชม", text);
        mockChatInput.value = '';
        clearTimeout(silenceTimer);
        lastConversationTime = Date.now(); // อัปเดตเวลาคุย

        try {
            const response = await fetch(`${BACKEND_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });
            if (!response.ok) throw new Error("Gemini failed");
            const data = await response.json();
            
            speechQueue.enqueue(data.reply, 1, 'conversation');
            if (!isProcessingQueue) processQueue();
            
        } catch (err) {
            console.log("Gemini Error", err);
            speechQueue.enqueue("ขอโทษครับ พี่โอมคิดช้าไปนิดนึง", 1, 'conversation');
            if (!isProcessingQueue) processQueue();
        }
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
    // 6. Speech Library & Time Engine
    // ==========================================
    const speechLibrary = {
        greeting: ["สวัสดีครับทุกคน ยินดีต้อนรับเข้าสู่ไลฟ์ครับ", "แวะเข้ามาทักทายกันได้นะครับ", "วันนี้เป็นอย่างไรกันบ้างครับ", "ใครเพิ่งเข้ามาใหม่ ยินดีต้อนรับครับ", "เข้ามานั่งเล่นด้วยกันก่อนได้นะครับ"],
        like: ["ฝากกดไลก์ให้กันหน่อยนะครับ", "กดหัวใจคนละดวงเป็นกำลังใจนะครับ", "กดไลก์หกเจ็ดตามด้วยนะครับ", "ขอบคุณทุกหัวใจที่ส่งมาให้ครับ"],
        follow: ["ฝากกดติดตามกันไว้ด้วยนะครับ", "จะได้กลับมาพบกันอีกในไลฟ์หน้าครับ", "ขอบคุณทุกคนที่ติดตามกันครับ"],
        dailyLife: ["วันนี้กินข้าวกันหรือยังครับ", "มื้อกลางวันกินอะไรกันครับ", "วันนี้ทำงานเหนื่อยไหมครับ", "อย่าลืมดูแลสุขภาพกันนะครับ"],
        encouragement: ["ทำงานให้มีความสุขนะครับ", "เหนื่อยก็พักได้ครับ อย่าลืมดูแลตัวเอง", "ขอให้วันนี้เป็นวันที่ดีของทุกคนครับ"],
        conversation: ["วันนี้อยากคุยเรื่องอะไรกันครับ", "ใครมีเรื่องสนุก ๆ มาแบ่งปันกันบ้างครับ", "ทุกคนคิดอย่างไรกับเรื่องนี้ครับ"],
        humor: ["เงียบแบบนี้สงสัยกำลังแอบฟังกันอยู่แน่เลยครับ", "วันนี้ใครยิ้มแล้วบ้างครับ", "ไลก์ไม่ต้องเยอะ ขอให้กดด้วยใจก็พอครับ"],
        thanks: ["ขอบคุณสำหรับทุกกำลังใจครับ", "ขอบคุณที่เข้ามาพูดคุยกันนะครับ", "ขอบคุณสำหรับหัวใจครับ"],
        night: ["ดึกแล้วอย่าลืมพักผ่อนนะครับ", "ขอให้คืนนี้เป็นคืนที่ดีครับ", "หลับฝันดีนะครับทุกคน"],
        farewell: ["ขอบคุณทุกคนที่อยู่ด้วยกันวันนี้ครับ", "แล้วพบกันใหม่ในไลฟ์หน้าครับ", "ราตรีสวัสดิ์ครับทุกคน"]
    };

    function getTimeBasedCategory() {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const thaiTime = new Date(utc + (3600000 * 7));
        const h = thaiTime.getHours();
        const m = thaiTime.getMinutes();
        const t = h * 60 + m;

        if (t >= 300 && t < 540) return { category: "dailyLife", label: "MORNING" };
        if (t >= 540 && t < 690) return { category: "encouragement", label: "WORKING" };
        if (t >= 690 && t < 810) return { category: "dailyLife", label: "LUNCH" };
        if (t >= 810 && t < 1020) return { category: "conversation", label: "AFTERNOON" };
        if (t >= 1020 && t < 1170) return { category: "encouragement", label: "EVENING" };
        if (t >= 1170 && t < 1320) return { category: "conversation", label: "PRIME TIME" };
        return { category: "night", label: "NIGHT" };
    }

    function getRandomSpeech(category) {
        const list = speechLibrary[category];
        if (!list) return null;
        const available = list.filter(s => !wasRecentlySpoken(s));
        if (available.length === 0) return null;
        return available[Math.floor(Math.random() * available.length)];
    }

    function decideNextSpeech() {
        if (!localStorage.getItem('hasSpokenWelcome')) {
            localStorage.setItem('hasSpokenWelcome', 'true');
            const greeting = getRandomSpeech('greeting');
            if (greeting) return { text: greeting, priority: 3 };
        }
        
        const timeCat = getTimeBasedCategory();
        if (canUseCategory(timeCat.category)) {
            const speech = getRandomSpeech(timeCat.category);
            if (speech) return { text: speech, priority: 5 };
        }
        if (canUseCategory('like')) {
            const speech = getRandomSpeech('like');
            if (speech) return { text: speech, priority: 6 };
        }
        if (canUseCategory('conversation')) {
            const speech = getRandomSpeech('conversation');
            if (speech) return { text: speech, priority: 4 };
        }
        return null;
    }

    // ==========================================
    // 7. Dynamic Standby Timer
    // ==========================================
    let silenceTimer;
    let lastConversationTime = 0;
    const DYNAMIC_DELAYS = [7000, 15000, 20000, 30000];

    function getRandomDelay() {
        const timeSinceConversation = Date.now() - lastConversationTime;
        if (timeSinceConversation < 30000) return 30000;
        if (timeSinceConversation > 120000) return 7000;
        return DYNAMIC_DELAYS[Math.floor(Math.random() * DYNAMIC_DELAYS.length)];
    }

    function resetSilenceTimer() {
        clearTimeout(silenceTimer);
        const delay = getRandomDelay();
        console.log(`⏱️ พี่โอมจะพูดในอีก ${(delay/1000).toFixed(1)} วินาที`);
        
        silenceTimer = setTimeout(() => {
            if (!isSpeaking && !isDragging && speechQueue.length === 0) { 
                const decision = decideNextSpeech();
                if (decision) {
                    speechQueue.enqueue(decision.text, decision.priority, 'auto');
                    if (!isProcessingQueue) processQueue();
                } else {
                    resetSilenceTimer();
                }
            }
        }, delay);
    }
    resetSilenceTimer();

    // ==========================================
    // 8. Buttons & Init
    // ==========================================
    document.getElementById('btnTestTalk')?.addEventListener('click', () => {
        const text = scriptInput.value.trim();
        if (text) {
            speechQueue.enqueue(text, 1, 'test');
            if (!isProcessingQueue) processQueue();
        }
        clearTimeout(silenceTimer);
    });
    document.getElementById('btnTestBlink')?.addEventListener('click', () => {
        wrapper.classList.add('blinking');
        setTimeout(() => wrapper.classList.remove('blinking'), 150);
    });

    console.log("🚀 AI Host System Ready");
});
