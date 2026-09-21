// mobile.js — App móvil simplificada de InventIA.
(function(){
  "use strict";
  const API = "/api";
  let lector = null;
  let camaraActiva = false;
  let filtroAreaActual = "";

  const AREAS = [
    { valor: "ZAGALITOS", emoji: "🧸", etiqueta: "Zagalitos" },
    { valor: "ZAGALES", emoji: "🎒", etiqueta: "Zagales" },
    { valor: "JUVAM", emoji: "🎓", etiqueta: "Juvam" },
    { valor: "ADMINISTRATIVO", emoji: "🏢", etiqueta: "Administrativo" },
  ];
  const CATEGORIAS = [
    { valor: "Mobiliario", emoji: "🪑" },
    { valor: "Equipo tecnológico", emoji: "💻" },
    { valor: "Infraestructura", emoji: "🏗️" },
    { valor: "Aseo", emoji: "🧹" },
    { valor: "Equipo deportivo", emoji: "🏀" },
    { valor: "Herramienta", emoji: "🔧" },
    { valor: "Material didáctico", emoji: "📚" },
    { valor: "Otro", emoji: "📦" },
  ];
  const ESTADOS = ["Bueno", "Regular", "Malo", "De Baja"];
  function claseEstado(estado){ return estado.replace(/\s+/g, ""); }
  function escapeHtml(s){ return String(s||"").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

  function toast(msg){
    const t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("mostrar");
    clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.remove("mostrar"), 2600);
  }

  async function api(ruta, opciones){
    const resp = await fetch(API + ruta, opciones);
    if(resp.status === 204) return null;
    const datos = await resp.json().catch(() => ({}));
    if(!resp.ok) throw new Error((datos.errores && datos.errores.join(" ")) || "Error de conexión con el servidor.");
    return datos;
  }

  async function verificarConexion(){
    const el = document.getElementById("estado-conexion");
    try{ await api("/dashboard"); el.textContent = "en línea"; el.style.color = "#8FD9A8"; }
    catch(e){ el.textContent = "sin conexión"; el.style.color = "#E9B9C0"; }
  }

  // ---------- navegación inferior ----------
  const botonesNav = document.querySelectorAll("#navbar button");
  botonesNav.forEach(btn => {
    btn.addEventListener("click", () => irAPantalla(btn.dataset.pantalla));
  });
  function irAPantalla(nombre){
    if(camaraActiva && nombre !== "escanear") detenerCamara();
    botonesNav.forEach(b => b.classList.toggle("activo", b.dataset.pantalla === nombre));
    document.querySelectorAll(".pantalla").forEach(p => p.classList.remove("activa"));
    document.getElementById("pantalla-" + nombre).classList.add("activa");
    if(nombre === "agregar") iniciarWizard();
    if(nombre === "inventario") cargarInventario();
  }

  // ---------- hoja inferior (bottom sheet) ----------
  const hojaFondo = document.getElementById("hoja-fondo");
  const hojaContenido = document.getElementById("hoja-contenido");
  function abrirHoja(html){
    hojaContenido.innerHTML = '<div class="manija"></div>' + html;
    hojaFondo.classList.add("activo");
  }
  function cerrarHoja(){ hojaFondo.classList.remove("activo"); hojaContenido.innerHTML = ""; }
  hojaFondo.addEventListener("click", (e) => { if(e.target === hojaFondo) cerrarHoja(); });

  // =========================================================
  // ESCANEAR
  // =========================================================
  document.getElementById("btn-iniciar-camara").addEventListener("click", iniciarCamara);
  document.getElementById("btn-detener-camara").addEventListener("click", detenerCamara);
  document.getElementById("btn-buscar-manual").addEventListener("click", () => {
    const c = document.getElementById("codigo-manual").value.trim();
    if(c) buscarYMostrarRecurso(c);
  });
  document.getElementById("codigo-manual").addEventListener("keydown", (e) => {
    if(e.key === "Enter"){ e.preventDefault(); document.getElementById("btn-buscar-manual").click(); }
  });

  function iniciarCamara(){
    if(typeof Html5Qrcode === "undefined"){
      toast("No se pudo cargar el lector QR (se necesita internet la primera vez).");
      return;
    }
    document.getElementById("placeholder-camara").style.display = "none";
    document.getElementById("lector-camara-interno").style.display = "block";
    lector = new Html5Qrcode("lector-camara-interno");
    lector.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 230 },
      (texto) => buscarYMostrarRecurso(texto),
      () => {}
    ).then(() => {
      camaraActiva = true;
      document.getElementById("btn-iniciar-camara").style.display = "none";
      document.getElementById("btn-detener-camara").style.display = "block";
    }).catch(() => {
      toast("No fue posible acceder a la cámara. Revisa los permisos.");
      document.getElementById("placeholder-camara").style.display = "flex";
      document.getElementById("lector-camara-interno").style.display = "none";
    });
  }
  function detenerCamara(){
    if(lector && camaraActiva){
      lector.stop().then(() => {
        lector.clear();
        camaraActiva = false;
        document.getElementById("btn-iniciar-camara").style.display = "block";
        document.getElementById("btn-detener-camara").style.display = "none";
        document.getElementById("placeholder-camara").style.display = "flex";
        document.getElementById("lector-camara-interno").style.display = "none";
      }).catch(() => {});
    }
  }

  async function buscarYMostrarRecurso(codigo){
    codigo = codigo.trim().toUpperCase();
    const cont = document.getElementById("resultado-escaneo");
    try{
      const r = await api("/escanear", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ codigo }) });
      if(navigator.vibrate) navigator.vibrate(60);
      cont.innerHTML = tarjetaDetalleRecurso(r);
      document.getElementById("codigo-manual").value = "";
    }catch(err){
      cont.innerHTML = `<div class="tarjeta" style="text-align:center;color:var(--malo);">${escapeHtml(err.message)}</div>`;
    }
  }

  function tarjetaDetalleRecurso(r){
    return `
      <div class="tarjeta">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <h3 style="font-size:18px;">${escapeHtml(r.nombre)}</h3>
          <span class="badge-estado ${claseEstado(r.estado)}">${r.estado}</span>
        </div>
        <div class="cod-grande" style="margin-bottom:10px;">${r.codigo}</div>
        <div class="fila-dato"><span>Área</span><span>${r.area || "—"}</span></div>
        <div class="fila-dato"><span>Categoría</span><span>${r.categoria}</span></div>
        <div class="fila-dato"><span>Ubicación</span><span>${escapeHtml(r.ubicacion)}</span></div>
        <div class="fila-dato"><span>Cantidad</span><span>${r.cantidad}</span></div>
        <div class="fila-dato"><span>Responsable</span><span>${escapeHtml(r.responsable) || "—"}</span></div>
        <button class="btn-grande negro" style="margin-top:16px;" onclick="MOB.cambiarEstado(${r.id}, '${r.codigo}')">Cambiar estado</button>
      </div>`;
  }

  // Cambiar estado con un toque (hoja inferior con 4 tiles grandes)
  window.MOB = window.MOB || {};
  window.MOB.cambiarEstado = function(id, codigo){
    abrirHoja(`
      <h3 style="margin-bottom:14px;">¿Cómo está este recurso?</h3>
      <div class="grid-estados">
        ${ESTADOS.map(es => `<button class="tile-estado ${claseEstado(es)}" onclick="MOB.guardarEstado(${id}, '${es}')">${es}</button>`).join("")}
      </div>
    `);
  };
  window.MOB.guardarEstado = async function(id, nuevoEstado){
    try{
      const actual = (await api("/recursos")).find(x => x.id === id);
      if(!actual) throw new Error("Recurso no encontrado.");
      const actualizado = await api("/recursos/" + id, {
        method: "PUT", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ ...actual, estado: nuevoEstado, _origen: "Estado actualizado desde escaneo." }),
      });
      cerrarHoja();
      toast("Estado actualizado a \"" + nuevoEstado + "\".");
      document.getElementById("resultado-escaneo").innerHTML = tarjetaDetalleRecurso(actualizado);
      if(document.getElementById("pantalla-inventario").classList.contains("activa")) cargarInventario();
    }catch(err){ toast(err.message); }
  };

  // =========================================================
  // AGREGAR (wizard)
  // =========================================================
  let pasoWizard = 1;
  const TOTAL_PASOS = 4;
  let datosWizard = { area: "", categoria: "", nombre: "", ubicacion: "", cantidad: 1, responsable: "", estado: "" };

  function iniciarWizard(){
    pasoWizard = 1;
    datosWizard = { area: "", categoria: "", nombre: "", ubicacion: "", cantidad: 1, responsable: "", estado: "" };
    renderWizard();
  }

  function pintarPuntos(){
    document.getElementById("puntos-progreso").innerHTML =
      Array.from({length: TOTAL_PASOS}, (_, i) => `<span class="${i+1 === pasoWizard ? "activo" : ""}"></span>`).join("");
  }

  function renderWizard(){
    pintarPuntos();
    const cont = document.getElementById("contenido-wizard");

    if(pasoWizard === 1){
      cont.innerHTML = `
        <div class="titulo-paso">¿En qué área está?</div>
        <div class="subtitulo-paso">Paso 1 de ${TOTAL_PASOS}</div>
        <div class="grid-tiles">
          ${AREAS.map(a => `
            <div class="tile-opcion ${datosWizard.area===a.valor?"seleccionado":""}" data-area="${a.valor}">
              <span class="emoji">${a.emoji}</span>${a.etiqueta}
            </div>`).join("")}
        </div>
        <div class="fila-botones-wizard">
          <button class="btn-grande rojo" id="btn-siguiente" ${datosWizard.area?"":"disabled style='opacity:.5'"}>Siguiente →</button>
        </div>`;
      cont.querySelectorAll("[data-area]").forEach(tile => tile.addEventListener("click", () => {
        datosWizard.area = tile.dataset.area; renderWizard();
      }));
      const btnSig = document.getElementById("btn-siguiente");
      if(btnSig) btnSig.addEventListener("click", () => { if(datosWizard.area){ pasoWizard = 2; renderWizard(); } });
    }

    else if(pasoWizard === 2){
      cont.innerHTML = `
        <div class="titulo-paso">¿Qué tipo de recurso es?</div>
        <div class="subtitulo-paso">Paso 2 de ${TOTAL_PASOS}</div>
        <div class="grid-tiles">
          ${CATEGORIAS.map(c => `
            <div class="tile-opcion ${datosWizard.categoria===c.valor?"seleccionado":""}" data-cat="${c.valor}">
              <span class="emoji">${c.emoji}</span>${c.valor}
            </div>`).join("")}
        </div>
        <div class="fila-botones-wizard">
          <button class="btn-grande linea" id="btn-atras">← Atrás</button>
          <button class="btn-grande rojo" id="btn-siguiente" ${datosWizard.categoria?"":"disabled style='opacity:.5'"}>Siguiente →</button>
        </div>`;
      cont.querySelectorAll("[data-cat]").forEach(tile => tile.addEventListener("click", () => {
        datosWizard.categoria = tile.dataset.cat; renderWizard();
      }));
      document.getElementById("btn-atras").addEventListener("click", () => { pasoWizard = 1; renderWizard(); });
      const btnSig = document.getElementById("btn-siguiente");
      if(btnSig) btnSig.addEventListener("click", () => { if(datosWizard.categoria){ pasoWizard = 3; renderWizard(); } });
    }

    else if(pasoWizard === 3){
      cont.innerHTML = `
        <div class="titulo-paso">Cuéntanos un poco más</div>
        <div class="subtitulo-paso">Paso 3 de ${TOTAL_PASOS}</div>
        <div class="campo"><label>Nombre del recurso</label><input type="text" id="w-nombre" placeholder="Ej: Videobeam, Silla rimax" value="${escapeHtml(datosWizard.nombre)}"></div>
        <div class="campo"><label>Ubicación / salón</label><input type="text" id="w-ubicacion" placeholder="Ej: Aula 301, Transición A" value="${escapeHtml(datosWizard.ubicacion)}"></div>
        <div class="campo"><label>Responsable (opcional)</label><input type="text" id="w-responsable" placeholder="Nombre del encargado" value="${escapeHtml(datosWizard.responsable)}"></div>
        <div class="campo">
          <label>Cantidad</label>
          <div class="stepper">
            <button type="button" id="menos">−</button>
            <span class="valor" id="valor-cantidad">${datosWizard.cantidad}</span>
            <button type="button" id="mas">+</button>
          </div>
        </div>
        <div class="fila-botones-wizard">
          <button class="btn-grande linea" id="btn-atras">← Atrás</button>
          <button class="btn-grande rojo" id="btn-siguiente">Siguiente →</button>
        </div>`;
      document.getElementById("menos").addEventListener("click", () => {
        datosWizard.cantidad = Math.max(1, datosWizard.cantidad - 1);
        document.getElementById("valor-cantidad").textContent = datosWizard.cantidad;
      });
      document.getElementById("mas").addEventListener("click", () => {
        datosWizard.cantidad += 1;
        document.getElementById("valor-cantidad").textContent = datosWizard.cantidad;
      });
      document.getElementById("btn-atras").addEventListener("click", () => { guardarCampos3(); pasoWizard = 2; renderWizard(); });
      document.getElementById("btn-siguiente").addEventListener("click", () => {
        guardarCampos3();
        if(!datosWizard.nombre || !datosWizard.ubicacion){ toast("Falta el nombre o la ubicación."); return; }
        pasoWizard = 4; renderWizard();
      });
    }

    else if(pasoWizard === 4){
      cont.innerHTML = `
        <div class="titulo-paso">¿Cómo está el recurso?</div>
        <div class="subtitulo-paso">Paso 4 de ${TOTAL_PASOS}</div>
        <div class="grid-estados" style="grid-template-columns:1fr 1fr;">
          ${ESTADOS.map(es => `<button type="button" class="tile-estado ${claseEstado(es)} ${datosWizard.estado===es?"seleccionado":""}" data-estado="${es}">${es}</button>`).join("")}
        </div>
        <div class="fila-botones-wizard">
          <button class="btn-grande linea" id="btn-atras">← Atrás</button>
          <button class="btn-grande rojo" id="btn-guardar" ${datosWizard.estado?"":"disabled style='opacity:.5'"}>✅ Guardar y generar QR</button>
        </div>`;
      cont.querySelectorAll("[data-estado]").forEach(tile => tile.addEventListener("click", () => {
        datosWizard.estado = tile.dataset.estado; renderWizard();
      }));
      document.getElementById("btn-atras").addEventListener("click", () => { pasoWizard = 3; renderWizard(); });
      const btnGuardar = document.getElementById("btn-guardar");
      if(btnGuardar) btnGuardar.addEventListener("click", guardarRecursoWizard);
    }
  }

  function guardarCampos3(){
    datosWizard.nombre = document.getElementById("w-nombre").value.trim();
    datosWizard.ubicacion = document.getElementById("w-ubicacion").value.trim();
    datosWizard.responsable = document.getElementById("w-responsable").value.trim();
  }

  async function guardarRecursoWizard(){
    try{
      const r = await api("/recursos", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          nombre: datosWizard.nombre, categoria: datosWizard.categoria, area: datosWizard.area,
          ubicacion: datosWizard.ubicacion, cantidad: datosWizard.cantidad, estado: datosWizard.estado,
          responsable: datosWizard.responsable, frecuencia_uso: "Media",
        }),
      });
      mostrarPantallaExito(r);
    }catch(err){ toast(err.message); }
  }

  function mostrarPantallaExito(r){
    const cont = document.getElementById("contenido-wizard");
    document.getElementById("puntos-progreso").innerHTML = "";
    cont.innerHTML = `
      <div class="qr-final">
        <div style="font-size:40px;margin-bottom:6px;">✅</div>
        <h3 style="margin-bottom:12px;">¡Recurso registrado!</h3>
        <div id="qr-contenedor"></div>
        <div class="codigo">${r.codigo}</div>
        <p style="color:var(--texto-suave);font-size:13.5px;">Imprime esta etiqueta y pégala sobre el recurso.</p>
        <button class="btn-grande linea" id="btn-imprimir" style="margin-top:6px;">🖨️ Imprimir etiqueta</button>
      </div>
      <button class="btn-grande rojo" id="btn-agregar-otro" style="margin-top:16px;">➕ Agregar otro recurso</button>
      <button class="btn-texto" id="btn-ir-inventario">Ver en el inventario</button>
    `;
    const canvas = document.createElement("canvas");
    document.getElementById("qr-contenedor").appendChild(canvas);
    QRCode.toCanvas(canvas, r.codigo, { width: 190, margin: 2, color: { dark: "#181818", light: "#FFFFFF" } });

    document.getElementById("btn-imprimir").addEventListener("click", () => {
      const ventana = window.open("", "_blank");
      ventana.document.write(`<html><body style="text-align:center;font-family:Arial;padding:40px;">
        <img src="${canvas.toDataURL()}" style="width:220px;">
        <h2 style="font-family:'Courier New',monospace;">${r.codigo}</h2>
        <p>Instituto Técnico San Rafael</p>
        <script>window.onload=()=>window.print();<\/script></body></html>`);
      ventana.document.close();
    });
    document.getElementById("btn-agregar-otro").addEventListener("click", iniciarWizard);
    document.getElementById("btn-ir-inventario").addEventListener("click", () => irAPantalla("inventario"));
  }

  // =========================================================
  // INVENTARIO
  // =========================================================
  document.getElementById("buscar").addEventListener("input", debounce(cargarInventario, 300));
  document.querySelectorAll("#chips-area .chip-filtro").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#chips-area .chip-filtro").forEach(c => c.classList.remove("activo"));
      chip.classList.add("activo");
      filtroAreaActual = chip.dataset.area;
      cargarInventario();
    });
  });
  function debounce(fn, ms){ let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  async function cargarInventario(){
    const texto = document.getElementById("buscar").value.trim();
    const cont = document.getElementById("lista-inventario");
    let lista;
    try{
      const params = new URLSearchParams();
      if(filtroAreaActual) params.set("area", filtroAreaActual);
      if(texto) params.set("buscar", texto);
      lista = await api("/recursos?" + params.toString());
    }catch(err){ cont.innerHTML = '<div class="vacio">No fue posible cargar el inventario.</div>'; return; }

    if(lista.length === 0){
      cont.innerHTML = '<div class="vacio"><div class="icono">🗄️</div>Ningún recurso encontrado.</div>';
      return;
    }
    cont.innerHTML = lista.map(r => `
      <div class="tarjeta-recurso" onclick="MOB.verDetalle(${r.id})">
        <div class="info">
          <div class="nombre">${escapeHtml(r.nombre)}</div>
          <div class="meta">${r.codigo} · ${escapeHtml(r.ubicacion)}</div>
        </div>
        <div class="punto-estado ${claseEstado(r.estado)}"></div>
      </div>`).join("");
  }

  window.MOB.verDetalle = async function(id){
    try{
      const r = (await api("/recursos")).find(x => x.id === id);
      if(!r) return;
      abrirHoja(`
        <h3 style="margin-bottom:4px;">${escapeHtml(r.nombre)}</h3>
        <div class="cod-grande" style="margin-bottom:10px;">${r.codigo}</div>
        <div class="fila-dato"><span>Área</span><span>${r.area || "—"}</span></div>
        <div class="fila-dato"><span>Categoría</span><span>${r.categoria}</span></div>
        <div class="fila-dato"><span>Ubicación</span><span>${escapeHtml(r.ubicacion)}</span></div>
        <div class="fila-dato"><span>Cantidad</span><span>${r.cantidad}</span></div>
        <div class="fila-dato"><span>Estado</span><span class="badge-estado ${claseEstado(r.estado)}">${r.estado}</span></div>
        <div class="fila-dato"><span>Responsable</span><span>${escapeHtml(r.responsable)||"—"}</span></div>
        <button class="btn-grande negro" style="margin-top:16px;" onclick="MOB.cambiarEstadoDesdeHoja(${r.id})">Cambiar estado</button>
      `);
    }catch(err){ toast(err.message); }
  };
  window.MOB.cambiarEstadoDesdeHoja = function(id){
    abrirHoja(`
      <h3 style="margin-bottom:14px;">¿Cómo está este recurso?</h3>
      <div class="grid-estados">
        ${ESTADOS.map(es => `<button class="tile-estado ${claseEstado(es)}" onclick="MOB.guardarEstadoInventario(${id}, '${es}')">${es}</button>`).join("")}
      </div>
    `);
  };
  window.MOB.guardarEstadoInventario = async function(id, nuevoEstado){
    try{
      const actual = (await api("/recursos")).find(x => x.id === id);
      await api("/recursos/" + id, {
        method: "PUT", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ ...actual, estado: nuevoEstado, _origen: "Estado actualizado desde inventario." }),
      });
      cerrarHoja();
      toast("Estado actualizado a \"" + nuevoEstado + "\".");
      cargarInventario();
    }catch(err){ toast(err.message); }
  };

  // =========================================================
  // MÁS
  // =========================================================
  document.getElementById("btn-ver-panel").addEventListener("click", () => window.open("/admin.html", "_blank"));
  document.getElementById("btn-descargar-csv").addEventListener("click", () => { window.location.href = API + "/reportes/csv"; });
  document.getElementById("btn-descargar-json").addEventListener("click", () => { window.location.href = API + "/respaldo"; });

  // ---------- registro del service worker (PWA instalable) ----------
  if("serviceWorker" in navigator){
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {});
    });
  }

  // ---------- inicio ----------
  verificarConexion();
})();
