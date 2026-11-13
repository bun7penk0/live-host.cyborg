document.addEventListener("DOMContentLoaded", () => {
    const BACKEND_URL = "https://cyborg-backend-production.up.railway.app";

    // DOM Elements
    const mouthPart = document.getElementById('mouthPart');
    const btnToggleDrag = document.getElementById('btnToggleDrag');
    const wrapper = document.getElementById('characterWrapper');
    const studioContainer = document.getElementById('studioContainer');
    const scriptInput = document.getElementById('scriptInput');
    const liveStatus = document.getElementById('liveStatus');
    const chatOverlay = document.getElementById('chatOverlay');
    const soundWave = document.getElementById('soundWave');
    const mockChatInput = document.getElementById('mockChatInput'); 
    
    // State
    let isDragMode = false;
    let isDragging = false;
    let posX = 0, posY = -30; 
    let isSpeaking = false;
    let isProcessingQueue = false;

    // ==========================================
    // 0. AUDIO UNLOCK
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
    // 1. MATRIX BACKGROUND
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
        drops = [];
        for (let i = 0; i < columns; i++) drops[i] = 1;
    }
    function drawMatrix() {
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
    btnMatrixToggle.addEventListener('click', () => {
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
    selectMatrixSpeed.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'slow') matrixSpeed = 100;
        if (val === 'normal') matrixSpeed = 50;
        if (val === 'fast') matrixSpeed = 20;
        if (isMatrixOn) { clearInterval(matrixInterval); startMatrix(); }
    });
    startMatrix();
    window.addEventListener('resize', () => { if (isMatrixOn) initMatrix(); });

    // ==========================================
    // 2. MOUTH POSITION
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

    btnToggleDrag.addEventListener('click', () => {
        isDragMode = !isDragMode;
        btnToggleDrag.classList.toggle('active', isDragMode);
        btnToggleDrag.textContent = isDragMode ? "🛑 ปิดโหมดลาก (บันทึก)" : "👉 เปิดโหมดลากปาก";
        mouthPart.style.pointerEvents = isDragMode ? 'auto' : 'none';
        mouthPart.style.outline = isDragMode ? '2px dashed yellow' : 'none';
        if (!isDragMode) savePositions();
    });
    mouthPart.addEventListener('pointerdown', (e) => {
        if (!isDragMode) return;
        isDragging = true;
        mouthPart.setPointerCapture(e.pointerId);
        e.preventDefault();
    });
    mouthPart.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const rect = studioContainer.getBoundingClientRect();
        posX = (e.clientX - rect.left) - (rect.width / 2);
        posY = (e.clientY - rect.top) - (rect.height / 2);
        updateMouthPosition();
    });
    mouthPart.addEventListener('pointerup', () => {
        if (isDragging) { isDragging = false; savePositions(); }
    });
    loadPositions();

    // ==========================================
    // 3. 🔥 PRIORITY QUEUE ENGINE (SPEC Phase 1)
    // ==========================================
    // Priority 1: คำถามผู้ชม
    // Priority 2: ขอบคุณของขวัญ/ติดตาม
    // Priority 3: ทักทายคนใหม่
    // Priority 4: สนทนาตามบริบท
    // Priority 5: ตามเวลา
    // Priority 6: ชวนกดไลก์
    
    class PriorityQueue {
        constructor() {
            this.items = [];
        }
        enqueue(text, priority, category) {
            const item = { text, priority, category, addedAt: Date.now() };
            this.items.push(item);
            // เรียงตาม priority (เลขน้อย = สำคัญกว่า)
            this.items.sort((a, b) => a.priority - b.priority);
        }
        dequeue() {
            return this.items.shift();
        }
        peek() {
            return this.items[0];
        }
        get length() {
            return this.items.length;
        }
        clear() {
            this.items = [];
        }
    }

    const speechQueue = new PriorityQueue();

    // 🔥 ระบบ Duplicate Window (SPEC ข้อ 7)
    // เก็บประโยคที่พูดไปแล้วใน 10 นาที
    const DUPLICATE_WINDOW_MS = 10 * 60 * 1000; // 10 นาที
    
    function loadSpokenHistory() {
        const saved = localStorage.getItem('spokenHistory');
        if (saved) {
            const history = JSON.parse(saved);
            // กรองเอาเฉพาะที่ยังไม่เกิน 10 นาที
            const now = Date.now();
            return history.filter(item => (now - item.spokenAt) < DUPLICATE_WINDOW_MS);
        }
        return [];
    }
    
    function saveSpokenHistory(history) {
        localStorage.setItem('spokenHistory', JSON.stringify(history));
    }

    let spokenHistory = loadSpokenHistory();

    function wasRecentlySpoken(text) {
        const now = Date.now();
        // ล้างประวัติที่เก่าเกิน 10 นาทีออกก่อน
        spokenHistory = spokenHistory.filter(item => (now - item.spokenAt) < DUPLICATE_WINDOW_MS);
        return spokenHistory.some(item => item.text === text);
    }

    function markAsSpoken(text) {
        spokenHistory.push({ text, spokenAt: Date.now() });
        saveSpokenHistory(spokenHistory);
    }

    // 🔥 Category Cooldown (SPEC ข้อ 6)
    // ป้องกันการพูดหมวดเดิมถี่เกินไป
    const categoryCooldowns = {
        greeting: 0,      // 3 นาที
        like: 0,          // 5 นาที
        follow: 0,        // 8 นาที
        thanks: 0,        // 10 นาที
        dailyLife: 0,     // 5 นาที
        encouragement: 0, // 10 นาที
        conversation: 0,  // 5 นาที
        humor: 0,         // 8 นาที
        night: 0,         // 5 นาที
        farewell: 0       // 10 นาที
    };

    const CATEGORY_COOLDOWN_MS = {
        greeting: 3 * 60 * 1000,
        like: 5 * 60 * 1000,
        follow: 8 * 60 * 1000,
        thanks: 10 * 60 * 1000,
        dailyLife: 5 * 60 * 1000,
        encouragement: 10 * 60 * 1000,
        conversation: 5 * 60 * 1000,
        humor: 8 * 60 * 1000,
        night: 5 * 60 * 1000,
        farewell: 10 * 60 * 1000
    };

    function canUseCategory(category) {
        const now = Date.now();
        if (now - categoryCooldowns[category] < CATEGORY_COOLDOWN_MS[category]) {
            return false;
        }
        categoryCooldowns[category] = now;
        return true;
    }

    // ==========================================
    // 4. ANIMATION & SPEECH PROCESSING
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

    async function processQueue() {
        if (speechQueue.length === 0) { 
            isProcessingQueue = false; 
            return; 
        }
        isProcessingQueue = true;
        const item = speechQueue.dequeue();
        await playAudio(item.text);
        processQueue(); 
    }

    async function playAudio(text) {
        if (isSpeaking) { window.speechSynthesis.cancel(); stopTalkingAnim(); }
        isSpeaking = true;
        addChatBubble("พี่โอม", text, true);
        startTalkingAnim();
        markAsSpoken(text); // 🔥 บันทึกว่าพูดประโยคนี้แล้ว

        return new Promise(async (resolve) => {
            let hasResolved = false;
            const safeResolve = () => { if (!hasResolved) { hasResolved = true; resolve(); } };
            const timeoutId = setTimeout(() => { if (!hasResolved) { fallbackWebSpeech(text, safeResolve); } }, 6000);

            try {
                const response = await fetch(`${BACKEND_URL}/api/tts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: text })
                });
                if (!response.ok) throw new Error("TTS failed");
                
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);
                audio.onended = () => { clearTimeout(timeoutId); stopTalkingAnim(); safeResolve(); };
                audio.onerror = () => { clearTimeout(timeoutId); fallbackWebSpeech(text, safeResolve); };
                await audio.play();
            } catch (err) {
                clearTimeout(timeoutId); fallbackWebSpeech(text, safeResolve);
            }
        });
    }

    function fallbackWebSpeech(text, callback) {
        if ('speechSynthesis' in window) {
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
    // 5. GEMINI CHAT (Priority 1)
    // ==========================================
    window.sendMockChat = async function() {
        const text = mockChatInput.value.trim();
        if (!text) return;
        
        addChatBubble("ผู้ชม", text);
        mockChatInput.value = '';
        
        // 🔥 หยุดตารางชั่วคราว เพราะมีคนคุย
        clearTimeout(silenceTimer);

        try {
            const response = await fetch(`${BACKEND_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });
            if (!response.ok) throw new Error("Gemini failed");
            const data = await response.json();
            
            // 🔥 Priority 1: ตอบแชท
            speechQueue.enqueue(data.reply, 1, 'conversation');
            if (!isProcessingQueue) processQueue();
            
        } catch (err) {
            console.log("Gemini Error", err);
            speechQueue.enqueue("ขอโทษครับ พี่โอมคิดช้าไปนิดนึง", 1, 'conversation');
            if (!isProcessingQueue) processQueue();
        }
    };

    // ==========================================
    // 6. CHAT UI
    // ==========================================
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
    // 7. 🔥 SPEECH LIBRARY (ตาม SPEC ข้อ 3)
    // ==========================================
    const speechLibrary = {
        // A. GREETING (Priority 3)
        greeting: [
            "สวัสดีครับทุกคน ยินดีต้อนรับเข้าสู่ไลฟ์ครับ",
            "แวะเข้ามาทักทายกันได้นะครับ",
            "วันนี้เป็นอย่างไรกันบ้างครับ",
            "ใครเพิ่งเข้ามาใหม่ ยินดีต้อนรับครับ",
            "เข้ามานั่งเล่นด้วยกันก่อนได้นะครับ",
            "ขอบคุณที่แวะมาเยี่ยมเยียนกันครับ",
            "วันนี้ใครอารมณ์ดีบ้างครับ",
            "มีใครกำลังพักผ่อนอยู่บ้างครับ",
            "เข้ามาแล้วอย่าเพิ่งรีบไปไหนนะครับ",
            "ยินดีที่ได้พบทุกคนครับ"
        ],
        // B. LIKE (Priority 6)
        like: [
            "ฝากกดไลก์ให้กันหน่อยนะครับ",
            "กดหัวใจคนละดวงเป็นกำลังใจนะครับ",
            "กดไลก์หกเจ็ดตามด้วยนะครับ",
            "ใครชอบบรรยากาศแบบนี้ส่งหัวใจมาได้เลยครับ",
            "ช่วยกันเติมหัวใจให้ไลฟ์นี้หน่อยครับ",
            "ขอบคุณทุกหัวใจที่ส่งมาให้ครับ",
            "กดไลก์กันเบา ๆ แต่กำลังใจเต็มร้อยครับ",
            "ใครเพิ่งเข้ามาอย่าลืมกดหัวใจนะครับ"
        ],
        // C. FOLLOW (Priority 2)
        follow: [
            "ฝากกดติดตามกันไว้ด้วยนะครับ",
            "จะได้กลับมาพบกันอีกในไลฟ์หน้าครับ",
            "ขอบคุณทุกคนที่ติดตามกันครับ",
            "ชวนเพื่อนเข้ามาพูดคุยกันได้นะครับ",
            "ฝากแชร์ไลฟ์ให้เพื่อน ๆ ด้วยนะครับ"
        ],
        // D. DAILY LIFE (Priority 5)
        dailyLife: [
            "วันนี้กินข้าวกันหรือยังครับ",
            "มื้อกลางวันกินอะไรกันครับ",
            "วันนี้ทำงานเหนื่อยไหมครับ",
            "อย่าลืมดูแลสุขภาพกันนะครับ",
            "วันนี้อากาศเป็นอย่างไรบ้างครับ",
            "ใครกำลังเดินทางอยู่ขอให้ปลอดภัยนะครับ",
            "วันนี้มีเรื่องดี ๆ เกิดขึ้นบ้างไหมครับ",
            "มีใครกำลังพักผ่อนอยู่บ้างครับ",
            "วันหยุดนี้มีแผนไปไหนกันครับ",
            "อย่าลืมหาเวลาพักให้ตัวเองนะครับ"
        ],
        // E. ENCOURAGEMENT (Priority 5)
        encouragement: [
            "ทำงานให้มีความสุขนะครับ",
            "เหนื่อยก็พักได้ครับ อย่าลืมดูแลตัวเอง",
            "ขอให้วันนี้เป็นวันที่ดีของทุกคนครับ",
            "เป็นกำลังใจให้ทุกคนที่กำลังต่อสู้นะครับ",
            "ทุกความพยายามมีคุณค่าเสมอครับ",
            "ขอให้การงานราบรื่นครับ",
            "อย่าลืมยิ้มให้ตัวเองบ้างนะครับ",
            "วันนี้อาจเหนื่อย แต่คุณทำได้ดีแล้วครับ",
            "ขอให้ทุกคนมีสุขภาพแข็งแรงครับ",
            "ขอให้พบเจอแต่สิ่งดี ๆ นะครับ"
        ],
        // F. CONVERSATION (Priority 4)
        conversation: [
            "วันนี้อยากคุยเรื่องอะไรกันครับ",
            "ใครมีเรื่องสนุก ๆ มาแบ่งปันกันบ้างครับ",
            "ทุกคนคิดอย่างไรกับเรื่องนี้ครับ",
            "ใครอยู่จังหวัดไหนกันบ้างครับ",
            "วันนี้มีใครอยากเล่าเรื่องราวของตัวเองไหมครับ",
            "พิมพ์มาคุยกันได้เลยนะครับ",
            "ไม่ต้องเกรงใจครับ เราคุยกันแบบเพื่อน",
            "มีคำถามอะไรถามได้เลยครับ"
        ],
        // G. HUMOR (Priority 6)
        humor: [
            "เงียบแบบนี้สงสัยกำลังแอบฟังกันอยู่แน่เลยครับ",
            "ใครกำลังกินขนมอยู่ อย่าลืมแบ่งผมด้วยนะครับ",
            "เข้ามาแล้วอย่าทำตัวเป็นคนแปลกหน้านะครับ",
            "วันนี้ใครยิ้มแล้วบ้างครับ",
            "ไลก์ไม่ต้องเยอะ ขอให้กดด้วยใจก็พอครับ",
            "คุยกันเพลิน ๆ ระวังลืมเวลากันนะครับ"
        ],
        // H. THANK YOU (Priority 2)
        thanks: [
            "ขอบคุณสำหรับทุกกำลังใจครับ",
            "ขอบคุณที่เข้ามาพูดคุยกันนะครับ",
            "ขอบคุณสำหรับหัวใจครับ",
            "ขอบคุณที่กดติดตามครับ",
            "ขอบคุณสำหรับการแบ่งปันครับ",
            "ทุกการสนับสนุนมีความหมายครับ"
        ],
        // I. NIGHT (Priority 5)
        night: [
            "ดึกแล้วอย่าลืมพักผ่อนนะครับ",
            "ขอให้คืนนี้เป็นคืนที่ดีครับ",
            "ใครทำงานกะกลางคืนขอส่งกำลังใจครับ",
            "ดูแลสุขภาพกันด้วยนะครับ",
            "หลับฝันดีนะครับทุกคน",
            "พรุ่งนี้ขอให้เป็นวันที่สดใสครับ"
        ],
        // J. FAREWELL (Priority 2)
        farewell: [
            "ขอบคุณทุกคนที่อยู่ด้วยกันวันนี้ครับ",
            "แล้วพบกันใหม่ในไลฟ์หน้าครับ",
            "เดินทางกลับบ้านปลอดภัยนะครับ",
            "ขอให้ทุกคนมีความสุขครับ",
            "ดูแลตัวเองด้วยนะครับ",
            "ราตรีสวัสดิ์ครับทุกคน"
        ]
    };

    // ==========================================
    // 8. 🔥 TIME-BASED ENGINE (SPEC ข้อ 2)
    // ==========================================
    function getTimeBasedCategory() {
        // ดึงเวลาประเทศไทย (UTC+7)
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const thaiTime = new Date(utc + (3600000 * 7));
        const hour = thaiTime.getHours();
        const minute = thaiTime.getMinutes();
        const timeInMinutes = hour * 60 + minute;

        // 05:00–08:59 = 300–539 MORNING
        if (timeInMinutes >= 300 && timeInMinutes < 540) return { category: "dailyLife", label: "MORNING" };
        // 09:00–11:29 = 540–689 WORKING
        if (timeInMinutes >= 540 && timeInMinutes < 690) return { category: "encouragement", label: "WORKING" };
        // 11:30–13:29 = 690–809 LUNCH
        if (timeInMinutes >= 690 && timeInMinutes < 810) return { category: "dailyLife", label: "LUNCH" };
        // 13:30–16:59 = 810–1019 AFTERNOON
        if (timeInMinutes >= 810 && timeInMinutes < 1020) return { category: "conversation", label: "AFTERNOON" };
        // 17:00–19:29 = 1020–1169 EVENING
        if (timeInMinutes >= 1020 && timeInMinutes < 1170) return { category: "encouragement", label: "EVENING" };
        // 19:30–21:59 = 1170–1319 PRIME TIME
        if (timeInMinutes >= 1170 && timeInMinutes < 1320) return { category: "conversation", label: "PRIME TIME" };
        // 22:00–04:59 = 1320–299 NIGHT
        return { category: "night", label: "NIGHT" };
    }

    // ==========================================
    // 9. 🔥 SMART SPEECH SELECTOR (ไม่มีพูดซ้ำ)
    // ==========================================
    function getRandomSpeech(category) {
        const list = speechLibrary[category];
        if (!list || list.length === 0) return null;
        
        // กรองประโยคที่ยังไม่ถูกพูดใน 10 นาที
        const available = list.filter(s => !wasRecentlySpoken(s));
        
        if (available.length === 0) {
            // ถ้าพูดครบทุกประโยคแล้ว ให้เว้นช่วงเงียบ (ตาม SPEC ข้อ 7)
            console.log(`⚠️ หมวด ${category} ถูกพูดครบทุกประโยคใน 10 นาที - เว้นช่วงเงียบ`);
            return null;
        }
        
        return available[Math.floor(Math.random() * available.length)];
    }

    // ==========================================
    // 10. 🔥 HYBRID DECISION ENGINE
    // ==========================================
    function decideNextSpeech() {
        // ลำดับความสำคัญ:
        // Priority 2: ถ้ามี thanks/follow ค้าง (จาก event)
        // Priority 3: ทักทาย (ครั้งแรก)
        // Priority 4: สนทนา (ถ้ามีคนพิมพ์)
        // Priority 5: ตามเวลา
        // Priority 6: ชวนกดไลก์/ตลก
        
        // ถ้าเป็นครั้งแรก ให้ทักทาย
        if (!localStorage.getItem('hasSpokenWelcome')) {
            localStorage.setItem('hasSpokenWelcome', 'true');
            const greeting = getRandomSpeech('greeting');
            if (greeting) return { text: greeting, priority: 3 };
        }
        
        // ลองหาคำพูดตามเวลา (Priority 5)
        const timeCategory = getTimeBasedCategory();
        if (canUseCategory(timeCategory.category)) {
            const speech = getRandomSpeech(timeCategory.category);
            if (speech) return { text: speech, priority: 5 };
        }
        
        // ถ้าไม่ได้ ให้ลองชวนกดไลก์ (Priority 6)
        if (canUseCategory('like')) {
            const speech = getRandomSpeech('like');
            if (speech) return { text: speech, priority: 6 };
        }
        
        // ตลก (Priority 6)
        if (canUseCategory('humor')) {
            const speech = getRandomSpeech('humor');
            if (speech) return { text: speech, priority: 6 };
        }
        
        // สนทนา (Priority 4)
        if (canUseCategory('conversation')) {
            const speech = getRandomSpeech('conversation');
            if (speech) return { text: speech, priority: 4 };
        }
        
        // ไม่มีอะไรจะพูด ให้เว้นช่วงเงียบ
        return null;
    }

    // ==========================================
    // 11. 🔥 EVENT SIMULATORS (สำหรับทดสอบ)
    // ==========================================
    window.simulateLike = function() {
        const speech = getRandomSpeech('like');
        if (speech) {
            speechQueue.enqueue(speech, 2, 'like');
            if (!isProcessingQueue) processQueue();
        }
    };

    window.simulateFollow = function() {
        const speech = getRandomSpeech('follow') || getRandomSpeech('thanks');
        if (speech) {
            speechQueue.enqueue(speech, 2, 'follow');
            if (!isProcessingQueue) processQueue();
        }
    };

    window.simulateGift = function() {
        const speech = getRandomSpeech('thanks');
        if (speech) {
            speechQueue.enqueue(speech, 2, 'thanks');
            if (!isProcessingQueue) processQueue();
        }
    };

    window.simulateViewerJoin = function() {
        const speech = getRandomSpeech('greeting');
        if (speech) {
            speechQueue.enqueue(speech, 3, 'greeting');
            if (!isProcessingQueue) processQueue();
        }
    };

    // ==========================================
    // 12. 🔥 STANDBY MODE (30 วินาที ตาม SPEC)
    // ==========================================
    let silenceTimer;
    
    function resetSilenceTimer() {
        clearTimeout(silenceTimer);
        // SPEC ข้อ 6: ระยะห่างบทพูดทั่วไป 30 วินาที
        silenceTimer = setTimeout(() => {
            if (!isSpeaking && !isDragging && speechQueue.length === 0) { 
                const decision = decideNextSpeech();
                if (decision) {
                    speechQueue.enqueue(decision.text, decision.priority, 'auto');
                    if (!isProcessingQueue) processQueue();
                } else {
                    // ไม่มีอะไรจะพูด ให้รออีก 30 วิ
                    resetSilenceTimer();
                }
            }
        }, 30000); // 30 วินาที
    }
    
    resetSilenceTimer();

    // ==========================================
    // 13. BUTTONS
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

    // ==========================================
    // 14. INIT
    // ==========================================
    console.log("🚀 AI Host System Ready (Phase 1)");
    console.log("📋 SPEC: Priority Queue + Duplicate Window + 30s Interval");
    console.log("🎯 Priority Levels: 1=Chat, 2=Gift/Follow, 3=Greeting, 4=Conversation, 5=Time, 6=Like");
});
