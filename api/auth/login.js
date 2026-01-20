// ./api/auth/login.js
const db = require('../../lib/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Clave secreta para firmar los tokens. 
// EN PRODUCCIÓN: Muévela al .env (ej. JWT_SECRET="tu_secreto_super_seguro")
const JWT_SECRET = process.env.JWT_SECRET || 'secreto_temporal_para_demo';

module.exports = async (req, res) => {
    // 1. Configuración CORS (Permitir acceso desde tu frontend)
    res.setHeader('Access-Control-Allow-Origin', '*'); // O pon tu dominio específico
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    try {
        // 2. Buscar usuario en la Base de Datos
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const user = result.rows[0];

        // 3. Verificar contraseña (comparar hash)
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // 4. Verificar si el usuario está activo
        if (!user.is_active) {
            return res.status(403).json({ error: 'Usuario desactivado. Contacte soporte.' });
        }

        // 5. Generar Token JWT
        // Este token contiene el ID del usuario y su Org. Expira en 24 horas.
        const token = jwt.sign(
            { userId: user.id, orgId: user.organization_id, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 6. Responder con el token y datos básicos
        return res.status(200).json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.full_name,
                quota_remaining: user.monthly_quota - user.requests_count
            }
        });

    } catch (error) {
        console.error('Login Error:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};