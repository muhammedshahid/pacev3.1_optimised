const SRGB_TO_LINEAR = new Float32Array(256);
const LINEAR_TO_SRGB_LUT_SIZE = 4096;
const LINEAR_TO_SRGB = new Uint8ClampedArray(LINEAR_TO_SRGB_LUT_SIZE);

for (let i = 0; i < 256; i++) {
    const c = i / 255;
    SRGB_TO_LINEAR[i] =
        c <= 0.04045
            ? c / 12.92
            : Math.pow((c + 0.055) / 1.055, 2.4);
}

for (let i = 0; i < LINEAR_TO_SRGB_LUT_SIZE; i++) {
    const linear = i / (LINEAR_TO_SRGB_LUT_SIZE - 1);

    const srgb =
        linear <= 0.0031308
            ? linear * 12.92
            : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;

    LINEAR_TO_SRGB[i] = (srgb * 255 + 0.5) | 0;
}

const INV_GAMMA = 1 / 2.4;


const LUT_SIZE = 4096;
const gammaLUT = new Uint8ClampedArray(LUT_SIZE);

for (let i = 0; i < LUT_SIZE; i++) {
    const x = i / (LUT_SIZE - 1);

    const srgb =
        x <= 0.0031308
            ? 12.92 * x
            : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;

    gammaLUT[i] = Math.round(srgb * 255);
}


const CBRT_LUT_SIZE = 4096;
const CBRT_LUT = new Float32Array(CBRT_LUT_SIZE);

for (let i = 0; i < CBRT_LUT_SIZE; i++) {
    CBRT_LUT[i] = Math.cbrt(i / (CBRT_LUT_SIZE - 1));
}

function fastCbrt(x) {
    return x ** 0.3333333333;
}

function lutCbrt(x) {

    const lut = CBRT_LUT;
    const max = CBRT_LUT_SIZE - 1;

    const idx = (x * max) | 0;

    return (idx >= 0 && idx <= max) ? lut[idx] : fastCbrt(x);
}

// RGBA (Uint8 0–255) → OKLab (Float32 interleaved) LAB
export function rgbToOklab(src) {

    const pixelCount = src.length >> 2;
    const out = new Float32Array(pixelCount * 3);

    let j = 0;

    for (let i = 0; i < src.length; i += 4) {

        const lr = SRGB_TO_LINEAR[src[i]];
        const lg = SRGB_TO_LINEAR[src[i + 1]];
        const lb = SRGB_TO_LINEAR[src[i + 2]];

        const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
        const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
        const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

        const l_ = l ** (1 / 3);
        const m_ = m ** (1 / 3);
        const s_ = s ** (1 / 3);

        out[j++] = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
        out[j++] = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
        out[j++] = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
    }

    return out;
}

// RGBA (Uint8[0–255]) → OKLab (Float32[0,1] non-interleaved) LAB
// export function rgbToOklabPlanes(src) {

//     const pixelCount = src.length >> 2;

//     const L_plane = new Float32Array(pixelCount);
//     const a_plane = new Float32Array(pixelCount);
//     const b_plane = new Float32Array(pixelCount);

//     for (let i = 0, j = 0; i < src.length; i += 4, j++) {

//         const lr = SRGB_TO_LINEAR[src[i]];
//         const lg = SRGB_TO_LINEAR[src[i + 1]];
//         const lb = SRGB_TO_LINEAR[src[i + 2]];

//         const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
//         const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
//         const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

//         const l_ = Math.cbrt(l);
//         const m_ = Math.cbrt(m);
//         const s_ = Math.cbrt(s);

//         L_plane[j] = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
//         a_plane[j] = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
//         b_plane[j] = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
//     }

//     return {
//         L: L_plane,
//         a: a_plane,
//         b: b_plane,
//         pixelCount
//     };
// }

export function rgbToOklabPlanes(src) {

    const pixelCount = src.length >> 2;

    const L_plane = new Float32Array(pixelCount);
    const a_plane = new Float32Array(pixelCount);
    const b_plane = new Float32Array(pixelCount);

    const srgbToLinear = SRGB_TO_LINEAR;

    let i = 0;
    let j = 0;

    const end = pixelCount & ~1; // even pixel count

    // ---- process 2 pixels per loop ----
    for (; j < end; j += 2, i += 8) {

        // ---------- Pixel 1 ----------
        const lr1 = srgbToLinear[src[i]];
        const lg1 = srgbToLinear[src[i + 1]];
        const lb1 = srgbToLinear[src[i + 2]];

        const l1 = 0.4122214708 * lr1 + 0.5363325363 * lg1 + 0.0514459929 * lb1;
        const m1 = 0.2119034982 * lr1 + 0.6806995451 * lg1 + 0.1073969566 * lb1;
        const s1 = 0.0883024619 * lr1 + 0.2817188376 * lg1 + 0.6299787005 * lb1;

        const l_1 = lutCbrt(l1);
        const m_1 = lutCbrt(m1);
        const s_1 = lutCbrt(s1);

        L_plane[j] = 0.2104542553 * l_1 + 0.7936177850 * m_1 - 0.0040720468 * s_1;
        a_plane[j] = 1.9779984951 * l_1 - 2.4285922050 * m_1 + 0.4505937099 * s_1;
        b_plane[j] = 0.0259040371 * l_1 + 0.7827717662 * m_1 - 0.8086757660 * s_1;

        // ---------- Pixel 2 ----------
        const lr2 = srgbToLinear[src[i + 4]];
        const lg2 = srgbToLinear[src[i + 5]];
        const lb2 = srgbToLinear[src[i + 6]];

        const l2 = 0.4122214708 * lr2 + 0.5363325363 * lg2 + 0.0514459929 * lb2;
        const m2 = 0.2119034982 * lr2 + 0.6806995451 * lg2 + 0.1073969566 * lb2;
        const s2 = 0.0883024619 * lr2 + 0.2817188376 * lg2 + 0.6299787005 * lb2;

        const l_2 = lutCbrt(l2);
        const m_2 = lutCbrt(m2);
        const s_2 = lutCbrt(s2);

        L_plane[j + 1] = 0.2104542553 * l_2 + 0.7936177850 * m_2 - 0.0040720468 * s_2;
        a_plane[j + 1] = 1.9779984951 * l_2 - 2.4285922050 * m_2 + 0.4505937099 * s_2;
        b_plane[j + 1] = 0.0259040371 * l_2 + 0.7827717662 * m_2 - 0.8086757660 * s_2;
    }

    // ---- remaining pixel ----
    if (j < pixelCount) {

        const lr = srgbToLinear[src[i]];
        const lg = srgbToLinear[src[i + 1]];
        const lb = srgbToLinear[src[i + 2]];

        const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
        const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
        const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

        const l_ = lutCbrt(l);
        const m_ = lutCbrt(m);
        const s_ = lutCbrt(s);

        L_plane[j] = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
        a_plane[j] = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
        b_plane[j] = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
    }

    return {
        L: L_plane,
        a: a_plane,
        b: b_plane,
        pixelCount
    };
}

// OKLab(LAB Float32 interleaved) → RGBA (Uint8Clamped RGBA)
export function oklabToRgb(src) {

    const pixelCount = src.length / 3;
    const out = new Uint8ClampedArray(pixelCount * 4);

    let j = 0;

    for (let i = 0; i < src.length; i += 3) {

        const L = src[i];
        const a = src[i + 1];
        const b = src[i + 2];

        const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
        const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
        const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

        const l = l_ * l_ * l_;
        const m = m_ * m_ * m_;
        const s = s_ * s_ * s_;

        let lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
        let lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
        let lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

        lr = lr <= 0 ? 0 : lr >= 1 ? 1 : lr;
        lg = lg <= 0 ? 0 : lg >= 1 ? 1 : lg;
        lb = lb <= 0 ? 0 : lb >= 1 ? 1 : lb;

        lr = lr <= 0.0031308 ? lr * 12.92 : 1.055 * Math.pow(lr, INV_GAMMA) - 0.055;
        lg = lg <= 0.0031308 ? lg * 12.92 : 1.055 * Math.pow(lg, INV_GAMMA) - 0.055;
        lb = lb <= 0.0031308 ? lb * 12.92 : 1.055 * Math.pow(lb, INV_GAMMA) - 0.055;

        out[j++] = (lr * 255 + 0.5) | 0;
        out[j++] = (lg * 255 + 0.5) | 0;
        out[j++] = (lb * 255 + 0.5) | 0;
        out[j++] = 255;
    }

    return out;
}

// export function oklabPlanesToRgb(L, a, b) {

//     const n = L.length;
//     const rgb = new Uint8ClampedArray(n * 4);

//     for (let i = 0; i < n; i++) {

//         const Ls = L[i];
//         const as = a[i];
//         const bs = b[i];

//         // ---- OKLab → LMS ----
//         const l_ = Ls + 0.3963377774 * as + 0.2158037573 * bs;
//         const m_ = Ls - 0.1055613458 * as - 0.0638541728 * bs;
//         const s_ = Ls - 0.0894841775 * as - 1.2914855480 * bs;

//         const l = l_ * l_ * l_;
//         const m = m_ * m_ * m_;
//         const s = s_ * s_ * s_;

//         // ---- LMS → Linear RGB ----
//         let r =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
//         let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
//         let b2 = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

//         // ---- Linear → sRGB ----
//         r = r <= 0.0031308 ? 12.92 * r : 1.055 * Math.pow(r, 1/2.4) - 0.055;
//         g = g <= 0.0031308 ? 12.92 * g : 1.055 * Math.pow(g, 1/2.4) - 0.055;
//         b2 = b2 <= 0.0031308 ? 12.92 * b2 : 1.055 * Math.pow(b2, 1/2.4) - 0.055;

//         // Clamp
//         r = Math.min(1, Math.max(0, r));
//         g = Math.min(1, Math.max(0, g));
//         b2 = Math.min(1, Math.max(0, b2));

//         const j = i * 4; // ✅ correct stride

//         rgb[j]     = r * 255;
//         rgb[j + 1] = g * 255;
//         rgb[j + 2] = b2 * 255;
//         rgb[j + 3] = 255;
//     }

//     return rgb;
// }


export function oklabPlanesToRgb(L, a, b) {

    const n = L.length;
    const rgb = new Uint8ClampedArray(n * 4);

    for (let i = 0, j = 0; i < n; i++, j += 4) {

        const Ls = L[i];
        const as = a[i];
        const bs = b[i];

        // OKLab → LMS
        const l_ = Ls + 0.3963377774 * as + 0.2158037573 * bs;
        const m_ = Ls - 0.1055613458 * as - 0.0638541728 * bs;
        const s_ = Ls - 0.0894841775 * as - 1.2914855480 * bs;

        const l = l_ * l_ * l_;
        const m = m_ * m_ * m_;
        const s = s_ * s_ * s_;

        // LMS → Linear RGB
        let r =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
        let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
        let b2 = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

        // Clamp linear values
        if (r < 0) r = 0; else if (r > 1) r = 1;
        if (g < 0) g = 0; else if (g > 1) g = 1;
        if (b2 < 0) b2 = 0; else if (b2 > 1) b2 = 1;

        // LUT gamma conversion
        const ri = (r * (LUT_SIZE - 1)) | 0;
        const gi = (g * (LUT_SIZE - 1)) | 0;
        const bi = (b2 * (LUT_SIZE - 1)) | 0;

        rgb[j]     = gammaLUT[ri];
        rgb[j + 1] = gammaLUT[gi];
        rgb[j + 2] = gammaLUT[bi];
        rgb[j + 3] = 255;
    }

    return rgb;
}

// RGBA (Uint8 0–255) → Linear[0,1] (Float32 interleaved)
export function rgbToLinear(src) {
    const pixelCount = src.length >> 2;
    const out = new Float32Array(pixelCount * 4);

    let j = 0;

    for (let i = 0; i < src.length; i += 4) {
        out[j++] = SRGB_TO_LINEAR[src[i]];;
        out[j++] = SRGB_TO_LINEAR[src[i + 1]];
        out[j++] = SRGB_TO_LINEAR[src[i + 2]];
        out[j++] = src[i + 3]; //untouched
    }

    return out;
}

// Linear[0,1] (Float32 interleaved) → RGBA (Uint8 0–255)
export function linearToRgb(src) {
    const pixelCount = src.length >> 2;
    const out = new Uint8ClampedArray(pixelCount * 4);

    const scale = LINEAR_TO_SRGB_LUT_SIZE - 1;

    let j = 0;

    for (let i = 0; i < src.length; i += 4) {

        let r = src[i];
        let g = src[i + 1];
        let b = src[i + 2];

        // Clamp once
        r = r <= 0 ? 0 : r >= 1 ? 1 : r;
        g = g <= 0 ? 0 : g >= 1 ? 1 : g;
        b = b <= 0 ? 0 : b >= 1 ? 1 : b;

        out[j++] = LINEAR_TO_SRGB[(r * scale) | 0];
        out[j++] = LINEAR_TO_SRGB[(g * scale) | 0];
        out[j++] = LINEAR_TO_SRGB[(b * scale) | 0];
        out[j++] = src[i + 3];
    }

    return out;
}

// RGBA (Uint8 0–255) → Luminance(Y)[0,1] (Float32)
export function rgbToLuminance(src) {
    const pixelCount = src.length >> 2;
    const out = new Float32Array(pixelCount);

    let j = 0;

    for (let i = 0; i < src.length; i += 4) {

        const lr = SRGB_TO_LINEAR[src[i]];
        const lg = SRGB_TO_LINEAR[src[i + 1]];
        const lb = SRGB_TO_LINEAR[src[i + 2]];

        // Rec.709 luminance
        out[j++] = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
    }

    return out;
}