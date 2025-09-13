const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

//ruta a AUDIOS_DIR
const { AUDIOS_DIR } = require('../config/storage');

async function runTTSFase2(pool, id) {
  // 1) lee texto de fase 1
  const rows = await pool.query("SELECT id, lectura, fase, estado FROM clientes WHERE id=?", [id]);
  if (!rows || rows.length === 0) throw new Error("no existe");
  const { lectura, fase, estado } = rows[0];
  if (!lectura) throw new Error("sin lectura para TTS");

  // evita dobles ejecuciones
  if (fase === 2 && estado === "procesando") return { id, fase, estado, skip:"en curso" };
  if (fase === 2 && estado === "completado") return { id, fase, estado, skip:"ya completado" };

  await pool.query("UPDATE clientes SET fase=2, estado='pendiente' WHERE id=?", [id]);
  await pool.query("UPDATE clientes SET estado='procesando' WHERE id=?", [id]);

  // 2) SDK oficial (import dinámico para CJS)
  const { ElevenLabsClient } = await import("@elevenlabs/elevenlabs-js");
  const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

  const voiceId = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb"; // cualquier voz
  const modelId = process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5";        // barato/rápido

  // 3) genera audio (stream) y guarda a disco
  const audioStream = await client.textToSpeech.stream(voiceId, {
    text: lectura,
    modelId
  }); // el SDK soporta streaming y runtime Node 15+ con timeouts/retries. :contentReference[oaicite:2]{index=2}

  await fs.mkdir(AUDIOS_DIR, { recursive: true });
  const hash = crypto.createHash("sha1").update(String(id) + lectura).digest("hex");
  const filename = `tts_${id}_${hash}.mp3`;
  const full = path.join(AUDIOS_DIR, filename);

  // escribir stream a archivo (WHATWG stream -> buffer)
  const reader = audioStream.getReader();
  const chunks = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
  }
  await fs.writeFile(full, Buffer.concat(chunks));

  const urlPublica = `/audios/${filename}`;
  await pool.query("UPDATE clientes SET audio_url=?, estado='completado' WHERE id=?", [urlPublica, id]);


    // 2) ⬇️ AUTO FASE 3 (pegar aquí)
  try {
    const autoF3 = (process.env.AUTO_FASE3 || "").toLowerCase().trim();
    if (["1","true","on","yes"].includes(autoF3)) {
      const { runVideoFase3 } = require("./video.service"); // mismo directorio /services
      setImmediate(() => {
        runVideoFase3(pool, id).catch(err => {
          console.error("fase3 (auto) falló:", err);
          pool.query("UPDATE clientes SET estado='error' WHERE id=?", [id]).catch(()=>{});
        });
      });
    }
  } catch (e) {
    console.error("no se pudo disparar fase3:", e);
  }

  // 3) devuelves el resultado de fase 2
  

  return { id, fase: 2, estado: "completado", audio_url: urlPublica };
}

module.exports = { runTTSFase2 };