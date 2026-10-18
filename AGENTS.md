# AGENTS.md — soft-brightness

## Qué es este proyecto

Extensión de GNOME Shell (**"Soft Brightness"**) que oscurece pantallas digitalmente
con una capa negra semitransparente, incluyendo un **selector de pantalla**
(todas / HDMI / laptop). Se creó porque el monitor del usuario **no soporta
DDC/CI** (control de brillo por hardware desde el PC).

## Contexto del entorno

- Fedora 44, GNOME Shell **50.5**, sesión **Wayland**, usuario `jarod`.
- Monitor HDMI: Samsung **SyncMaster** (2009, product 0x0489, `card1-HDMI-A-2`).
  Diagnosticado con `ddcutil`: i2c accesible (udev rule `uaccess` aplicada), pero
  **la dirección 0x37 no responde → sin DDC/CI, sin control hardware de brillo**.
  No hay `/dev/cec*` (sin CEC). El panel interno sí tiene backlight
  (`/sys/class/backlight/intel_backlight`), pero eso ya lo maneja GNOME.
- Por eso la solución es software dimming vía capa del compositor.

## Estructura

```
TOOLS/soft-brightness/            ← este repo (fuente de verdad, git init 2026-10-18)
├── AGENTS.md
├── EASY-START.md                 ← guía exprés copy-paste para humanos
├── LICENSE                       ← GPL-2.0 (texto oficial)
├── README.md                     ← README público estilo GitHub (badges shields.io)
├── .gitignore                    ← schemas/*.compiled, .config/, editor/OS
├── extension.js                  ← código de la sesión del compositor (ESM)
├── prefs.js                      ← ventana de ajustes (Adw) slider + selector + créditos
├── metadata.json                 ← uuid: soft-brightness@jarod.local
│                                   url: github.com/jarodsmdev/soft-brightness
└── schemas/…gschema.xml          ← GSettings: dim, target, monitors (JSON)
~/.local/share/gnome-shell/extensions/soft-brightness@jarod.local
                                  ← symlink al directorio del repo
GSettings (dconf)
  /org/gnome/shell/extensions/soft-brightness/{dim,target,monitors}
                                  ← estado compartido extensión ↔ prefs
  (migra y borra ~/.config/soft-brightness/state.json en el primer enable)
```

## Cómo desplegar / probar

1. El symlink de instalación ya está creado. Si se borra:
   `ln -s /home/jarod/Documents/web/TOOLS/soft-brightness ~/.local/share/gnome-shell/extensions/soft-brightness@jarod.local`
2. Habilitar (tras cargar la extensión):
   `gnome-extensions enable soft-brightness@jarod.local`
3. **GNOME/Wayland no recarga extensiones en caliente**: `org.gnome.Shell.Eval`
   está deshabilitado y `ReloadExtension` no está implementado. Cualquier cambio
   en `extension.js`/`metadata.json` requiere **cerrar sesión y volver a entrar**.
4. Verificar tras el login:
   - `gnome-extensions info soft-brightness@jarod.local` → debe decir "enabled".
   - `journalctl --user -b | grep -iE 'soft-brightness|JS ERROR'` → sin errores.
   - UI: menú de Ajustes Rápidos → slider "Brillo (suave)" + toggle "Pantalla".

## Chequeo rápido de sintaxis (no requiere login)

```bash
gjs -m extension.js
```

Debe fallar **solo** con `ImportError: Unable to load file from:
resource:///org/gnome/shell/ui/main.js` (esperado fuera de gnome-shell).
Cualquier `SyntaxError` o error de parseo → el código está mal.

## Convenciones y APIs usadas

- JavaScript ESM moderno (`import ... from 'gi://...'`), estilo GNOME 45+.
- APIs de GNOME 50: `QuickSettings.QuickSlider`, `QuickSettings.QuickMenuToggle`,
  `QuickSettings.SystemIndicator`, `Main.layoutManager.addTopChrome(...,
  {trackFullscreen:false})` (capa encima de todo sin capturar clics; **NO**
  `affectsInputRegion` — GNOME 50 lo rechaza con "Unrecognized parameter"),
  `PopupMenu` con ornamento DOT para selección radio.
- **Gotcha QuickSlider en GNOME 50** (causó el primer error): ya NO existe
  `QuickSettings.SliderMode` ni el parámetro `title`. Solo se acepta
  `iconName`; el título va en el menú: `this.menu.setHeader(icon, título)`.
  Patrón de referencia: `js/ui/status/brightness.js` de gnome-shell 50.5.
- **Gotcha**: `QuickMenuToggle` NO tiene `setToggleState()` en GNOME 50
  (error al activar ítem del selector); seleccionar reconstruye el menú y ya.
- **Gotcha prefs (GTK4/GJS)**: `Gtk.Scale` no acepta propiedades `min_value`/
  `max_value`/`draw_value` ni `minValue`; usar `set_range(0,100)`,
  `set_draw_value(false)`, `set_value(dim)`.
- Para verificar APIs de una versión concreta de GNOME (el JS va embebido en el
  binario, no hay `gresource` instalado): leer el fuente desde el mirror
  `https://raw.githubusercontent.com/GNOME/gnome-shell/<tag>/js/ui/...`
  (p. ej. tag `50.5`). `LayoutManager` vive en `js/ui/layout.js` desde GNOME 48.
- Identificación de monitores: `global.display.get_monitors()` →
  `Meta.Monitor.get_connector()`; fallback a geometría `WxH @x,y` (envuelto en
  try/catch por si la API cambia).
- Persistencia en **GSettings** (`this.getSettings()` / `ExtensionPreferences`,
  requiere `settings-schema` en metadata + `schemas/*.compiled`). La extensión
  publica la lista de monitores en la clave `monitors` (JSON) para que `prefs.js`
  (proceso GTK independiente) pueda mostrarla; ambos lados se sincronizan con
  `changed::dim` / `changed::target` / `changed::monitors`.
  `prefs.js` requiere `glib-compile-schemas schemas` antes de abrirlo.
- `MAX_ALPHA = 230` (~90% negro al máximo) para no dejar la pantalla inservible.

## Pendiente / known issues

- Estado (2026-10-18): slider + selector **funcionando** en sesión viva tras
  logout/login (errores `SliderMode`, `affectsInputRegion` y `setToggleState`
  corregidos). `prefs.js` (GSettings + Adw) **probado 2026-10-18**: abre sin
  errores JS. El código migrado a GSettings **aún no se probó en sesión viva**
  de `extension.js` → requiere logout/login.
- README.md badge "estado": cambiar a `funcionando` solo tras verificar
  `extension.js` con GSettings en sesión viva (journal limpio + slider/selector
  reaccionando desde prefs).
- Si el usuario pide brillo por hardware: reintentar `ddcutil detect` solo si
  cambia de monitor; su SyncMaster actual no responde (ya diagnosticado).
