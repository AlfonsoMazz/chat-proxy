// ./api/EJEM.js

// Nota: Usamos 'fetch' nativo (Node 18+), no requerimos 'node-fetch' para evitar errores de dependencias.
module.exports = async (req, res) => {
    
    // --- 1. SEGURIDAD ESTÁTICA (CLONADA DE PJEM) ---
    // Fijamos el origen exacto para garantizar que el navegador acepte la respuesta.
    res.setHeader('Access-Control-Allow-Origin', 'https://demo.escuelajudicial.datialabs.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Manejo inmediato de Preflight (OPTIONS)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Rechazar cualquier método que no sea POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { target, ...payload } = req.body;

        if (!target) {
            return res.status(400).json({ error: 'Falta el "target" en la petición.' });
        }

        // -----------------------------------------------------------------------
        // 2. LÓGICA VOICEFLOW (CLONADA Y ADAPTADA)
        // -----------------------------------------------------------------------
        if (target === 'voiceflow') {
            const { userID, action } = payload;
            
            if (!userID || !action) {
                return res.status(400).json({ error: 'Faltan userID o action para Voiceflow.' });
            }

            // Usamos las variables de entorno específicas para EJEM
            // ASEGÚRATE DE TENER ESTAS VARIABLES EN VERCEL:
            // EJEM_VOICEFLOW_API_KEY
            // EJEM_VOICEFLOW_VERSION_ID
            const API_KEY = process.env.EJEM_VOICEFLOW_API_KEY;
            const VERSION_ID = process.env.EJEM_VOICEFLOW_VERSION_ID;
            
            if (!API_KEY || !VERSION_ID) {
                console.error('[EJEM] Faltan variables de entorno (Voiceflow).');
                return res.status(500).json({ error: 'Error de configuración del servidor.' });
            }

            // URL Endpoint Original (Igual que PJEM)
            const url = `https://general-runtime.voiceflow.com/state/user/${userID}/interact`;

            const voiceflowResponse = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': API_KEY,
                    'versionID': VERSION_ID,
                    'Accept': 'text/event-stream' // HEADER CRÍTICO PARA EL FUNCIONAMIENTO
                },
                body: JSON.stringify({ action }),
            });

            if (!voiceflowResponse.ok) {
                const errorText = await voiceflowResponse.text();
                console.error(`[EJEM] Error Voiceflow API: ${voiceflowResponse.status} - ${errorText}`);
                throw new Error(`Voiceflow Error: ${voiceflowResponse.statusText}`);
            }
            
            // Devolvemos el JSON directamente (Más robusto que pipe en Vercel nativo)
            const data = await voiceflowResponse.json();
            return res.status(200).json(data);

        // -----------------------------------------------------------------------
        // 3. LÓGICA TTS (ELEVENLABS)
        // -----------------------------------------------------------------------
        } else if (target === 'tts') {
            const { text } = payload;
            
            if (!text) return res.status(400).json({ error: 'Falta el "text" para TTS.' });

            // Variables de entorno específicas para EJEM
            const API_KEY = process.env.EJEM_TTS_API_KEY;
            const VOICE_ID = process.env.EJEM_VOICE_ID;
            
             if (!API_KEY || !VOICE_ID) {
                console.error('[EJEM] Faltan variables de entorno (TTS).');
                return res.status(500).json({ error: 'Configuración TTS incompleta.' });
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

            if (!ttsResponse.ok) {
                const err = await ttsResponse.text();
                console.error(`[EJEM] Error TTS: ${err}`);
                throw new Error('Error en la respuesta de ElevenLabs');
            }
            
            // Para audio binario, convertimos a ArrayBuffer y enviamos
            const audioBuffer = await ttsResponse.arrayBuffer();
            res.setHeader('Content-Type', 'audio/mpeg');
            return res.send(Buffer.from(audioBuffer));

        } else {
            return res.status(400).json({ error: 'Target no válido.' });
        }

    } catch (error) {
        console.error('[EJEM] Error CRÍTICO en Proxy:', error.message);
        return res.status(500).json({ error: 'Error interno del servidor proxy.' });
    }
};