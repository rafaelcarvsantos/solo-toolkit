import { App, MarkdownView, Notice, TFile } from "obsidian";

function getObsidianApp(app?: App): App | null {
  if (app) return app;
  const globalApp = (globalThis as any)?.app as App | undefined;
  return globalApp ?? null;
}

function findBestMarkdownView(app: App): MarkdownView | null {
  // 1) Best case: currently active markdown view
  const active = app.workspace.getActiveViewOfType(MarkdownView);
  if (active) return active;

  // 2) Otherwise: any open markdown view (most recent leaf if possible)
  const leaves = app.workspace.getLeavesOfType("markdown");
  if (leaves.length > 0) {
    const view = leaves[0].view;
    if (view instanceof MarkdownView) return view;
  }

  return null;
}

export async function appendToActiveNote(
  text: string,
  options?: {
    app?: App;
    atEnd?: boolean;
    ensureNewline?: boolean;
    silent?: boolean;

    // Optional fallback: if no editor is open, append to this file path
    fallbackFilePath?: string; // e.g. "Sessions/2026-02-17.md"
  }
) {
  const app = getObsidianApp(options?.app);

  if (!app) {
    if (!options?.silent) new Notice("Could not access Obsidian app instance.");
    return false;
  }

  let contentToInsert = text;
  if (options?.ensureNewline) {
    if (!contentToInsert.startsWith("\n")) contentToInsert = "\n" + contentToInsert;
    if (!contentToInsert.endsWith("\n")) contentToInsert = contentToInsert + "\n";
  }

  const view = findBestMarkdownView(app);

  // A) If we have an editor open somewhere, insert there
  if (view) {
    const editor = view.editor;

    if (options?.atEnd) {
      const lastLine = editor.lastLine();
      const lastCh = editor.getLine(lastLine).length;
      editor.setCursor({ line: lastLine, ch: lastCh });
    }

    editor.replaceRange(contentToInsert, editor.getCursor());
    return true;
  }

  // B) If no markdown editor is open, optionally append directly to a file
  if (options?.fallbackFilePath) {
    const file = app.vault.getAbstractFileByPath(options.fallbackFilePath);
    if (file && file instanceof TFile) {
      const existing = await app.vault.read(file);
      await app.vault.modify(file, existing + contentToInsert);
      return true;
    } else {
      if (!options?.silent)
        new Notice(`Fallback file not found: ${options.fallbackFilePath}`);
      return false;
    }
  }

  if (!options?.silent) {
    new Notice("No open note to append to. Open a note first, or set a fallback file.");
  }
  return false;
}