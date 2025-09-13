// services/video.service.js
const { spawn } = require("child_process");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const { AUDIOS_DIR, VIDEOS_DIR } = require("../config/storage");

// binario empaquetado de ffmpeg (multi-OS)
const FFMPEG_BIN = require("@ffmpeg-installer/ffmpeg").path;

// Assets: ambos 1920x1080
const BG_IMAGE =
  process.env.VID_BG_IMAGE ||
  path.resolve(__dirname, "..", "..", "assets", "video", "bg.jpg");

const LOGO_IMAGE =
  process.env.VID_LOGO_IMAGE ||
  path.resolve(__dirname, "..", "..", "assets", "video", "logo.png");

// Ejecutar ffmpeg y fallar con stderr si algo va mal
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(stderr || `ffmpeg exit ${code}`))
    );
  });
}

async function runVideoFase3(pool, id) {
  // 1) leer cliente (necesita audio_url listo)
  const [row] = await pool.query(
    "SELECT id, fase, estado, audio_url FROM clientes WHERE id=?",
    [id]
  );
  if (!row) throw new Error("no existe");
  const { fase, estado, audio_url } = row;
  if (!audio_url) throw new Error("no hay audio_url (fase 2)");

  // evita dobles ejecuciones
  if (fase === 3 && estado === "procesando")
    return { id, fase, estado, skip: "en curso" };
  if (fase === 3 && estado === "completado")
    return { id, fase, estado, skip: "ya completado" };

  await pool.query(
    "UPDATE clientes SET fase=3, estado='pendiente' WHERE id=?",
    [id]
  );
  await pool.query("UPDATE clientes SET estado='procesando' WHERE id=?", [id]);

  // 2) paths de entrada/salida
  const audioName = path.basename(audio_url); // ej: tts_1_hash.mp3
  const audioPath = path.join(AUDIOS_DIR, audioName);

  // comprobar que existen los assets (ambos 1920x1080)
  await fs.access(BG_IMAGE).catch(() => {
    throw new Error(`BG_IMAGE no encontrada: ${BG_IMAGE}`);
  });
  await fs.access(LOGO_IMAGE).catch(() => {
    throw new Error(`LOGO_IMAGE no encontrada: ${LOGO_IMAGE}`);
  });

  await fs.mkdir(VIDEOS_DIR, { recursive: true });
  const hash = crypto.createHash("sha1").update(String(id) + audioName).digest("hex");
  const outName = `video_${id}_${hash}.mp4`;
  const outPath = path.join(VIDEOS_DIR, outName);

  // 3) SIEMPRE HAY LOGO + SIN ESCALADO NI CROP (ambos 1920x1080)
  // - loop de la imagen de fondo
  // - overlay del PNG 1920x1080 en 0:0 (el PNG debe tener transparencia)
  // - vídeo h264 por CPU (libx264), 30 fps, yuv420p; audio AAC 128k
  const args = [
    "-y",
    "-loop", "1",
    "-i", BG_IMAGE,      // 0: fondo 1920x1080
    "-i", audioPath,     // 1: audio
    "-i", LOGO_IMAGE,    // 2: overlay 1920x1080 con transparencia
    "-filter_complex", "[0:v][2:v]overlay=0:0[v]",
    "-map", "[v]",
    "-map", "1:a:0",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "stillimage",
    "-pix_fmt", "yuv420p",
    "-r", "30",
    "-c:a", "aac",
    "-b:a", "128k",
    "-shortest",
    outPath
  ];

  try {
    await run(FFMPEG_BIN, args);
    const publicUrl = `/videos/${outName}`;
    await pool.query(
      "UPDATE clientes SET video_url=?, estado='completado' WHERE id=?",
      [publicUrl, id]
    );
    return { id, fase: 3, estado: "completado", video_url: publicUrl };
  } catch (err) {
    await pool.query("UPDATE clientes SET estado='error' WHERE id=?", [id]);
    throw err;
  }
}

module.exports = { runVideoFase3, FFMPEG_BIN };
