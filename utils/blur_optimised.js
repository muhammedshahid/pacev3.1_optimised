const LUT_SIZE = 1024;

const sigma = 0.1;

const weightLUT = new Float32Array(LUT_SIZE);

for (let i = 0; i < LUT_SIZE; i++) {

    const d = i / (LUT_SIZE - 1);

    weightLUT[i] = Math.exp(-(d * d) / sigma);

}


export function boxBlurAlphaMap(alphaMap, width, height) {

    const n = alphaMap.length;

    const temp = new Float32Array(n);
    const out = new Float32Array(n);

    const inv3 = 1 / 3;

    /* -------- Horizontal pass -------- */

    for (let y = 0; y < height; y++) {

        const row = y * width;

        for (let x = 1; x < width - 1; x++) {

            const i = row + x;

            temp[i] =
                (alphaMap[i - 1] +
                 alphaMap[i] +
                 alphaMap[i + 1]) * inv3;
        }
    }

    /* -------- Vertical pass -------- */

    const w = width;

    for (let y = 1; y < height - 1; y++) {

        const row = y * w;

        for (let x = 0; x < width; x++) {

            const i = row + x;

            out[i] =
                (temp[i - w] +
                 temp[i] +
                 temp[i + w]) * inv3;
        }
    }

    return out;
}

/* 
Recommended parameters
Start with:
sigma = 0.1
radius = 1

If alpha transitions look too sharp:
sigma = 0.15

If edges leak:
sigma = 0.05
*/
export function guidedAlphaSmoothing(alphaMap, L, width, height) {

    const n = alphaMap.length;

    const out = new Float32Array(n);

    const lutScale = LUT_SIZE - 1;

    for (let y = 1; y < height - 1; y++) {

        const row = y * width;

        for (let x = 1; x < width - 1; x++) {

            const i = row + x;

            const centerL = L[i];

            let sum = 0;
            let wsum = 0;

            const j0 = i - width - 1;
            const j1 = i - width;
            const j2 = i - width + 1;

            const j3 = i - 1;
            const j4 = i;
            const j5 = i + 1;

            const j6 = i + width - 1;
            const j7 = i + width;
            const j8 = i + width + 1;

            const idx0 = Math.min(Math.abs(L[j0] - centerL) * lutScale | 0, lutScale);
            const idx1 = Math.min(Math.abs(L[j1] - centerL) * lutScale | 0, lutScale);
            const idx2 = Math.min(Math.abs(L[j2] - centerL) * lutScale | 0, lutScale);

            const idx3 = Math.min(Math.abs(L[j3] - centerL) * lutScale | 0, lutScale);
            const idx4 = 0;
            const idx5 = Math.min(Math.abs(L[j5] - centerL) * lutScale | 0, lutScale);

            const idx6 = Math.min(Math.abs(L[j6] - centerL) * lutScale | 0, lutScale);
            const idx7 = Math.min(Math.abs(L[j7] - centerL) * lutScale | 0, lutScale);
            const idx8 = Math.min(Math.abs(L[j8] - centerL) * lutScale | 0, lutScale);

            const w0 = weightLUT[idx0];
            const w1 = weightLUT[idx1];
            const w2 = weightLUT[idx2];

            const w3 = weightLUT[idx3];
            const w4 = weightLUT[idx4];
            const w5 = weightLUT[idx5];

            const w6 = weightLUT[idx6];
            const w7 = weightLUT[idx7];
            const w8 = weightLUT[idx8];

            sum =
                alphaMap[j0] * w0 +
                alphaMap[j1] * w1 +
                alphaMap[j2] * w2 +
                alphaMap[j3] * w3 +
                alphaMap[j4] * w4 +
                alphaMap[j5] * w5 +
                alphaMap[j6] * w6 +
                alphaMap[j7] * w7 +
                alphaMap[j8] * w8;

            wsum =
                w0 + w1 + w2 +
                w3 + w4 + w5 +
                w6 + w7 + w8;

            out[i] = sum / (wsum + 1e-12);
        }
    }

    return out;
}

export function smooth3x3(L, width, height) {

    const n = L.length;

    const temp = new Float32Array(n);
    const out = new Float32Array(n);

    const w = width;

    /* Horizontal pass */

    for (let y = 1; y < height - 1; y++) {

        const row = y * w;

        for (let x = 1; x < width - 1; x++) {

            const i = row + x;

            temp[i] =
                (L[i - 1] + 2 * L[i] + L[i + 1]) * 0.25;
        }
    }

    /* Vertical pass */

    for (let y = 1; y < height - 1; y++) {

        const row = y * w;

        for (let x = 1; x < width - 1; x++) {

            const i = row + x;

            out[i] =
                (temp[i - w] + 2 * temp[i] + temp[i + w]) * 0.25;
        }
    }

    return out;
}

export function smooth5x5(L, width, height) {

    const n = L.length;

    const temp = new Float32Array(n);
    const out = new Float32Array(n);

    const inv5 = 0.2;

    /* -------- Horizontal pass -------- */

    for (let y = 0; y < height; y++) {

        const row = y * width;

        for (let x = 2; x < width - 2; x++) {

            const i = row + x;

            const sum =
                L[i - 2] +
                L[i - 1] +
                L[i] +
                L[i + 1] +
                L[i + 2];

            temp[i] = sum * inv5;
        }
    }

    /* -------- Vertical pass -------- */

    for (let y = 2; y < height - 2; y++) {

        const row = y * width;
        const w1 = width
        const w2 = 2 * width

        for (let x = 0; x < width; x++) {

            const i = row + x;

            const sum =
                temp[i - w2] +
                temp[i - w1] +
                temp[i] +
                temp[i + w1] +
                temp[i + w2];

            out[i] = sum * inv5;
        }
    }

    return out;
}

export function smooth7x7(L, width, height) {

    const temp = new Float32Array(L.length);
    const out = new Float32Array(L.length);

    const w0 = 1, w1 = 6, w2 = 15, w3 = 20;

    const norm = 64;

    // horizontal pass
    for (let y = 0; y < height; y++) {

        const row = y * width;

        for (let x = 3; x < width - 3; x++) {

            const i = row + x;

            temp[i] =
                (
                    w0 * (L[i - 3] + L[i + 3]) +
                    w1 * (L[i - 2] + L[i + 2]) +
                    w2 * (L[i - 1] + L[i + 1]) +
                    w3 * L[i]
                ) / norm;

        }

    }

    // vertical pass
    for (let y = 3; y < height - 3; y++) {

        const row = y * width;

        for (let x = 0; x < width; x++) {

            const i = row + x;

            out[i] =
                (
                    w0 * (temp[i - 3 * width] + temp[i + 3 * width]) +
                    w1 * (temp[i - 2 * width] + temp[i + 2 * width]) +
                    w2 * (temp[i - width] + temp[i + width]) +
                    w3 * temp[i]
                ) / norm;

        }

    }

    return out;

}