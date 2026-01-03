document.addEventListener("mousemove", (e) => {
  const bg = document.querySelector(".login-bg");
  if (!bg) return;

  const x = (e.clientX / window.innerWidth - 0.5) * 10;
  const y = (e.clientY / window.innerHeight - 0.5) * 10;

  bg.style.transform = `scale(1.12) translate(${x}px, ${y}px)`;
});

/* Mobile subtle drift (no mouse) */
let mobileOffset = 0;

setInterval(() => {
  const bg = document.querySelector(".login-bg");
  if (!bg) return;

  mobileOffset += 0.15;
  bg.style.transform = `scale(1.12) translateY(${Math.sin(mobileOffset) * 4}px)`;
}, 50);