const express = require("express");
const router = express.Router();
const pool = require('../db.js');

/*
router.post('/', (req, res) => {
  const { nombre, fecha } = req.body;
  console.log(`Nombre: ${nombre}, Fecha: ${fecha}`);
  //res.status(200).redirect('/form-ok');
  res.redirect(303, '/form-ok')
  console.log(JSON.stringify(req.body, null, 2));
  //json({ status: 'success', data: req.body });
});
*/

router.post("/", async (req, res) => {
  try {
    const { nombre, email, fecha } = req.body;

    if (!nombre || !email || !fecha) {
      return res.status(400).send("faltan campos: nombre, email, fecha");
    }

    // Normaliza 'DD/MM/YYYY' → 'YYYY-MM-DD'. Si ya viene 'YYYY-MM-DD', lo deja igual.
    //const birthDate = normalizarFecha(fecha);

    const birthDate = fecha;

    // Inserta y recupera el id autoincrement
    const sql = "INSERT INTO clientes (firstname, email, birth_date, fase, estado) VALUES (?, ?, ?, 0, 'completado')";
    const params = [nombre, email, birthDate];
    const result = await pool.query(sql, params);

    const id = result.insertId; // referencia para el segundo paso
    return res.redirect(303, `/form-ok?id=${id}`);
  } catch (err) {
    console.error("error insertando en MariaDB:", err);
    return res.status(500).send("error guardando datos");
  }
});

module.exports = router;