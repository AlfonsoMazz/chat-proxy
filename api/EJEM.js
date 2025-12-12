const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // --- 1. SEGURIDAD CORS ---
    // Solo permitimos el dominio de la Escuela Judicial
    res.setHeader('Access-Control-Allow-Origin', 'https://demo.escuelajudicial.datialabs.com'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Manejo de preflight request (OPTIONS)
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

        // --- 2. LÓGICA VOICEFLOW ---
        if (target === 'voiceflow') {
            const { userID, action } = payload;
            if (!userID || !action) {
                return res.status(400).json({ error: 'Faltan userID o action para Voiceflow.' });
            }

            // Usamos las variables de entorno específicas de EJEM
            const API_KEY = process.env.EJEM_VOICEFLOW_API_KEY;
            const VERSION_ID = process.env.EJEM_VOICEFLOW_VERSION_ID;

            // URL estándar de Runtime de Voiceflow
            const url = `https://general-runtime.voiceflow.com/state/user/${userID}/interact`;

            const voiceflowResponse = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': API_KEY,
                    'versionID': VERSION_ID,
                    'Accept': 'text/event-stream' // Importante para streaming si se usa
                },
                body: JSON.stringify({ action }),
            });

            if (!voiceflowResponse.ok) {
                // Leemos el error para debugging (opcional, o lanzamos error genérico)
                const errorText = await voiceflowResponse.text();
                console.error(`Voiceflow Error (${voiceflowResponse.status}):`, errorText);
                throw new Error(`Error en la respuesta de Voiceflow: ${voiceflowResponse.statusText}`);
            }
            
            // Pipeamos la respuesta directamente al frontend
            res.setHeader('Content-Type', 'application/json');
            voiceflowResponse.body.pipe(res);

        // --- 3. LÓGICA TTS (ELEVENLABS) ---
        } else if (target === 'tts') {
            const { text } = payload;
            if (!text) return res.status(400).json({ error: 'Falta el "text" para TTS.' });

            // Usamos las variables de entorno específicas de EJEM
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

            if (!ttsResponse.ok) {
                const errorText = await ttsResponse.text();
                console.error(`ElevenLabs Error (${ttsResponse.status}):`, errorText);
                throw new Error('Error en la respuesta de ElevenLabs');
            }
            
            res.setHeader('Content-Type', 'audio/mpeg');
            ttsResponse.body.pipe(res);

        } else {
            return res.status(400).json({ error: 'Target no válido.' });
        }

    } catch (error) {
        console.error('Error en el servidor proxy (EJEM):', error.message);
        return res.status(500).json({ error: 'Error interno del servidor proxy.' });
    }
};