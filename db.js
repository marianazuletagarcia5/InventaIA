// db.js — Capa de acceso a datos de InventIA.
// Motor: SQLite (archivo local "inventario.db"). Toda la lógica de datos
// vive aquí; migrar a otro motor en el futuro no afecta al resto del sistema.

const path = require("path");
const Database = require("better-sqlite3");

const RUTA_DB = path.join(__dirname, "inventario.db");
const db = new Database(RUTA_DB);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS recursos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    categoria TEXT NOT NULL,
    area TEXT DEFAULT '',
    ubicacion TEXT NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1,
    estado TEXT NOT NULL,
    responsable TEXT DEFAULT '',
    fecha_adquisicion TEXT DEFAULT '',
    frecuencia_uso TEXT DEFAULT 'Media',
    observaciones TEXT DEFAULT '',
    fecha_registro TEXT NOT NULL,
    ultima_actualizacion TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS movimientos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recurso_id INTEGER NOT NULL,
    codigo TEXT NOT NULL,
    tipo TEXT NOT NULL,          -- registro | escaneo | actualizacion | baja
    detalle TEXT DEFAULT '',
    fecha TEXT NOT NULL,
    FOREIGN KEY (recurso_id) REFERENCES recursos(id)
  );

  CREATE TABLE IF NOT EXISTS consecutivo (
    area TEXT NOT NULL,
    anio INTEGER NOT NULL,
    valor INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (area, anio)
  );
`);

const PREFIJOS_AREA = { ZAGALITOS: "ZTO", ZAGALES: "ZAG", JUVAM: "JUV", ADMINISTRATIVO: "ADM" };
function prefijoDeArea(area) {
  const clave = (area || "").trim().toUpperCase();
  return PREFIJOS_AREA[clave] || "GEN";
}

function pad4(n) { return String(n).padStart(4, "0"); }
function ahora() { return new Date().toISOString(); }
function hoy() { return new Date().toISOString().slice(0, 10); }

const generarCodigo = db.transaction((area) => {
  const anio = new Date().getFullYear();
  const prefijo = prefijoDeArea(area);
  const fila = db.prepare("SELECT valor FROM consecutivo WHERE area = ? AND anio = ?").get(prefijo, anio);
  const siguiente = (fila ? fila.valor : 0) + 1;
  if (fila) {
    db.prepare("UPDATE consecutivo SET valor = ? WHERE area = ? AND anio = ?").run(siguiente, prefijo, anio);
  } else {
    db.prepare("INSERT INTO consecutivo (area, anio, valor) VALUES (?, ?, ?)").run(prefijo, anio, siguiente);
  }
  return `${prefijo}-${anio}-${pad4(siguiente)}`;
});

function registrarMovimiento(recurso_id, codigo, tipo, detalle) {
  db.prepare(
    "INSERT INTO movimientos (recurso_id, codigo, tipo, detalle, fecha) VALUES (?, ?, ?, ?, ?)"
  ).run(recurso_id, codigo, tipo, detalle || "", ahora());
}

function listarRecursos({ categoria, estado, area, buscar } = {}) {
  let sql = "SELECT * FROM recursos WHERE 1=1";
  const params = [];
  if (categoria) { sql += " AND categoria = ?"; params.push(categoria); }
  if (estado) { sql += " AND estado = ?"; params.push(estado); }
  if (area) { sql += " AND area = ?"; params.push(area); }
  if (buscar) {
    sql += " AND (nombre LIKE ? OR codigo LIKE ? OR responsable LIKE ? OR ubicacion LIKE ?)";
    const like = `%${buscar}%`;
    params.push(like, like, like, like);
  }
  sql += " ORDER BY codigo";
  return db.prepare(sql).all(...params);
}

function obtenerPorCodigo(codigo) {
  return db.prepare("SELECT * FROM recursos WHERE codigo = ?").get(codigo);
}

const crearRecurso = db.transaction((datos) => {
  const codigo = generarCodigo(datos.area);
  const fecha = hoy();
  const marca = ahora();
  db.prepare(`
    INSERT INTO recursos
      (codigo, nombre, categoria, area, ubicacion, cantidad, estado, responsable, fecha_adquisicion, frecuencia_uso, observaciones, fecha_registro, ultima_actualizacion)
    VALUES (@codigo, @nombre, @categoria, @area, @ubicacion, @cantidad, @estado, @responsable, @fecha_adquisicion, @frecuencia_uso, @observaciones, @fecha_registro, @ultima_actualizacion)
  `).run({
    codigo,
    nombre: datos.nombre,
    categoria: datos.categoria,
    area: datos.area || "",
    ubicacion: datos.ubicacion,
    cantidad: Number(datos.cantidad) > 0 ? Number(datos.cantidad) : 1,
    estado: datos.estado,
    responsable: datos.responsable || "",
    fecha_adquisicion: datos.fecha_adquisicion || "",
    frecuencia_uso: datos.frecuencia_uso || "Media",
    observaciones: datos.observaciones || "",
    fecha_registro: datos.fecha_registro || fecha,
    ultima_actualizacion: marca,
  });
  const recurso = obtenerPorCodigo(codigo);
  registrarMovimiento(recurso.id, codigo, "registro", datos._origen || "Recurso registrado en el sistema.");
  return recurso;
});

const actualizarRecurso = db.transaction((id, datos, origen) => {
  const actual = db.prepare("SELECT * FROM recursos WHERE id = ?").get(id);
  if (!actual) return null;

  db.prepare(`
    UPDATE recursos SET
      nombre=@nombre, categoria=@categoria, area=@area, ubicacion=@ubicacion, cantidad=@cantidad, estado=@estado,
      responsable=@responsable, fecha_adquisicion=@fecha_adquisicion, frecuencia_uso=@frecuencia_uso,
      observaciones=@observaciones, ultima_actualizacion=@ultima_actualizacion
    WHERE id=@id
  `).run({
    id,
    nombre: datos.nombre,
    categoria: datos.categoria,
    area: datos.area || "",
    ubicacion: datos.ubicacion,
    cantidad: Number(datos.cantidad) > 0 ? Number(datos.cantidad) : 1,
    estado: datos.estado,
    responsable: datos.responsable || "",
    fecha_adquisicion: datos.fecha_adquisicion || "",
    frecuencia_uso: datos.frecuencia_uso || "Media",
    observaciones: datos.observaciones || "",
    ultima_actualizacion: ahora(),
  });

  const actualizado = db.prepare("SELECT * FROM recursos WHERE id = ?").get(id);
  registrarMovimiento(id, actualizado.codigo, "actualizacion", origen || "Información actualizada.");
  return actualizado;
});

function eliminarRecurso(id) {
  const r = db.prepare("SELECT * FROM recursos WHERE id = ?").get(id);
  if (!r) return false;
  registrarMovimiento(id, r.codigo, "baja", "Recurso eliminado del inventario.");
  db.prepare("DELETE FROM recursos WHERE id = ?").run(id);
  return true;
}

function registrarEscaneo(codigo) {
  const r = obtenerPorCodigo(codigo);
  if (!r) return null;
  registrarMovimiento(r.id, codigo, "escaneo", "Código QR escaneado.");
  return r;
}

function listarMovimientos(limite = 15) {
  return db.prepare("SELECT * FROM movimientos ORDER BY id DESC LIMIT ?").all(limite);
}

function obtenerDashboard() {
  const total = db.prepare("SELECT COUNT(*) AS n FROM recursos").get().n;
  const porEstado = db.prepare("SELECT estado, COUNT(*) AS n FROM recursos GROUP BY estado").all();
  const porCategoria = db.prepare("SELECT categoria, COUNT(*) AS n FROM recursos GROUP BY categoria").all();
  const porArea = db.prepare("SELECT area, COUNT(*) AS n FROM recursos WHERE area != '' GROUP BY area").all();
  const necesitanReposicion = db.prepare("SELECT COUNT(*) AS n FROM recursos WHERE estado IN ('Malo','De Baja')").get().n;
  const movimientosRecientes = listarMovimientos(8);
  return { total, porEstado, porCategoria, porArea, necesitanReposicion, movimientosRecientes };
}

// Carga masiva inicial a partir de un arreglo ya normalizado
// (ver data/inventario_inicial.json). Solo se usa si la tabla está vacía.
const importarSemillaInicial = db.transaction((items) => {
  const fecha = hoy();
  items.forEach((it) => {
    crearRecurso({
      nombre: it.nombre,
      categoria: it.categoria,
      area: it.area,
      ubicacion: it.salon,
      cantidad: it.cantidad,
      estado: "Bueno",
      responsable: it.responsable,
      fecha_adquisicion: "",
      frecuencia_uso: "Media",
      observaciones: "Importado del inventario físico por salones (marzo 2026).",
      fecha_registro: fecha,
      _origen: "Cargado desde el inventario inicial por salones.",
    });
  });
});

function estaVacio() {
  return db.prepare("SELECT COUNT(*) AS n FROM recursos").get().n === 0;
}

function respaldoCompleto() {
  return {
    recursos: db.prepare("SELECT * FROM recursos ORDER BY id").all(),
    movimientos: db.prepare("SELECT * FROM movimientos ORDER BY id").all(),
    consecutivo: db.prepare("SELECT * FROM consecutivo").all(),
    exportadoEl: ahora(),
  };
}

const restaurarRespaldo = db.transaction((datos) => {
  db.prepare("DELETE FROM movimientos").run();
  db.prepare("DELETE FROM recursos").run();
  db.prepare("DELETE FROM consecutivo").run();

  const insR = db.prepare(`
    INSERT INTO recursos (id, codigo, nombre, categoria, area, ubicacion, cantidad, estado, responsable, fecha_adquisicion, frecuencia_uso, observaciones, fecha_registro, ultima_actualizacion)
    VALUES (@id, @codigo, @nombre, @categoria, @area, @ubicacion, @cantidad, @estado, @responsable, @fecha_adquisicion, @frecuencia_uso, @observaciones, @fecha_registro, @ultima_actualizacion)
  `);
  (datos.recursos || []).forEach((r) => insR.run({ area: "", cantidad: 1, ...r }));

  const insM = db.prepare(`
    INSERT INTO movimientos (id, recurso_id, codigo, tipo, detalle, fecha)
    VALUES (@id, @recurso_id, @codigo, @tipo, @detalle, @fecha)
  `);
  (datos.movimientos || []).forEach((m) => insM.run(m));

  const insC = db.prepare("INSERT INTO consecutivo (area, anio, valor) VALUES (@area, @anio, @valor)");
  (datos.consecutivo || []).forEach((c) => insC.run(c));
});

module.exports = {
  listarRecursos, obtenerPorCodigo, crearRecurso, actualizarRecurso, eliminarRecurso,
  registrarEscaneo, listarMovimientos, obtenerDashboard, respaldoCompleto, restaurarRespaldo,
  importarSemillaInicial, estaVacio,
  RUTA_DB,
};
