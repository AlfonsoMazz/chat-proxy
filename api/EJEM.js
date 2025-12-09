const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // -----------------------------------------------------------------------
    // 1. CONFIGURACIÓN CORS DINÁMICA (SOLUCIÓN DE PROBLEMAS)
    // -----------------------------------------------------------------------
    const allowedOrigins = [
        'https://demo.escuelajudicial.datialabs.com', // Producción
        'http://localhost:3000',                      // Tu entorno local (si usas otro puerto, cámbialo)
        'http://localhost:5173'                       // Vite / React local común
    ];

    const origin = req.headers.origin;
    
    // Si el origen de la petición está en la lista blanca, lo permitimos.
    // Si no tienes origen (ej. Postman), a veces es necesario permitirlo o manejarlo aparte.
    if (allowedOrigins.includes(origin) || !origin) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    } else {
        // Opcional: Para pruebas rápidas, puedes descomentar la siguiente línea y comentar el bloque IF de arriba
        // res.setHeader('Access-Control-Allow-Origin', '*'); 
    }

    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // Agregué Authorization por seguridad

    // Manejo de preflight request (CORS)
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

        // -----------------------------------------------------------------------
        // 2. LÓGICA VOICEFLOW (CHAT)
        // -----------------------------------------------------------------------
        if (target === 'voiceflow') {
            const { userID, action } = payload;
            
            // Verificación extra de depuración
            console.log(`[EJEM] Voiceflow Request - User: ${userID}, Action received.`);

            const API_KEY = process.env.EJEM_VOICEFLOW_API_KEY;
            const VERSION_ID = process.env.EJEM_VOICEFLOW_VERSION_ID;
            
            if (!API_KEY || !VERSION_ID) {
                console.error('[EJEM] Faltan variables de entorno (Voiceflow). Revisa Vercel.');
                return res.status(500).json({ error: 'Configuración del servidor incompleta.' });
            }

            // URL Endpoint
            const url = `https://general-runtime.voiceflow.com/state/user/${userID}/interact`;

            const voiceflowResponse = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': API_KEY, // Nota: A veces Voiceflow requiere 'Bearer ' + API_KEY, pero si PJEM funciona sin eso, dejalo así.
                    'versionID': VERSION_ID,
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify({ action }),
            });

            if (!voiceflowResponse.ok) {
                const errorText = await voiceflowResponse.text();
                console.error(`[EJEM] Error Voiceflow: ${voiceflowResponse.status} - ${errorText}`);
                throw new Error(`Error Voiceflow: ${voiceflowResponse.statusText}`);
            }
            
            // Streaming response
            res.setHeader('Content-Type', 'application/json');
            voiceflowResponse.body.pipe(res);

        // -----------------------------------------------------------------------
        // 3. LÓGICA TTS (ELEVENLABS)
        // -----------------------------------------------------------------------
        } else if (target === 'tts') {
            const { text } = payload;
            
            // Verificación extra
            if (!text) return res.status(400).json({ error: 'Falta el "text" para TTS.' });

            const API_KEY = process.env.EJEM_TTS_API_KEY;
            const VOICE_ID = process.env.EJEM_VOICE_ID;
            
             if (!API_KEY || !VOICE_ID) {
                console.error('[EJEM] Faltan variables de entorno (TTS). Revisa Vercel.');
                return res.status(500).json({ error: 'Configuración TTS incompleta.' });
            }

            const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`; // Nota: ElevenLabs usa URL con VoiceID, no header

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
                const err = await ttsResponse.text();
                console.error(`[EJEM] Error TTS: ${err}`);
                throw new Error('Error en la respuesta de ElevenLabs');
            }
            
            res.setHeader('Content-Type', 'audio/mpeg');
            ttsResponse.body.pipe(res);

        } else {
            return res.status(400).json({ error: 'Target no válido.' });
        }

    } catch (error) {
        console.error('[EJEM] Error CRÍTICO en el servidor proxy:', error.message);
        return res.status(500).json({ error: 'Error interno del servidor proxy.' });
    }
};