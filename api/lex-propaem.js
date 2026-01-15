// ./api/lex.js (o lex-propaem.js)

module.exports = async (req, res) => {
    // 1. CORS - LISTA BLANCA DE DOMINIOS
    const allowedOrigins = [
        'https://tu-subdominio-propaem.datialabs.com', // <--- ACTUALIZA CON TU DOMINIO REAL
        'http://localhost:5173',
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

        console.log(`[Request] Target: ${target}, Agent: ${agentId}`);

        if (target === 'voiceflow') {
            const { userID, action } = payload;
            let API_KEY;

            // 2. MAPEO DE AGENTES PROPAEM -> VARIABLES DE ENTORNO (Prefijo LEX_PROPAEM)
            switch (agentId) {
                case 'fauna':          API_KEY = process.env.VF_LEX_PROPAEM_FAUNA_API_KEY; break;
                case 'atmosfera':      API_KEY = process.env.VF_LEX_PROPAEM_ATMOSFERA_API_KEY; break;
                case 'residuos':       API_KEY = process.env.VF_LEX_PROPAEM_RESIDUOS_API_KEY; break;
                case 'impacto':        API_KEY = process.env.VF_LEX_PROPAEM_IMPACTO_API_KEY; break;
                case 'forestal':       API_KEY = process.env.VF_LEX_PROPAEM_FORESTAL_API_KEY; break;
                case 'agua':           API_KEY = process.env.VF_LEX_PROPAEM_AGUA_API_KEY; break;
                case 'procedimiento':  API_KEY = process.env.VF_LEX_PROPAEM_PROCEDIMIENTO_API_KEY; break;
                default:
                    console.error(`[Error] ID de Agente no reconocido: ${agentId}`);
                    return res.status(400).json({ error: `Agente no válido: ${agentId}` });
            }

            // Verificación de Key
            if (!API_KEY || API_KEY.includes('PLACEHOLDER')) {
                console.error(`[Error] Falta API Key para ${agentId}`);
                return res.status(500).json({ error: `Configuración faltante para ${agentId}. (Check Env Vars)` });
            }

            // ID de Versión
            const versionID = process.env.VF_LEX_PROPAEM_VERSION_ID || 'production';
            
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