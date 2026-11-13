document.addEventListener("DOMContentLoaded", () => {
    // ⚠️ URL ของ Railway
    const BACKEND_URL = "https://cyborg-backend-production.up.railway.app";

    const mouthPart = document.getElementById('mouthPart');
    const btnToggleDrag = document.getElementById('btnToggleDrag');
    const wrapper = document.getElementById('characterWrapper');
    const studioContainer = document.getElementById('studioContainer');
    const scriptInput = document.getElementById('scriptInput');
    const liveStatus = document.getElementById('liveStatus');
    const chatOverlay = document.getElementById('chatOverlay');
    const soundWave = document.getElementById('soundWave');
    const mockChatInput = document.getElementById('mockChatInput'); 
    
    // ตัวแปรระบบ
    let isDragMode = false;
    let isDragging = false;
    let posX = 0, posY = -30; 
    let isSpeaking = false;
    let silenceTimer;

    // ==========================================
    // 1. ระบบตำแหน่งปาก (เหมือนเดิม)
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
            posX = parsed.x;
            posY = parsed.y;
        }
        updateMouthPosition();
    }

    function savePositions() {
        localStorage.setItem('mouthPos', JSON.stringify({ x: posX, y: posY }));
    }
    window.savePositions = savePositions;

    btnToggleDrag.addEventListener('click', () => {
        isDragMode = !isDragMode;
        btnToggleDrag.classList.toggle('active', isDragMode);
        btnToggleDrag.textContent = isDragMode ? "🛑 ปิดโหมดลาก (บันทึก)" : "👉 เปิดโหมดลากปาก";
        mouthPart.style.pointerEvents = isDragMode ? 'auto' : 'none';
        mouthPart.style.outline = isDragMode ? '2px dashed yellow' : 'none';
        mouthPart.style.cursor = isDragMode ? 'grab' : 'default';
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
    // 2. ระบบอนิเมชัน
    // ==========================================
    function startTalkingAnim() {
        wrapper.classList.add('talking');
        if (soundWave) soundWave.classList.add('active');
        if (liveStatus) {
            liveStatus.textContent = "LIVE";
            liveStatus.style.background = "#f44336";
        }
    }

    function stopTalkingAnim() {
        wrapper.classList.remove('talking');
        if (soundWave) soundWave.classList.remove('active');
        if (liveStatus) {
            liveStatus.textContent = "STANDBY";
            liveStatus.style.background = "#9e9e9e";
        }
        isSpeaking = false;
        
        // ✅ สำคัญมาก: เมื่อพูดจบ ให้เริ่มนับเวลา Standby ใหม่ทันที
        resetSilenceTimer(); 
    }

    // ==========================================
    // 3. ระบบเสียงพูด (TTS)
    // ==========================================
    async function botSpeak(text) {
        // ถ้ากำลังพูดอยู่ ให้หยุดก่อน
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            stopTalkingAnim();
        }
        
        isSpeaking = true;
        addChatBubble("พี่โอม", text, true);
        startTalkingAnim();

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
            
            // ✅ เมื่อเสียง ElevenLabs เล่นจบ
            audio.onended = () => stopTalkingAnim();
            await audio.play();

        } catch (err) {
            console.log("Fallback to Web Speech");
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'th-TH';
            // ✅ เมื่อเสียง Web Speech เล่นจบ
            utterance.onend = () => stopTalkingAnim(); 
            window.speechSynthesis.speak(utterance);
        }
    }

    // ==========================================
    // 4. ระบบตอบแชท (Gemini)
    // ==========================================
    window.sendMockChat = async function() {
        const text = mockChatInput.value.trim();
        if (!text) return;
        
        addChatBubble("ผู้ชม", text);
        mockChatInput.value = '';
        
        // ✅ มีคนคุยด้วย -> หยุดเวลา Standby (ให้ AI ตอบก่อน)
        clearTimeout(silenceTimer);

        try {
            const response = await fetch(`${BACKEND_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            if (!response.ok) throw new Error("Gemini failed");
            const data = await response.json();
            botSpeak(data.reply); // ให้ AI พูดตอบ

        } catch (err) {
            const fallback = ["สวัสดีครับ มีอะไรให้พี่โอมช่วยไหมครับ", "คำถามนี้น่าสนใจมากครับ"];
            botSpeak(fallback[Math.floor(Math.random() * fallback.length)]);
        }
    };

    // ==========================================
    // 5. UI แชท
    // ==========================================
    function addChatBubble(user, text, isBot = false) {
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${isBot ? 'bot-reply' : ''}`;
        bubble.innerHTML = `<span class="user-name">${user}:</span> ${text}`;
        chatOverlay.appendChild(bubble);
        chatOverlay.scrollTop = chatOverlay.scrollHeight;
        
        // เก็บไว้แค่ 2 ข้อความ
        while (chatOverlay.children.length > 2) {
            chatOverlay.removeChild(chatOverlay.firstChild);
        }

        // หายเองใน 5 วินาที
        setTimeout(() => {
            if (bubble.parentNode) {
                bubble.style.transition = 'opacity 0.5s';
                bubble.style.opacity = '0';
                setTimeout(() => bubble.remove(), 500);
            }
        }, 5000);
    }

    // ==========================================
    // 6. ปุ่มทดสอบ
    // ==========================================
    document.getElementById('btnTestTalk')?.addEventListener('click', () => {
        const text = scriptInput.value.trim();
        if (text) botSpeak(text);
        clearTimeout(silenceTimer);
    });

    document.getElementById('btnTestBlink')?.addEventListener('click', () => {
        wrapper.classList.add('blinking');
        setTimeout(() => wrapper.classList.remove('blinking'), 150);
    });

    // ==========================================
    // 7. Standby Mode (หัวใจของการพูดอัตโนมัติ)
    // ==========================================
    const standbyPrompts = [
        "ใครมีคำถามพิมพ์ถามพี่โอมได้เลยครับ",
        "ฝากกดไลก์ กดติดตาม เป็นกำลังใจให้พี่โอมด้วยนะครับ",
        "ช่วงนี้เงียบจังเลยครับ มีใครอยากคุยกับพี่โอมไหมครับ"
    ];

    function resetSilenceTimer() {
        // ล้างเวลาเดิมก่อนทุกครั้ง
        clearTimeout(silenceTimer);
        
        // ตั้งเวลาใหม่ 15 วินาที
        silenceTimer = setTimeout(() => {
            // เช็กว่าไม่ได้กำลังพูด และไม่ได้กำลังลากปาก
            if (!isSpeaking && !isDragging) { 
                const prompt = standbyPrompts[Math.floor(Math.random() * standbyPrompts.length)];
                botSpeak(prompt); // พูดข้อความ Standby
            }
        }, 15000); // 15000 ms = 15 วินาที
    }
    
    // เริ่มระบบ Standby ทันทีที่โหลดหน้าเว็บ
    resetSilenceTimer();
});
