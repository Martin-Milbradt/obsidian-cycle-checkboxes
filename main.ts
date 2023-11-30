import { App, Editor, MarkdownView, Plugin, PluginSettingTab, Setting, debounce } from 'obsidian';

interface CycleSettings {
	fillings: string[];
	reload: boolean;
	includeEmpty: boolean;
	includeDash: boolean;
}

const DEFAULT_SETTINGS: CycleSettings = {
	fillings: [" ", "x", "/", "-"],
	reload: true,
	includeEmpty: true,
	includeDash: true,
}

export default class CycleCheckboxes extends Plugin {
	settings: CycleSettings;

	prefixes: string[];
	prefixRegEx: string;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'cycle-forward',
			name: 'Cycle forward',
			callback: () => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view) {
					return;
				} else {
					const view_mode = view.getMode();
				switch (view_mode) {
						case "preview":
							return;
						case "source": {
							this.cycle(view.editor);
						}
					}
				}
			}
		});

		this.addCommand({
			id: 'cycle-backward',
			name: 'Cycle backward',
			callback: () => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view) {
					return;
				} else {
					const view_mode = view.getMode();
				switch (view_mode) {
						case "preview":
							return;
						case "source": {
							this.cycle(view.editor, -1);
						}
					}
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new CycleSettingsTab(this.app, this));

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {
		// Intentionally empty
	}

	cycle(editor: Editor, offset = 1) {
		if (this.settings.reload) {
			// Create variables for prefix matching
			this.prefixes = [...this.settings.fillings.map(e => `- [${e}] `)];
			let regExPart = this.settings.fillings.map(e => `- \\[\\${e}\\] `).join("|");
			if (this.settings.includeDash) {
				this.prefixes.push("- ");
				regExPart += "|- ";
			}
			if (this.settings.includeEmpty) {
				this.prefixes.push("");
				regExPart += "|";
			}
			this.prefixRegEx = `^(\\s*)(${regExPart}|- \\[.\\]|- |)(.*)$`;
			this.settings.reload = false;
		}
		const start = editor.getCursor("from")
		const end = editor.getCursor("to")
		for (let i = start.line; i <= end.line; i++) {
			const lineContents = editor.getLine(i);
			const match = RegExp(this.prefixRegEx).exec(lineContents);
			if (!match) {
				console.log("no match for line " + i + ": " + lineContents);
				return;
			}
			const prefix = match[2];
			const currentPrefixIndex = this.prefixes.findIndex(p => p == prefix); // not found defaults to -1
			const nextPrefix = this.prefixes[((currentPrefixIndex + offset) + this.prefixes.length) % this.prefixes.length]; // + length to avoid negative modulo
			const newLineContent = match[1] + nextPrefix + match[3]
			editor.setLine(i, newLineContent);
			if (i == start.line) {
				start.ch +=  nextPrefix.length - prefix.length;
			}
			if (i == end.line) {
				end.ch +=  nextPrefix.length - prefix.length;
			}
		}
		editor.setSelection(start, end);
	}

	async loadSettings() {
		this.settings = { ...DEFAULT_SETTINGS, ...await this.loadData()};
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class CycleSettingsTab extends PluginSettingTab {
	plugin: CycleCheckboxes;

	constructor(app: App, plugin: CycleCheckboxes) {
		super(app, plugin);
		this.plugin = plugin;
	}
	fillings = [" ", "x", "/", "-"];
	display(): void {
		const {containerEl} = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Cycle Checkboxes' });

		new Setting(this.containerEl)
            .setName("Enable bullet point")
            .setDesc("Adds the generic bullet point '-' to the cycle.")
            .addToggle(toggle =>
                toggle
                    .setValue(this.plugin.settings.includeDash)
                    .onChange(async () => {
						this.plugin.settings.includeDash = !this.plugin.settings.includeDash;
						this.plugin.settings.reload = true;
						await this.plugin.saveSettings()
					})
            );

		new Setting(this.containerEl)
            .setName("Enable no checkbox")
            .setDesc("Adds removal of checkboxes to the cycle.")
            .addToggle(toggle =>
                toggle
                    .setValue(this.plugin.settings.includeEmpty)
                    .onChange(async () => {
						this.plugin.settings.includeEmpty = !this.plugin.settings.includeEmpty;
						this.plugin.settings.reload = true;
						await this.plugin.saveSettings()
					})
            );

		new Setting(containerEl)
			.setName('Ckeckboxes to be cycled')
			.setDesc('Enter the checkboxes you want to toggle in a comma-separated list. Note: The empty checkbox has to be included as well. Restart Obsidian after changing this setting.')
			.addTextArea(text => {
                const onChange = async (value: string) => {
                    const list = value.split(',').map((v) => v.trim() || ' ');
                    this.plugin.settings.fillings = list;
					this.plugin.settings.reload = true;
                    await this.plugin.saveSettings();
                };
                text.setPlaceholder(
                    'List checkboxes to cycle',
                );
                text.setValue(
                    this.plugin.settings.fillings.join(', '),
                ).onChange(debounce(onChange, 500, true));
            });
	}
}
