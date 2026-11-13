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
    const mockChatInput = document.getElementById('mockChatInput'); 
    
    let isDragMode = false;
    let isDragging = false;
    let posX = 0, posY = -30; 
    let isSpeaking = false;
    let silenceTimer;
    
    // 🚀 ระบบคิวคำพูด (Speech Queue)
    let speechQueue = [];
    let isProcessingQueue = false;

    // --- 1. ระบบตำแหน่งปาก ---
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

    // --- 2. ระบบอนิเมชัน ---
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
        isProcessingQueue = false; 
        resetSilenceTimer(); 
    }

    // --- 3. ระบบคิวและการพูด ---
    // ฟังก์ชันเพิ่มคำพูดเข้าคิว
    function enqueueSpeech(text) {
        speechQueue.push(text);
        if (!isProcessingQueue) {
            processQueue();
        }
    }

    // ฟังก์ชันประมวลผลคิว
    async function processQueue() {
        if (speechQueue.length === 0) {
            isProcessingQueue = false;
            return;
        }

        isProcessingQueue = true;
        const textToSpeak = speechQueue.shift(); // ดึงคำพูดแรกออกมา
        await playAudio(textToSpeak);
        
        // เมื่อพูดจบ ให้เรียกฟังก์ชันนี้ซ้ำเพื่อพูดคำถัดไป
        processQueue(); 
    }

    // ฟังก์ชันเล่นเสียงจริง
    async function playAudio(text) {
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            stopTalkingAnim();
        }
        
        isSpeaking = true;
        addChatBubble("พี่โอม", text, true);
        startTalkingAnim();

        return new Promise(async (resolve) => {
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
                
                audio.onended = () => {
                    stopTalkingAnim();
                    resolve(); // แจ้งว่าพูดจบแล้ว
                };
                await audio.play();

            } catch (err) {
                console.log("Fallback to Web Speech");
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'th-TH';
                utterance.onend = () => {
                    stopTalkingAnim();
                    resolve(); // แจ้งว่าพูดจบแล้ว
                };
                window.speechSynthesis.speak(utterance);
            }
        });
    }

    // --- 4. ระบบตอบแชท (Gemini) ---
    window.sendMockChat = async function() {
        const text = mockChatInput.value.trim();
        if (!text) return;
        
        addChatBubble("ผู้ชม", text);
        mockChatInput.value = '';
        
        clearTimeout(silenceTimer); // หยุด Standby ชั่วคราว

        try {
            const response = await fetch(`${BACKEND_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            if (!response.ok) throw new Error("Gemini failed");
            const data = await response.json();
            
            // 🚀 ส่งคำตอบเข้าคิว (แทนที่จะพูดทันที)
            enqueueSpeech(data.reply);

        } catch (err) {
            enqueueSpeech("ขอโทษครับ พี่โอมคิดช้าไปนิดนึง");
        }
    };

    // --- 5. ระบบแชท UI ---
    function addChatBubble(user, text, isBot = false) {
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${isBot ? 'bot-reply' : ''}`;
        bubble.innerHTML = `<span class="user-name">${user}:</span> ${text}`;
        chatOverlay.appendChild(bubble);
        chatOverlay.scrollTop = chatOverlay.scrollHeight;
        
        while (chatOverlay.children.length > 2) {
            chatOverlay.removeChild(chatOverlay.firstChild);
        }

        setTimeout(() => {
            if (bubble.parentNode) {
                bubble.style.transition = 'opacity 0.5s';
                bubble.style.opacity = '0';
                setTimeout(() => bubble.remove(), 500);
            }
        }, 5000);
    }

    // --- 6. ปุ่มทดสอบ ---
    document.getElementById('btnTestTalk')?.addEventListener('click', () => {
        const text = scriptInput.value.trim();
        if (text) enqueueSpeech(text);
        clearTimeout(silenceTimer);
    });

    document.getElementById('btnTestBlink')?.addEventListener('click', () => {
        wrapper.classList.add('blinking');
        setTimeout(() => wrapper.classList.remove('blinking'), 150);
    });

    // --- 7. Standby Mode ---
    const standbyPrompts = [
        "สวัสดีครับทุกคน ผมชื่อพี่โอม พิธีกร AI ประจำรายการครับ",
        "ฝากกดไลก์ กดติดตาม เป็นกำลังใจให้พี่โอมด้วยนะครับ",
        "ใครมีคำถามหรือเรื่องไหนอยากคุยกับพี่โอม พิมพ์มาได้เลยครับ"
    ];

    function checkMealTime() {
        const hour = new Date().getHours();
        if (hour === 2) return "ตี 2 แล้วนะครับ ใครยังไม่นอนบ้างครับ";
        if (hour === 12) return "เที่ยงแล้วนะครับ อย่าลืมทานข้าวกลางวันกันด้วยนะครับ";
        if (hour === 20) return "สองทุ่มแล้วครับ ใครยังไม่ได้กินข้าวเย็นบ้างครับ";
        return null;
    }

    function resetSilenceTimer() {
        clearTimeout(silenceTimer);
        // ถ้าคิวว่างอยู่ และไม่ได้กำลังพูด ให้เริ่มนับเวลา Standby
        silenceTimer = setTimeout(() => {
            if (!isSpeaking && !isDragging && speechQueue.length === 0) { 
                const mealPrompt = checkMealTime();
                const prompt = mealPrompt || standbyPrompts[Math.floor(Math.random() * standbyPrompts.length)];
                enqueueSpeech(prompt);
            }
        }, 15000); 
    }
    
    resetSilenceTimer();
});
