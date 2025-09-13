// routes/lectura.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { runLectura } = require("../services/lectura.service");

router.post("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).send("id inválido");
  try {
    const result = await runLectura(pool, id);
    return res.status(200).json(result);
  } catch (err) {
    console.error("error generando/guardando lectura:", err);
    return res.status(500).send("error generando/guardando lectura");
  }
});

module.exports = router;
