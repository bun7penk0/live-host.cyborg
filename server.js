const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let chatHistory = [];

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; 

// URL ของโมเดล Gemini
// ✅ ใช้ gemini-flash-latest (alias ที่ Google การันตีความเสถียร)
const GEMINI_MODEL_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

// ฟังก์ชันสำหรับเรียก Gemini พร้อมระบบ Retry อัตโนมัติ
async function callGemini(contents, retries = 2) {
    for (let i = 0; i <= retries; i++) {
        try {
            const response = await fetch(GEMINI_MODEL_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: {
                        parts: [{ text: "คุณคือพี่โอม พิธีกร AI ครึ่งคนครึ่งไซบอร์ก ให้ตอบคำถามสั้นๆ สุภาพ เป็นกันเอง ห้ามตอบเรื่องการเมือง ศาสนา หรือคำหยาบ" }]
                    },
                    contents: contents
                })
            });
            
            const data = await response.json();
            
            // ถ้าเจอ Error 503 (High Demand) ให้ลองใหม่
            if (data.error && data.error.code === 503 && i < retries) {
                console.log(`⚠️ Google High Demand - Retrying (${i + 1}/${retries})...`);
                await new Promise(r => setTimeout(r, 2000)); // รอ 2 วินาทีแล้วลองใหม่
                continue;
            }
            
            return data;
        } catch (err) {
            if (i < retries) {
                console.log(`⚠️ Network Error - Retrying (${i + 1}/${retries})...`);
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }
            throw err;
        }
    }
}

app.get('/', (req, res) => res.send('🤖 Cyborg Backend is Running!'));

app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;
        
        // ถ้าเป็นข้อความแรกของบทสนทนา ให้ล้างประวัติเก่าออก
        if (chatHistory.length === 0) {
            chatHistory = [{ role: "user", parts: [{ text: userMessage }] }];
        } else {
            chatHistory.push({ role: "user", parts: [{ text: userMessage }] });
        }
        
        // จำกัดประวัติไม่เกิน 10 ข้อความ
        if (chatHistory.length > 10) chatHistory = chatHistory.slice(-10);

        // เรียก Gemini พร้อม Retry
        const data = await callGemini(chatHistory);

        // ✅ ถ้า Google ตอบกลับมาเป็น Error
        if (data.error) {
            console.error("Google API Error:", data.error.message);
            return res.status(500).json({ 
                error: "Google API Error", 
                details: data.error.message || "Google กำลัง繁忙 กรุณาลองใหม่ภายหลัง" 
            });
        }

        // ✅ ตรวจสอบโครงสร้างข้อมูล
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error("Gemini ตอบกลับมาแปลกๆ:", data);
            return res.status(500).json({ 
                error: "Invalid response", 
                details: "Gemini ไม่ได้ตอบกลับในรูปแบบที่คาดหวัง" 
            });
        }

        const botReply = data.candidates[0].content.parts[0].text;
        chatHistory.push({ role: "model", parts: [{ text: botReply }] });

        res.json({ reply: botReply });
    } catch (error) {
        console.error("Fetch Error:", error.message);
        res.status(500).json({ 
            error: "Network Error", 
            details: "ไม่สามารถเชื่อมต่อกับ Gemini ได้ กรุณาลองใหม่" 
        });
    }
});

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
        
        if (!response.ok) {
            throw new Error(`ElevenLabs returned ${response.status}`);
        }
        
        const audioBuffer = await response.arrayBuffer();
        res.set('Content-Type', 'audio/mpeg');
        res.send(Buffer.from(audioBuffer));
    } catch (error) {
        console.error("TTS Error:", error.message);
        res.status(500).json({ error: "TTS Error", details: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
