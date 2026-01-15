module.exports = async (req, res) => {
    // 1. CORS - LISTA BLANCA ACTUALIZADA
    const allowedOrigins = [
        'https://demo.propaem.datialabs.com', // <--- DOMINIO CONFIRMADO
        'http://localhost:5173',              // Dev local
        'http://localhost:5174'               // Dev local backup
    ];
    
    const origin = req.headers.origin;
    
    // Verificación de Origen
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    // Headers requeridos
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, versionID');

    // Preflight check para navegadores
    if (req.method === 'OPTIONS') return res.status(200).end();
    
    // Método no permitido
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { target, agentId, ...payload } = req.body;

        // Logging para debug en Vercel
        console.log(`[Request] Target: ${target}, Agent: ${agentId}, Origin: ${origin}`);

        if (target === 'voiceflow') {
            const { userID, action } = payload;
            let API_KEY;

            // 2. MAPEO DE AGENTES PROPAEM (Sintaxis con guiones bajos)
            switch (agentId) {
                case 'fauna':          API_KEY = process.env.VF_LEX_PROPAEM_FAUNA_API_KEY; break;
                case 'atmosfera':      API_KEY = process.env.VF_LEX_PROPAEM_ATMOSFERA_API_KEY; break;
                case 'residuos':       API_KEY = process.env.VF_LEX_PROPAEM_RESIDUOS_API_KEY; break;
                case 'impacto':        API_KEY = process.env.VF_LEX_PROPAEM_IMPACTO_API_KEY; break;
                case 'forestal':       API_KEY = process.env.VF_LEX_PROPAEM_FORESTAL_API_KEY; break;
                case 'agua':           API_KEY = process.env.VF_LEX_PROPAEM_AGUA_API_KEY; break;
                case 'procedimiento':  API_KEY = process.env.VF_LEX_PROPAEM_PROCEDIMIENTO_API_KEY; break;
                default:
                    console.error(`[Error] Agente no reconocido: ${agentId}`);
                    return res.status(400).json({ error: `ID de agente no válido: ${agentId}` });
            }

            // Verificación de existencia de API KEY
            if (!API_KEY || API_KEY.includes('PLACEHOLDER')) {
                console.error(`[Error] Falta API Key en Vercel para: ${agentId}`);
                return res.status(500).json({ error: `Error de configuración del servidor para ${agentId}.` });
            }

            // ID de Versión (Production por defecto)
            const versionID = process.env.VF_LEX_PROPAEM_VERSION_ID || 'production';
            
            const url = `https://general-runtime.voiceflow.com/state/user/${userID}/interact`;

            // Petición a Voiceflow
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
                // Retornar error transparente al frontend
                return res.status(voiceflowResponse.status).json({ 
                    error: `Error del proveedor de IA (${voiceflowResponse.status})` 
                });
            }
            
            const data = await voiceflowResponse.json();
            res.status(200).json(data);

        } else {
            return res.status(400).json({ error: 'Target no soportado.' });
        }

    } catch (error) {
        console.error('[Server Error]', error);
        return res.status(500).json({ error: `Error interno del proxy: ${error.message}` });
    }
};