document.addEventListener("DOMContentLoaded", () => {
    const BACKEND_URL = "https://cyborg-backend-production.up.railway.app";

    const mouthPart = document.getElementById('mouthPart');
    const btnToggleDrag = document.getElementById('btnToggleDrag');
    const wrapper = document.getElementById('characterWrapper');
    const studioContainer = document.getElementById('studioContainer');
    const scriptInput = document.getElementById('scriptInput');
    const liveStatus = document.getElementById('liveStatus');
    const chatOverlay = document.getElementById('chatOverlay');
    const soundWave = document.getElementById('soundWave');
    
    let isDragMode = false;
    let isDragging = false;
    // ปากจะอ้างอิงจากกลางจอ + จุดปากจริง (62% จากบนลงล่าง)
    let posX = 0, posY = 0;
    let isSpeaking = false;

    // --- 1. ระบบลากปาก (แก้ใหม่ทั้งหมด) ---
    function loadPositions() {
        const saved = localStorage.getItem('mouthPos');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                posX = parsed.x;
                posY = parsed.y;
            } catch(e) {}
        } else {
            // ค่าเริ่มต้นที่ตรงปากพี่โอมที่สุด (จากรูปที่ส่งมา)
            posX = -8;  // ติดลบ = ไปซ้ายนิดเดียว
            posY = -12; // ติดลบ = ขึ้นบนนิดเดียว
        }
        updateMouthPosition();
    }
    
    function updateMouthPosition() {
        // จุดกลางของปาก = 50% ซ้าย, 62% บน + ค่าที่ลาก
        mouthPart.style.left = `calc(50% + ${posX}px)`;
        mouthPart.style.top = `calc(62% + ${posY}px)`;
        mouthPart.style.transform = `translate(-50%, -50%)`;
    }

    btnToggleDrag.addEventListener('click', () => {
        isDragMode = !isDragMode;
        btnToggleDrag.classList.toggle('active', isDragMode);
        btnToggleDrag.textContent = isDragMode ? "🛑 ปิดโหมดลาก" : "👉 เปิดโหมดลากปาก";
        mouthPart.style.pointerEvents = isDragMode ? 'auto' : 'none';
        mouthPart.style.outline = isDragMode ? '2px dashed yellow' : 'none';
        mouthPart.style.cursor = isDragMode ? 'grab' : 'default';
        if (isDragMode) alert("ลากวงกลมฟ้าไปวางทับตรงกลางริมฝีปาก แล้วกดปุ่มอีกครั้งเพื่อบันทึก");
        else savePositions();
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
        // คำนวณจากตำแหน่งเมาส์เทียบกับจุดปากจริงโดยตรง ไม่ต้องลบครึ่งจอแบบเดิม
        posX = (e.clientX - rect.left) - (rect.width * 0.50);
        posY = (e.clientY - rect.top) - (rect.height * 0.62);
        updateMouthPosition();
    });

    mouthPart.addEventListener('pointerup', () => {
        if (isDragging) {
            isDragging = false;
            savePositions();
        }
    });

    function savePositions() {
        localStorage.setItem('mouthPos', JSON.stringify({ x: posX, y: posY }));
    }
    window.savePositions = savePositions;
    loadPositions();

    // --- 2. ระบบอนิเมชัน ---
    function startTalkingAnim() {
    wrapper.classList.add('talking');
    // เพิ่มบรรทัดนี้ - ให้คลื่นเสียงล่างขยับด้วย
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
}

    

    // --- 3. ระบบพูด ---
    async function botSpeak(text) {
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
            audio.onended = () => stopTalkingAnim();
            await audio.play();
        } catch (err) {
            console.log("Fallback to Web Speech");
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'th-TH';
            utterance.onend = () => stopTalkingAnim();
            window.speechSynthesis.speak(utterance);
        }
    }

    // --- 4. ระบบตอบแชท (Gemini) ---
    window.sendMockChat = async function() {
        const input = document.getElementById('mockChatInput');
        const text = input.value.trim();
        if (!text) return;
        
        addChatBubble("ผู้ชม", text);
        input.value = '';
        resetSilenceTimer();

        try {
            const response = await fetch(`${BACKEND_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });
            if (!response.ok) throw new Error("Gemini failed");
            const data = await response.json();
            botSpeak(data.reply);
        } catch (err) {
            const fallback = ["สวัสดีครับ มีอะไรให้พี่โอมช่วยไหมครับ", "คำถามนี้น่าสนใจมากครับ"];
            botSpeak(fallback[Math.floor(Math.random() * fallback.length)]);
        }
    };

    // --- 5. ระบบแชท UI (แก้ใหม่: เล็ก + ไม่บังหน้า + หายเอง) ---
    function addChatBubble(user, text, isBot = false) {
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${isBot ? 'bot-reply' : ''}`;
        bubble.innerHTML = `<span class="user-name">${user}:</span> ${text}`;
        chatOverlay.appendChild(bubble);
        chatOverlay.scrollTop = chatOverlay.scrollHeight;
        
        // เก็บไว้แค่ 1 ข้อความล่าสุด ไม่บังหน้า
        while (chatOverlay.children.length > 1) {
            chatOverlay.removeChild(chatOverlay.firstChild);
        }

        // หายเองใน 5 วิ จะได้เห็นหน้าพี่โอมชัดๆ
        setTimeout(() => {
            bubble.style.transition = 'opacity 0.5s';
            bubble.style.opacity = '0';
            setTimeout(() => bubble.remove(), 500);
        }, 5000);
    }

    // --- 6. ปุ่มทดสอบ ---
    document.getElementById('btnTestTalk')?.addEventListener('click', () => {
        const text = scriptInput.value.trim();
        if (text) botSpeak(text);
        resetSilenceTimer();
    });

    document.getElementById('btnTestBlink')?.addEventListener('click', () => {
        wrapper.classList.add('blinking');
        setTimeout(() => wrapper.classList.remove('blinking'), 150);
    });

    // --- 7. Standby Mode ---
    const standbyPrompts = [
        "ใครมีคำถามพิมพ์ถามพี่โอมได้เลยครับ",
        "ฝากกดไลก์ กดติดตาม เป็นกำลังใจให้พี่โอมด้วยนะครับ"
    ];
    let silenceTimer;

    function resetSilenceTimer() {
        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
            if (!isSpeaking && !isDragging) { 
                const prompt = standbyPrompts[Math.floor(Math.random() * standbyPrompts.length)];
                botSpeak(prompt);
            }
        }, 15000);
    }
    resetSilenceTimer();
});
