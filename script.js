"use strict";

// This step only provides a friendly Canvas placeholder. Roulette behavior is
// intentionally reserved for the next implementation step.
const canvas = document.querySelector("#wheel");

if (canvas) {
  const context = canvas.getContext("2d");

  if (context) {
    const center = canvas.width / 2;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#8794a8";
    context.font = "600 25px -apple-system, BlinkMacSystemFont, sans-serif";
    context.fillText("룰렛 화면을 준비하고 있어요", center, center - 10);
    context.fillStyle = "#a3adbc";
    context.font = "20px -apple-system, BlinkMacSystemFont, sans-serif";
    context.fillText("다음 단계에서 원판이 완성돼요", center, center + 30);
  }
}
