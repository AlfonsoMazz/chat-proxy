const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Las cabeceras CORS están bien
    res.setHeader('Access-Control-Allow-Origin', 'https://demo.gobierno.datialabs.com'); 
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

        if (target === 'voiceflow') {
            const { userID, action } = payload;
            if (!userID || !action) {
                return res.status(400).json({ error: 'Faltan userID o action para Voiceflow.' });
            }

            // Se usan las variables correctas para PJEM
            const API_KEY = process.env.PJEM_VOICEFLOW_API_KEY;
            const VERSION_ID = process.env.PJEM_VOICEFLOW_VERSION_ID;

            const url = `https://general-runtime.voiceflow.com/state/user/${userID}/interact`;

            const voiceflowResponse = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': API_KEY,
                    'versionID': VERSION_ID,
                    // --- INICIO DE LA CORRECCIÓN ---
                    // 1. Pedimos el STREAM, igual que en el bot que SÍ funciona.
                    'Accept': 'text/event-stream'
                    // --- FIN DE LA CORRECCIÓN ---
                },
                body: JSON.stringify({ action }),
            });

            if (!voiceflowResponse.ok) {
                throw new Error(`Error en la respuesta de Voiceflow: ${voiceflowResponse.statusText}`);
            }
            
            // --- INICIO DE LA CORRECCIÓN ---
            // 2. Pasamos el STREAM directamente al frontend,
            //    en lugar de esperar y empaquetarlo como JSON.
            res.setHeader('Content-Type', 'application/json'); // Voiceflow lo manda como JSON-stream
            voiceflowResponse.body.pipe(res);
            // --- FIN DE LA CORRECCIÓN ---
            
            /* ESTAS LÍNEAS SE ELIMINAN PORQUE ERAN EL PROBLEMA (BUFFERING)
            const data = await voiceflowResponse.json();
            return res.status(200).json(data);
            */
            
        } else if (target === 'tts') {
            // La parte de TTS está perfecta y no se toca.
            const { text } = payload;
            if (!text) return res.status(400).json({ error: 'Falta el "text" para TTS.' });

            const API_KEY = process.env.PJEM_TTS_API_KEY;
            const VOICE_ID = process.env.PJEM_VOICE_ID;
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