// ./create_first_admin.js
// EJECUTAR CON: node create_first_admin.js
require('dotenv').config(); // Asegúrate de tener dotenv instalado o carga las variables
const db = require('./lib/db');
const bcrypt = require('bcryptjs');

async function main() {
  const email = 'tu_email@admin.com'; // <--- PON TU EMAIL AQUÍ
  const password = 'tu_password_seguro'; // <--- PON TU CONTRASEÑA AQUÍ
  const orgName = 'Demo Gobierno';

  try {
    console.log('--- Iniciando creación de Super Admin ---');

    // 1. Crear Organización
    const orgRes = await db.query(
      `INSERT INTO organizations (name, slug, allowed_origins) 
       VALUES ($1, $2, $3) RETURNING id`,
      [orgName, 'demo-gob', ['https://demo.gobierno.datialabs.com', 'http://localhost:3000']]
    );
    const orgId = orgRes.rows[0].id;
    console.log(`Organización creada con ID: ${orgId}`);

    // 2. Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // 3. Crear Usuario
    const userRes = await db.query(
      `INSERT INTO users (organization_id, email, password_hash, full_name, role, monthly_quota)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [orgId, email, hash, 'Super Admin', 'admin', 999999]
    );
    
    console.log(`Usuario Admin creado con ID: ${userRes.rows[0].id}`);
    console.log('--- PROCESO TERMINADO ---');
    process.exit(0);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();