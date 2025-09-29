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
        const { target, ...payload } = req.body;

        if (!target) {
            return res.status(400).json({ error: 'Falta el "target" en la petición.' });
        }

        // --- ROUTER: Decide a qué API llamar ---

        if (target === 'voiceflow') {
            const { userID, action, stream } = payload; // Capturamos el parámetro "stream" del frontend
            if (!userID || !action) {
                return res.status(400).json({ error: 'Faltan userID o action para Voiceflow.' });
            }

            const API_KEY = process.env.TRIBUNAL_ELECTORAL_VOICEFLOW_API_KEY;
            const VERSION_ID = process.env.TRIBUNAL_ELECTORAL_VOICEFLOW_VERSION_ID;

            // Construimos la URL de Voiceflow, añadiendo el parámetro para streaming
            const url = `https://general-runtime.voiceflow.com/state/user/${userID}/interact${stream ? '?stream=true' : ''}`;

            const voiceflowResponse = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': API_KEY,
                    'versionID': VERSION_ID,
                },
                body: JSON.stringify({ action }),
            });

            if (!voiceflowResponse.ok) throw new Error('Error en la respuesta de Voiceflow');
            
            // ########## INICIO DE LA CORRECCIÓN ##########
            // En lugar de esperar el JSON, ahora pasamos el stream directamente.
            
            res.setHeader('Content-Type', 'application/json'); // Indicamos que el stream contiene JSON
            voiceflowResponse.body.pipe(res); // ¡Convertido en tubería!
            
            // ########## FIN DE LA CORRECCIÓN ##########

        } else if (target === 'tts') {
            const { text } = payload;
            if (!text) {
                return res.status(400).json({ error: 'Falta el "text" para TTS.' });
            }

            const API_KEY = process.env.TRIBUNAL_ELECTORAL_TTS_API_KEY;
            const VOICE_ID = process.env.TRIBUNAL_ELECTORAL_VOICE_ID;
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
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                    },
                }),
            });

            if (!ttsResponse.ok) throw new Error('Error en la respuesta de ElevenLabs');
            
            res.setHeader('Content-Type', 'audio/mpeg');
            ttsResponse.body.pipe(res); // Tu tubería de audio (ya estaba correcta)

        } else {
            return res.status(400).json({ error: 'Target no válido.' });
        }

    } catch (error) {
        console.error('Error en el servidor proxy:', error.message);
        return res.status(500).json({ error: 'Error interno del servidor proxy.' });
    }
};