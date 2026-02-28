import { App, TFile } from "obsidian";

export async function getOrCreateCampaignFile(app: App) {
  const existing = app.vault.getAbstractFileByPath("Campaign.md");

  if (existing instanceof TFile) {
    const content = await app.vault.read(existing);
    return { file: existing, content };
  }

  const file = await app.vault.create("Campaign.md", `
`);
  return { file, content: await app.vault.read(file) };
}