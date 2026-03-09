function buildTileLUTs(gray, w, h, tileSize, clipLimit) {

    const bins = 256;
    const tilesX = Math.ceil(w / tileSize);
    const tilesY = Math.ceil(h / tileSize);

    const luts = Array.from({ length: tilesY }, () =>
        Array.from({ length: tilesX }, () => new Uint8Array(bins))
    );

    for (let ty = 0; ty < tilesY; ty++) {
        for (let tx = 0; tx < tilesX; tx++) {

            const hist = new Uint32Array(bins);

            const x0 = tx * tileSize;
            const y0 = ty * tileSize;
            const x1 = Math.min(x0 + tileSize, w);
            const y1 = Math.min(y0 + tileSize, h);

            // ---- 1️⃣ Build Histogram ----
            for (let y = y0; y < y1; y++) {
                const row = y * w;
                for (let x = x0; x < x1; x++) {
                    hist[gray[row + x]]++;
                }
            }

            const tileArea = (x1 - x0) * (y1 - y0);

            // ---- 2️⃣ Integer Clip Threshold ----
            const maxPerBin = Math.floor(clipLimit * tileArea);

            let excess = 0;

            for (let i = 0; i < bins; i++) {
                if (hist[i] > maxPerBin) {
                    excess += hist[i] - maxPerBin;
                    hist[i] = maxPerBin;
                }
            }

            // ---- 3️⃣ Uniform Integer Redistribution ----
            const redist = Math.floor(excess / bins);
            const remainder = excess % bins;

            for (let i = 0; i < bins; i++) {
                hist[i] += redist;
            }

            // distribute remainder evenly
            for (let i = 0; i < remainder; i++) {
                hist[i]++;
            }

            // ---- 4️⃣ Build LUT via CDF ----
            let acc = 0;
            const scale = 255 / tileArea;

            for (let i = 0; i < bins; i++) {
                acc += hist[i];
                luts[ty][tx][i] = Math.min(255, Math.round(acc * scale));
            }
        }
    }

    return { luts, tilesX, tilesY };
}

function claheGrayBilinear(gray, w, h, tileSize, luts, tilesX, tilesY) {
    const out = new Uint8ClampedArray(gray.length);

    for (let y = 0; y < h; y++) {

        // Map pixel into tile grid space
        const gy = (y + 0.5) / tileSize - 0.5;
        let ty = Math.floor(gy);
        const fy = gy - ty;

        ty = Math.max(0, Math.min(ty, tilesY - 1));
        const ty1 = Math.min(ty + 1, tilesY - 1);

        for (let x = 0; x < w; x++) {

            const gx = (x + 0.5) / tileSize - 0.5;
            let tx = Math.floor(gx);
            const fx = gx - tx;

            tx = Math.max(0, Math.min(tx, tilesX - 1));
            const tx1 = Math.min(tx + 1, tilesX - 1);

            const g = gray[y * w + x];

            const v_tl = luts[ty][tx][g];
            const v_tr = luts[ty][tx1][g];
            const v_bl = luts[ty1][tx][g];
            const v_br = luts[ty1][tx1][g];

            const w_tl = (1 - fx) * (1 - fy);
            const w_tr = fx * (1 - fy);
            const w_bl = (1 - fx) * fy;
            const w_br = fx * fy;

            out[y * w + x] =
                v_tl * w_tl +
                v_tr * w_tr +
                v_bl * w_bl +
                v_br * w_br;
        }
    }

    return out;
}

export function applyCLAHE(Lfloat, width, height, tileSize, clipLimit) {

    const size = width * height;

    // ---- 1️⃣ Float → Uint8 ----
    const L = new Uint8Array(size);

    for (let i = 0; i < size; i++) {
        let v = Lfloat[i] * 255;
        v = v < 0 ? 0 : v > 255 ? 255 : v;
        L[i] = v | 0;
    }

    // ---- 2️⃣ Build LUTs ----
    const { luts, tilesX, tilesY } =
        buildTileLUTs(L, width, height, tileSize, clipLimit);

    // ---- 3️⃣ Interpolate ----
    const Leq = claheGrayBilinear(
        L,
        width,
        height,
        tileSize,
        luts,
        tilesX,
        tilesY
    );

    // ---- 4️⃣ Uint8 → Float ----
    const Lout = new Float32Array(size);

    for (let i = 0; i < size; i++) {
        Lout[i] = Leq[i] / 255;
    }

    return Lout;
}