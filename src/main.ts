import { CardValidatorOCR, type CardValidatorResponse } from "./index";

const validator = new CardValidatorOCR();

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text; // siempre textContent
  return node;
}

const root = document.getElementById("app") ?? document.body;
root.replaceChildren();

const input = el("input");
input.type = "file";
input.accept = "image/jpeg,image/png,image/webp";
const btn = el("button", "Leer carné");
btn.disabled = true;
const status = el("p");
const output = el("div");
root.append(el("h1", "hacksis-card-validator · prueba"), input, btn, status, output);

let file: File | null = null;
input.addEventListener("change", () => {
  file = input.files?.[0] ?? null;
  btn.disabled = !file;
});

function render(r: CardValidatorResponse): void {
  output.replaceChildren();
  output.append(el("h2", `Estado: ${r.status}`));

  if (r.error) output.append(el("p", `Error ${r.error.code}: ${r.error.message}`));

  for (const [key, value] of Object.entries(r.data)) {
    const doubtful = r.fieldsToReview.includes(key);
    const row = el("div", `${key}: ${value === "" ? "—" : value}${doubtful ? "  ⚠" : ""}`);
    row.style.color = doubtful ? "#c0392b" : "";
    output.append(row);
  }

  if (r.warnings.length > 0) {
    output.append(el("h3", "Advertencias"));
    const ul = el("ul");
    for (const w of r.warnings) ul.append(el("li", w));
    output.append(ul);
  }

  const pre = el("pre");
  pre.textContent = JSON.stringify(r.flags, null, 2);
  output.append(el("h3", "Flags"), pre);
}

btn.addEventListener("click", async () => {
  if (!file) return;
  btn.disabled = true;
  status.textContent = "Procesando…";
  render(await validator.setFile(file).setParams({ includeFieldDetails: true }).send());
  status.textContent = "Listo.";
  btn.disabled = false;
});

window.addEventListener("beforeunload", () => void validator.dispose());