import { App, TFile } from "obsidian";

export async function getOrCreateListsFile(app: App) {
  const existing = app.vault.getAbstractFileByPath("Lists.md");

  if (existing instanceof TFile) {
    const content = await app.vault.read(existing);
    return { file: existing, content };
  }

  const file = await app.vault.create("Lists.md", `# Lists

## Characters
- 
-

## Threads
- (open)
- 
`);
  return { file, content: await app.vault.read(file) };
}