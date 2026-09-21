# InventIA — Instituto Técnico San Rafael

App móvil (instalable, sin tienda de aplicaciones) para el registro y
consulta del inventario de activos físicos del colegio mediante códigos
QR, con una base de datos real (SQLite) que persiste la información.

## Dos interfaces incluidas

- **App simple para el celular** (`/`, `mobile.js`): pensada para
  cualquier persona, sin experiencia técnica. Pantallas grandes,
  navegación por pestañas abajo (Escanear, Agregar, Inventario, Más), un
  asistente paso a paso para registrar un recurso, y un cambio de estado
  con un solo toque después de escanear.
- **Panel completo de administración** (`/admin.html`, `admin.js`):
  la vista de escritorio con tablas, filtros avanzados, gráficos y
  reportes, para quien necesite una visión más detallada. Se accede
  desde el botón "Ver panel completo" en la pestaña "Más" de la app.

Ambas comparten la misma base de datos: lo que se registra desde el
celular aparece de inmediato en el panel de administración, y viceversa.

## Cómo instalar la app en el celular (como una app real)

1. Ejecuta el servidor siguiendo la guía de instalación (ver más abajo)
   y confirma que abre correctamente en `http://localhost:3000` desde un
   computador.
2. Desde el celular, conectado a la misma red Wi-Fi, abre en Chrome (Android)
   o Safari (iPhone) la dirección `http://IP_DEL_COMPUTADOR:3000`.
3. **En Android (Chrome):** toca el menú (⋮) → "Agregar a pantalla de
   inicio" o "Instalar aplicación". Quedará un ícono de InventIA como
   cualquier otra app, y se abrirá sin barra de navegador.
4. **En iPhone (Safari):** toca el botón compartir (□↑) → "Agregar a
   pantalla de inicio".
5. Para que la instalación funcione igual de bien en todos los celulares
   sin depender de la red del colegio, lo ideal es desplegar el sistema
   en la nube (ver sección "Uso en la nube" más abajo) — así cada celular
   simplemente entra a una dirección web pública y la instala.

## Inventario ya incluido

El sistema se entrega **precargado con el inventario real por salones
2026** (INVENTARIO_POR_SALONES_2026.xlsx): 627 recursos distribuidos en
las tres áreas del colegio (ZAGALITOS, ZAGALES, JUVAM), con su categoría,
salón, cantidad y docente responsable. Esta carga ocurre automáticamente
la primera vez que se inicia el servidor (si la base de datos está vacía);
los registros posteriores que agregues quedan igual de permanentes.

Cada recurso recibe un código con el prefijo de su área:

| Área | Prefijo | Ejemplo |
|---|---|---|
| ZAGALITOS | ZTO | ZTO-2026-0001 |
| ZAGALES | ZAG | ZAG-2026-0001 |
| JUVAM | JUV | JUV-2026-0001 |
| ADMINISTRATIVO | ADM | ADM-2026-0001 |
| (sin área) | GEN | GEN-2026-0001 |

## Requisito

Tener instalado **Node.js** (versión 18 o superior) — gratis en [nodejs.org](https://nodejs.org).

## Uso local

1. Descomprime esta carpeta.
2. Abre una terminal dentro de la carpeta `inventia-servidor`.
3. Instala las dependencias (solo la primera vez):
   ```
   npm install
   ```
4. Inicia el servidor:
   ```
   npm start
   ```
5. Abre `http://localhost:3000` en el navegador (Chrome o Edge recomendado
   para el uso de la cámara).

> Para escanear con el **celular**, este debe estar en la misma red Wi-Fi
> que el computador donde corre el servidor, y se accede a
> `http://IP_DEL_COMPUTADOR:3000`. Los navegadores solo permiten el uso de
> la cámara en `localhost` o en conexiones seguras (`https`); si vas a
> usar el escáner desde el celular en la red local, es posible que el
> navegador pida confirmar el permiso o que sea necesario desplegar el
> sistema con HTTPS (ver sección de nube).

## Uso en la nube

El mismo proyecto puede subirse a un servicio como **Render** o
**Railway**: instalar con `npm install`, arrancar con `npm start`, y
activar un disco persistente para que `inventario.db` no se borre entre
reinicios. Estos servicios entregan automáticamente una dirección
`https://...`, lo cual además habilita el uso de la cámara desde
cualquier celular sin restricciones.

## Cómo funciona el escaneo QR

- Los códigos QR se generan **en el navegador** con la librería
  [`qrcode`](https://github.com/soldair/node-qrcode).
- La lectura de la cámara usa la librería
  [`html5-qrcode`](https://github.com/mebjas/html5-qrcode) (código
  abierto, licencia Apache 2.0).
- Ambas se cargan desde internet la primera vez que se abre cada pantalla
  (registrar / escanear); el resto del sistema funciona sin conexión.

## Estructura de códigos

Ver la tabla de prefijos por área al inicio de este documento. El
consecutivo se calcula automáticamente por área y por año, y nunca se
repite.

## Estructura del proyecto

```
inventia-servidor/
├── server.js          → servidor y rutas de la API
├── db.js              → base de datos SQLite (recursos y trazabilidad)
├── package.json
├── inventario.db      → se crea automáticamente al iniciar
├── data/
│   └── inventario_inicial.json  → inventario real por salones (carga automática)
└── public/
    ├── index.html        → app móvil simplificada (pantalla principal)
    ├── mobile.js          → lógica de la app móvil
    ├── admin.html         → panel completo de administración
    ├── admin.js           → lógica del panel de administración
    ├── manifest.json      → manifiesto de la app instalable (PWA)
    ├── service-worker.js  → caché para apertura instantánea
    ├── iconos/            → íconos de la app (192px y 512px)
    └── escudo.jpeg        → escudo institucional
```

## Copias de seguridad

Desde el menú **Copia de seguridad** se puede descargar toda la
información en un archivo `.json` y restaurarla cuando se necesite,
como respaldo adicional a la base de datos.
