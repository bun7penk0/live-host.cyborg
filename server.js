const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let chatHistory = [];

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; 

app.get('/', (req, res) => res.send('🤖 Cyborg Backend is Running!'));

app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;
        chatHistory.push({ role: "user", parts: [{ text: userMessage }] });
        if (chatHistory.length > 10) chatHistory = chatHistory.slice(-10);

        // ใช้ gemini-1.5-flash (รุ่นนี้เสถียรและรองรับ key ใหม่)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: "คุณคือพี่โอม พิธีกร AI ครึ่งคนครึ่งไซบอร์ก ให้ตอบคำถามสั้นๆ สุภาพ เป็นกันเอง ห้ามตอบเรื่องการเมือง ศาสนา หรือคำหยาบ" }]
                },
                contents: chatHistory
            })
        });
        
        const data = await response.json();

        // ✅ ถ้า Google ตอบกลับมาเป็น Error ให้ส่ง Error นั้นกลับไปให้ Frontend เห็น
        if (data.error) {
            console.error("Google API Error:", data.error);
            return res.status(500).json({ 
                error: "Google API Error", 
                details: data.error.message || JSON.stringify(data.error) 
            });
        }

        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error("Gemini ตอบกลับมาแปลกๆ:", data);
            return res.status(500).json({ 
                error: "Invalid response", 
                details: JSON.stringify(data) 
            });
        }

        const botReply = data.candidates[0].content.parts[0].text;
        chatHistory.push({ role: "model", parts: [{ text: botReply }] });

        res.json({ reply: botReply });
    } catch (error) {
        console.error("Fetch Error:", error.message);
        res.status(500).json({ error: "Network Error", details: error.message });
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
        const audioBuffer = await response.arrayBuffer();
        res.set('Content-Type', 'audio/mpeg');
        res.send(Buffer.from(audioBuffer));
    } catch (error) {
        res.status(500).json({ error: "TTS Error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
