/* logo-util.js — tratamiento del logo, para las páginas de DerLabs que no cargan app.js
   (hoy: altas.html). Es la misma lógica de procesarLogo() e iconoDeLogo() de app.js y
   generar-tienda.html: si se cambia una, cambiar las tres. */
/* Logo: conserva transparencia (PNG/WebP), quita el fondo liso, limpia el
   borde y recorta lo vacío. Se guarda hasta 1000x800 px: el splash lo
   muestra casi a pantalla completa y con menos resolución se ve pixelado. */
function procesarLogo(dataURL){
  return new Promise(function(resolve, reject){
    const img = new Image();
    img.onload = function(){
      /* fotos enormes: se trabajan a 1600 px como máximo para no trabar el teléfono */
      const e0 = Math.min(1, 1600 / Math.max(img.width, img.height, 1));
      const W = Math.max(1, Math.round(img.width * e0)), H = Math.max(1, Math.round(img.height * e0));
      const c0 = document.createElement("canvas"); c0.width = W; c0.height = H;
      const x0 = c0.getContext("2d"); x0.imageSmoothingQuality = "high"; x0.drawImage(img, 0, 0, W, H);
      let datos = null; try { datos = x0.getImageData(0, 0, W, H); } catch(e){ datos = null; }
      let minX = 0, minY = 0, maxX = W - 1, maxY = H - 1;
      if (datos){
        const px = datos.data;
        const dif = function(i, r, g, b){ return Math.abs(px[i]-r) + Math.abs(px[i+1]-g) + Math.abs(px[i+2]-b); };
        /* Fondo liso (las 4 esquinas del mismo color): se vuelve transparente,
           rellenando solo desde los bordes para no borrar partes internas del logo. */
        const esq = [0, (W-1)*4, (H-1)*W*4, ((H-1)*W + W-1)*4];
        const r0 = px[0], g0 = px[1], b0 = px[2];
        const opaco = esq.every(function(i){ return px[i+3] > 240; });
        const liso = opaco && esq.every(function(i){ return dif(i, r0, g0, b0) < 30; });
        if (liso){
          const TOL = 70, N = W * H, visto = new Uint8Array(N), pila = [];
          const empujar = function(x, y){ const k = y*W + x; if (!visto[k] && dif(k*4, r0, g0, b0) < TOL){ visto[k] = 1; pila.push(k); } };
          for (let x = 0; x < W; x++){ empujar(x, 0); empujar(x, H-1); }
          for (let y = 0; y < H; y++){ empujar(0, y); empujar(W-1, y); }
          while (pila.length){
            const k = pila.pop(), x = k % W, y = (k - x) / W;
            if (x > 0) empujar(x-1, y); if (x < W-1) empujar(x+1, y);
            if (y > 0) empujar(x, y-1); if (y < H-1) empujar(x, y+1);
          }
          /* Borde limpio. Los píxeles pegados al fondo vienen mezclados con él
             (en un JPG, además, con un halo): si solo se borra el fondo queda un
             filo claro y dentado. A las 3 capas del borde se les devuelve el color
             del interior del logo y se les da la transparencia que les toca. */
          const CAPAS = 3, capa = new Uint8Array(N), porCapa = [];
          let frente = [];
          for (let k = 0; k < N; k++){
            if (visto[k]) continue;
            const x = k % W, y = (k - x) / W;
            if ((x > 0 && visto[k-1]) || (x < W-1 && visto[k+1]) || (y > 0 && visto[k-W]) || (y < H-1 && visto[k+W])){ capa[k] = 1; frente.push(k); }
          }
          porCapa[1] = frente;
          for (let L = 2; L <= CAPAS; L++){
            const sig = [];
            for (let j = 0; j < frente.length; j++){
              const k = frente[j], x = k % W, y = (k - x) / W;
              const ver = function(q){ if (!visto[q] && !capa[q]){ capa[q] = L; sig.push(q); } };
              if (x > 0) ver(k-1); if (x < W-1) ver(k+1); if (y > 0) ver(k-W); if (y < H-1) ver(k+W);
            }
            porCapa[L] = sig; frente = sig;
          }
          /* color "real" de cada píxel del borde: promedio de sus vecinos más adentro */
          const fr = new Float32Array(N), fg = new Float32Array(N), fb = new Float32Array(N), tiene = new Uint8Array(N);
          for (let L = CAPAS; L >= 1; L--){
            const lista = porCapa[L];
            for (let j = 0; j < lista.length; j++){
              const k = lista[j], x = k % W, y = (k - x) / W;
              let sr = 0, sg = 0, sb = 0, n = 0;
              for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++){
                if (!dx && !dy) continue;
                const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
                const q = yy * W + xx; if (visto[q]) continue;
                if (!capa[q]){ sr += px[q*4]; sg += px[q*4+1]; sb += px[q*4+2]; n++; }
                else if (capa[q] > L && tiene[q]){ sr += fr[q]; sg += fg[q]; sb += fb[q]; n++; }
              }
              if (n){ fr[k] = sr / n; fg[k] = sg / n; fb[k] = sb / n; tiene[k] = 1; }
            }
          }
          for (let k = 0; k < N; k++){
            if (visto[k]){ px[k*4+3] = 0; continue; }
            if (!capa[k]) continue;
            const i = k * 4, d = dif(i, r0, g0, b0);
            if (tiene[k]){
              const dF = Math.abs(fr[k]-r0) + Math.abs(fg[k]-g0) + Math.abs(fb[k]-b0);
              if (dF < 60) continue;                         /* esa parte del logo es casi del color del fondo: no se toca */
              const a = Math.min(1, d / dF);
              if (a > 0.96) continue;
              px[i] = Math.round(fr[k]); px[i+1] = Math.round(fg[k]); px[i+2] = Math.round(fb[k]);
              px[i+3] = Math.round(px[i+3] * a);
            } else if (capa[k] === 1 && d < 180){             /* trazos muy finos: borde suave simple */
              px[i+3] = Math.round(px[i+3] * d / 180);
            }
          }
          x0.putImageData(datos, 0, 0);
        }
        /* Recorte: todo lo transparente (o del color de fondo) alrededor del logo */
        const a0 = px[3];
        const vacio = function(i){ return px[i+3] < 16 || (a0 >= 16 && dif(i, r0, g0, b0) < 40); };
        minX = W; minY = H; maxX = -1; maxY = -1;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
          if (!vacio((y*W + x) * 4)){ if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
        }
        if (maxX < 0){ minX = 0; minY = 0; maxX = W - 1; maxY = H - 1; }
        const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.02);
        minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
        maxX = Math.min(W - 1, maxX + pad); maxY = Math.min(H - 1, maxY + pad);
      }
      const w = maxX - minX + 1, h = maxY - minY + 1;
      /* Se guarda dentro de la configuración de la tienda: si pesa mucho, se achica de a poco */
      const PESO_MAX = 300000;
      let esc = Math.min(1, 1000 / w, 800 / h), out = "";
      for (let intento = 0; intento < 6; intento++){
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(w * esc)); c.height = Math.max(1, Math.round(h * esc));
        const x = c.getContext("2d"); x.imageSmoothingQuality = "high";
        x.drawImage(c0, minX, minY, w, h, 0, 0, c.width, c.height);
        out = c.toDataURL("image/png");
        if (out.length > PESO_MAX){ const wp = c.toDataURL("image/webp", 0.9); if (wp.indexOf("data:image/webp") === 0 && wp.length < out.length) out = wp; }
        if (out.length <= PESO_MAX) break;
        esc *= 0.8;
      }
      resolve(out);
    };
    img.onerror = function(){ reject(new Error("No se pudo cargar la imagen")); };
    img.src = dataURL;
  });
}

/* Ícono cuadrado a partir del logo (pestaña del navegador y acceso directo):
   el logo completo, centrado sobre fondo transparente y sin deformarlo. */
function iconoDeLogo(dataURL, lado){
  return new Promise(function(resolve){
    const img = new Image();
    img.onload = function(){
      try {
        const L = lado || 256, c = document.createElement("canvas"); c.width = L; c.height = L;
        const x = c.getContext("2d"); x.imageSmoothingQuality = "high";
        const m = Math.round(L * 0.04), e = Math.min((L - 2*m) / img.width, (L - 2*m) / img.height);
        const w = img.width * e, h = img.height * e;
        x.drawImage(img, (L - w) / 2, (L - h) / 2, w, h);
        resolve(c.toDataURL("image/png"));
      } catch(err){ resolve(""); }
    };
    img.onerror = function(){ resolve(""); };
    img.src = dataURL;
  });
}
