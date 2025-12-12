// api/EJEM.js - Versión Robusta (Sin dependencia externa de fetch)

module.exports = async (req, res) => {
    // 1. CONFIGURACIÓN CORS (Permite acceso al frontend)
    const allowedOrigins = [
        'https://demo.escuelajudicial.datialabs.com',
        'https://www.demo.escuelajudicial.datialabs.com'
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        // Fallback seguro para desarrollo o si el header viene vacío
        res.setHeader('Access-Control-Allow-Origin', 'https://demo.escuelajudicial.datialabs.com');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Responder OK a la petición OPTIONS (Pre-flight del navegador)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido. Use POST.' });
    }

    try {
        const { target, ...payload } = req.body;

        // 2. VALIDACIÓN DE VARIABLES DE ENTORNO
        if (!process.env.EJEM_VOICEFLOW_API_KEY) {
            console.error("ERROR CRÍTICO: Faltan variables de entorno EJEM_VOICEFLOW_API_KEY");
            return res.status(500).json({ error: 'Configuración del servidor incompleta (Env Vars).' });
        }

        // 3. ENRUTAMIENTO (Voiceflow vs TTS)
        if (target === 'voiceflow') {
            const { userID, action } = payload;
            
            // Usamos el fetch global (Node 18+)
            const response = await fetch(`https://general-runtime.voiceflow.com/state/user/${userID}/interact`, {
                method: 'POST',
                headers: {
                    'Authorization': process.env.EJEM_VOICEFLOW_API_KEY,
                    'versionID': process.env.EJEM_VOICEFLOW_VERSION_ID,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action })
            });

            if (!response.ok) {
                const errorDetail = await response.text();
                console.error(`Error Voiceflow (${response.status}):`, errorDetail);
                return res.status(response.status).json({ error: 'Error externo Voiceflow', details: errorDetail });
            }

            const data = await response.json();
            return res.json(data);

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

            if (!ttsResponse.ok) {
                const err = await ttsResponse.text();
                console.error('Error TTS:', err);
                throw new Error('Fallo en ElevenLabs');
            }
            
            // Convertir el stream a buffer para enviarlo
            const arrayBuffer = await ttsResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            res.setHeader('Content-Type', 'audio/mpeg');
            res.send(buffer);

        } else {
            return res.status(400).json({ error: 'Target no válido (debe ser voiceflow o tts)' });
        }

    } catch (error) {
        console.error('SERVER ERROR (EJEM.js):', error);
        return res.status(500).json({ 
            error: 'Error interno del Proxy', 
            message: error.message 
        });
    }
};