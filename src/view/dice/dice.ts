import { ExtraButtonComponent, setTooltip, Modal, Setting } from "obsidian";
import {
  random,
  rollIntervals,
  bounce,
  clickToCopy,
  first,
  sum,
} from "../../utils";
import { RollColor } from "./types";
import { DiceView } from "./view";
import { appendToActiveNote } from "src/utils/appendToNote";


/**
 * Modal to ask for:
 * - how many rolls
 * - whether to sum or keep separate
 */
class RollBatchModal extends Modal {
  private times: number;
  private mode: "sum" | "separate";

  constructor(
    app: any,
    initialTimes: number,
    initialMode: "sum" | "separate",
    private onSubmit: (times: number, mode: "sum" | "separate") => void
  ) {
    super(app);
    this.times = initialTimes;
    this.mode = initialMode;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Roll multiple dice" });

    new Setting(contentEl)
      .setName("How many rolls?")
      .addText((t) =>
        t
          .setPlaceholder("e.g. 3")
          .setValue(String(this.times))
          .onChange((v) => {
            const n = Number.parseInt(v, 10);
            this.times = Number.isFinite(n) && n > 0 ? n : 1;
          })
      );

    new Setting(contentEl)
      .setName("Output")
      .setDesc("Sum them into one total, or keep them separated.")
      .addDropdown((dd) =>
        dd
          .addOption("separate", "Keep separated")
          .addOption("sum", "Sum them")
          .setValue(this.mode)
          .onChange((v) => (this.mode = v as "sum" | "separate"))
      );

    new Setting(contentEl).addButton((b) =>
      b
        .setCta()
        .setButtonText("Roll")
        .onClick(() => {
          this.close();
          this.onSubmit(this.times, this.mode);
        })
    );
  }

  onClose() {
    this.contentEl.empty();
  }
}

export class Dice {
  min: number = 1;
  max: number = 20;
  el: HTMLElement;
  resultsEl: HTMLElement;
  
  private lastRollTimes: number = 2;
  private lastRollMode: "sum" | "separate" = "separate";

  constructor(private view: DiceView, private type: string) {
    switch (type) {
      case "d4":
        this.max = 4;
        break;
      case "d6":
        this.max = 6;
        break;
      case "d8":
        this.max = 8;
        break;
      case "d10":
        this.max = 10;
        break;
      case "d12":
        this.max = 12;
        break;
      case "d20":
        this.max = 20;
        break;
      case "d100":
        this.max = 100;
        break;
      case "dF":
        this.min = -1;
        this.max = 1;
        break;
    }

    this.generateDOM();
  }

  format(value: number): string {
    if (this.type === "dF") {
      if (value === -1) return "-";
      if (value === +1) return "+";
      return "▢";
    } else {
      return value.toString();
    }
  }

  /**
   * Promise-based single roll that resolves ONLY when the roll animation finishes.
   * This lets us batch-roll deterministically and then append once.
   */
  addResultAsync(color: RollColor): Promise<number> {
    return new Promise((resolve) => {
      let value = random(this.min, this.max);

      this.view.rolls[this.type] = this.view.rolls[this.type] || [];
      const rollIndex = this.view.rolls[this.type].length;
      this.view.rolls[this.type][rollIndex] = [value, color];

      const valueEl = this.resultsEl.createDiv(
        `dice-result-value dice-color-${color}`
      );
      valueEl.setText(this.format(value));

      let i = 0;
      const reroll = () => {
        if (this.view.rolls[this.type][rollIndex]) {
          value = random(this.min, this.max, value);
          this.view.rolls[this.type][rollIndex][0] = value;
          valueEl.setText(this.format(value));

          if (this.type === "dF") {
            if (value) {
              valueEl.classList.remove("dice-fudge-0");
            } else {
              valueEl.classList.add("dice-fudge-0");
            }
          }

          i++;
          if (rollIntervals[i]) {
            setTimeout(reroll, rollIntervals[i]);
          } else {
            // To prevent double-tap bug on mobile
            const preventClick = bounce(1000, true);

            valueEl.onclick = (event) => {
              if (preventClick.check()) return;
              const { shiftKey, ctrlKey, metaKey, altKey } = event;
              const anyKey = shiftKey || ctrlKey || metaKey || altKey;

              const [single, total] = this.view.formatForClipboard(
                value,
                this.type
              );

              if (anyKey) {
                clickToCopy(total)(event);
                if (this.view.view.settings.diceDeleteOnCopy) {
                  this.resultsEl.empty();
                  delete this.view.rolls[this.type];
                  this.updateTooltip(this.type);
                }
              } else {
                clickToCopy(single)(event);
                if (this.view.view.settings.diceDeleteOnCopy) {
                  valueEl.remove();
                  this.view.rolls[this.type][rollIndex][0] = NaN;
                  this.updateTooltip(this.type);
                }
              }
            };

            valueEl.oncontextmenu = (event) => {
              event.preventDefault();
              event.stopPropagation();
              const [_single, total] = this.view.formatForClipboard(
                value,
                this.type
              );
              clickToCopy(total)(event);
              if (this.view.view.settings.diceDeleteOnCopy) {
                this.resultsEl.empty();
                delete this.view.rolls[this.type];
                this.updateTooltip(this.type);
              }
              preventClick.set();
            };

            this.updateTooltip(this.type);

            // Resolve final value here (end of animation)
            resolve(value);
          }
        }
      };

      setTimeout(reroll, rollIntervals[i]);
    });
  }

  /**
   * Batch roll:
   * - roll X times (with UI animation for each)
   * - append ONE line, either summed or separated
   *
   * NOTE: When mode === "sum", we append ONLY the sum (no individual results).
   */
  async addResults(
    times: number,
    color: RollColor,
    mode: "sum" | "separate"
  ) {
    const values: number[] = [];

    for (let k = 0; k < times; k++) {
      const v = await this.addResultAsync(color);
      values.push(v);
    }

    if (mode === "sum") {
      const total = values.reduce((a, b) => a + b, 0);
      appendToActiveNote(
        `- **${this.type} (${times} rolls):** **${total}**`,
        { atEnd: true, ensureNewline: true }
      );
    } else {
      appendToActiveNote(
        `- **${this.type} (${times} rolls):** ${values
          .map((v) => this.format(v))
          .join(", ")}`,
        { atEnd: true, ensureNewline: true }
      );
    }
  }

  private updateTooltip(dice: string) {
    const rolls = this.view.getRolls(dice);
    const total = sum(rolls.map(first));

    let text = "";
    if (rolls.length === 1) {
      text = `${dice}: ${total}`;
    } else if (rolls.length > 1) {
      text = `${rolls.length}${dice}: ${total}`;
    }

    setTooltip(this.resultsEl, text, {
      delay: 0,
      placement: "bottom",
    });
  }

  private generateDOM() {
    this.el = this.view.btnsEl.createDiv(
      `dice-variant dice-variant-${this.type}`
    );

    this.resultsEl = this.el.createDiv(
      `dice-results dice-results-${this.type}`
    );
    this.view.resultEls[this.type] = this.resultsEl;

    const btnEl = new ExtraButtonComponent(this.el)
      .setIcon(`srt-${this.type}`)
      .setTooltip(`Roll ${this.type}`);

    // To prevent double-tap bug on mobile
    const preventClick = bounce(1000, true);

    /**
     * UX:
     * - ALWAYS open the modal on click
     * - modifiers still affect "color" if you want that behavior
     */
    btnEl.extraSettingsEl.onclick = (event) => {
      if (preventClick.check()) return;

      const { shiftKey, ctrlKey, metaKey, altKey } = event;

      const a = shiftKey ? 0b001 : 0;
      const b = ctrlKey || metaKey ? 0b010 : 0;
      const c = altKey ? 0b100 : 0;
      const color = (a + b + c) as RollColor;

      new RollBatchModal(
          this.view.view.app,
          this.lastRollTimes,
          this.lastRollMode,
          async (times, mode) => {
            // remember last selections (session-only)
            this.lastRollTimes = times;
            this.lastRollMode = mode;

            await this.addResults(times, color, mode);
          }
        ).open();
    };

    /**
     * Keep original right-click behavior:
     * - roll once with color=1
     *
     * If you want, you can also make right-click open the modal
     * by duplicating the modal logic here.
     */
    btnEl.extraSettingsEl.oncontextmenu = async (event) => {
      event.preventDefault();
      event.stopPropagation();

      // Original behavior: single roll (no modal) on right click.
      // If you'd rather always show modal, replace this with modal logic too.
      const color = 1 as RollColor;
      await this.addResults(1, color, "separate");

      preventClick.set();
    };
  }
}