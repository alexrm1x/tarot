const mariadb = require("mariadb");

const pool = mariadb.createPool({
  host: "localhost",
  user: "root",
  password: "cultus",
  database: "tarot",
  connectionLimit: 5, // ajusta según tu carga
  port: 3306, // por si lo cambiaste
  allowPublicKeyRetrieval: true, // a veces útil en local
  dateStrings: true,        // o: dateStrings: ['DATE']
  bigIntAsNumber: true // si tus ids caben en Number
});

// prueba rápida de conexión al cargar el módulo (opcional)
(async () => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query('SELECT 1');
    console.log('Conexión exitosa a MariaDB');
  } catch (err) {
    console.error('Error al conectar a MariaDB:', err);
  } finally {
    if (conn) conn.release();
  }
})();

// cierre ordenado del pool al terminar el proceso (opcional recomendado)
process.on('SIGINT', async () => {
  try { await pool.end(); } catch {}
  process.exit(0);
});

module.exports = pool;
