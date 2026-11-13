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
    let silenceTimer;
    let speechQueue = [];
    let isProcessingQueue = false;

    // ==========================================
    // 0. ปลดล็อกเสียงของเบราว์เซอร์ (Autoplay Policy)
    // ==========================================
    let audioUnlocked = false;
    function unlockAudio() {
        if (audioUnlocked) return;
        const silentAudio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
        silentAudio.play().then(() => {
            audioUnlocked = true;
        }).catch(() => {});
    }
    document.body.addEventListener('click', unlockAudio, { once: true });
    document.body.addEventListener('touchstart', unlockAudio, { once: true });

    // ==========================================
    // 1. ระบบ Matrix Background
    // ==========================================
    const canvas = document.getElementById('matrixCanvas');
    const ctx = canvas.getContext('2d');
    
    let matrixInterval;
    let isMatrixOn = true;
    let matrixSpeed = 50;
    
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

    function startMatrix() {
        initMatrix();
        matrixInterval = setInterval(drawMatrix, matrixSpeed);
    }

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
        if (isMatrixOn) {
            clearInterval(matrixInterval);
            startMatrix();
        }
    });

    startMatrix();

    window.addEventListener('resize', () => {
        if (isMatrixOn) initMatrix();
    });

    // ==========================================
    // 2. ระบบตำแหน่งปาก
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
    // 3. ระบบอนิเมชัน & คิวคำพูด
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
        isProcessingQueue = false; 
        resetSilenceTimer(); 
    }

    function enqueueSpeech(text) {
        speechQueue.push(text);
        if (!isProcessingQueue) processQueue();
    }

    async function processQueue() {
        if (speechQueue.length === 0) {
            isProcessingQueue = false;
            return;
        }
        isProcessingQueue = true;
        const textToSpeak = speechQueue.shift(); 
        await playAudio(textToSpeak);
        processQueue(); 
    }

    async function playAudio(text) {
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            stopTalkingAnim();
        }
        
        isSpeaking = true;
        addChatBubble("พี่โอม", text, true);
        startTalkingAnim();

        return new Promise(async (resolve) => {
            let hasResolved = false;
            const safeResolve = () => {
                if (!hasResolved) {
                    hasResolved = true;
                    resolve();
                }
            };

            const timeoutId = setTimeout(() => {
                if (!hasResolved) {
                    console.log("Backend Timeout - Switching to Web Speech");
                    fallbackWebSpeech(text, safeResolve);
                }
            }, 6000);

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
                    clearTimeout(timeoutId);
                    stopTalkingAnim();
                    safeResolve();
                };
                
                audio.onerror = () => {
                    clearTimeout(timeoutId);
                    fallbackWebSpeech(text, safeResolve);
                };

                await audio.play();

            } catch (err) {
                console.log("Fetch Error - Fallback to Web Speech", err);
                clearTimeout(timeoutId);
                fallbackWebSpeech(text, safeResolve);
            }
        });
    }

    function fallbackWebSpeech(text, callback) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'th-TH';
            utterance.rate = 1.0;
            
            utterance.onend = () => {
                stopTalkingAnim();
                if (callback) callback();
            };
            utterance.onerror = () => {
                stopTalkingAnim();
                if (callback) callback();
            };
            
            window.speechSynthesis.speak(utterance);
        } else {
            stopTalkingAnim();
            if (callback) callback();
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
        clearTimeout(silenceTimer); 

        try {
            const response = await fetch(`${BACKEND_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            if (!response.ok) throw new Error("Gemini failed");
            const data = await response.json();
            enqueueSpeech(data.reply);

        } catch (err) {
            console.log("Gemini Error", err);
            enqueueSpeech("ขอโทษครับ พี่โอมคิดช้าไปนิดนึง");
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

    // ==========================================
    // 6. ปุ่มทดสอบ
    // ==========================================
    document.getElementById('btnTestTalk')?.addEventListener('click', () => {
        const text = scriptInput.value.trim();
        if (text) enqueueSpeech(text);
        clearTimeout(silenceTimer);
    });

    document.getElementById('btnTestBlink')?.addEventListener('click', () => {
        wrapper.classList.add('blinking');
        setTimeout(() => wrapper.classList.remove('blinking'), 150);
    });

    // ==========================================
    // 7. Standby Mode (ระบบวนลูปบทพูด)
    // ==========================================
    
    // ✅ เพิ่มจำนวนบทพูดให้เยอะขึ้น
    const standbyPrompts = [
        "สวัสดีครับทุกคน ผมชื่อพี่โอม พิธีกร AI ประจำรายการครับ",
        "ยินดีต้อนรับเข้าสู่ห้องไลฟ์ครับ ใครเพิ่งเข้ามาก็ทักทายกันได้เลยนะครับ",
        "ฝากกดไลก์ กดติดตาม เป็นกำลังใจให้พี่โอมด้วยนะครับ",
        "ถ้าชอบรายการนี้ อย่าลืมกดหัวใจ กดติดตามกันด้วยนะครับ",
        "ใครมีคำถามหรือเรื่องไหนอยากคุยกับพี่โอม พิมพ์มาได้เลยครับ",
        "ช่วงนี้เงียบจังเลยครับ มีใครอยากแชทกับพี่โอมไหมครับ",
        "วันนี้มีเรื่องอะไรสนุกๆ มาเล่าให้พี่โอมฟังบ้างไหมครับ",
        "พี่โอมพร้อมตอบคำถามทุกคนเลยครับ พิมพ์มาได้เลย",
        "ถ้าใครมีเรื่องอยากปรึกษา พี่โอมยินดีรับฟังนะครับ",
        "มาคุยกับพี่โอมสนุกๆ กันดีกว่าครับ ใครอยู่บ้างยกมือขึ้น",
        "อย่าลืมแชร์ไลฟ์นี้ให้เพื่อนๆ มาดูด้วยนะครับ",
        "ขอบคุณทุกคนที่เข้ามาเป็นกำลังใจให้พี่โอมนะครับ"
    ];

    // ✅ ระบบสุ่มแบบไม่ซ้ำ (Shuffle Bag)
    let promptBag = [];
    function getNextStandbyPrompt() {
        if (promptBag.length === 0) {
            // ถ้าคลังว่าง ให้เอาบทพูดทั้งหมดมาใส่แล้วสลับตำแหน่ง (Fisher-Yates Shuffle)
            promptBag = [...standbyPrompts];
            for (let i = promptBag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [promptBag[i], promptBag[j]] = [promptBag[j], promptBag[i]];
            }
        }
        // ดึงบทพูดอันแรกออกมา (ซึ่งจะไม่ซ้ำกับรอบก่อนหน้า)
        return promptBag.pop();
    }

    function checkMealTime() {
        const hour = new Date().getHours();
        if (hour === 2) return "ตี 2 แล้วนะครับ ใครยังไม่นอนบ้างครับ";
        if (hour === 12) return "เที่ยงแล้วนะครับ อย่าลืมทานข้าวกลางวันกันด้วยนะครับ";
        if (hour === 20) return "สองทุ่มแล้วครับ ใครยังไม่ได้กินข้าวเย็นบ้างครับ";
        return null;
    }

    function resetSilenceTimer() {
        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
            if (!isSpeaking && !isDragging && speechQueue.length === 0) { 
                const mealPrompt = checkMealTime();
                
                if (mealPrompt) {
                    enqueueSpeech(mealPrompt);
                } else {
                    // ✅ ดึงบทพูดจากระบบสลับ
                    const nextPrompt = getNextStandbyPrompt();
                    enqueueSpeech(nextPrompt);
                }
            }
        }, 15000); // 15 วินาที
    }
    
    resetSilenceTimer();
});
