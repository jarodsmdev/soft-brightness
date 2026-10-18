import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const MAX_ALPHA = 230;

const SliderItem = GObject.registerClass(
class SliderItem extends QuickSettings.QuickSlider {
    _init(ext) {
        super._init({
            iconName: 'display-brightness-symbolic',
        });
        this.menu.setHeader('display-brightness-symbolic',
            _('Brillo (suave)'));
        this._ext = ext;
        this.slider.value = ext.dim / 100;
        this._valueId = this.slider.connect('notify::value', () => {
            this._ext.setDim(Math.round(this.slider.value * 100));
        });
    }

    setValue(dim) {
        if (Math.round(this.slider.value * 100) !== dim)
            this.slider.value = dim / 100;
    }

    destroy() {
        this.slider.disconnect(this._valueId);
        this._ext = null;
        super.destroy();
    }
});

const Indicator = GObject.registerClass(
class Indicator extends QuickSettings.SystemIndicator {
    _init(ext) {
        super._init();
        this._ext = ext;

        this._indicator = this._addIndicator();
        this._indicator.icon_name = 'display-brightness-symbolic';

        this._sliderItem = new SliderItem(ext);
        this.quickSettingsItems.push(this._sliderItem);

        this._targetToggle = new QuickSettings.QuickMenuToggle({
            title: _('Pantalla'),
            iconName: 'preferences-desktop-display-symbolic',
            toggleMode: true,
        });
        this._targetToggle.menu.setHeader(
            'preferences-desktop-display-symbolic',
            _('Pantalla objetivo'));
        this._targetItems = new Map();
        this._rebuildTargetMenu();
        this.quickSettingsItems.push(this._targetToggle);
    }

    _rebuildTargetMenu() {
        for (const item of this._targetItems.values())
            item.destroy();
        this._targetItems.clear();

        const current = this._ext.target;
        const options = [['all', _('Todas las pantallas')]];
        for (const {id, label} of this._ext.monitorLabels())
            options.push([id, label]);

        for (const [id, label] of options) {
            const item = new PopupMenu.PopupMenuItem(label);
            if (id === current)
                item.setOrnament(PopupMenu.Ornament.DOT);
            item.connect('activate', () => {
                this._ext.setTarget(id);
                this._rebuildTargetMenu();
            });
            this._targetToggle.menu.addMenuItem(item);
            this._targetItems.set(id, item);
        }
    }

    setValue(dim) {
        this._sliderItem.setValue(dim);
    }

    destroy() {
        this._sliderItem.destroy();
        for (const item of this._targetItems.values())
            item.destroy();
        this._targetItems.clear();
        this._targetToggle.destroy();
        super.destroy();
    }
});

export default class SoftBrightness extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._migrateLegacyState();
        this._dim = this._settings.get_int('dim');
        this._target = this._settings.get_string('target');
        this._overlays = new Map();
        this._connMap = new Map();
        this._refreshConnectorMap();

        this._settingsIds = [
            this._settings.connect('changed::dim', () => {
                const v = this._settings.get_int('dim');
                if (v === this._dim)
                    return;
                this._dim = v;
                this._indicator?.setValue(v);
                this._apply();
            }),
            this._settings.connect('changed::target', () => {
                const v = this._settings.get_string('target');
                if (v === this._target)
                    return;
                this._target = v;
                this._indicator?._rebuildTargetMenu();
                this._apply();
            }),
        ];

        this._indicator = new Indicator(this);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);

        this._buildOverlays();
        this._monId = Main.layoutManager.connect('monitors-changed', () => {
            this._refreshConnectorMap();
            this._buildOverlays();
            this._indicator._rebuildTargetMenu();
        });
        this._apply();
    }

    disable() {
        if (this._monId) {
            Main.layoutManager.disconnect(this._monId);
            this._monId = 0;
        }
        for (const id of this._settingsIds ?? [])
            this._settings.disconnect(id);
        this._settingsIds = [];
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        this._destroyOverlays();
        this._settings = null;
        this._connMap = null;
        this._dim = 0;
        this._target = 'all';
    }

    get dim() {
        return this._dim;
    }

    get target() {
        return this._target;
    }

    setDim(dim) {
        this._dim = Math.max(0, Math.min(100, dim));
        this._settings.set_int('dim', this._dim);
        this._apply();
    }

    setTarget(target) {
        this._target = target;
        this._settings.set_string('target', target);
        this._apply();
    }

    monitorLabels() {
        const result = [];
        for (const m of Main.layoutManager.monitors) {
            const key = `${m.x},${m.y},${m.width},${m.height}`;
            const conn = this._connMap.get(`${m.x},${m.y}`) ?? null;
            result.push({
                id: conn ?? key,
                label: conn ?? `${m.width}x${m.height}`,
            });
        }
        if (this._settings) {
            try {
                this._settings.set_string('monitors', JSON.stringify(result));
            } catch (e) {
            }
        }
        return result;
    }

    _refreshConnectorMap() {
        const map = new Map();
        try {
            const model = global.display.get_monitors();
            for (let i = 0; i < model.get_n_items(); i++) {
                const m = model.get_item(i);
                const g = m.get_geometry();
                const conn = m.get_connector?.();
                if (g && conn)
                    map.set(`${g.x},${g.y}`, conn);
            }
        } catch (e) {
        }
        this._connMap = map;
        if (map.size >= Main.layoutManager.monitors.length)
            return;
        Gio.DBus.session.call(
            'org.gnome.Mutter.DisplayConfig',
            '/org/gnome/Mutter/DisplayConfig',
            'org.gnome.Mutter.DisplayConfig',
            'GetCurrentState', null, null,
            Gio.DBusCallFlags.NONE, -1, null,
            (conn, res) => {
                try {
                    const val = conn.call_finish(res).recursiveUnpack();
                    for (const lm of val[2]) {
                        const [x, y, , , , mons] = lm;
                        if (mons?.length === 1 && !map.has(`${x},${y}`))
                            map.set(`${x},${y}`, mons[0][0]);
                    }
                } catch (e) {
                }
                if (this._connMap !== map || !map.size)
                    return;
                this._connMap = map;
                if (this._indicator) {
                    this._indicator._rebuildTargetMenu();
                    this._apply();
                }
            });
    }

    _buildOverlays() {
        this._destroyOverlays();
        for (const m of Main.layoutManager.monitors) {
            const actor = new St.Widget({
                x: m.x,
                y: m.y,
                width: m.width,
                height: m.height,
                reactive: false,
                opacity: 0,
                style: 'background-color: black;',
            });
            Main.layoutManager.addTopChrome(actor, {
                trackFullscreen: false,
            });
            this._overlays.set(`${m.x},${m.y},${m.width},${m.height}`, actor);
        }
        this._apply();
    }

    _destroyOverlays() {
        for (const actor of this._overlays.values())
            actor.destroy();
        this._overlays.clear();
    }

    _apply() {
        const alpha = Math.round(MAX_ALPHA * this._dim / 100);
        for (const [key, actor] of this._overlays) {
            const [x, y] = key.split(',');
            const conn = this._connMap.get(`${x},${y}`);
            const on = this._target === 'all' ||
                this._target === conn ||
                this._target === key;
            actor.opacity = on ? alpha : 0;
        }
    }

    _migrateLegacyState() {
        try {
            const path = GLib.build_filenamev([
                GLib.get_user_config_dir(),
                'soft-brightness',
                'state.json',
            ]);
            const file = Gio.File.new_for_path(path);
            if (!file.query_exists(null))
                return;
            const [, bytes] = file.load_contents(null);
            const data = JSON.parse(new TextDecoder().decode(bytes));
            if (Number.isFinite(data.dim))
                this._settings.set_int('dim',
                    Math.max(0, Math.min(100, data.dim)));
            if (typeof data.target === 'string')
                this._settings.set_string('target', data.target);
            file.delete(null);
        } catch (e) {
        }
    }
}
