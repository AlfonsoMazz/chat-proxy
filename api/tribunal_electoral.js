const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // 1. Permisos CORS (sin cambios)
    res.setHeader('Access-Control-Allow-Origin', 'https://demo.tribunalelectoral.datialabs.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
         return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // AHORA ESPERAMOS UN "target" PARA DECIDIR QUÉ HACER
        const { target, ...payload } = req.body;

        if (!target) {
            return res.status(400).json({ error: 'Falta el "target" en la petición.' });
        }

        // --- ROUTER: Decide a qué API llamar ---

        if (target === 'voiceflow') {
            // --- Lógica de Voiceflow (la que ya tenías) ---
            const { userID, action } = payload;
            if (!userID || !action) {
                return res.status(400).json({ error: 'Faltan userID o action para Voiceflow.' });
            }

            const API_KEY = process.env.TRIBUNAL_ELECTORAL_VOICEFLOW_API_KEY; // Usando tu variable
            const VERSION_ID = process.env.TRIBUNAL_ELECTORAL_VOICEFLOW_VERSION_ID; // Usando tu variable

            const voiceflowResponse = await fetch(
                `https://general-runtime.voiceflow.com/state/user/${userID}/interact`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': API_KEY,
                        'versionID': VERSION_ID,
                    },
                    body: JSON.stringify({ action }),
                }
            );

            if (!voiceflowResponse.ok) throw new Error('Error en la respuesta de Voiceflow');
            const data = await voiceflowResponse.json();
            return res.status(200).json(data);

        } else if (target === 'tts') {
            // --- NUEVA Lógica de ElevenLabs (Text-to-Speech) ---
            const { text } = payload;
            if (!text) {
                return res.status(400).json({ error: 'Falta el "text" para TTS.' });
            }

            const API_KEY = process.env.TRIBUNAL_ELECTORAL_TTS_API_KEY; // Usando tu variable
            const VOICE_ID = process.env.TRIBUNAL_ELECTORAL_VOICE_ID; // Usando tu variable
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
                    model_id: 'eleven_multilingual_v2', // O el modelo que prefieras
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                    },
                }),
            });

            if (!ttsResponse.ok) throw new Error('Error en la respuesta de ElevenLabs');
            
            // Devolvemos el audio directamente al frontend
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