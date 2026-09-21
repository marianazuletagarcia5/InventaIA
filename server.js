// server.js — InventIA. API REST respaldada por SQLite (db.js), sirve el
// frontend estático en /public.
// Ejecutar: npm install && npm start  →  http://localhost:3000

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();
const PUERTO = process.env.PORT || 3000;

// Carga automática del inventario inicial (si la base de datos está vacía)
try {
  if (db.estaVacio()) {
    const rutaSemilla = path.join(__dirname, "data", "inventario_inicial.json");
    if (fs.existsSync(rutaSemilla)) {
      const items = JSON.parse(fs.readFileSync(rutaSemilla, "utf-8"));
      db.importarSemillaInicial(items);
      console.log(`Inventario inicial cargado: ${items.length} registros.`);
    }
  }
} catch (err) {
  console.error("No fue posible cargar el inventario inicial:", err.message);
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function validar(body) {
  const errores = [];
  if (!body.nombre || !body.nombre.trim()) errores.push("El nombre es obligatorio.");
  if (!body.categoria) errores.push("La categoría es obligatoria.");
  if (!body.ubicacion || !body.ubicacion.trim()) errores.push("La ubicación es obligatoria.");
  if (!body.estado) errores.push("El estado es obligatorio.");
  return errores;
}

// ---------- recursos ----------
app.get("/api/recursos", (req, res) => {
  const { categoria, estado, area, buscar } = req.query;
  res.json(db.listarRecursos({ categoria, estado, area, buscar }));
});

app.get("/api/recursos/codigo/:codigo", (req, res) => {
  const r = db.obtenerPorCodigo(req.params.codigo.trim().toUpperCase());
  if (!r) return res.status(404).json({ errores: ["No existe ningún recurso con ese código."] });
  res.json(r);
});

app.post("/api/recursos", (req, res) => {
  const errores = validar(req.body);
  if (errores.length) return res.status(400).json({ errores });
  try {
    res.status(201).json(db.crearRecurso(req.body));
  } catch (err) {
    res.status(500).json({ errores: [err.message] });
  }
});

app.put("/api/recursos/:id", (req, res) => {
  const errores = validar(req.body);
  if (errores.length) return res.status(400).json({ errores });
  const r = db.actualizarRecurso(req.params.id, req.body, req.body._origen);
  if (!r) return res.status(404).json({ errores: ["Recurso no encontrado."] });
  res.json(r);
});

app.delete("/api/recursos/:id", (req, res) => {
  const ok = db.eliminarRecurso(req.params.id);
  if (!ok) return res.status(404).json({ errores: ["Recurso no encontrado."] });
  res.status(204).end();
});

// ---------- escaneo QR ----------
app.post("/api/escanear", (req, res) => {
  const codigo = (req.body.codigo || "").trim().toUpperCase();
  const r = db.registrarEscaneo(codigo);
  if (!r) return res.status(404).json({ errores: ["Código QR no reconocido. Verifica que el recurso esté registrado."] });
  res.json(r);
});

// ---------- panel general ----------
app.get("/api/dashboard", (req, res) => res.json(db.obtenerDashboard()));
app.get("/api/movimientos", (req, res) => res.json(db.listarMovimientos(Number(req.query.limite) || 30)));

// ---------- reportes CSV ----------
app.get("/api/reportes/csv", (req, res) => {
  const { categoria, estado, area } = req.query;
  const lista = db.listarRecursos({ categoria, estado, area });
  const encabezado = ["Codigo","Nombre","Categoria","Area","Ubicacion","Cantidad","Estado","Responsable","Fecha_Adquisicion","Frecuencia_Uso","Observaciones","Fecha_Registro"];
  const filas = lista.map((r) => [
    r.codigo, r.nombre, r.categoria, r.area, r.ubicacion, r.cantidad, r.estado, r.responsable,
    r.fecha_adquisicion, r.frecuencia_uso, r.observaciones, r.fecha_registro,
  ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
  const csv = "\uFEFF" + encabezado.join(",") + "\n" + filas.join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="inventario_inventia.csv"');
  res.send(csv);
});

// ---------- copia de seguridad ----------
app.get("/api/respaldo", (req, res) => {
  res.setHeader("Content-Disposition", 'attachment; filename="respaldo_inventia.json"');
  res.json(db.respaldoCompleto());
});
app.post("/api/respaldo/restaurar", (req, res) => {
  try { db.restaurarRespaldo(req.body); res.json({ ok: true }); }
  catch (err) { res.status(400).json({ errores: ["Archivo de respaldo inválido: " + err.message] }); }
});

app.listen(PUERTO, () => {
  console.log("InventIA - Instituto Tecnico San Rafael");
  console.log(`Servidor escuchando en http://localhost:${PUERTO}`);
  console.log(`Base de datos: ${db.RUTA_DB}`);
});
