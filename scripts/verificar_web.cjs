// Verifica RNF-03 (sin desplazamiento horizontal) y RNF-04 (carga < 3 s) con Playwright sobre `npm run preview`.
const { chromium } = require("playwright");
const rutas = ["/", "/demanda", "/menu", "/menu/Efo%20Riro", "/alertas", "/cargar", "/confiabilidad"];
const anchos = [360, 768, 1280];
(async () => {
  const b = await chromium.launch();
  let fallos = 0;
  for (const w of anchos) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
    const p = await ctx.newPage();
    for (const r of rutas) {
      const t0 = Date.now();
      await p.goto("http://localhost:4173" + r, { waitUntil: "networkidle" });
      await p.waitForSelector("h1");
      const ms = Date.now() - t0;
      const sobra = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const ok = sobra <= 0 && ms < 3000;
      if (!ok) fallos++;
      console.log(`${ok ? "OK " : "FALLA"} ${w}px ${r} carga=${ms}ms desbordeHorizontal=${sobra}px`);
      await p.screenshot({ path: `results/capturas/${w}${r.replace(/[\/%]/g, "_")}.png`, fullPage: true });
    }
    await ctx.close();
  }
  // Carga de un CSV en el navegador
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto("http://localhost:4173/cargar", { waitUntil: "networkidle" });
  await p.setInputFiles("#archivo", "data/raw/Anonymized_Restaurant_Sales_Data.csv");
  await p.waitForSelector("text=Archivo cargado");
  console.log("Carga CSV:", (await p.locator("section.tarjeta ul").innerText()).replace(/\n/g, " | "));
  await p.screenshot({ path: "results/capturas/1280_cargar_resultado.png", fullPage: true });
  await p.click("text=Volver a los datos originales");
  await p.waitForSelector("text=datos originales del restaurante");
  await b.close();
  process.exit(fallos ? 1 : 0);
})();
