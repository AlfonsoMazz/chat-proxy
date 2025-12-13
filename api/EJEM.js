const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Se mantiene el origen CORS específico de EJEM
    res.setHeader('Access-Control-Allow-Origin', 'https://demo.escuelajudicial.datialabs.com'); 
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

            // ---------------------------------------------------------------
            // 🛑 ZONA HARDCODED - DEBUGGING
            // Comentamos las variables de entorno para probar directo
            // ---------------------------------------------------------------
            
            // const API_KEY = process.env.EJEM_VOICEFLOW_API_KEY;
            const API_KEY = "VF.DM.693ca53cdecfb91fb1fddf11.lgL5emsu39WzHIZy"; 

            // const VERSION_ID = process.env.EJEM_VOICEFLOW_VERSION_ID;
            const VERSION_ID = "693c8122b5e9def47fba5dbb"; 

            // ---------------------------------------------------------------

            console.log("Intentando conectar a Voiceflow con ID:", VERSION_ID); // Esto saldrá en los logs de Vercel

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
                // Esto nos dirá en los logs POR QUÉ falló Voiceflow si responde error
                const errorText = await voiceflowResponse.text();
                console.error("Error respuesta VF:", errorText);
                throw new Error(`Error en la respuesta de Voiceflow: ${voiceflowResponse.status} - ${errorText}`);
            }
            
            res.setHeader('Content-Type', 'application/json');
            voiceflowResponse.body.pipe(res);

        } else if (target === 'tts') {
            const { text } = payload;
            if (!text) return res.status(400).json({ error: 'Falta el "text" para TTS.' });

            // ---------------------------------------------------------------
            // 🛑 TAMBIÉN HARDCODEAMOS TTS POR SI ACASO
            // ---------------------------------------------------------------
            
            // const API_KEY = process.env.EJEM_TTS_API_KEY;
            const API_KEY = "sk_2bba0f86499a8b2c0186bc2841e49fc970ca86441076ef9a";
            
            // const VOICE_ID = process.env.EJEM_VOICE_ID;
            const VOICE_ID = "rixsIpPlTphvsJd2mI03"; 

            // ---------------------------------------------------------------

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
                 const errorText = await ttsResponse.text();
                 console.error("Error respuesta ElevenLabs:", errorText);
                 throw new Error('Error en la respuesta de ElevenLabs: ' + errorText);
            }
            
            res.setHeader('Content-Type', 'audio/mpeg');
            ttsResponse.body.pipe(res);

        } else {
            return res.status(400).json({ error: 'Target no válido.' });
        }

    } catch (error) {
        console.error('Error en el servidor proxy:', error.message);
        return res.status(500).json({ error: 'Error interno del servidor proxy: ' + error.message });
    }
};