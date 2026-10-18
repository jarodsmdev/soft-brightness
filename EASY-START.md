# EASY-START

Guía exprés. Todo en copy-paste.

## 1. Requisitos

- GNOME 50 en Wayland.
- La extensión enlazada: `~/.local/share/gnome-shell/extensions/soft-brightness@jarod.local`
  → `/home/jarod/Documents/web/TOOLS/soft-brightness`.

Si falta el symlink:

```bash
mkdir -p ~/.local/share/gnome-shell/extensions
ln -s /home/jarod/Documents/web/TOOLS/soft-brightness ~/.local/share/gnome-shell/extensions/soft-brightness@jarod.local
```

## 2. Instalar (habilitar)

```bash
gnome-extensions enable soft-brightness@jarod.local
```

Si dice que "doesn't exist", es que gnome-shell aún no escaneó la carpeta:
**cierra sesión y vuelve a entrar** y repite el comando.

Comprobar que está bien:

```bash
gnome-extensions info soft-brightness@jarod.local   # debe decir "Enabled"
journalctl --user -b | grep -iE 'soft-brightness|JS ERROR'
```

## 3. Usar

1. Pulsa **Super+V** (Ajustes Rápidos) o haz clic en la esquina superior derecha.
2. **Slider "Brillo (suave)"**: 0% = normal, 100% = 90% más oscuro.
3. **Toggle "Pantalla"**: elige *Todas las pantallas*, la HDMI o la laptop.
4. Se guarda solo y vuelve al próximo inicio de sesión.

## 4. Editar el código

La extensión es el repo (está enlazada). Edita
`/home/jarod/Documents/web/TOOLS/soft-brightness/extension.js` y luego
**cierra sesión y entra otra vez** (Wayland no recarga en caliente).

Chequeo rápido de sintaxis sin recargar:

```bash
cd /home/jarod/Documents/web/TOOLS/soft-brightness && gjs -m extension.js
```

Solo debe fallar con `resource:///org/gnome/shell/ui/main.js` (error esperado
fuera de gnome-shell). Otro error = código mal.

## 5. Desinstalar

```bash
gnome-extensions disable soft-brightness@jarod.local
rm ~/.local/share/gnome-shell/extensions/soft-brightness@jarod.local
rm -rf ~/.config/soft-brightness
```

Para borrar el proyecto también:

```bash
rm -rf /home/jarod/Documents/web/TOOLS/soft-brightness
```

## Problemas comunes

| Síntoma | Solución |
|---|---|
| `does not exist` al habilitar | Cerrar sesión y entrar (Wayland escanea al login) |
| Aparece en rojo (ERROR) | `journalctl --user -b \| grep -A20 'soft-brightness'`; si es error de API, corregir código y cerrar sesión |
| No aparece el slider | Extensiones (app) → activar "Soft Brightness" |
| Error tras editar | Mirar `journalctl --user -b \| grep 'JS ERROR'` |
| Se ve todo negro | Slider al 100%: bájalo; el tope es 90% de oscurecimiento |
