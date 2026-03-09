const EPS = 1e-6;
export function applyBlending(L, Lclahe, width, height, maps, globalAlpha, perceptualParams) {

    const size = L.length;
    const Lenhanced = new Float32Array(size);
    const { lambda, beta, tau, edgeStabilizer } = perceptualParams;
    const k = edgeStabilizer;
    const { edgeMap, skinDampMap, structureMask, Lsmall, Lmedium, smoothLocalAlphaMap: alphaMap } = maps;

    for (let y = 1; y < height - 1; y++) {

        for (let x = 1; x < width - 1; x++) {

            const i = y * width + x;

            const finalAlpha = globalAlpha * (0.8 + 0.8 * Math.max(0, Math.min(1, alphaMap[i])));

            // ---------- Retinex (stable) ----------
            const reflectance =
                Math.log(Math.max(Lsmall[i], EPS)) -
                Math.log(Math.max(Lmedium[i], EPS));
            // console.log(reflectance);

            const detailMask = Math.min(1, Math.max(0, reflectance * 0.8 + 0.5));
            // console.log(detailMask);

            const skinDamp = skinDampMap[i];
            // console.log(skinDamp);

            const structureBoost = Math.pow(structureMask[i], 0.7);
            // console.log(structureBoost);

            // ---------- Laplacian detail ----------
            const localMean =
                (Lsmall[i - 1] +
                    Lsmall[i + 1] +
                    Lsmall[i - width] +
                    Lsmall[i + width]) * 0.25;
            // console.log(localMean);

            const edge = Math.abs(edgeMap[i]);
            // console.log(edge);

            const textureMask = edge / (edge + 0.015 + EPS);
            // console.log(textureMask);

            let deltaDetail = (Lsmall[i] - localMean) * textureMask;
            // console.log(deltaDetail);

            // clamp detail spikes
            deltaDetail = Math.max(-0.25, Math.min(0.25, deltaDetail));
            // console.log(deltaDetail);

            // ---------- CLAHE ----------
            const deltaClahe = Lclahe[i] - L[i];
            // console.log(deltaClahe);

            const edgeAdaptive = edge / (edge + 0.03 + EPS);

            // ---------- Combined contrast ----------
            let delta =
                deltaClahe +
                0.45 *
                deltaDetail *
                detailMask *
                skinDamp *
                structureBoost *
                edgeAdaptive;
            // console.log(delta);

            // clamp delta
            delta = Math.max(-0.5, Math.min(0.5, delta));
            // console.log(delta);

            // ---------- Halo suppression ----------
            const haloWeight = 1 / (1 + 2.0 * Math.abs(delta) + EPS);
            // console.log(haloWeight);

            const deltaStable = delta * haloWeight;
            // console.log(deltaStable);

            // ---------- Tone limiter ----------
            const deltaLimited =
                deltaStable /
                (1 + Math.abs(deltaStable) /
                    (tau * (0.5 + L[i])));
            // console.log(deltaLimited);

            // ---------- Nonlinear compression ----------
            const compressed = deltaLimited / (1 + lambda * Math.abs(deltaLimited));
            // console.log(compressed);

            // ---------- Detail compression ----------
            // const detailCompression =
            //     1 / (1 + 1.8 * Math.abs(deltaLimited));
            const detailCompression = 1;
            // console.log(detailCompression);

            // ---------- Edge gain ----------
            const kAdaptive = k / (1 + finalAlpha);
            // console.log(kAdaptive);

            const edgeResponse = edge / (edge + kAdaptive + 1e-6);
            // console.log(edgeResponse);

            const edgeGain = Math.pow(edgeResponse, 0.8) * (1 + 0.6 * edgeResponse);
            // console.log(edgeGain);

            // ---------- Highlight protection ----------
            const lumMask = Math.max(0.15, 1 - beta * L[i]);
            // console.log(lumMask);

            // ---------- Contrast gain perceptual scaling ----------
            const contrastGain = 1 + finalAlpha * (1 - 0.5 * L[i]);
            // console.log(contrastGain);

            // ---------- Final luminance ----------
            let enhanced =
                L[i] +
                compressed *
                edgeGain *
                lumMask *
                contrastGain *
                detailCompression;

            // const gain = Math.min(
            //     2.0,
            //     1 +
            //     compressed *
            //     edgeGain *
            //     lumMask *
            //     contrastGain *
            //     detailCompression
            // );

            // let enhanced =
            //     localMean +
            //     gain * (Lsmall[i] - localMean);
            // console.log(enhanced);

            // NaN protection
            if (!Number.isFinite(enhanced)) {
                enhanced = L[i];
            }

            // clamp luminance
            Lenhanced[i] = Math.min(1, Math.max(0, enhanced));
            // console.log(Lenhanced[i]);
        }
    }
    return Lenhanced;
}