module.exports = async (req, res) => {
    // 1. CORS Permisivo (Igual que el widget que funciona en cualquier lado)
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { target, ...payload } = req.body;

        // --- MOTOR VOICEFLOW (Igual al Widget) ---
        if (target === 'voiceflow') {
            const { userID, action } = payload;
            
            // USAMOS SOLO LA API KEY, IGNORAMOS EL VERSION_ID DEL ENV
            // Forzamos 'production' porque el widget demostró que eso funciona
            const API_KEY = process.env.EJEM_VOICEFLOW_API_KEY; 
            
            const url = `https://general-runtime.voiceflow.com/state/user/${userID}/interact`;

            // Usamos fetch nativo (sin dependencias externas)
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': API_KEY,
                    'versionID': 'production', // <--- EL SECRETO DEL WIDGET
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify({ action })
            });

            if (!response.ok) {
                const errText = await response.text();
                // Log simple para evitar el error "Circular Structure"
                console.error(`Error VF: ${response.status} - ${errText.substring(0, 200)}`);
                return res.status(response.status).json({ error: "Error en Voiceflow" });
            }

            // Streaming Compatible con Vercel/Node (Reader)
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Transfer-Encoding', 'chunked');

            const reader = response.body.getReader();
            
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    res.write(value);
                }
            } catch (streamErr) {
                console.error('Error durante el stream:', streamErr);
            } finally {
                res.end();
            }

        // --- MOTOR TTS (ElevenLabs) ---
        } else if (target === 'tts') {
            const { text } = payload;
            const API_KEY = process.env.EJEM_TTS_API_KEY;
            const VOICE_ID = process.env.EJEM_VOICE_ID;
            const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

            const response = await fetch(ttsUrl, {
                method: 'POST',
                headers: {
                    'xi-api-key': API_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg'
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                })
            });

            if (!response.ok) {
                 console.error('Error TTS');
                 return res.status(500).json({ error: 'Error ElevenLabs' });
            }

            res.setHeader('Content-Type', 'audio/mpeg');
            
            // Mismo Reader para audio
            const reader = response.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(value);
            }
            res.end();

        } else {
            return res.status(400).json({ error: 'Target no válido' });
        }

    } catch (error) {
        // Log de texto simple para evitar error 500 por JSON Circular
        console.error('Error General:', error.message); 
        return res.status(500).json({ error: 'Error Interno del Proxy' });
    }
};