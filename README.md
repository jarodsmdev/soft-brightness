# Soft Brightness

![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-50-black?logo=gnome&logoColor=white)
![Fedora](https://img.shields.io/badge/Fedora-44-51A2DA?logo=fedora&logoColor=white)
![Ubuntu](https://img.shields.io/badge/Ubuntu-26.04%2B-E95420?logo=ubuntu&logoColor=white)
![Wayland](https://img.shields.io/badge/Wayland-compatible-4A5568?logo=wayland&logoColor=white)
![Licencia](https://img.shields.io/badge/licencia-GPL--2.0-blue)
![Estado](https://img.shields.io/badge/estado-en%20pruebas-orange)

Control de brillo para monitores **sin soporte DDC/CI**, implementado como
extensión de GNOME Shell con un slider y un selector de pantalla — disponibles
tanto en **Ajustes Rápidos** como en la **ventana de ajustes** de la extensión.

Cuando el control por hardware no es una opción (muchos monitores/TVs HDMI
antiguos nunca implementan el protocolo DDC/CI), la única vía que queda es el
oscurecimiento *por software*: una capa negra a nivel de compositor que atenúa
la imagen digitalmente. Esta extensión hace exactamente eso — de forma fiable,
en Wayland y sin root.

## Características

- **Slider de brillo** en Ajustes Rápidos (`Super+V`) y en la ventana de
  ajustes de la extensión: 0% a 100% de oscurecimiento suave (tope visual ~90%).
- **Selector de pantalla** (todas / HDMI / laptop) en ambos lugares, identificado
  por conector (p. ej. `HDMI-A-2`, `eDP-1`). Ambos controles están sincronizados
  en vivo: cambiar en un sitio actualiza el otro.
- **Ventana de ajustes** con créditos, enlace al repositorio y autor.
- **No bloquea el ratón**: la capa no captura clics y queda encima de ventanas
  en pantalla completa.
- **Persistente**: el estado se guarda con GSettings (dconf) y se restaura en
  el login. Migra automáticamente desde `~/.config/soft-brightness/state.json`
  si venías de una versión anterior.
- **Cero dependencias de runtime**: sin `ddcutil`, sin root, sin daemons.

## Compatibilidad (¿solo Fedora?)

**No, no es exclusivo de Fedora.** Lo único que exige es **GNOME Shell 50**
(declarado en `metadata.json` → `"shell-version": ["50"]`):

| SO | GNOME | Estado |
|---|---|---|
| **Fedora 44** | 50.x | ✅ Entorno de desarrollo y pruebas (Wayland) |
| **Ubuntu 26.04+** | 50.x | ✅ Debería funcionar igual (mismo GNOME 50) |
| Ubuntu 25.10 | 49 | ❌ Rechazada por `shell-version`; ampliar a `["49","50"]` y probar |
| Ubuntu 24.04 LTS | 46 | ❌ Igual que arriba (posible con cambios menores, sin probar) |
| GNOME 45–48 (otras distros) | 45–48 | ⚠️ Posible, pero las APIs de `QuickSettings` cambiaron — hay que probar |

En resumen: en **X11 y Wayland** funciona, en **cualquier distro con GNOME 50**
(Silverblue, openSUSE Tumbleweed, Arch con GNOME 50, etc.) debería funcionar
sin cambios. En GNOME < 50 hay que ampliar `shell-version` y validar las APIs.

## Dependencias

**Runtime: ninguna.** Solo necesitas una sesión GNOME 50 (trae GTK4/Adwaita).

Para **instalar/desde fuente**:

| Herramienta | Para qué | Fedora | Ubuntu/Debian |
|---|---|---|---|
| `glib-compile-schemas` | compilar `schemas/` | ya viene con `glib2`<br>`sudo dnf install glib2` | `sudo apt install libglib2.0-bin` |
| `git` | clonar el repo | `sudo dnf install git` | `sudo apt install git` |

Opcional (solo diagnóstico de DDC/CI, **no** requerido por la extensión):

```bash
sudo dnf install ddcutil      # Fedora
sudo apt install ddcutil      # Ubuntu
```

## Instalación

```bash
git clone https://github.com/jarodsmdev/soft-brightness.git
cd soft-brightness

glib-compile-schemas schemas

mkdir -p ~/.local/share/gnome-shell/extensions
ln -s "$PWD" ~/.local/share/gnome-shell/extensions/soft-brightness@jarod.local

gnome-extensions enable soft-brightness@jarod.local
```

> En Wayland, GNOME solo escanea el directorio de extensiones al iniciar sesión.
> Si el comando de habilitar dice *"does not exist"*, cierra sesión, vuelve a
> entrar y reintenta.

Verificación:

```bash
gnome-extensions info soft-brightness@jarod.local   # → State: ACTIVE
journalctl --user -b | grep -i 'JS ERROR'           # → sin salida
```

## Uso

**Desde Ajustes Rápidos** (`Super+V` o clic en la esquina superior derecha):

1. Mueve el slider **"Brillo (suave)"** para atenuar.
2. Pulsa el toggle **"Pantalla"** y elige el destino: todas, HDMI o laptop.

**Desde la ventana de ajustes** (App *Extensiones* → *Soft Brightness* →
tuerca ⚙):

1. Slider **"Nivel de oscurecimiento"** con valor en vivo.
2. Lista **"Pantalla objetivo"** con las pantallas detectadas (✓ en la activa).
3. Sección **"Acerca de"** con repositorio y créditos.

Ambos caminos comparten el mismo estado (GSettings), así que lo que cambies en
uno se refleja al instante en el otro.

## Cómo funciona

`extension.js` registra un `QuickSettings.QuickSlider` y un
`QuickSettings.QuickMenuToggle`, y coloca un `St.Widget` por monitor (negro,
controlado por `opacity`) mediante `Main.layoutManager.addTopChrome()` con
`trackFullscreen: false`, de modo que se dibuja sobre todas las ventanas sin
interferir con el input. Los conectores de pantalla se resuelven con
`global.display.get_monitors()` (`Meta.Monitor.get_connector()`).

El estado vive en GSettings
(`org.gnome.shell.extensions.soft-brightness`, claves `dim`, `target`,
`monitors`) — `prefs.js` (proceso GTK independiente) y `extension.js`
(compositor) lo comparten y se notifican entre sí mediante `changed::*`.

El DDC/CI por hardware quedó descartado para este hardware: `ddcutil detect`
confirma que la dirección DDC `0x37` del monitor nunca responde por HDMI, así
que el VCP `0x10` (brillo) es inalcanzable por diseño.

## Desarrollo

```bash
cd soft-brightness
gjs -m extension.js      # chequeo de sintaxis: solo errores resource:// son OK
gjs -m prefs.js          # ídem para los ajustes
```

Los cambios de código requieren **reiniciar la sesión** en Wayland (GNOME no
recarga extensiones en caliente). Los cambios en `prefs.js`/schemas sí se ven
al reabrir la ventana de ajustes (`gnome-extensions prefs soft-brightness@jarod.local`).
Contexto completo de desarrollo en [AGENTS.md](AGENTS.md) y guía exprés en
[EASY-START.md](EASY-START.md).

## Solución de problemas

| Síntoma | Solución |
|---|---|
| `does not exist` al habilitar | Cerrar sesión y entrar (Wayland escanea al login) |
| Aparece en rojo (ERROR) | `journalctl --user -b \| grep -A20 'soft-brightness'`; casi siempre es una API de GNOME que cambió — tras corregir, cerrar sesión |
| No aparece el slider | App Extensiones → activar *Soft Brightness* |
| La ventana de ajustes no abre | `glib-compile-schemas schemas` y reabrir (¿schema desactualizado?) |
| Las pantallas no se listan en ajustes | La extensión publica la lista al cargarse; verifica con `gsettings get org.gnome.shell.extensions.soft-brightness monitors` |
| Pantalla muy oscura | El slider topea en ~90% de negro; bájalo |
| Raro después de editar | `journalctl --user -b \| grep 'JS ERROR'` |

## Desinstalación

```bash
gnome-extensions disable soft-brightness@jarod.local
rm ~/.local/share/gnome-shell/extensions/soft-brightness@jarod.local
dconf reset -f /org/gnome/shell/extensions/soft-brightness/
```

## Licencia

[GPL-2.0](LICENSE)
