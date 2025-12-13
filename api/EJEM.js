const axios = require('axios');

module.exports = async (req, res) => {
    // 1. Configuración de CORS (Permitir solo tu dominio)
    res.setHeader('Access-Control-Allow-Origin', 'https://demo.escuelajudicial.datialabs.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Manejo de preflight request (OPTIONS)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Rechazar todo lo que no sea POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { target, ...payload } = req.body;

        if (!target) {
            return res.status(400).json({ error: 'Falta el target' });
        }

        // --- BLOQUE 1: VOICEFLOW ENGINE ---
        if (target === 'voiceflow') {
            const { userID, action } = payload;
            
            // Variables de entorno
            const API_KEY = process.env.EJEM_VOICEFLOW_API_KEY;
            const VERSION_ID = process.env.EJEM_VOICEFLOW_VERSION_ID;

            if (!userID || !action) {
                return res.status(400).json({ error: 'Faltan datos para Voiceflow' });
            }

            const url = `https://general-runtime.voiceflow.com/state/user/${userID}/interact`;

            // Usamos AXIOS para una conexión robusta en Node 22
            const response = await axios({
                method: 'post',
                url: url,
                headers: {
                    'Authorization': API_KEY,
                    'versionID': VERSION_ID,
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream' // Pedimos el stream
                },
                data: { action },
                responseType: 'stream' // <--- CLAVE: Esto mantiene el canal abierto sin llenar la memoria
            });

            // Preparamos la respuesta para tu frontend
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            // Conectamos la tubería (Pipe) de forma segura con Axios
            response.data.pipe(res);

        // --- BLOQUE 2: TTS ENGINE (ELEVENLABS) ---
        } else if (target === 'tts') {
            const { text } = payload;
            
            const API_KEY = process.env.EJEM_TTS_API_KEY;
            const VOICE_ID = process.env.EJEM_VOICE_ID;

            if (!text) return res.status(400).json({ error: 'Falta texto para TTS' });

            const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

            const response = await axios({
                method: 'post',
                url: ttsUrl,
                headers: {
                    'xi-api-key': API_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg'
                },
                data: {
                    text: text,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
                },
                responseType: 'stream' // Stream de audio
            });

            res.setHeader('Content-Type', 'audio/mpeg');
            response.data.pipe(res);

        } else {
            return res.status(400).json({ error: 'Target no válido' });
        }

    } catch (error) {
        // Manejo de errores detallado en los Logs de Vercel
        const errorMsg = error.response?.data 
            ? JSON.stringify(error.response.data) 
            : error.message;
            
        console.error('❌ Error en Proxy:', errorMsg);
        
        // Respondemos al frontend con un error 500 limpio
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error de conexión con el proveedor IA' });
        }
    }
};