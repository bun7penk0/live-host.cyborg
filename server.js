const express = require('express');
const cors = require('cors');
const app = express();

// 1. เปิดให้ทุกโดเมนสามารถเชื่อมต่อได้ (แก้ปัญหา CORS)
app.use(cors());
app.use(express.json());

// 2. เพิ่ม Route / เพื่อให้เช็กได้ว่า Server ทำงาน
app.get('/', (req, res) => {
    res.send('🤖 Cyborg Backend is Running!');
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; 

// 3. Endpoint สำหรับ Gemini AI
app.post('/api/chat', async (req, res) => {
    try {
        // เปลี่ยนเป็น gemini-1.5-flash เพื่อความเร็วและรองรับ API Key ใหม่
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `คุณคือพี่โอม พิธีกร AI ครึ่งคนครึ่งไซบอร์ก ตอบสั้นๆ สุภาพ: ${req.body.message}` }] }]
            })
        });
        const data = await response.json();
        res.json({ reply: data.candidates[0].content.parts[0].text });
    } catch (error) {
        console.error("Gemini Error:", error);
        res.status(500).json({ error: "AI Error" });
    }
});

// 4. Endpoint สำหรับ ElevenLabs TTS
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
        console.error("TTS Error:", error);
        res.status(500).json({ error: "TTS Error" });
    }
});

// 5. รัน Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
