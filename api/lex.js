const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // 1. SEGURIDAD: Whitelist (CORS)
    // Permitimos producción y tu entorno local para desarrollo
    const allowedOrigins = [
        'https://demo.plataformainvestigacion.datialabs.com',
        'http://localhost:5173' 
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Manejo de Preflight request (OPTIONS)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { target, agentId, ...payload } = req.body;

        if (!target) {
            return res.status(400).json({ error: 'Falta el "target".' });
        }

        // --- ENRUTAMIENTO DE AGENTES ---
        if (target === 'voiceflow') {
            const { userID, action } = payload;

            // Selección dinámica de la API KEY según la materia seleccionada en el Frontend
            let API_KEY;
            switch (agentId) {
                case 'penal':
                    API_KEY = process.env.VF_PINV_PENAL_API_KEY;
                    break;
                case 'civil':
                    API_KEY = process.env.VF_PINV_CIVIL_API_KEY;
                    break;
                case 'familiar':
                    API_KEY = process.env.VF_PINV_FAMILIAR_API_KEY; // El que usarás para la demo
                    break;
                case 'laboral':
                    API_KEY = process.env.VF_PINV_LABORAL_API_KEY;
                    break;
                default:
                    return res.status(400).json({ error: 'Materia no válida o no especificada.' });
            }

            // Validación de seguridad: Si no hay key configurada, error interno
            if (!API_KEY) {
                console.error(`Falta API Key para: ${agentId}`);
                return res.status(500).json({ error: 'Configuración del agente no encontrada.' });
            }

            // Usamos una variable global para la versión, o 'production' por defecto
            const VERSION_ID = process.env.VF_PINV_VERSION_ID || 'production';

            const url = `https://general-runtime.voiceflow.com/state/user/${userID}/interact`;

            const voiceflowResponse = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': API_KEY,
                    'versionID': VERSION_ID,
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify({ action }),
            });

            if (!voiceflowResponse.ok) {
                throw new Error(`Voiceflow Error: ${voiceflowResponse.statusText}`);
            }
            
            // Pipe (Streaming) de la respuesta de VF hacia el Frontend
            res.setHeader('Content-Type', 'application/json');
            voiceflowResponse.body.pipe(res);

        } else if (target === 'tts') {
            // --- LOGICA DE TTS (Mantenida por compatibilidad) ---
            // Nota: Aquí podrías querer usar también diferentes voces según el agente si quisieras,
            // por ahora usamos la configuración global PJEM existente o una nueva VF_PINV.
            const { text } = payload;
            
            const TTS_API_KEY = process.env.VF_PINV_TTS_API_KEY || process.env.PJEM_TTS_API_KEY; // Fallback
            const VOICE_ID = process.env.VF_PINV_VOICE_ID || process.env.PJEM_VOICE_ID;         // Fallback
            
            if (!TTS_API_KEY) return res.status(500).json({ error: 'TTS no configurado' });

            const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

            const ttsResponse = await fetch(ttsUrl, {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': TTS_API_KEY,
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
                }),
            });

            if (!ttsResponse.ok) throw new Error('ElevenLabs Error');
            
            res.setHeader('Content-Type', 'audio/mpeg');
            ttsResponse.body.pipe(res);

        } else {
            return res.status(400).json({ error: 'Target desconocido.' });
        }

    } catch (error) {
        console.error('Proxy Error:', error.message);
        return res.status(500).json({ error: 'Error interno del servidor proxy.' });
    }
};