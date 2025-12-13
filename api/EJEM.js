// api/EJEM.js - Clon Exacto de PJEM.js (Estructura probada)
const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // 1. Configuración de CORS (Igual que PJEM pero con el dominio de la escuela)
    res.setHeader('Access-Control-Allow-Origin', 'https://demo.escuelajudicial.datialabs.com'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { target, ...payload } = req.body;

        if (!target) {
            return res.status(400).json({ error: 'Falta el "target" en la petición.' });
        }

        // --- LÓGICA VOICEFLOW ---
        if (target === 'voiceflow') {
            const { userID, action } = payload;
            
            // Verificación básica
            if (!userID || !action) {
                return res.status(400).json({ error: 'Faltan userID o action para Voiceflow.' });
            }

            // 2. Variables de Entorno EJEM
            const API_KEY = process.env.EJEM_VOICEFLOW_API_KEY;
            const VERSION_ID = process.env.EJEM_VOICEFLOW_VERSION_ID;

            // Validación de seguridad para Logs
            if (!API_KEY) throw new Error("Falta EJEM_VOICEFLOW_API_KEY en Vercel");

            // URL estándar
            const url = `https://general-runtime.voiceflow.com/state/user/${userID}/interact`;

            // Petición idéntica a PJEM
            const voiceflowResponse = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': API_KEY,
                    'versionID': VERSION_ID,
                    // Header crítico que usas en PJEM
                    'Accept': 'text/event-stream' 
                },
                body: JSON.stringify({ action }),
            });

            if (!voiceflowResponse.ok) {
                // Si falla, leemos el texto para saber por qué (aparecerá en logs Vercel)
                const errorBody = await voiceflowResponse.text();
                console.error(`Error VF ${voiceflowResponse.status}: ${errorBody}`);
                throw new Error(`Error Voiceflow: ${voiceflowResponse.statusText}`);
            }
            
            // Pipe directo (Streaming)
            res.setHeader('Content-Type', 'application/json');
            voiceflowResponse.body.pipe(res);

        // --- LÓGICA TTS ---
        } else if (target === 'tts') {
            const { text } = payload;
            if (!text) return res.status(400).json({ error: 'Falta el "text" para TTS.' });

            const API_KEY = process.env.EJEM_TTS_API_KEY;
            const VOICE_ID = process.env.EJEM_VOICE_ID;
            
            const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

            const ttsResponse = await fetch(ttsUrl, {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': API_KEY,
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
                }),
            });

            if (!ttsResponse.ok) throw new Error('Error en la respuesta de ElevenLabs');
            
            res.setHeader('Content-Type', 'audio/mpeg');
            ttsResponse.body.pipe(res);

        } else {
            return res.status(400).json({ error: 'Target no válido.' });
        }

    } catch (error) {
        console.error('Error en el servidor proxy:', error.message);
        return res.status(500).json({ error: 'Error interno del servidor proxy.' });
    }
};