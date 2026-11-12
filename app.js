document.addEventListener("DOMContentLoaded", () => {
    const mouthPart = document.getElementById('mouthPart');
    const mouthShape = document.getElementById('mouthShape');
    const btnToggleDrag = document.getElementById('btnToggleDrag');
    const wrapper = document.getElementById('characterWrapper');
    const scriptInput = document.getElementById('scriptInput');
    const liveStatus = document.getElementById('liveStatus');
    
    let isDragMode = false;
    let isDragging = false;
    let offsetX = 0, offsetY = 0;
    let posX = 0, posY = 44; // ตำแหน่งเริ่มต้น

    // --- 1. ระบบลากลำโพง ---
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
        if (isDragging) { isDragging = false; savePositions(); }
    });

    window.savePositions = function() {
        localStorage.setItem('mouthPos', JSON.stringify({ x: posX, y: posY }));
    };
    loadPositions();

    // --- 2. ระบบ TTS & Animation ---
    const synth = window.speechSynthesis;
    let isSpeaking = false;
    let talkInterval;

    function startTalkingAnim() {
        wrapper.classList.add('talking');
        liveStatus.textContent = "LIVE";
        liveStatus.style.background = "#f44336";
        talkInterval = setInterval(() => {
            const scale = 1 + (Math.random() * 0.3);
            mouthShape.style.transform = `scale(${scale})`;
        }, 80);
    }

    function stopTalkingAnim() {
        wrapper.classList.remove('talking');
        liveStatus.textContent = "STANDBY";
        liveStatus.style.background = "#9e9e9e";
        clearInterval(talkInterval);
        mouthShape.style.transform = 'scale(1)';
        isSpeaking = false;
    }

    function botSpeak(text) {
        if (isSpeaking) {
            synth.cancel(); // หยุดคำพูดเก่า
            stopTalkingAnim();
        }
        isSpeaking = true;
        startTalkingAnim();
        addChatBubble("พี่โอม", text, true);

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'th-TH';
        utterance.rate = 1.0;
        utterance.onend = () => { stopTalkingAnim(); };
        synth.speak(utterance);
    }

    document.getElementById('btnTestTalk').addEventListener('click', () => {
        const text = scriptInput.value.trim();
        if (text) botSpeak(text);
    });

    document.getElementById('btnTestBlink').addEventListener('click', () => {
        wrapper.classList.add('blinking');
        setTimeout(() => wrapper.classList.remove('blinking'), 150);
    });

    // --- 3. ระบบแชท & AI Logic ---
    const chatOverlay = document.getElementById('chatOverlay');
    
    function addChatBubble(user, text, isBot = false) {
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${isBot ? 'bot-reply' : ''}`;
        bubble.innerHTML = `<span class="user-name">${user}:</span> ${text}`;
        chatOverlay.appendChild(bubble);
        chatOverlay.scrollTop = chatOverlay.scrollHeight;
        if (chatOverlay.children.length > 5) chatOverlay.removeChild(chatOverlay.firstChild);
    }

    window.sendMockChat = function() {
        const input = document.getElementById('mockChatInput');
        const text = input.value.trim();
        if (!text) return;

        addChatBubble("ผู้ชม", text);
        input.value = '';
        
        // หน่วงเวลา 1 วิให้เหมือนกำลังคิด
        setTimeout(() => processAIResponse(text), 1000);
    };

    const badWords = ["คำหยาบ1", "คำหยาบ2"]; // เพิ่มคำหยาบที่นี่
    const knowledgeBase = [
        { keywords: ["บอล", "ฟุตบอล"], answers: ["เมื่อคืนบาร์เซโลน่าชนะขาดครับ 3-1"] },
        { keywords: ["สวัสดี", "หวัดดี"], answers: ["สวัสดีครับผม พี่โอม ยินดีที่ได้รู้จักครับ"] },
        { keywords: ["ชื่อ", "ใคร"], answers: ["ผมชื่อพี่โอม เป็นพิธีกร AI ครับ"] }
    ];

    function processAIResponse(userText) {
        if (badWords.some(word => userText.includes(word))) {
            botSpeak("ขอโทษด้วยครับ พี่โอมไม่ขอตอบคำถามในลักษณะนี้นะครับ");
            return;
        }

        let botAnswer = null;
        for (let item of knowledgeBase) {
            if (item.keywords.some(kw => userText.includes(kw))) {
                botAnswer = item.answers[Math.floor(Math.random() * item.answers.length)];
                break;
            }
        }

        if (!botAnswer) {
            const fallbacks = ["คำถามนี้ยากจังครับ ขอพี่โอมคิดแป๊บนึงนะ", "ยังไม่มีข้อมูลส่วนนี้เลยครับ"];
            botAnswer = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        }
        botSpeak(botAnswer);
    }

    // --- 4. Standby Mode ---
    const standbyPrompts = [
        "ใครมีคำถามพิมพ์ถามพี่โอมได้เลยครับ",
        "ฝากกดไลก์ กดติดตาม เป็นกำลังใจให้พี่โอมด้วยนะครับ"
    ];

    setInterval(() => {
        if (!isSpeaking) {
            const randomPrompt = standbyPrompts[Math.floor(Math.random() * standbyPrompts.length)];
            botSpeak(randomPrompt);
        }
    }, 15000); // 15 วินาที
});
