const express = require("express");
const router = express.Router();
const pool = require("../db");
const { runTTSFase2 } = require("../services/tts.elevenlabs.service"); // o .rest

router.post("/:id", async (req, res) => {
  try {
    const out = await runTTSFase2(pool, Number(req.params.id));
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).send("error TTS");
  }
});

module.exports = router;