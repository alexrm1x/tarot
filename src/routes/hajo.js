// RUTA: /hajo versión ALFA

const express = require("express");
const OpenAI = require("openai");

const router = express.Router();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.get("/", async (_req, res) => {
  try {
    // 1) Crear thread y capturar SOLO el id
    const thread = await client.beta.threads.create();
    const threadId = thread?.id;
    if (!threadId || !threadId.startsWith("thread_")) {
      throw new Error(`threadId inválido: ${threadId}`);
    }

    // 2) Añadir mensaje
    await client.beta.threads.messages.create(threadId, {
      role: "user",
      content: "Dame una lectura del tarot para Alejandro, nacido el 8 de junio de 1972."
    });

    // 3) Ejecutar el assistant y esperar a que termine (sin bucle manual)
    const run = await client.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: "asst_AlzbnIH23W0DgFwGkVsflgv0"
    });

    // sanity check del run
    const runId = run?.id;
    if (!runId || !runId.startsWith("run_")) {
      throw new Error(`runId inválido: ${runId}`);
    }
    if (run.status !== "completed") {
      return res.status(500).send(`Run no completado. Estado: ${run.status}`);
    }

    // 4) Leer la última respuesta del assistant (buscando la más reciente de role "assistant")
    const list = await client.beta.threads.messages.list(threadId, { limit: 10 });
    const assistantMsg = list.data.find(m => m.role === "assistant");
    const value = assistantMsg?.content?.[0]?.type === "text"
      ? assistantMsg.content[0].text.value
      : "";

    res.send(value || "Sin salida de texto del assistant.");
  } catch (e) {
    console.error(e);
    res.status(500).send("Error ejecutando el assistant.");
  }
});

module.exports = router;
