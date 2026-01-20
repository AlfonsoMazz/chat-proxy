// ./api/PROPAEM_WEB.js

module.exports = async (req, res) => {
    // =================================================================
    // 1. CONFIGURACIÓN DE SEGURIDAD (WHITELIST)
    // =================================================================
    
    // Dominio autorizado (Sin slash al final para coincidir con el header Origin del navegador)
    const ALLOWED_ORIGIN = 'https://demo.propaemweb.datialabs.com';

    // Establecemos el CORS estricto
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Manejo de Preflight (OPTIONS)
    if (req.method === 'OPTIONS') return res.status(200).end();
    
    // Rechazar cualquier método que no sea POST
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { target, ...payload } = req.body;

        // =================================================================
        // 2. MOTOR VOICEFLOW (CHAT)
        // =================================================================
        if (target === 'voiceflow') {
            const { userID, action } = payload;
            
            // Variable de entorno ESPECÍFICA para PROPAEM
            const API_KEY = process.env.PROPAEM_VOICEFLOW_API_KEY; 
            
            if (!API_KEY) {
                console.error('Falta API Key de Voiceflow en Vercel');
                return res.status(500).json({ error: "Configuración del servidor incompleta" });
            }

            const url = `https://general-runtime.voiceflow.com/state/user/${userID}/interact`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': API_KEY,
                    'versionID': 'production', 
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify({ action })
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error(`Error VF PROPAEM: ${response.status} - ${errText.substring(0, 200)}`);
                return res.status(response.status).json({ error: "Error en Voiceflow" });
            }

            // Streaming
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Transfer-Encoding', 'chunked');

            const reader = response.body.getReader();
            
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    res.write(value);
                }
            } catch (streamErr) {
                console.error('Error durante el stream:', streamErr);
            } finally {
                res.end();
            }

        // =================================================================
        // 3. MOTOR TTS (ELEVENLABS)
        // =================================================================
        } else if (target === 'tts') {
            const { text } = payload;
            
            // Variables de entorno ESPECÍFICAS para PROPAEM
            const API_KEY = process.env.PROPAEM_TTS_API_KEY;
            const VOICE_ID = process.env.PROPAEM_VOICE_ID; // ID de voz para Tlali

            if (!API_KEY || !VOICE_ID) {
                console.error('Falta configuración TTS en Vercel');
                return res.status(500).json({ error: "Configuración de audio incompleta" });
            }

            const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

            const response = await fetch(ttsUrl, {
                method: 'POST',
                headers: {
                    'xi-api-key': API_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg'
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                })
            });

            if (!response.ok) {
                 console.error('Error TTS PROPAEM');
                 return res.status(500).json({ error: 'Error ElevenLabs' });
            }

            res.setHeader('Content-Type', 'audio/mpeg');
            
            const reader = response.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(value);
            }
            res.end();

        } else {
            return res.status(400).json({ error: 'Target no válido' });
        }

    } catch (error) {
        console.error('Error General PROPAEM:', error.message); 
        return res.status(500).json({ error: 'Error Interno del Proxy' });
    }
};