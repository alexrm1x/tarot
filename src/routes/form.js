// routes/form.js (fire-and-forget, disparo tras enviar la respuesta)
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { runLectura } = require("../services/lectura.service");

router.post("/", async (req, res) => {
  // si tu HTML ya envía firstname/email/birth_date, esto vale:
  const { firstname, email, birth_date } = req.body;

  // validación mínima para evitar NULLs
  if (!firstname || !email || !birth_date) {
    return res.status(400).json({
      error: "faltan campos",
      detalle: { firstname, email, birth_date }
    });
  }

  try {
    // 1) insertar fase 0 completado
    const result = await pool.query(
      "INSERT INTO clientes (firstname, email, birth_date, fase, estado) VALUES (?, ?, ?, 0, 'completado')",
      [firstname, email, birth_date]
    );
    const id = Number(result.insertId); // evitar BigInt en JSON

    // 2) preparar disparo en background CUANDO acabe de enviarse la respuesta
    res.once("finish", () => {
      setImmediate(async () => {
        try {
          await runLectura(pool, id); // fase 1: pendiente → procesando → completado|error
        } catch (err) {
          console.error("fallo en procesamiento automático:", err);
          try { await pool.query("UPDATE clientes SET estado='error' WHERE id=?", [id]); } catch {}
        }
      });
    });

    // 3) responder YA al usuario (UX rápida)
    res.status(201).json({
      id,
      mensaje: "Formulario recibido. Te contactaremos por email.",
      fase: 0,
      estado: "completado"
    });

  } catch (err) {
    console.error("error en /form:", err);
    return res.status(500).json({ error: "no se pudo crear" });
  }
});

module.exports = router;
