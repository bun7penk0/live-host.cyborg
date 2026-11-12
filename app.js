document.addEventListener("DOMContentLoaded", () => {
    // ⚠️ ใส่ URL จาก Railway ของคุณตรงนี้ ⚠️
    const BACKEND_URL = "https://your-railway-url.up.railway.app"; 

    const mouthPart = document.getElementById('mouthPart');
    const btnToggleDrag = document.getElementById('btnToggleDrag');
    const wrapper = document.getElementById('characterWrapper');
    const scriptInput = document.getElementById('scriptInput');
    const liveStatus = document.getElementById('liveStatus');
    const chatOverlay = document.getElementById('chatOverlay');
    const soundWave = document.getElementById('soundWave');
    
    // ตัวแปรระบบลาก
    let isDragMode = false;
    let isDragging = false;
    let offsetX = 0, offsetY = 0;
    let posX = 0, posY = 44;
    let isSpeaking = false;

    // --- 1. ระบบลากปาก ---
    function loadPositions() {
        const saved = localStorage.getItem('mouthPos');
        if (saved) {
            const parsed = JSON.parse(saved);
            posX = parsed.x;
            posY = parsed.y;
        }
        updateMouthPosition();
    }
    function updateMouthPosition() { mouthPart.style.transform = `translate(${posX}px, ${posY}px)`; }

    btnToggleDrag.addEventListener('click', () => {
        isDragMode = !isDragMode;
        btnToggleDrag.classList.toggle('active', isDragMode);
        btnToggleDrag.textContent = isDragMode ? "🛑 ปิดโหมดลาก" : "👉 เปิดโหมดลากปาก";
        mouthPart.style.pointerEvents = isDragMode ? 'auto' : 'none';
        mouthPart.style.outline = isDragMode ? '2px dashed yellow' : 'none';
    });

    mouthPart.addEventListener('pointerdown', (e) => {
        if (!isDragMode) return;
        isDragging = true;
        const rect = mouthPart.getBoundingClientRect();
        offsetX = e.clientX - rect.left - (rect.width / 2);
        offsetY = e.clientY - rect.top - (rect.height / 2);
        e.preventDefault();
    });

    window.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const studioRect = document.getElementById('studioContainer').getBoundingClientRect();
        posX = (e.clientX - studioRect.left) - (studioRect.width / 2) - offsetX;
        posY = (e.clientY - studioRect.top) - (studioRect.height / 2) - offsetY;
        updateMouthPosition();
    });

    window.addEventListener('pointerup', () => {
        if (isDragging) { isDragging = false; window.savePositions(); }
    });

    window.savePositions = function() {
        localStorage.setItem('mouthPos', JSON.stringify({ x: posX, y: posY }));
    };
    loadPositions();

    // --- 2. ระบบอนิเมชัน ---
    function startTalkingAnim() {
        wrapper.classList.add('talking');
        soundWave.classList.add('active');
        liveStatus.textContent = "LIVE";
        liveStatus.style.background = "#f44336";
    }

    function stopTalkingAnim() {
        wrapper.classList.remove('talking');
        soundWave.classList.remove('active');
        liveStatus.textContent = "STANDBY";
        liveStatus.style.background = "#9e9e9e";
        isSpeaking = false;
    }

    // --- 3. ระบบพูด (ElevenLabs หรือ Web Speech) ---
    async function botSpeak(text) {
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            stopTalkingAnim();
        }
        isSpeaking = true;
        addChatBubble("พี่โอม", text, true);
        startTalkingAnim();

        try {
            // ลองเรียก ElevenLabs ผ่าน Railway
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
            // ถ้า Railway ไม่ตอบ ให้ใช้เสียงเบราว์เซอร์แทน
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

        try {
            // ลองเรียก Gemini ผ่าน Railway
            const response = await fetch(`${BACKEND_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            if (!response.ok) throw new Error("Gemini failed");
            const data = await response.json();
            botSpeak(data.reply);

        } catch (err) {
            // ถ้า Railway ไม่ตอบ ให้ตอบจำลอง
            const fallback = ["สวัสดีครับ มีอะไรให้พี่โอมช่วยไหมครับ", "คำถามนี้น่าสนใจมากครับ"];
            botSpeak(fallback[Math.floor(Math.random() * fallback.length)]);
        }
    };

    // --- 5. ระบบแชท UI ---
    function addChatBubble(user, text, isBot = false) {
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${isBot ? 'bot-reply' : ''}`;
        bubble.innerHTML = `<span class="user-name">${user}:</span> ${text}`;
        chatOverlay.appendChild(bubble);
        chatOverlay.scrollTop = chatOverlay.scrollHeight;
        if (chatOverlay.children.length > 5) chatOverlay.removeChild(chatOverlay.firstChild);
    }

    // --- 6. ปุ่มทดสอบ ---
    document.getElementById('btnTestTalk').addEventListener('click', () => {
        const text = scriptInput.value.trim();
        if (text) botSpeak(text);
    });

    document.getElementById('btnTestBlink').addEventListener('click', () => {
        wrapper.classList.add('blinking');
        setTimeout(() => wrapper.classList.remove('blinking'), 150);
    });

    // --- 7. Standby Mode (พูดเองเมื่อเงียบ) ---
    const standbyPrompts = [
        "ใครมีคำถามพิมพ์ถามพี่โอมได้เลยครับ",
        "ฝากกดไลก์ กดติดตาม เป็นกำลังใจให้พี่โอมด้วยนะครับ"
    ];
    let silenceTimer;

    function resetSilenceTimer() {
        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
            if (!isSpeaking) {
                const prompt = standbyPrompts[Math.floor(Math.random() * standbyPrompts.length)];
                botSpeak(prompt);
            }
        }, 15000); // 15 วินาที
    }
    resetSilenceTimer();
});
