// app.js — Frontend de InventIA.
(function(){
  "use strict";
  const API = "/api";
  let idParaBorrar = null;
  let lectorHtml5Qrcode = null;
  let camaraActiva = false;

  function claseChip(estado){ return estado.replace(/\s+/g,''); }
  function escapeHtml(s){ return String(s||"").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function mostrarToast(msg){
    const t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("mostrar");
    clearTimeout(t._temporizador);
    t._temporizador = setTimeout(() => t.classList.remove("mostrar"), 2800);
  }
  function fechaLegible(iso){
    if(!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("es-CO", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" });
  }
  const ETIQUETAS_MOVIMIENTO = { registro:"Registro", escaneo:"Escaneo", actualizacion:"Actualización", baja:"Baja" };

  async function api(ruta, opciones){
    const resp = await fetch(API + ruta, opciones);
    if(resp.status === 204) return null;
    const datos = await resp.json().catch(() => ({}));
    if(!resp.ok){
      throw new Error((datos.errores && datos.errores.join(" ")) || "Ocurrió un error al comunicarse con el servidor.");
    }
    return datos;
  }

  async function verificarConexion(){
    const el = document.getElementById("estado-conexion");
    try{ await api("/dashboard"); el.textContent = "conectada"; el.style.color = "#8FD9A8"; }
    catch(e){ el.textContent = "sin conexión"; el.style.color = "#E9B9C0"; }
  }

  // ---------- navegación ----------
  const botonesNav = document.querySelectorAll("#nav button");
  botonesNav.forEach(btn => {
    btn.addEventListener("click", () => {
      if(camaraActiva && btn.dataset.vista !== "escanear") detenerCamara();
      botonesNav.forEach(b => b.classList.remove("activa"));
      btn.classList.add("activa");
      document.querySelectorAll(".vista").forEach(v => v.classList.remove("activa"));
      document.getElementById("vista-" + btn.dataset.vista).classList.add("activa");
      if(btn.dataset.vista === "dashboard") pintarDashboard();
      if(btn.dataset.vista === "inventario") pintarTablaInventario();
    });
  });

  // ---------- formulario de registro ----------
  const form = document.getElementById("form-recurso");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const idEdicion = document.getElementById("f-id").value;
    const payload = {
      nombre: document.getElementById("f-nombre").value.trim(),
      categoria: document.getElementById("f-categoria").value,
      area: document.getElementById("f-area").value,
      ubicacion: document.getElementById("f-ubicacion").value.trim(),
      cantidad: Number(document.getElementById("f-cantidad").value) || 1,
      estado: document.getElementById("f-estado").value,
      responsable: document.getElementById("f-responsable").value.trim(),
      frecuencia_uso: document.getElementById("f-frecuencia").value,
      fecha_adquisicion: document.getElementById("f-fecha").value,
      observaciones: document.getElementById("f-observaciones").value.trim(),
    };
    try{
      let recurso;
      if(idEdicion){
        recurso = await api("/recursos/" + idEdicion, { method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) });
        mostrarToast("Recurso " + recurso.codigo + " actualizado.");
        document.getElementById("panel-qr-resultado").style.display = "none";
      } else {
        recurso = await api("/recursos", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) });
        mostrarToast("Recurso " + recurso.codigo + " registrado.");
        mostrarQR(recurso.codigo);
      }
      form.reset();
      document.getElementById("f-id").value = "";
      document.getElementById("btn-cancelar-edicion").style.display = "none";
      pintarDashboard();
    }catch(err){ mostrarToast(err.message); }
  });

  document.getElementById("btn-cancelar-edicion").addEventListener("click", function(){
    form.reset();
    document.getElementById("f-id").value = "";
    this.style.display = "none";
    document.getElementById("panel-qr-resultado").style.display = "none";
  });

  function mostrarQR(codigo){
    const panel = document.getElementById("panel-qr-resultado");
    const contenedor = document.getElementById("qr-canvas-contenedor");
    contenedor.innerHTML = "";
    const canvas = document.createElement("canvas");
    contenedor.appendChild(canvas);
    QRCode.toCanvas(canvas, codigo, { width: 200, margin: 2, color: { dark: "#181818", light: "#FFFFFF" } });
    document.getElementById("qr-codigo-texto").textContent = codigo;
    panel.style.display = "block";
  }

  document.getElementById("btn-imprimir-qr").addEventListener("click", () => {
    const canvas = document.querySelector("#qr-canvas-contenedor canvas");
    const codigo = document.getElementById("qr-codigo-texto").textContent;
    if(!canvas) return;
    const ventana = window.open("", "_blank");
    ventana.document.write(`
      <html><head><title>Etiqueta ${codigo}</title></head>
      <body style="text-align:center;font-family:Arial;padding:40px;">
        <img src="${canvas.toDataURL()}" style="width:220px;">
        <h2 style="font-family:'Courier New',monospace;">${codigo}</h2>
        <p>Instituto Técnico San Rafael</p>
        <script>window.onload = () => window.print();<\/script>
      </body></html>
    `);
    ventana.document.close();
  });

  async function editarRecurso(id){
    try{
      const lista = await api("/recursos");
      const r = lista.find(x => String(x.id) === String(id));
      if(!r) return;
      document.getElementById("f-id").value = r.id;
      document.getElementById("f-nombre").value = r.nombre;
      document.getElementById("f-categoria").value = r.categoria;
      document.getElementById("f-area").value = r.area || "";
      document.getElementById("f-ubicacion").value = r.ubicacion;
      document.getElementById("f-cantidad").value = r.cantidad || 1;
      document.getElementById("f-estado").value = r.estado;
      document.getElementById("f-responsable").value = r.responsable;
      document.getElementById("f-frecuencia").value = r.frecuencia_uso;
      document.getElementById("f-fecha").value = r.fecha_adquisicion;
      document.getElementById("f-observaciones").value = r.observaciones;
      document.getElementById("btn-cancelar-edicion").style.display = "inline-block";
      document.getElementById("panel-qr-resultado").style.display = "none";

      botonesNav.forEach(b => b.classList.remove("activa"));
      document.querySelector('[data-vista="registrar"]').classList.add("activa");
      document.querySelectorAll(".vista").forEach(v => v.classList.remove("activa"));
      document.getElementById("vista-registrar").classList.add("activa");
    }catch(err){ mostrarToast(err.message); }
  }

  // ---------- eliminar ----------
  const modal = document.getElementById("modal-confirmar");
  document.getElementById("modal-cancelar").addEventListener("click", () => { modal.classList.remove("activo"); idParaBorrar = null; });
  document.getElementById("modal-confirmar-btn").addEventListener("click", async () => {
    if(idParaBorrar){
      try{
        await api("/recursos/" + idParaBorrar, { method:"DELETE" });
        mostrarToast("Recurso eliminado del inventario.");
        pintarTablaInventario(); pintarDashboard();
      }catch(err){ mostrarToast(err.message); }
    }
    modal.classList.remove("activo"); idParaBorrar = null;
  });
  function pedirConfirmacion(id, texto){
    idParaBorrar = id;
    document.getElementById("modal-texto").textContent = texto;
    modal.classList.add("activo");
  }

  // ---------- inventario ----------
  document.getElementById("buscar").addEventListener("input", debounce(pintarTablaInventario, 250));
  document.getElementById("filtro-area").addEventListener("change", pintarTablaInventario);
  document.getElementById("filtro-categoria").addEventListener("change", pintarTablaInventario);
  document.getElementById("filtro-estado").addEventListener("change", pintarTablaInventario);
  function debounce(fn, ms){ let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  async function pintarTablaInventario(){
    const texto = document.getElementById("buscar").value.trim();
    const area = document.getElementById("filtro-area").value;
    const categoria = document.getElementById("filtro-categoria").value;
    const estado = document.getElementById("filtro-estado").value;
    const cont = document.getElementById("contenedor-tabla");
    let lista;
    try{
      const params = new URLSearchParams();
      if(area) params.set("area", area);
      if(categoria) params.set("categoria", categoria);
      if(estado) params.set("estado", estado);
      if(texto) params.set("buscar", texto);
      lista = await api("/recursos?" + params.toString());
    }catch(err){ cont.innerHTML = '<div class="vacio">No fue posible cargar el inventario.</div>'; return; }

    if(lista.length === 0){
      cont.innerHTML = '<div class="vacio"><div class="icono">🗄️</div>' +
        (area || categoria || estado || texto ? 'Ningún recurso coincide con el filtro aplicado.' : 'Todavía no hay recursos registrados.') +
        '</div>';
      return;
    }
    let html = '<table><thead><tr><th>Código</th><th>Nombre</th><th>Área</th><th>Ubicación</th><th>Cant.</th><th>Estado</th><th></th></tr></thead><tbody>';
    lista.forEach(r => {
      html += '<tr>' +
        '<td class="cod-tag">'+r.codigo+'</td>' +
        '<td>'+escapeHtml(r.nombre)+'</td>' +
        '<td>'+(r.area||'—')+'</td>' +
        '<td>'+escapeHtml(r.ubicacion)+'</td>' +
        '<td>'+r.cantidad+'</td>' +
        '<td><span class="chip '+claseChip(r.estado)+'">'+r.estado+'</span></td>' +
        '<td style="white-space:nowrap;">' +
          '<button class="btn linea chico" onclick="INV.editar('+r.id+')">Editar</button> ' +
          '<button class="btn peligro chico" onclick="INV.borrar('+r.id+',\''+r.codigo+'\')">Eliminar</button>' +
        '</td></tr>';
    });
    html += '</tbody></table>';
    cont.innerHTML = html;
  }

  // ---------- dashboard ----------
  async function pintarDashboard(){
    let d;
    try{ d = await api("/dashboard"); } catch(err){ return; }
    document.getElementById("kpi-total").textContent = d.total;
    const buenos = d.porEstado.find(x => x.estado === "Bueno");
    document.getElementById("kpi-buenos").textContent = buenos ? buenos.n : 0;
    document.getElementById("kpi-reposicion").textContent = d.necesitanReposicion;
    document.getElementById("kpi-movimientos").textContent = d.movimientosRecientes.length;

    const max1 = Math.max(1, d.total);
    document.getElementById("grafico-area").innerHTML = (d.porArea && d.porArea.length ? d.porArea : []).map(a => {
      const pct = Math.round((a.n/max1)*100);
      return '<div class="barra"><span class="nombre">'+a.area+'</span><div class="pista"><div class="relleno" style="width:'+pct+'%"></div></div><span class="cant">'+a.n+'</span></div>';
    }).join("") || '<p style="color:var(--texto-suave);font-size:13px;">Sin datos aún.</p>';

    document.getElementById("grafico-categoria").innerHTML = d.porCategoria.map(c => {
      const pct = Math.round((c.n/max1)*100);
      return '<div class="barra"><span class="nombre">'+c.categoria+'</span><div class="pista"><div class="relleno" style="width:'+pct+'%"></div></div><span class="cant">'+c.n+'</span></div>';
    }).join("") || '<p style="color:var(--texto-suave);font-size:13px;">Sin datos aún.</p>';

    const estados = ["Bueno","Regular","Malo","De Baja"];
    document.getElementById("grafico-estado").innerHTML = estados.map(es => {
      const fila = d.porEstado.find(x => x.estado === es);
      const c = fila ? fila.n : 0;
      const pct = Math.round((c/max1)*100);
      return '<div class="barra"><span class="nombre">'+es+'</span><div class="pista"><div class="relleno" style="width:'+pct+'%"></div></div><span class="cant">'+c+'</span></div>';
    }).join("");

    document.getElementById("lista-movimientos").innerHTML = d.movimientosRecientes.length
      ? d.movimientosRecientes.map(m =>
          '<div class="movimiento"><span><span class="tag-tipo">'+ (ETIQUETAS_MOVIMIENTO[m.tipo]||m.tipo) +'</span> <b>'+m.codigo+'</b> — '+escapeHtml(m.detalle)+'</span><span>'+fechaLegible(m.fecha)+'</span></div>'
        ).join("")
      : '<p style="color:var(--texto-suave);font-size:13px;">Aún no hay movimientos registrados.</p>';
  }

  // ---------- escaneo QR ----------
  document.getElementById("btn-iniciar-camara").addEventListener("click", iniciarCamara);
  document.getElementById("btn-detener-camara").addEventListener("click", detenerCamara);
  document.getElementById("btn-buscar-manual").addEventListener("click", () => {
    const codigo = document.getElementById("codigo-manual").value.trim();
    if(codigo) procesarCodigoEscaneado(codigo);
  });
  document.getElementById("codigo-manual").addEventListener("keydown", (e) => {
    if(e.key === "Enter"){ e.preventDefault(); document.getElementById("btn-buscar-manual").click(); }
  });

  function iniciarCamara(){
    if(typeof Html5Qrcode === "undefined"){
      mostrarToast("No se pudo cargar el lector de QR (se necesita conexión a internet la primera vez).");
      return;
    }
    document.getElementById("lector-camara").innerHTML = '<div id="lector-camara-interno" style="width:100%"></div>';
    lectorHtml5Qrcode = new Html5Qrcode("lector-camara-interno");
    lectorHtml5Qrcode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 220 },
      (textoDecodificado) => { procesarCodigoEscaneado(textoDecodificado); },
      () => {}
    ).then(() => {
      camaraActiva = true;
      document.getElementById("btn-iniciar-camara").style.display = "none";
      document.getElementById("btn-detener-camara").style.display = "inline-block";
    }).catch(() => {
      mostrarToast("No fue posible acceder a la cámara. Verifica los permisos del navegador.");
    });
  }

  function detenerCamara(){
    if(lectorHtml5Qrcode && camaraActiva){
      lectorHtml5Qrcode.stop().then(() => {
        lectorHtml5Qrcode.clear();
        camaraActiva = false;
        document.getElementById("btn-iniciar-camara").style.display = "inline-block";
        document.getElementById("btn-detener-camara").style.display = "none";
      }).catch(() => {});
    }
  }

  async function procesarCodigoEscaneado(codigo){
    codigo = codigo.trim().toUpperCase();
    const cont = document.getElementById("resultado-escaneo");
    try{
      const r = await api("/escanear", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ codigo }) });
      mostrarToast("Código " + r.codigo + " reconocido.");
      cont.innerHTML = `
        <div class="panel" style="box-shadow:none;border:1px solid var(--linea);">
          <h3>${escapeHtml(r.nombre)} <span class="cod-tag">(${r.codigo})</span></h3>
          <p><b>Área:</b> ${r.area || "—"} &nbsp; | &nbsp; <b>Categoría:</b> ${r.categoria} &nbsp; | &nbsp; <b>Ubicación:</b> ${escapeHtml(r.ubicacion)}</p>
          <p><b>Cantidad:</b> ${r.cantidad} &nbsp; | &nbsp; <b>Estado:</b> <span class="chip ${claseChip(r.estado)}">${r.estado}</span> &nbsp; | &nbsp; <b>Uso:</b> ${r.frecuencia_uso}</p>
          <p><b>Responsable:</b> ${escapeHtml(r.responsable) || "—"}</p>
          <button class="btn linea chico" onclick="INV.editar(${r.id})">Editar este recurso</button>
        </div>`;
    }catch(err){
      cont.innerHTML = '<div class="aviso">'+escapeHtml(err.message)+'</div>';
    }
  }

  // ---------- reportes ----------
  document.getElementById("btn-exportar-todo").addEventListener("click", () => { window.location.href = API + "/reportes/csv"; });

  // ---------- respaldo ----------
  document.getElementById("btn-exportar-json").addEventListener("click", () => { window.location.href = API + "/respaldo"; });
  document.getElementById("input-importar-json").addEventListener("change", (e) => {
    const archivo = e.target.files[0];
    if(!archivo) return;
    const lector = new FileReader();
    lector.onload = async (ev) => {
      try{
        const datos = JSON.parse(ev.target.result);
        await api("/respaldo/restaurar", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(datos) });
        pintarDashboard(); pintarTablaInventario();
        mostrarToast("Copia de seguridad restaurada correctamente.");
      }catch(err){ mostrarToast("El archivo seleccionado no es una copia de seguridad válida."); }
    };
    lector.readAsText(archivo);
    e.target.value = "";
  });

  window.INV = { editar: editarRecurso, borrar: pedirConfirmacion };

  verificarConexion();
  pintarDashboard();
  pintarTablaInventario();
})();
