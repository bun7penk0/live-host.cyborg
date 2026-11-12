// server.js (ตัวอย่างโครงสร้าง - ต้องติดตั้ง dependencies เพิ่ม)
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

// ===== 1. ElevenLabs TTS =====
app.post('/api/tts', async (req, res) => {
    const { text } = req.body;
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY; // เก็บใน .env
    const VOICE_ID = "YOUR_VOICE_ID";
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
        method: 'POST',
        headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text: text,
            model_id: "eleven_flash_v2_5", // รองรับไทย, latency ต่ำ [citation:11]
            voice_settings: { stability: 0.5, similarity_boost: 0.8 }
        })
    });
    
    const audioBuffer = await response.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(audioBuffer));
});

// ===== 2. Gemini Chat =====
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: "คุณคือพี่โอม พิธีกร AI ครึ่งคนครึ่งไซบอร์ก ตอบสั้นๆ สุภาพ ห้ามตอบเรื่องการเมือง ศาสนา และคำหยาบ" }]
                },
                contents: [{ parts: [{ text: message }] }]
            })
        }
    );
    
    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "ขอโทษครับ พี่โอมตอบไม่ได้ตอนนี้";
    res.json({ reply });
});

// ===== 3. Facebook Live Comments (SSE) =====
app.get('/api/live-comments/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // ⚠️ ต้องมี Facebook Access Token และ Live Video ID
    // ใช้ SSE Endpoint: https://streaming-graph.facebook.com/{live-video-id}/live_comments?access_token={token} [citation:3]
    
    // ตัวอย่างการ Polling (ทางเลือกถ้า SSE ยาก)
    // setInterval(async () => {
    //     const comments = await fetchFacebookComments();
    //     comments.forEach(c => res.write(`data: ${JSON.stringify(c)}\n\n`));
    // }, 3000);
});

// ===== 4. TikTok Live Comments =====
// ใช้ Library: tiktok-live-connector (npm) [citation:10]
// หรือ tiktok-live-api (npm) [citation:14]
// ต้องมี Signing API Key จาก Euler Stream

app.listen(3000, () => console.log('Backend running on port 3000'));
