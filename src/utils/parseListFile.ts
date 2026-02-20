import { App, Notice, TFile } from "obsidian";

const LIST_FILE = "Lists.md";

function getObsidianApp(): App | null {
  const globalApp = (globalThis as any)?.app as App | undefined;
  return globalApp ?? null;
}

export async function readListsFile(): Promise<string> {
  const app = getObsidianApp();

  if (!app) {
    new Notice("Could not access Obsidian app instance.");
    throw new Error("Obsidian app instance unavailable");
  }

  const file = app.vault.getAbstractFileByPath(LIST_FILE);
  if (!file || !(file instanceof TFile)) {
    throw new Error(`${LIST_FILE} not found in vault`);
  }

  return await app.vault.read(file);
}

export function parseListSection(
  content: string,
  sectionName: "Characters" | "Threads"
): string[] {
  const lines = content.split("\n");
  const results: string[] = [];
  let inTargetSection = false;

  const sectionRegex = new RegExp(`^##\\s*${sectionName}\\b`, "i");

  for (const line of lines) {
    if (sectionRegex.test(line)) {
      inTargetSection = true;
      continue;
    }

    if (/^##\s+/.test(line)) {
      inTargetSection = false;
    }

    if (!inTargetSection) continue;

    const match = line.match(/^- (.*)/);
    if (match) {
      const value = match[1].trim();
      if (value.length > 0) results.push(value);
    }
  }

  return results;
}

export async function readAndParseListSection(
  sectionName: "Characters" | "Threads"
): Promise<string[]> {
  const content = await readListsFile();
  console.log(parseListSection(content, sectionName));
  return parseListSection(content, sectionName);

}