// api/EJEM.js - Modo "Tubo Transparente" (Streaming)

module.exports = async (req, res) => {
    // --- 1. CONFIGURACIÓN CORS ---
    const allowedOrigins = [
        'https://demo.escuelajudicial.datialabs.com',
        'https://www.demo.escuelajudicial.datialabs.com'
    ];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', 'https://demo.escuelajudicial.datialabs.com');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { target, ...payload } = req.body;

        // --- 2. ENRUTAMIENTO VOICEFLOW ---
        if (target === 'voiceflow') {
            const { userID, action } = payload;
            
            // Hacemos la petición pero NO usamos 'await response.json()'
            const response = await fetch(`https://general-runtime.voiceflow.com/state/user/${userID}/interact`, {
                method: 'POST',
                headers: {
                    'Authorization': process.env.EJEM_VOICEFLOW_API_KEY,
                    'versionID': process.env.EJEM_VOICEFLOW_VERSION_ID,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json' 
                },
                body: JSON.stringify({ action })
            });

            // Si Voiceflow da error, pasamos el estado y el texto tal cual
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Voiceflow Error (${response.status}):`, errorText);
                return res.status(response.status).send(errorText);
            }

            // TRUCO MAESTRO: Convertimos la respuesta en Buffer y la enviamos.
            // Esto evita problemas de parsing si la respuesta es compleja.
            const dataBuffer = await response.arrayBuffer();
            res.setHeader('Content-Type', 'application/json');
            res.send(Buffer.from(dataBuffer));

        // --- 3. ENRUTAMIENTO TTS ---
        } else if (target === 'tts') {
            const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.EJEM_VOICE_ID}`, {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': process.env.EJEM_TTS_API_KEY,
                },
                body: JSON.stringify({
                    text: payload.text,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
                }),
            });

            if (!ttsResponse.ok) throw new Error('Error ElevenLabs');
            
            const audioBuffer = await ttsResponse.arrayBuffer();
            res.setHeader('Content-Type', 'audio/mpeg');
            res.send(Buffer.from(audioBuffer));

        } else {
            return res.status(400).json({ error: 'Target no válido' });
        }

    } catch (error) {
        console.error('CRITICAL PROXY ERROR:', error);
        return res.status(500).json({ error: error.message });
    }
};