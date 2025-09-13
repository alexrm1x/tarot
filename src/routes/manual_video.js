const express = require('express');
const router = express.Router();
const pool = require('../db');
const { runVideoFase3 } = require('../services/video.service');

async function handle(req, res) {
  try {
    const out = await runVideoFase3(pool, Number(req.params.id));
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).send('error vídeo');
  }
}

router.post('/:id', handle);
router.get('/:id', handle); // útil probar en navegador

module.exports = router;
