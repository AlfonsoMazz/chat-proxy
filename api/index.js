const fetch = require('node-fetch');

// Exportamos una única función que Vercel ejecutará
module.exports = async (req, res) => {
    // 1. Configuramos los permisos (CORS) manualmente para ser explícitos
    res.setHeader('Access-Control-Allow-Origin', 'https://demo.tribunalelectoral.datialabs.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 2. El navegador a veces envía una petición 'OPTIONS' antes del 'POST'.
    //    Si es así, le damos el visto bueno y terminamos.
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // 3. Nos aseguramos de que solo se acepten peticiones POST
    if (req.method !== 'POST') {
         return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 4. La misma lógica que ya teníamos
    try {
        const { userID, action } = req.body;

        if (!userID || !action) {
            return res.status(400).json({ error: 'Faltan userID o action en la petición.' });
        }

        const API_KEY = process.env.VOICEFLOW_API_KEY;
        const VERSION_ID = process.env.VOICEFLOW_VERSION_ID;

        const voiceflowResponse = await fetch(
            `https://general-runtime.voiceflow.com/state/user/${userID}/interact`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': API_KEY,
                    'versionID': VERSION_ID,
                },
                body: JSON.stringify({ action }),
            }
        );

        if (!voiceflowResponse.ok) {
            const errorData = await voiceflowResponse.text();
            console.error('Error desde Voiceflow:', errorData);
            return res.status(voiceflowResponse.status).json({ error: 'Error en la comunicación con Voiceflow', details: errorData });
        }

        const data = await voiceflowResponse.json();
        return res.status(200).json(data);

    } catch (error) {
        console.error('Error en el servidor proxy:', error);
        return res.status(500).json({ error: 'Error interno del servidor proxy.' });
    }
};