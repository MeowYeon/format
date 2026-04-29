"use strict";

const { Modal, Notice, Plugin, Setting, MarkdownView } = require("obsidian");
const { formatText } = require("./formatter");

const MENU_TITLE = "Custom Format";
const PREVIEW_LIMIT = 8;

class FormatPreviewModal extends Modal {
  constructor(app, file, before, formatResult) {
    super(app);
    this.file = file;
    this.before = before;
    this.formatResult = formatResult;
    this.decision = false;
    this._resolver = null;
    this.result = new Promise((resolve) => {
      this._resolver = resolve;
    });
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("format-preview-modal");

    contentEl.createEl("h2", {
      text: `Apply formatting to ${this.file.basename}?`,
    });

    contentEl.createEl("p", {
      text: `${this.formatResult.changes.length} line(s) would change before closing.`,
    });

    const previewContainer = contentEl.createDiv({ cls: "format-preview-list" });

    for (const change of this.formatResult.changes.slice(0, PREVIEW_LIMIT)) {
      const block = previewContainer.createDiv({ cls: "format-preview-item" });
      block.createEl("div", {
        text: `Line ${change.line}`,
        cls: "format-preview-line-number",
      });
      block.createEl("pre", {
        text: `- ${visualizeWhitespace(change.before)}`,
        cls: "format-preview-before",
      });
      block.createEl("pre", {
        text: `+ ${visualizeWhitespace(change.after)}`,
        cls: "format-preview-after",
      });
    }

    if (this.formatResult.changes.length > PREVIEW_LIMIT) {
      previewContainer.createEl("p", {
        text: `...and ${this.formatResult.changes.length - PREVIEW_LIMIT} more changed line(s).`,
      });
    }

    new Setting(contentEl)
      .addButton((button) =>
        button.setButtonText("Apply").setCta().onClick(() => {
          this.decision = true;
          this.close();
        })
      )
      .addButton((button) =>
        button.setButtonText("Skip").onClick(() => {
          this.decision = false;
          this.close();
        })
      );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    if (this._resolver) {
      this._resolver(this.decision);
      this._resolver = null;
    }
  }

  waitForDecision() {
    this.open();
    return this.result;
  }
}

module.exports = class FormatPlugin extends Plugin {
  async onload() {
    this.fileState = new Map();
    this.pendingCloseFormats = new Set();
    this.openMarkdownFilePaths = this.getOpenMarkdownFilePaths();

    this.addCommand({
      id: "custom-format",
      name: MENU_TITLE,
      editorCallback: (editor, view) => {
        void this.formatSelectionOrDocument(editor, view).catch((error) => {
          console.error(error);
        });
      },
    });

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        menu.addItem((item) => {
          item.setTitle(MENU_TITLE).setIcon("wand").onClick(() => {
            void this.formatSelectionOrDocument(editor, view).catch((error) => {
              console.error(error);
            });
          });
        });
      })
    );

    this.registerEvent(
      this.app.workspace.on("editor-change", (editor) => {
        const view = this.findMarkdownViewForEditor(editor) ?? this.app.workspace.getActiveViewOfType(MarkdownView);
        const file = view?.file;
        if (!file) {
          return;
        }

        this.captureFileState(file, editor.getValue());
      })
    );

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        void this.handleLayoutChange().catch((error) => {
          console.error(error);
        });
      })
    );

    this.registerEvent(
      this.app.workspace.on("quit", () => {
        void this.handleAppQuit().catch((error) => {
          console.error(error);
        });
      })
    );

    this.registerDomEvent(window, "beforeunload", () => {
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      const file = activeView?.file;
      if (!file) {
        return;
      }

      this.captureFileState(file, activeView.editor.getValue());
    });

    this.captureCurrentViewState();
  }

  onunload() {
    this.fileState.clear();
    this.pendingCloseFormats.clear();
  }

  captureCurrentViewState() {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = activeView?.file;
    if (!file) {
      return;
    }

    this.captureFileState(file, activeView.editor.getValue());
  }

  captureFileState(file, text) {
    this.fileState.set(file.path, {
      file,
      text,
    });
  }

  getOpenMarkdownFilePaths() {
    const openPaths = new Set();

    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const file = leaf.view?.file;
      if (file?.path) {
        openPaths.add(file.path);
      }
    }

    return openPaths;
  }

  findMarkdownViewForEditor(editor) {
    const leaves = this.app.workspace.getLeavesOfType("markdown");

    for (const leaf of leaves) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) {
        continue;
      }

      if (view.editor === editor) {
        return view;
      }
    }

    return null;
  }

  async handleLayoutChange() {
    const currentOpenPaths = this.getOpenMarkdownFilePaths();
    const closedPaths = [...this.openMarkdownFilePaths].filter((path) => !currentOpenPaths.has(path));

    for (const path of closedPaths) {
      const state = this.fileState.get(path);
      if (!state) {
        continue;
      }

      await this.maybeFormatOnClose(state.file, state.text);
      this.fileState.delete(path);
    }

    this.openMarkdownFilePaths = currentOpenPaths;
  }

  async handleAppQuit() {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const activeFile = activeView?.file;
    if (!activeFile) {
      return;
    }

    this.captureFileState(activeFile, activeView.editor.getValue());
    const state = this.fileState.get(activeFile.path);
    if (!state) {
      return;
    }

    await this.maybeFormatOnClose(state.file, state.text);
  }

  async formatSelectionOrDocument(editor, view) {
    const file = view?.file ?? this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("No active Markdown file to format.");
      return;
    }

    if (editor.somethingSelected()) {
      const selectedText = editor.getSelection();
      const result = await formatText(selectedText);
      if (result.output !== selectedText) {
        editor.replaceSelection(result.output);
        new Notice("Custom format applied to selection.");
      }
    } else {
      const currentText = editor.getValue();
      const result = await formatText(currentText);
      if (result.output !== currentText) {
        editor.setValue(result.output);
        new Notice("Custom format applied.");
      }
    }

    this.captureFileState(file, editor.getValue());
  }

  async maybeFormatOnClose(file, originalText) {
    if (!file || this.pendingCloseFormats.has(file.path)) {
      return;
    }

    const result = await formatText(originalText);
    if (result.output === originalText) {
      return;
    }

    this.pendingCloseFormats.add(file.path);

    try {
      const modal = new FormatPreviewModal(this.app, file, originalText, result);
      const shouldApply = await modal.waitForDecision();

      if (!shouldApply) {
        return;
      }

      const latestContent = await this.app.vault.cachedRead(file);
      const latestResult = await formatText(latestContent);

      if (latestResult.output === latestContent) {
        return;
      }

      await this.app.vault.modify(file, latestResult.output);
      new Notice(`Formatted ${file.basename} before closing.`);
    } finally {
      this.pendingCloseFormats.delete(file.path);
    }
  }
};

function visualizeWhitespace(value) {
  return value.replace(/ /g, "·");
}
