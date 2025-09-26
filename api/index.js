// Importa las librerías necesarias
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

// Carga las variables de entorno (.env) para desarrollo local
require('dotenv').config();

// Crea la aplicación del servidor
const app = express();

// --- Configuraciones del Servidor (Middlewares) ---
// Define explícitamente quién tiene permiso para conectarse
const corsOptions = {
       origin: 'https://demo.tribunalelectoral.datialabs.com'
};

// Usa la nueva configuración
app.use(cors(corsOptions));

// --- Nuestro Endpoint para Voiceflow ---
// Toda la lógica se ejecutará cuando el frontend llame a /api/interact
app.post('/', async (req, res) => {
  try {
    // 1. Recibimos los datos que nos envía el frontend (el userID y la acción)
    const { userID, action } = req.body;

    if (!userID || !action) {
      return res.status(400).json({ error: 'Faltan userID o action en la petición.' });
    }

    // 2. Obtenemos las claves seguras desde las variables de entorno del servidor
    const API_KEY = process.env.VOICEFLOW_API_KEY;
    const VERSION_ID = process.env.VOICEFLOW_VERSION_ID;

    // 3. Hacemos la llamada a Voiceflow DESDE EL SERVIDOR, usando la clave segura
    const voiceflowResponse = await fetch(
      `https://general-runtime.voiceflow.com/state/user/${userID}/interact`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': API_KEY, // La clave se usa aquí, de forma segura
          'versionID': VERSION_ID,
        },
        body: JSON.stringify({ action }),
      }
    );

    if (!voiceflowResponse.ok) {
        const errorData = await voiceflowResponse.text();
        // Si Voiceflow da un error, lo registramos y lo enviamos al frontend
        console.error('Error desde Voiceflow:', errorData);
        return res.status(voiceflowResponse.status).json({ error: 'Error en la comunicación con Voiceflow', details: errorData });
    }

    // 4. Enviamos la respuesta que nos dio Voiceflow de vuelta al frontend
    const data = await voiceflowResponse.json();
    res.status(200).json(data);

  } catch (error) {
    // Si algo falla en nuestro servidor, lo registramos y enviamos un error genérico
    console.error('Error en el servidor proxy:', error);
    res.status(500).json({ error: 'Error interno del servidor proxy.' });
  }
});

// Exportamos la app para que Vercel (o cualquier otro servicio) la pueda usar
module.exports = app;