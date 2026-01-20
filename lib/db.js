const { Pool } = require('pg');

// Creamos un pool de conexiones para ser eficientes en Vercel
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Indispensable para conectar a Supabase desde Vercel
  },
  max: 3, // Mantenemos pocas conexiones para no saturar la capa gratuita
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};