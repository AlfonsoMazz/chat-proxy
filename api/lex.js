// ELIMINAMOS EL REQUIRE DE NODE-FETCH (Vercel Node 18+ lo tiene nativo)
// const fetch = require('node-fetch'); <--- BORRA ESTA LINEA

module.exports = async (req, res) => {
    // 1. CORS
    const allowedOrigins = [
        'https://demo.plataformainvestigacion.datialabs.com',
        'http://localhost:5174' 
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { target, agentId, ...payload } = req.body;

        // LOGGING PARA DEBUG (Verás esto en Vercel Logs)
        console.log(`[Request] Target: ${target}, Agent: ${agentId}`);

        if (target === 'voiceflow') {
            const { userID, action } = payload;
            let API_KEY;

            switch (agentId) {
                case 'penal': API_KEY = process.env.VF_PINV_PENAL_API_KEY; break;
                case 'civil': API_KEY = process.env.VF_PINV_CIVIL_API_KEY; break;
                case 'familiar': API_KEY = process.env.VF_PINV_FAMILIAR_API_KEY; break;
                case 'laboral': API_KEY = process.env.VF_PINV_LABORAL_API_KEY; break;
            }

            // Verificación de Key
            if (!API_KEY || API_KEY.includes('PLACEHOLDER')) {
                console.error(`[Error] Falta API Key para ${agentId}`);
                return res.status(500).json({ error: `Configuración faltante para ${agentId}. (Check Env Vars)` });
            }

            const versionID = process.env.VF_PINV_VERSION_ID || 'production';
            const url = `https://general-runtime.voiceflow.com/state/user/${userID}/interact`;

            console.log(`[Voiceflow] Sending to ${url} with version ${versionID}`);

            const voiceflowResponse = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': API_KEY,
                    'versionID': versionID
                },
                body: JSON.stringify({ action }),
            });

            if (!voiceflowResponse.ok) {
                const errorBody = await voiceflowResponse.text();
                console.error(`[Voiceflow Error] Status: ${voiceflowResponse.status}, Body: ${errorBody}`);
                // Devolvemos el error EXACTO de Voiceflow al frontend
                return res.status(voiceflowResponse.status).json({ 
                    error: `Voiceflow Error (${voiceflowResponse.status}): ${errorBody}` 
                });
            }
            
            const data = await voiceflowResponse.json();
            res.status(200).json(data);

        } else {
            return res.status(400).json({ error: 'Target desconocido.' });
        }

    } catch (error) {
        console.error('[Server Error]', error);
        return res.status(500).json({ error: `Error Interno: ${error.message}` });
    }
};