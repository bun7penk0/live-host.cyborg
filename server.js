const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// ตัวแปรเก็บประวัติการคุย (จำกัด 5 ข้อความล่าสุดเพื่อประหยัด Token)
let chatHistory = [];

 const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; 

app.get('/', (req, res) => res.send('🤖 Cyborg Backend is Running!'));

// --- ระบบ AI Chat ที่จำบริบท ---
app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;
        
        // 1. เก็บข้อความของ User ลงประวัติ
        chatHistory.push({ role: "user", parts: [{ text: userMessage }] });
        
        // 2. ถ้าประวัติยาวเกิน 5 คู่ ให้ลบอันเก่าทิ้ง
        if (chatHistory.length > 10) chatHistory = chatHistory.slice(-10);

        // 3. ส่งไปให้ Gemini
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: "คุณคือพี่โอม พิธีกร AI ครึ่งคนครึ่งไซบอร์ก ให้ตอบคำถามสั้นๆ สุภาพ เป็นกันเอง ห้ามตอบเรื่องการเมือง ศาสนา หรือคำหยาบ" }]
                },
                contents: chatHistory // ส่งประวัติไปด้วยเพื่อให้ AI จำบริบท
            })
        });
        
        const data = await response.json();
        const botReply = data.candidates[0].content.parts[0].text;

        // 4. เก็บคำตอบของ AI ลงประวัติ
        chatHistory.push({ role: "model", parts: [{ text: botReply }] });

        res.json({ reply: botReply });
    } catch (error) {
        console.error("Gemini Error:", error);
        res.status(500).json({ error: "AI Error" });
    }
});

// --- ระบบเสียง TTS ---
app.post('/api/tts', async (req, res) => {
    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
            method: 'POST',
            headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: req.body.text, model_id: "eleven_multilingual_v2" })
        });
        const audioBuffer = await response.arrayBuffer();
        res.set('Content-Type', 'audio/mpeg');
        res.send(Buffer.from(audioBuffer));
    } catch (error) {
        res.status(500).json({ error: "TTS Error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
