module.exports = async (req, res) => {
    // 1. CORS: Configuración permisiva para asegurar que no sea el problema inicial
    // Puedes restringirlo de nuevo a tu dominio específico una vez funcione.
    res.setHeader('Access-Control-Allow-Origin', 'https://demo.escuelajudicial.datialabs.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Manejo de preflight (el navegador pregunta antes de enviar)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { target, ...payload } = req.body;

        if (!target) return res.status(400).json({ error: 'Falta target' });

        // Definimos las variables aquí (usando process.env para producción)
        const VF_API_KEY = process.env.EJEM_VOICEFLOW_API_KEY;
        const VF_VERSION_ID = process.env.EJEM_VOICEFLOW_VERSION_ID;
        const EL_API_KEY = process.env.EJEM_TTS_API_KEY;
        const EL_VOICE_ID = process.env.EJEM_VOICE_ID;

        let upstreamResponse;

        // --- LÓGICA VOICEFLOW ---
        if (target === 'voiceflow') {
            const { userID, action } = payload;
            const url = `https://general-runtime.voiceflow.com/state/user/${userID}/interact`;

            // Usamos el fetch NATIVO de Node 22 (sin requires)
            upstreamResponse = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': VF_API_KEY,
                    'versionID': VF_VERSION_ID,
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream' // Clave para el streaming
                },
                body: JSON.stringify({ action })
            });

        // --- LÓGICA TTS (ElevenLabs) ---
        } else if (target === 'tts') {
            const { text } = payload;
            const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE_ID}`;

            upstreamResponse = await fetch(ttsUrl, {
                method: 'POST',
                headers: {
                    'xi-api-key': EL_API_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg'
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                })
            });
        } else {
            return res.status(400).json({ error: 'Target inválido' });
        }

        // --- MANEJO DE RESPUESTA Y STREAMING (Nativo Node 22) ---
        
        if (!upstreamResponse.ok) {
            const errorText = await upstreamResponse.text();
            console.error(`Error del proveedor (${target}):`, errorText);
            return res.status(upstreamResponse.status).json({ error: errorText });
        }

        // Copiamos el tipo de contenido (importante para que el navegador sepa si es texto o audio)
        res.setHeader('Content-Type', upstreamResponse.headers.get('content-type'));
        
        // La parte mágica: Bucle de lectura para Node 22
        // Esto reemplaza al .pipe() y funciona sin librerías
        for await (const chunk of upstreamResponse.body) {
            res.write(chunk);
        }
        res.end();

    } catch (error) {
        console.error('Error Crítico en Proxy:', error);
        return res.status(500).json({ error: error.message });
    }
};