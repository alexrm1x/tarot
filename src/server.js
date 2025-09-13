// Variables de entorno DOTENV
require('dotenv').config();
console.log('KEY presente?', !!process.env.OPENAI_API_KEY); // true/false
console.log("AUTO_FASE2 en arranque =", JSON.stringify(process.env.AUTO_FASE2));


const express = require('express');
const morgan = require('morgan');
const path = require("path");


// Base de datos
const pool = require('./db.js');

// Crear servidor
const app = express();

//Audios y Videos
const { AUDIOS_DIR, VIDEOS_DIR } = require('./config/storage');
app.use('/audios', express.static(AUDIOS_DIR, { maxAge: '30d', etag: true }));
app.use('/videos', express.static(VIDEOS_DIR, { maxAge: '30d', etag: true }));

// Middleware
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static("./src/public")); 
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded bodies

// Rutas
const rutasUsuarios = require(path.join(__dirname, 'routes', 'listausuarios.js'));
app.use('/usuarios', rutasUsuarios);

const formRouter = require('./routes/form.js');
app.use('/form', formRouter);

const lecturaRouter = require("./routes/lectura");
app.use("/lectura", lecturaRouter);

//ChatGPT
const hajo = require(path.join(__dirname, 'routes', 'hajo.js'));
app.use('/hajo', hajo);


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

app.get('/form-ok', (req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html');
  res.end('<h1>Formulario recibido correctamente</h1>');
});


app.get("/test-insert", async (req, res) => {
  try {
    const result = await pool.query(
      "INSERT INTO clientes (firstname, email, birth_date, fase, estado) VALUES (?, ?, ?, 0, 'completado')",
      ["Test", "test@mail.com", "1990-01-01"]
    );

    console.log("insertId:", result.insertId, "typeof:", typeof result.insertId);
    res.send("OK, mira la consola 👀");
  } catch (err) {
    console.error("Error en test-insert:", err);
    res.status(500).send("Error en test-insert");
  }
});

app.use('/manual_tts', require('./routes/manual_tts'));

const manualVideo = require('./routes/manual_video');
app.use('/manual_video', manualVideo); // POST/GET /manual_video/:id
