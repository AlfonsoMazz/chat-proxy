const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // 1. CONFIGURACIÓN CORS ESPECÍFICA PARA LA ESCUELA JUDICIAL
    // Esto permite que SOLO tu nuevo subdominio pueda usar esta API
    res.setHeader('Access-Control-Allow-Origin', 'https://demo.escuela.judicial.datialabs.com'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Manejo de preflight request (CORS)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Solo aceptamos POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { target, ...payload } = req.body;

        if (!target) {
            return res.status(400).json({ error: 'Falta el "target" en la petición.' });
        }

        // --- LÓGICA VOICEFLOW (CHAT) ---
        if (target === 'voiceflow') {
            const { userID, action } = payload;
            if (!userID || !action) {
                return res.status(400).json({ error: 'Faltan userID o action para Voiceflow.' });
            }

            // USAMOS LAS VARIABLES DE ENTORNO NUEVAS (PREFIJO EJEM_)
            const API_KEY = process.env.EJEM_VOICEFLOW_API_KEY;
            const VERSION_ID = process.env.EJEM_VOICEFLOW_VERSION_ID;
            
            // Validamos que existan las keys antes de llamar
            if (!API_KEY || !VERSION_ID) {
                console.error('Faltan variables de entorno EJEM en Vercel');
                return res.status(500).json({ error: 'Error de configuración del servidor (Keys).' });
            }

            const url = `https://general-runtime.voiceflow.com/state/user/${userID}/interact`;

            const voiceflowResponse = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': API_KEY,
                    'versionID': VERSION_ID,
                    'Accept': 'text/event-stream' // Solicitamos stream
                },
                body: JSON.stringify({ action }),
            });

            if (!voiceflowResponse.ok) {
                throw new Error(`Error en la respuesta de Voiceflow: ${voiceflowResponse.statusText}`);
            }
            
            // Pipe directo de la respuesta (streaming)
            res.setHeader('Content-Type', 'application/json');
            voiceflowResponse.body.pipe(res);

        // --- LÓGICA TTS (ELEVENLABS) ---
        } else if (target === 'tts') {
            const { text } = payload;
            if (!text) return res.status(400).json({ error: 'Falta el "text" para TTS.' });

            // USAMOS LAS VARIABLES DE ENTORNO NUEVAS (PREFIJO EJEM_)
            const API_KEY = process.env.EJEM_TTS_API_KEY;
            const VOICE_ID = process.env.EJEM_VOICE_ID;
            
             // Validamos que existan las keys
             if (!API_KEY || !VOICE_ID) {
                return res.status(500).json({ error: 'Error de configuración TTS (Keys).' });
            }

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
        console.error('Error en el servidor proxy EJEM:', error.message);
        return res.status(500).json({ error: 'Error interno del servidor proxy.' });
    }
};