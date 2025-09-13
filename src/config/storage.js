const path = require('path');

// ✅ unifica todos a la MISMA carpeta de audios
// - en dev: <raiz>/audios
// - en prod: usa AUDIOS_DIR absoluto (e.g. /srv/tarot/audios)
const AUDIOS_DIR = process.env.AUDIOS_DIR
  || path.resolve(__dirname, '..', '..', 'audios');

const VIDEOS_DIR = process.env.VIDEOS_DIR || path.resolve(__dirname, '..', '..', 'videos');

module.exports = { AUDIOS_DIR, VIDEOS_DIR };
