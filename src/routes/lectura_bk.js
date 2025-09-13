const express = require("express");
const router = express.Router();
const pool = require("../db");        // tu db.js (mariadb)
const OpenAI = require("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// CAMBIO: extraer todos los bloques de texto del mensaje del assistant
function extraerTexto(msg) {
  if (!msg?.content?.length) return null;
  const partes = msg.content
    .filter(p => p.type === "text" && p.text?.value)
    .map(p => p.text.value);
  return partes.length ? partes.join("\n\n").trim() : null;
}


// CAMBIO: limpiar envoltorios (```json ... ```) y, si parece JSON, quedarnos con el campo "lectura"
function desjsonificar(str) {
  if (!str || typeof str !== "string") return str;

  // quitar fences de código tipo ```json ... ```
  let s = str.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // si parece JSON, intentar parsear
  if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
    try {
      const obj = JSON.parse(s);

      // 1) si es string directo
      if (typeof obj === "string") return obj.trim();

      // 2) si trae { lectura: "..." }
      if (obj && typeof obj.lectura === "string") return obj.lectura.trim();

      // 3) si es objeto con algún string útil, coge el primero
      if (obj && typeof obj === "object") {
        const firstString = Object.values(obj).find(v => typeof v === "string");
        if (firstString) return String(firstString).trim();
      }

      // 4) si es array de strings, coge el primero
      if (Array.isArray(obj)) {
        const firstStringInArray = obj.find(v => typeof v === "string");
        if (firstStringInArray) return firstStringInArray.trim();
      }
      // si no encontramos nada mejor, devuelve el original sin fences
      return s;
    } catch {
      // si no parsea, devuelve lo que hay sin fences
      return s;
    }
  }

  // no parecía JSON: devolver tal cual (sin fences)
  return s;
}




// POST /lectura/:id  → genera y guarda la lectura para ese registro
router.post("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).send("id inválido");
  }

  try {
    // 1) obtener datos del registro
    const rows = await pool.query(
      "SELECT firstname, email, birth_date FROM clientes WHERE id = ?",
      [id]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).send("registro no encontrado");
    }
    const { firstname, email, birth_date } = rows[0];

    // 2) construir el mensaje para el assistant
    const prompt = `Dame una lectura del tarot para el nombre ${firstname} y la fecha de nacimiento ${birth_date}.`;

    // 3) assistants v2: crear thread, añadir mensaje y ejecutar
    const thread = await client.beta.threads.create();
    await client.beta.threads.messages.create(thread.id, {
      role: "user",
      content: prompt
    });

    const run = await client.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: "asst_AlzbnIH23W0DgFwGkVsflgv0"
    });

    if (run.status !== "completed") {
      return res.status(502).send(`assistant no completado: ${run.status}`);
    }

    // 4) recuperar la respuesta del assistant
    const list = await client.beta.threads.messages.list(thread.id, { limit: 5 });
    const msg = list.data.find(m => m.role === "assistant");

    // CAMBIO: extraer texto raw y luego desjsonificar
    const lecturaRaw = extraerTexto(msg);
    if (!lecturaRaw) {
      return res.status(502).send("sin texto de salida del assistant");
    }

    // CAMBIO: logs para ver raw vs depurado
    console.log("lectura RAW recibida del assistant:", lecturaRaw);

    const lecturaDepurada = desjsonificar(lecturaRaw);

    // CAMBIO: este es el console del STRING final que vas a guardar (lo que pedías)
    console.log("lectura DEPURADA (string) a guardar:", lecturaDepurada);

    // 5) guardar en BBDD SOLO el string depurado
    await pool.query("UPDATE clientes SET lectura = ? WHERE id = ?", [lecturaDepurada, id]);

    // 6) devolver confirmación
    return res.status(200).json({ id, lectura: lecturaDepurada });
  } catch (err) {
    console.error("error generando/guardando lectura:", err);
    return res.status(500).send("error generando/guardando lectura");
  }
});

module.exports = router;