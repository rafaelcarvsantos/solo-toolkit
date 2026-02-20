import { App, TFile } from "obsidian";
import { readAndParseListSection } from "./parseListFile";
import { dictionary } from "./dictionary";

const LIST_FILE = "Lists.md";

export async function refreshListsCache(app: App): Promise<void> {
  const file = app.vault.getAbstractFileByPath(LIST_FILE);
  if (!file || !(file instanceof TFile)) return;

  const content = await app.vault.read(file);
  console.log("aaaa");
  dictionary.characterlist = await readAndParseListSection("Characters");
  dictionary.threadlist = await readAndParseListSection("Threads");
}