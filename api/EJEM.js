// ./api/EJEM.js

/**
 * Backend Proxy para Escuela Judicial del Estado de México (EJEM)
 * Maneja la comunicación segura entre el Frontend, Voiceflow y ElevenLabs.
 */

module.exports = async (req, res) => {
    
    // --- 1. CONFIGURACIÓN DE SEGURIDAD (CORS) ---
    // Solo permitimos peticiones desde el subdominio oficial
    res.setHeader('Access-Control-Allow-Origin', 'https://demo.escuelajudicial.datialabs.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Manejo de Preflight request (navegadores)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Validación de Método
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Extracción segura del payload
        const body = req.body || {};
        const { target, ...payload } = body;

        if (!target) {
            return res.status(400).json({ error: 'Falta el parámetro "target".' });
        }

        // --- 2. RUTAS DE SERVICIO ---

        // A) INTERACCIÓN CON VOICEFLOW
        if (target === 'voiceflow') {
            const { userID, action } = payload;
            
            // Validación de integridad
            if (!userID || !action) {
                return res.status(400).json({ error: 'Faltan datos requeridos (userID o action).' });
            }

            // Credenciales de entorno (EJEM)
            const API_KEY = process.env.EJEM_VOICEFLOW_API_KEY;
            const VERSION_ID = process.env.EJEM_VOICEFLOW_VERSION_ID;
            
            if (!API_KEY || !VERSION_ID) {
                console.error('[EJEM] Error Crítico: Faltan variables de entorno de Voiceflow.');
                return res.status(500).json({ error: 'Error de configuración del servidor.' });
            }

            // Petición a Voiceflow
            const vfUrl = `https://general-runtime.voiceflow.com/state/user/${userID}/interact`;
            
            const vfResponse = await fetch(vfUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': API_KEY,
                    'versionID': VERSION_ID,
                    'Accept': 'application/json' // Solicitamos JSON explícito para procesarlo
                },
                body: JSON.stringify({ action }),
            });

            if (!vfResponse.ok) {
                const errorText = await vfResponse.text();
                console.error(`[EJEM] Voiceflow API Error: ${vfResponse.status} - ${errorText}`);
                throw new Error(`Voiceflow respondió con estado: ${vfResponse.status}`);
            }
            
            // Retornamos la respuesta procesada al frontend
            const data = await vfResponse.json();
            return res.status(200).json(data);

        // B) TEXT-TO-SPEECH (ELEVENLABS)
        } else if (target === 'tts') {
            const { text } = payload;
            
            if (!text) return res.status(400).json({ error: 'Falta el texto para TTS.' });

            // Credenciales de entorno (EJEM)
            const API_KEY = process.env.EJEM_TTS_API_KEY;
            const VOICE_ID = process.env.EJEM_VOICE_ID;
            
             if (!API_KEY || !VOICE_ID) {
                console.error('[EJEM] Error Crítico: Faltan variables de entorno de TTS.');
                return res.status(500).json({ error: 'Error de configuración del servidor (TTS).' });
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
                console.error(`[EJEM] TTS API Error: ${err}`);
                throw new Error('Falló la generación de audio en ElevenLabs.');
            }
            
            // Procesamiento de audio binario
            const audioBuffer = await ttsResponse.arrayBuffer();
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Content-Length', audioBuffer.byteLength);
            
            // Enviamos el buffer directamente
            return res.send(Buffer.from(audioBuffer));

        } else {
            return res.status(400).json({ error: 'Target desconocido.' });
        }

    } catch (error) {
        console.error('[EJEM] Excepción no controlada:', error.message);
        return res.status(500).json({ error: 'Error interno en el Proxy EJEM.' });
    }
};