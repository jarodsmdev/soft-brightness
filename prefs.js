import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class SoftBrightnessPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        window.add(page);

        const dimGroup = new Adw.PreferencesGroup({
            title: _('Brillo'),
            description: _('Atenuación por software de la pantalla objetivo'),
        });
        page.add(dimGroup);

        const dim = settings.get_int('dim');

        const dimRow = new Adw.ActionRow({
            title: _('Nivel de oscurecimiento'),
            subtitle: _('0% = apagado · 100% = máximo (~90% de negro)'),
        });
        const scale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            hexpand: true,
            valign: Gtk.Align.CENTER,
        });
        scale.set_range(0, 100);
        scale.set_draw_value(false);
        scale.set_value(dim);
        const valueLabel = new Gtk.Label({
            label: `${dim}%`,
            width_chars: 5,
            xalign: 1,
        });
        scale.connect('value-changed', () => {
            const v = Math.round(scale.get_value());
            valueLabel.label = `${v}%`;
            if (settings.get_int('dim') !== v)
                settings.set_int('dim', v);
        });
        settings.connect('changed::dim', () => {
            const v = settings.get_int('dim');
            valueLabel.label = `${v}%`;
            if (Math.round(scale.get_value()) !== v)
                scale.set_value(v);
        });
        dimRow.add_suffix(scale);
        dimRow.add_suffix(valueLabel);
        dimRow.set_activatable_widget(scale);
        dimGroup.add(dimRow);

        const targetGroup = new Adw.PreferencesGroup({
            title: _('Pantalla objetivo'),
            description: _('Elige qué pantalla atenúa el slider'),
        });
        page.add(targetGroup);

        const targetRows = [];
        const rebuildTarget = () => {
            for (const row of targetRows)
                targetGroup.remove(row);
            targetRows.length = 0;

            const current = settings.get_string('target');
            const options = [{id: 'all', label: _('Todas las pantallas')}];

            const published = (() => {
                try {
                    const list = JSON.parse(settings.get_string('monitors'));
                    return Array.isArray(list) && list.length ? list : null;
                } catch (e) {
                    return null;
                }
            })();

            if (published) {
                options.push(...published);
            } else {
                const display = Gdk.Display.get_default();
                const model = display?.get_monitors();
                for (let i = 0; model && i < model.get_n_items(); i++) {
                    const m = model.get_item(i);
                    const g = m.get_geometry();
                    let conn = null;
                    try {
                        conn = m.get_connector?.() || null;
                    } catch (e) {
                    }
                    options.push({
                        id: conn ?? `${g.x},${g.y},${g.width},${g.height}`,
                        label: conn ?? `${g.width}x${g.height}`,
                    });
                }
            }

            for (const {id, label} of options) {
                const row = new Adw.ActionRow({
                    title: label,
                    activatable: true,
                });
                if (id === current) {
                    row.add_suffix(new Gtk.Image({
                        icon_name: 'object-select-symbolic',
                    }));
                    row.add_css_class('success');
                }
                row.connect('activated', () => {
                    if (settings.get_string('target') !== id)
                        settings.set_string('target', id);
                    rebuildTarget();
                });
                targetGroup.add(row);
                targetRows.push(row);
            }
        };
        rebuildTarget();
        const monitorsModel = Gdk.Display.get_default()?.get_monitors();
        const itemsId = monitorsModel?.connect('items-changed', rebuildTarget);
        const monId = settings.connect('changed::monitors', rebuildTarget);
        const targetId = settings.connect('changed::target', rebuildTarget);
        window.connect('close-request', () => {
            if (itemsId)
                monitorsModel.disconnect(itemsId);
            settings.disconnect(monId);
            settings.disconnect(targetId);
        });

        const aboutGroup = new Adw.PreferencesGroup({
            title: _('Acerca de'),
        });
        page.add(aboutGroup);

        aboutGroup.add(new Adw.ActionRow({
            title: _('Soft Brightness'),
            subtitle: _('Oscurecimiento por software · sin DDC/CI · GPL-2.0'),
        }));

        const repoRow = new Adw.ActionRow({
            title: _('Repositorio'),
            subtitle: 'github.com/jarodsmdev/soft-brightness',
        });
        const repoButton = new Gtk.Button({
            valign: Gtk.Align.CENTER,
            label: _('Abrir'),
        });
        repoButton.connect('clicked', () => {
            Gio.AppInfo.launch_default_for_uri(
                'https://github.com/jarodsmdev/soft-brightness', null);
        });
        repoRow.add_suffix(repoButton);
        aboutGroup.add(repoRow);

        aboutGroup.add(new Adw.ActionRow({
            title: _('Autor'),
            subtitle: 'Leonel Briones Palacios',
        }));
    }
}
