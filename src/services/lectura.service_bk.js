// services/lectura.service.js
const OpenAI = require("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function extraerTexto(msg) {
  if (!msg?.content?.length) return null;
  const partes = msg.content
    .filter((p) => p.type === "text" && p.text?.value)
    .map((p) => p.text.value);
  return partes.length ? partes.join("\n\n").trim() : null;
}

function desjsonificar(str) {
  if (!str || typeof str !== "string") return str;
  let s = str
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
    try {
      const obj = JSON.parse(s);
      if (typeof obj === "string") return obj.trim();
      if (obj && typeof obj.lectura === "string") return obj.lectura.trim();
      if (obj && typeof obj === "object") {
        const firstString = Object.values(obj).find((v) => typeof v === "string");
        if (firstString) return String(firstString).trim();
      }
      if (Array.isArray(obj)) {
        const firstStringInArray = obj.find((v) => typeof v === "string");
        if (firstStringInArray) return firstStringInArray.trim();
      }
      return s;
    } catch {
      return s;
    }
  }
  return s;
}

async function runLectura(pool, id) {
  // 1) leer datos
  const rows = await pool.query(
    "SELECT id, firstname, birth_date, fase, estado FROM clientes WHERE id = ?",
    [id]
  );
  if (!rows || rows.length === 0) throw new Error("registro no encontrado");

  const { firstname, birth_date, fase, estado } = rows[0];

  // 2) protecciones
  if (fase === 1 && estado === "procesando") return { id, fase, estado, skip: "en curso" };
  if (fase === 1 && estado === "completado") return { id, fase, estado, skip: "ya completado" };

  // 3) transiciones fase 1
  await pool.query("UPDATE clientes SET fase = 1, estado = 'pendiente' WHERE id = ?", [id]);
  await pool.query("UPDATE clientes SET estado = 'procesando' WHERE id = ?", [id]);

  // 4) openai
  const prompt = `Dame una lectura del tarot para el nombre ${firstname} y la fecha de nacimiento ${birth_date}.`;
  const thread = await client.beta.threads.create();
  await client.beta.threads.messages.create(thread.id, { role: "user", content: prompt });
  const run = await client.beta.threads.runs.createAndPoll(thread.id, {
    assistant_id: "asst_AlzbnIH23W0DgFwGkVsflgv0",
  });

  if (run.status !== "completed") {
    await pool.query("UPDATE clientes SET estado = 'error' WHERE id = ?", [id]);
    throw new Error(`assistant no completado: ${run.status}`);
  }

  // 5) extraer texto
  const list = await client.beta.threads.messages.list(thread.id, { limit: 5 });
  const msg = list.data.find((m) => m.role === "assistant");
  const lecturaRaw = extraerTexto(msg);
  if (!lecturaRaw) {
    await pool.query("UPDATE clientes SET estado = 'error' WHERE id = ?", [id]);
    throw new Error("sin texto de salida del assistant");
  }

  const lecturaDepurada = desjsonificar(lecturaRaw);

  // 6) guardar y marcar completado fase 1
  await pool.query(
    "UPDATE clientes SET lectura = ?, estado = 'completado' WHERE id = ?",
    [lecturaDepurada, id]
  );

  // 7) ⬇️ encadenar fase 2 (ElevenLabs) automáticamente si AUTO_FASE2=1
  try {
    if (process.env.AUTO_FASE2 === "1") {
      // import aquí para evitar ciclos; como estás en /services, el path es './...'
      const { runTTSFase2 } = require("./tts.elevenlabs.service"); // o "./tts.elevenlabs.rest" si usas REST
      setImmediate(() => {
        runTTSFase2(pool, id).catch((err) => {
          console.error("fase2 (auto) falló:", err);
          // si algo revienta antes de que fase 2 cambie estados, deja constancia
          pool.query("UPDATE clientes SET estado='error' WHERE id=?", [id]).catch(() => {});
        });
      });
    }
  } catch (e) {
    console.error("no se pudo disparar fase2:", e);
  }

  // 8) responder
  return { id, fase: 1, estado: "completado", lectura: lecturaDepurada };
}

module.exports = { runLectura };
