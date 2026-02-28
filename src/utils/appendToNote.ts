import { App, Notice, TFile } from "obsidian";

function getObsidianApp(app?: App): App | null {
  if (app) return app;
  const globalApp = (globalThis as any)?.app as App | undefined;
  return globalApp ?? null;
}

export async function appendToActiveNote(
  text: string,
  options?: {
    app?: App;
    atEnd?: boolean; // kept for compatibility (unused)
    ensureNewline?: boolean;
    silent?: boolean;
    fallbackFilePath?: string; // kept for compatibility (unused)
  }
) {
  const app = getObsidianApp(options?.app);

  if (!app) {
    if (!options?.silent)
      new Notice("Could not access Obsidian app instance.");
    return false;
  }

  let contentToInsert = text;

  if (options?.ensureNewline) {
    if (!contentToInsert.startsWith("\n"))
      contentToInsert = "\n" + contentToInsert;

    if (!contentToInsert.endsWith("\n"))
      contentToInsert = contentToInsert + "\n";
  }

  const file = app.vault.getAbstractFileByPath("Campaign.md");

  if (!file || !(file instanceof TFile)) {
    if (!options?.silent)
      new Notice("Campaign.md not found in vault root.");
    return false;
  }

  await app.vault.append(file, contentToInsert);

  return true;
}