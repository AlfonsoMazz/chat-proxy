const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { target, ...payload } = req.body;

        if (target === 'voiceflow') {
            const { userID, action } = payload;
            const API_KEY = process.env.EJEM_VOICEFLOW_API_KEY;
            const VERSION_ID = process.env.EJEM_VOICEFLOW_VERSION_ID;
            const url = `https://general-runtime.voiceflow.com/state/user/${userID}/interact`;

            // Configurar Headers para la petición a Voiceflow
            const vfHeaders = {
                'Content-Type': 'application/json',
                'Authorization': API_KEY,
                'versionID': VERSION_ID,
                'Accept': 'text/event-stream' // ¡IMPORTANTE! Pedimos Streaming
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: vfHeaders,
                body: JSON.stringify({ action })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Voiceflow Error ${response.status}: ${text}`);
            }

            // Preparar headers de respuesta para Streaming hacia el Frontend
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            // PIPE DIRECTO: Conectamos la salida de Voiceflow a la respuesta de Vercel
            response.body.pipe(res);

            // Manejo de errores en el stream para evitar cuelgues
            response.body.on('error', (err) => {
                console.error('Error en el stream de VF:', err);
                res.end();
            });

        } else if (target === 'tts') {
            // (Tu código TTS se mantiene igual, ya usaba pipe)
            const { text } = payload;
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

            if (!ttsResponse.ok) throw new Error('Error ElevenLabs');
            res.setHeader('Content-Type', 'audio/mpeg');
            ttsResponse.body.pipe(res);
        }

    } catch (error) {
        console.error('Proxy Error:', error);
        // Si ya se enviaron headers, no podemos enviar JSON, terminamos la respuesta.
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        } else {
            res.end();
        }
    }
};