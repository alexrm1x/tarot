const express = require("express");
const router = express.Router();
const pool = require('../db.js');

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM clientes');
    res.json(rows);

    // Separamos la fecha en partes
    console.log(rows);
    const birth_date = rows.birth_date;

    const [dia, mes, ano] = birth_date.split('-');
    console.log(`dia: ${dia}, mes: ${mes}, ano: ${ano}`);

  } catch (error) {
    console.error('Error al obtener la lista de clientes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


module.exports = router;
