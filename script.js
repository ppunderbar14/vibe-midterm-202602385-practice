"use strict";

const STORAGE_KEY = "vibeRoulette:v1";
const STORAGE_VERSION = 1;
const MAX_CANDIDATES = 20;
const TAU = Math.PI * 2;
const POINTER_ANGLE = -Math.PI / 2;
const SPIN_DURATION = 4200;
const MIN_SPIN_TURNS = 5;
const TARGET_EDGE_MARGIN = 1e-9;
const starterCandidates = [
  { id: "korean", name: "한식", weight: 1, color: "#5B8DEF" },
  { id: "chinese", name: "중식", weight: 1, color: "#8B75DE" },
  { id: "japanese", name: "일식", weight: 1, color: "#E9A94F" },
  { id: "western", name: "양식", weight: 1, color: "#E77F78" },
];

let candidates = starterCandidates.map((candidate) => ({ ...candidate }));
let nextCandidateId = 1;
let presets = [];
let isSpinning = false;
let rotationAngle = 0;
let animationFrameId = 0;

const canvas = document.querySelector("#wheel");
const candidateList = document.querySelector("#candidate-list");
const candidateCount = document.querySelector("#candidate-count");
const candidateNotice = document.querySelector("#candidate-notice");
const addCandidateButton = document.querySelector("#add-candidate");
const spinButton = document.querySelector(".spin-button");

const presetNameInput = document.querySelector("#preset-name");
const presetSelect = document.querySelector("#preset-select");
const savePresetButton = document.querySelector("#save-preset");
const loadPresetButton = document.querySelector("#load-preset");
const deletePresetButton = document.querySelector("#delete-preset");
const presetNotice = document.querySelector("#preset-notice");
const storageNotice = document.querySelector("#storage-notice");

function copyCandidates(list) {
  return list.map(({ id, name, weight, color }) => ({ id, name, weight, color }));
}

function validateStoredCandidates(list) {
  if (!Array.isArray(list) || list.length > MAX_CANDIDATES) throw new Error("Invalid candidate list");
  const ids = new Set();
  return list.map((item) => {
    if (!item || typeof item !== "object" || typeof item.id !== "string"
        || !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(item.id) || ids.has(item.id)
        || typeof item.name !== "string" || !validateName(item.name).valid
        || typeof item.weight !== "number" || !validateWeight(String(item.weight)).valid
        || typeof item.color !== "string" || !validateColor(item.color).valid) {
      throw new Error("Invalid candidate data");
    }
    ids.add(item.id);
    return { id: item.id, name: item.name.trim(), weight: item.weight, color: item.color.toUpperCase() };
  });
}

function restoreState() {
  let raw;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    storageNotice.textContent = "브라우저 저장소에 접근할 수 없어요. 현재 화면에서는 사용할 수 있지만 새로고침하면 유지되지 않을 수 있어요.";
    return;
  }
  if (raw === null) return;
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== STORAGE_VERSION || !Array.isArray(data.presets)) {
      throw new Error("Unsupported storage data");
    }
    const restoredCandidates = validateStoredCandidates(data.candidates);
    const names = new Set();
    const restoredPresets = data.presets.map((preset) => {
      if (!preset || typeof preset.name !== "string" || !validateName(preset.name).valid
          || names.has(preset.name.trim())) throw new Error("Invalid preset data");
      const name = preset.name.trim();
      names.add(name);
      return { name, candidates: validateStoredCandidates(preset.candidates) };
    });
    candidates = restoredCandidates;
    presets = restoredPresets;
    storageNotice.textContent = "저장된 후보와 프리셋을 불러왔어요.";
  } catch {
    storageNotice.textContent = "저장 데이터가 올바르지 않거나 지원하지 않는 형식이에요. 기본 후보로 시작하며 원본은 변경하지 않았어요. 이후 후보나 프리셋을 변경하면 새 상태를 저장해요.";
  }
}

function persistState() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION, candidates: copyCandidates(candidates),
      presets: presets.map((preset) => ({ name: preset.name, candidates: copyCandidates(preset.candidates) })),
    }));
    storageNotice.textContent = "현재 후보와 프리셋을 이 브라우저에 저장했어요.";
    return true;
  } catch {
    storageNotice.textContent = "브라우저에 저장하지 못했어요. 현재 화면에서는 계속 사용할 수 있지만 새로고침하면 변경 사항이 유지되지 않을 수 있어요.";
    return false;
  }
}

function updatePresetControls() {
  presetNameInput.disabled = isSpinning;
  savePresetButton.disabled = isSpinning;
  presetSelect.disabled = isSpinning || presets.length === 0;
  const selected = presets.some((preset) => preset.name === presetSelect.value);
  loadPresetButton.disabled = isSpinning || !selected;
  deletePresetButton.disabled = isSpinning || !selected;
}

function renderPresets(selectedName = presetSelect.value) {
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = presets.length ? "프리셋을 선택해 주세요" : "저장된 프리셋이 없어요";
  presetSelect.replaceChildren(placeholder, ...presets.map((preset) => {
    const option = document.createElement("option");
    option.value = preset.name;
    option.textContent = preset.name;
    return option;
  }));
  presetSelect.value = selectedName;
  if (presetSelect.selectedIndex < 0) presetSelect.value = "";
  updatePresetControls();
}

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
  if (isSpinning) return;
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
  persistState();
}

function renderCandidates() {
  candidateList.replaceChildren(...candidates.map(makeCandidateRow));
  candidateCount.textContent = `${candidates.length} / ${MAX_CANDIDATES}개`;
  addCandidateButton.disabled = candidates.length >= MAX_CANDIDATES;
  addCandidateButton.setAttribute("aria-disabled", String(addCandidateButton.disabled));
  spinButton.disabled = isSpinning || candidates.length < 2;
  candidateList.querySelectorAll("input, button").forEach((control) => {
    control.disabled = isSpinning;
  });
  addCandidateButton.disabled = isSpinning || candidates.length >= MAX_CANDIDATES;
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
  let startAngle = rotationAngle;
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

function normalizeAngle(angle) {
  return ((angle % TAU) + TAU) % TAU;
}

function getWheelSegments(snapshot) {
  const totalWeight = snapshot.reduce((total, candidate) => total + candidate.weight, 0);
  let startAngle = 0;
  return snapshot.map((candidate, index) => {
    const endAngle = index === snapshot.length - 1
      ? TAU
      : startAngle + TAU * candidate.weight / totalWeight;
    const segment = { candidate, startAngle, endAngle };
    startAngle = endAngle;
    return segment;
  });
}

function candidateAtPointer(snapshot, angle) {
  const localAngle = normalizeAngle(POINTER_ANGLE - angle);
  const segments = getWheelSegments(snapshot);
  return segments.find((segment) => localAngle >= segment.startAngle && localAngle < segment.endAngle)?.candidate
    ?? segments[segments.length - 1]?.candidate
    ?? null;
}

function chooseTarget(snapshot) {
  const segments = getWheelSegments(snapshot);
  const totalWeight = snapshot.reduce((total, candidate) => total + candidate.weight, 0);
  const targetWeight = Math.random() * totalWeight;
  let cumulativeWeight = 0;

  for (const segment of segments) {
    cumulativeWeight += segment.candidate.weight;
    if (targetWeight < cumulativeWeight) {
      const fraction = (targetWeight - (cumulativeWeight - segment.candidate.weight)) / segment.candidate.weight;
      const sliceAngle = segment.endAngle - segment.startAngle;
      const edgeMargin = Math.min(TARGET_EDGE_MARGIN, sliceAngle / 4);
      const rawTargetAngle = segment.startAngle + sliceAngle * fraction;
      const targetAngle = Math.min(
        segment.endAngle - edgeMargin,
        Math.max(segment.startAngle + edgeMargin, rawTargetAngle),
      );
      return { targetAngle, candidate: segment.candidate };
    }
  }

  const last = segments[segments.length - 1];
  return { targetAngle: last.endAngle - Math.min(TARGET_EDGE_MARGIN, (last.endAngle - last.startAngle) / 4), candidate: last.candidate };
}

function setInteractionLock(locked) {
  isSpinning = locked;
  candidateList.querySelectorAll("input, button").forEach((control) => {
    control.disabled = locked;
  });
  addCandidateButton.disabled = locked || candidates.length >= MAX_CANDIDATES;
  addCandidateButton.setAttribute("aria-disabled", String(addCandidateButton.disabled));
  spinButton.disabled = locked || candidates.length < 2;
  updatePresetControls();
}

function spinWheel() {
  if (isSpinning || candidates.length < 2) return;

  const snapshot = candidates.map((candidate) => ({ ...candidate }));
  if (snapshot.some((candidate) => !validateName(candidate.name).valid
      || !validateWeight(String(candidate.weight)).valid
      || !validateColor(candidate.color).valid)) {
    candidateNotice.textContent = "후보 정보를 확인한 뒤 다시 돌려 주세요.";
    return;
  }

  const { targetAngle } = chooseTarget(snapshot);
  const currentPointerAngle = normalizeAngle(POINTER_ANGLE - rotationAngle);
  const targetOffset = normalizeAngle(currentPointerAngle - targetAngle);
  const startRotation = rotationAngle;
  const finalRotation = startRotation + MIN_SPIN_TURNS * TAU + targetOffset;
  const startedAt = performance.now();
  let settled = false;

  setInteractionLock(true);
  candidateNotice.textContent = "룰렛이 돌아가는 동안 후보를 수정할 수 없어요.";
  resultText.textContent = "룰렛이 돌아가고 있어요…";

  function finishSpin() {
    rotationAngle = finalRotation;
    drawWheel();
    const winner = candidateAtPointer(snapshot, rotationAngle);
    if (!winner) throw new Error("회전 종료 각도에서 후보를 찾지 못했습니다.");
    resultText.textContent = `오늘의 선택은 ${winner.name}입니다!`;
    candidateNotice.textContent = `${winner.name}이(가) 선택됐어요.`;
    settled = true;
    setInteractionLock(false);
    renderCandidates();
  }

  function recoverSpin(error) {
    rotationAngle = startRotation;
    setInteractionLock(false);
    resultText.textContent = "룰렛 회전을 완료하지 못했어요. 다시 시도해 주세요.";
    candidateNotice.textContent = "회전 중 오류가 발생해 조작을 복구했어요.";
    try {
      drawWheel();
    } catch (renderError) {
      console.error("원판 복구 오류:", renderError);
    }
    console.error("룰렛 회전 오류:", error);
  }

  function animate(now) {
    try {
      const progress = Math.min(1, Math.max(0, (now - startedAt) / SPIN_DURATION));
      const easedProgress = 1 - (1 - progress) ** 4;
      rotationAngle = startRotation + (finalRotation - startRotation) * easedProgress;
      drawWheel();

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      finishSpin();
    } catch (error) {
      recoverSpin(error);
    } finally {
      if (settled || !isSpinning) animationFrameId = 0;
    }
  }

  try {
    animationFrameId = requestAnimationFrame(animate);
  } catch (error) {
    recoverSpin(error);
    animationFrameId = 0;
  }
}

const resultText = document.querySelector(".result > span:last-child");

spinButton.addEventListener("click", spinWheel);

candidateList.addEventListener("input", (event) => {
  if (isSpinning) return;
  if (!(event.target instanceof HTMLInputElement)) return;
  if (event.target.dataset.field !== "color") updateCandidateFromInput(event.target);
});

candidateList.addEventListener("change", (event) => {
  if (isSpinning) return;
  if (!(event.target instanceof HTMLInputElement)) return;
  const input = event.target;
  updateCandidateFromInput(input);
  if (input.dataset.field === "name" && input.getAttribute("aria-invalid") !== "true") {
    const candidate = candidates.find((item) => item.id === input.closest(".candidate-row").dataset.candidateId);
    if (candidate) input.value = candidate.name;
  }
});

candidateList.addEventListener("click", (event) => {
  if (isSpinning) return;
  const button = event.target.closest("button[data-action=\"delete\"]");
  if (!button) return;
  const row = button.closest(".candidate-row");
  candidates = candidates.filter((candidate) => candidate.id !== row.dataset.candidateId);
  candidateNotice.textContent = "후보를 삭제했어요.";
  renderCandidates();
  persistState();
});

addCandidateButton.addEventListener("click", () => {
  if (isSpinning) return;
  if (candidates.length >= MAX_CANDIDATES) {
    candidateNotice.textContent = `후보는 최대 ${MAX_CANDIDATES}개까지 추가할 수 있어요.`;
    return;
  }
  while (candidates.some((item) => item.id === `candidate-${nextCandidateId}`)) nextCandidateId += 1;
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
  persistState();
});

presetSelect.addEventListener("change", updatePresetControls);
presetNameInput.addEventListener("input", () => {
  presetNameInput.removeAttribute("aria-invalid");
  presetNotice.textContent = "";
});
savePresetButton.addEventListener("click", () => {
  if (isSpinning) return;
  const validation = validateName(presetNameInput.value);
  if (!validation.valid) {
    presetNameInput.setAttribute("aria-invalid", "true");
    presetNotice.textContent = "프리셋 이름은 앞뒤 공백 제거 후 1~30자로 입력해 주세요.";
    return;
  }
  const name = validation.value;
  const existing = presets.find((preset) => preset.name === name);
  if (existing && !window.confirm(`“${name}” 프리셋을 덮어쓸까요?`)) {
    presetNotice.textContent = "덮어쓰기를 취소했어요.";
    return;
  }
  const saved = { name, candidates: copyCandidates(candidates) };
  if (existing) presets[presets.indexOf(existing)] = saved;
  else presets.push(saved);
  presetNameInput.value = name;
  presetNameInput.removeAttribute("aria-invalid");
  presetNotice.textContent = "프리셋을 저장했어요.";
  renderPresets(name);
  persistState();
});
loadPresetButton.addEventListener("click", () => {
  if (isSpinning) return;
  const preset = presets.find((item) => item.name === presetSelect.value);
  if (!preset) return;
  candidates = copyCandidates(preset.candidates);
  rotationAngle = 0;
  resultText.textContent = "룰렛을 돌려 오늘의 선택을 확인해 보세요.";
  candidateNotice.textContent = "프리셋의 후보 목록을 불러왔어요.";
  renderCandidates();
  persistState();
  presetNotice.textContent = "프리셋을 불러왔어요.";
});
deletePresetButton.addEventListener("click", () => {
  if (isSpinning) return;
  const index = presets.findIndex((preset) => preset.name === presetSelect.value);
  if (index < 0) return;
  presets.splice(index, 1);
  renderPresets();
  persistState();
  presetNotice.textContent = "프리셋을 삭제했어요.";
});

if (canvas) {
  restoreState();
  renderCandidates();
  renderPresets();
  if ("ResizeObserver" in window) {
    new ResizeObserver(drawWheel).observe(canvas);
  } else {
    window.addEventListener("resize", drawWheel);
  }
}
