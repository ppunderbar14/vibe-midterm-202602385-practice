"use strict";

const MAX_CANDIDATES = 20;
const TAU = Math.PI * 2;
const POINTER_ANGLE = -Math.PI / 2;
const starterCandidates = [
  { id: "korean", name: "한식", weight: 1, color: "#5B8DEF" },
  { id: "chinese", name: "중식", weight: 1, color: "#8B75DE" },
  { id: "japanese", name: "일식", weight: 1, color: "#E9A94F" },
  { id: "western", name: "양식", weight: 1, color: "#E77F78" },
];

let candidates = starterCandidates.map((candidate) => ({ ...candidate }));
let nextCandidateId = 1;

const canvas = document.querySelector("#wheel");
const candidateList = document.querySelector("#candidate-list");
const candidateCount = document.querySelector("#candidate-count");
const candidateNotice = document.querySelector("#candidate-notice");
const addCandidateButton = document.querySelector("#add-candidate");
const spinButton = document.querySelector(".spin-button");

function validateName(value) {
  const name = value.trim();
  const length = Array.from(name).length;
  if (length < 1 || length > 30) {
    return { valid: false, message: "이름은 공백을 제외하고 1~30자로 입력해 주세요." };
  }
  return { valid: true, value: name };
}

function validateWeight(value) {
  const text = value.trim();
  if (!/^\d+$/.test(text)) {
    return { valid: false, message: "가중치는 1~100 사이의 정수로 입력해 주세요." };
  }
  const weight = Number(text);
  if (!Number.isSafeInteger(weight) || weight < 1 || weight > 100) {
    return { valid: false, message: "가중치는 1~100 사이의 정수로 입력해 주세요." };
  }
  return { valid: true, value: weight };
}

function validateColor(value) {
  if (!/^#[\da-f]{6}$/i.test(value)) {
    return { valid: false, message: "색상은 #RRGGBB 형식이어야 해요." };
  }
  return { valid: true, value: value.toUpperCase() };
}

function makeField({ id, labelText, field, type, value, inputMode, min, max }) {
  const wrapper = document.createElement("div");
  wrapper.className = `field field-${field}`;

  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = labelText;

  const input = document.createElement("input");
  input.id = id;
  input.type = type;
  input.value = value;
  input.dataset.field = field;
  if (inputMode) input.inputMode = inputMode;
  if (min !== undefined) input.min = String(min);
  if (max !== undefined) input.max = String(max);
  if (field === "weight") {
    input.setAttribute("aria-valuemin", "1");
    input.setAttribute("aria-valuemax", "100");
  }
  if (field === "name") input.maxLength = 60;
  if (field === "color") input.setAttribute("aria-label", `${labelText}: ${value}`);

  const error = document.createElement("span");
  error.className = "field-error";
  error.id = `${id}-error`;
  error.setAttribute("aria-live", "polite");

  input.setAttribute("aria-describedby", error.id);
  wrapper.append(label, input, error);
  return wrapper;
}

function makeCandidateRow(candidate, index) {
  const row = document.createElement("article");
  row.className = "candidate-row";
  row.dataset.candidateId = candidate.id;

  const number = document.createElement("span");
  number.className = "candidate-number";
  number.setAttribute("aria-hidden", "true");
  number.textContent = String(index + 1).padStart(2, "0");

  const fields = document.createElement("div");
  fields.className = "candidate-fields";
  fields.append(
    makeField({ id: `${candidate.id}-name`, labelText: "후보 이름", field: "name", type: "text", value: candidate.name }),
    makeField({ id: `${candidate.id}-weight`, labelText: "가중치", field: "weight", type: "text", value: candidate.weight, inputMode: "numeric", min: 1, max: 100 }),
    makeField({ id: `${candidate.id}-color`, labelText: "색상", field: "color", type: "color", value: candidate.color }),
  );

  const probability = document.createElement("p");
  probability.className = "candidate-probability";
  probability.dataset.probabilityId = candidate.id;

  const deleteButton = document.createElement("button");
  deleteButton.className = "icon-button delete-button";
  deleteButton.type = "button";
  deleteButton.dataset.action = "delete";
  deleteButton.setAttribute("aria-label", `${candidate.name} 삭제`);
  deleteButton.textContent = "×";

  row.append(number, fields, deleteButton, probability);
  return row;
}

function getTotalWeight() {
  return candidates.reduce((total, candidate) => total + candidate.weight, 0);
}

function formatProbability(weight, totalWeight) {
  const percentage = (weight / totalWeight) * 100;
  return `${Number(percentage.toFixed(1))}%`;
}

function updateProbabilities() {
  const totalWeight = getTotalWeight();
  candidates.forEach((candidate) => {
    const label = candidateList.querySelector(`[data-probability-id="${candidate.id}"]`);
    if (label) label.textContent = `선택 확률 ${formatProbability(candidate.weight, totalWeight)}`;
  });
}

function setFieldError(input, message) {
  const error = document.getElementById(`${input.id}-error`);
  input.setAttribute("aria-invalid", message ? "true" : "false");
  error.textContent = message;
}

function updateCandidateFromInput(input) {
  const row = input.closest(".candidate-row");
  const candidate = candidates.find((item) => item.id === row.dataset.candidateId);
  if (!candidate) return;

  let validation;
  switch (input.dataset.field) {
    case "name":
      validation = validateName(input.value);
      break;
    case "weight":
      validation = validateWeight(input.value);
      break;
    case "color":
      validation = validateColor(input.value);
      break;
    default:
      return;
  }

  if (!validation.valid) {
    setFieldError(input, validation.message);
    return;
  }

  setFieldError(input, "");
  candidate[input.dataset.field] = validation.value;
  if (input.dataset.field === "color") {
    input.value = validation.value;
    input.setAttribute("aria-label", `색상: ${validation.value}`);
  }
  if (input.dataset.field === "name") {
    row.querySelector(".delete-button").setAttribute("aria-label", `${validation.value} 삭제`);
  }

  updateProbabilities();
  drawWheel();
}

function renderCandidates() {
  candidateList.replaceChildren(...candidates.map(makeCandidateRow));
  candidateCount.textContent = `${candidates.length} / ${MAX_CANDIDATES}개`;
  addCandidateButton.disabled = candidates.length >= MAX_CANDIDATES;
  addCandidateButton.setAttribute("aria-disabled", String(addCandidateButton.disabled));
  spinButton.disabled = true;
  updateProbabilities();
  drawWheel();
}

function drawWheel() {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;

  const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
  const bounds = canvas.getBoundingClientRect();
  const style = window.getComputedStyle(canvas);
  const borderWidth = Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.borderRightWidth);
  const cssSize = Math.max(1, bounds.width - borderWidth);
  const size = Math.max(1, Math.round(cssSize * pixelRatio));
  if (canvas.width !== size || canvas.height !== size) {
    canvas.width = size;
    canvas.height = size;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const center = cssSize / 2;
  const radius = Math.max(1, center - 8);
  context.clearRect(0, 0, cssSize, cssSize);

  if (candidates.length === 0) {
    context.fillStyle = "#8794a8";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "600 14px sans-serif";
    context.fillText("후보를 추가해 주세요", center, center);
    return;
  }

  const totalWeight = getTotalWeight();
  let startAngle = POINTER_ANGLE;
  candidates.forEach((candidate) => {
    const sliceAngle = TAU * candidate.weight / totalWeight;
    const endAngle = startAngle + sliceAngle;

    context.beginPath();
    context.moveTo(center, center);
    context.arc(center, center, radius, startAngle, endAngle);
    context.closePath();
    context.fillStyle = candidate.color;
    context.fill();
    context.strokeStyle = "#ffffff";
    context.lineWidth = Math.max(2, cssSize * 0.008);
    context.stroke();

    drawCandidateLabel(context, candidate.name, startAngle, endAngle, center, radius);
    startAngle = endAngle;
  });

  context.beginPath();
  context.arc(center, center, radius, 0, TAU);
  context.strokeStyle = "rgba(45, 66, 98, .14)";
  context.lineWidth = 1;
  context.stroke();
}

function drawCandidateLabel(context, name, startAngle, endAngle, center, radius) {
  const sliceAngle = endAngle - startAngle;
  const labelRadius = radius * 0.62;
  const availableWidth = 2 * labelRadius * Math.sin(Math.min(Math.PI, sliceAngle) / 2) * 0.88;
  const midAngle = startAngle + sliceAngle / 2;
  const normalizedMid = ((midAngle % TAU) + TAU) % TAU;
  if (sliceAngle < 0.2 || availableWidth < 18) return;

  context.save();
  context.translate(center + Math.cos(midAngle) * labelRadius, center + Math.sin(midAngle) * labelRadius);
  let rotation = midAngle;
  if (normalizedMid > Math.PI / 2 && normalizedMid < Math.PI * 1.5) rotation += Math.PI;
  context.rotate(rotation);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#253047";

  let fontSize = Math.min(18, Math.max(10, radius * 0.1));
  context.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
  while (fontSize > 9 && context.measureText(name).width > availableWidth) {
    fontSize -= 1;
    context.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
  }
  if (context.measureText(name).width <= availableWidth) context.fillText(name, 0, 0);
  context.restore();
}

candidateList.addEventListener("input", (event) => {
  if (!(event.target instanceof HTMLInputElement)) return;
  if (event.target.dataset.field !== "color") updateCandidateFromInput(event.target);
});

candidateList.addEventListener("change", (event) => {
  if (!(event.target instanceof HTMLInputElement)) return;
  const input = event.target;
  updateCandidateFromInput(input);
  if (input.dataset.field === "name" && !input.getAttribute("aria-invalid")) {
    const candidate = candidates.find((item) => item.id === input.closest(".candidate-row").dataset.candidateId);
    if (candidate) input.value = candidate.name;
  }
});

candidateList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action=\"delete\"]");
  if (!button) return;
  const row = button.closest(".candidate-row");
  candidates = candidates.filter((candidate) => candidate.id !== row.dataset.candidateId);
  candidateNotice.textContent = "후보를 삭제했어요.";
  renderCandidates();
});

addCandidateButton.addEventListener("click", () => {
  if (candidates.length >= MAX_CANDIDATES) {
    candidateNotice.textContent = `후보는 최대 ${MAX_CANDIDATES}개까지 추가할 수 있어요.`;
    return;
  }
  const candidate = {
    id: `candidate-${nextCandidateId++}`,
    name: "새 후보",
    weight: 1,
    color: "#62B79A",
  };
  candidates.push(candidate);
  candidateNotice.textContent = "후보를 추가했어요.";
  renderCandidates();
  document.getElementById(`${candidate.id}-name`).focus();
});

if (canvas) {
  renderCandidates();
  if ("ResizeObserver" in window) {
    new ResizeObserver(drawWheel).observe(canvas);
  } else {
    window.addEventListener("resize", drawWheel);
  }
}
