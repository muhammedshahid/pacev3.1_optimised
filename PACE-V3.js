/* 
PACE: Perceptual Adaptive Contrast Enhancement
A Noise-Aware Perceptual Local Contrast Enhancement Engine

Broadly divided into 3
1] img stats
2] controller
3] actuator (CLAHE)
 */

import * as Utils from "./utils/index.js";
import * as Stats from "./stats/index.js";
import * as Controller from "./controller/index.js";
import * as Actuator from "./actuator/index.js";
import { createContext } from "./createContext.js";

const stage1 = (ctx) => {
    const data = ctx.image.input.data;

    const Lab = Utils.colorSpaceConversion.rgbToOklabPlanes(data);

    Object.assign(ctx.image.working, {
        L: Lab.L,
        A: Lab.a,
        B: Lab.b
    });

    return ctx;
};

const stage2 = (ctx) => {
    const { L } = ctx.image.working;
    const { width, height } = ctx.meta;

    const features = Stats.extractGlobalFeatures(L, width, height);

    ctx.stats = features;

    return ctx;
}

const stage3 = (ctx) => {
    const features = ctx.stats;

    const { controlParams, perceptualParams } = Controller.computeAdaptiveParams(features);

    Object.assign(ctx.params, {
        controlParams,
        perceptualParams
    });
    
    return ctx;
}

const stage4 = (ctx) => {
    const { L } = ctx.image.working;
    const { width, height } = ctx.meta;
    const { tileSize, clipLimit } = ctx.params.controlParams;

    const Lclahe = Actuator.applyCLAHE(L, width, height, tileSize, clipLimit);

    ctx.buffers.Lclahe = Lclahe;

    return ctx;
}

const stage5 = (ctx) => {
    const { L } = ctx.image.working;
    const { width, height } = ctx.meta;
    const { tileSize, globalAlpha } = ctx.params.controlParams;
    const globalNoiseRatio = ctx.stats.noise.noiseRatio;

    const maps = Controller.maps.computeControlMaps(L, width, height, globalAlpha, globalNoiseRatio, tileSize);

    ctx.maps = maps;

    return ctx;
}

const stage6 = (ctx) => {
    const { L } = ctx.image.working;
    const { Lclahe } = ctx.buffers;
    const { width, height } = ctx.meta;
    const { maps } = ctx;
    const { globalAlpha } = ctx.params.controlParams;
    const { perceptualParams } = ctx.params;

    const Lenhanced = Controller.applyBlending(L, Lclahe, width, height, maps, globalAlpha, perceptualParams);

    ctx.buffers.Lenhanced = Lenhanced;

    return ctx;
}

const stage7 = (ctx) => {
    const { Lenhanced } = ctx.buffers;
    const { A, B } = ctx.image.working;
    const { width, height } = ctx.meta;

    const t0 = performance.now();
    const newRGB = Utils.colorSpaceConversion.oklabPlanesToRgb(Lenhanced, A, B);
    const t1 = performance.now();
    console.log("color conversion take::", t1-t0);
    ctx.image.output = new ImageData(newRGB, width, height);

    return ctx;
}

const PIPELINE = [
    { name: "Extract Color", run: stage1 },
    { name: "Extract Stats", run: stage2 },
    { name: "Compute Params", run: stage3 },
    { name: "CLAHE", run: stage4 },
    { name: "Compute Maps", run: stage5 },
    { name: "Blending", run: stage6 },
    { name: "Reconstruct", run: stage7 }
];

const runPipeline = async (pipeline, ctx, onProgress) => {
    const totalStages = pipeline.length;

    Object.assign(ctx.runtime, {
        stage: "init",
        progressPercent: 0,
        stages: totalStages,
        prevStage: "init"
    });

    if (onProgress) {
        onProgress({
            stage: "init",
            index: 0,
            total: totalStages,
            time: 0,
            progressPercent: 0
        });
    }

    for (let i = 0; i < totalStages; i++) {
        const { name, run } = pipeline[i];
        const prevStage = ctx.runtime.stage;
        ctx.runtime.stage = name;

        const start = performance.now();

        try {
            ctx = await run(ctx);
        } catch (err) {
            console.error(`Pipeline failed at stage: ${name}`);
            throw err;
        }

        const time = performance.now() - start;

        const progressPercent = ((i + 1) / totalStages) * 100;
        ctx.metrics[name] = time;

        Object.assign(ctx.runtime, {
            stage: name,
            prevStage: prevStage,
            progressPercent: progressPercent
        });

        if (onProgress) {
            onProgress({
                stage: name,
                index: i + 1,
                total: totalStages,
                time,
                progressPercent
            });
        }
    }

    return ctx;
};

export async function applyPACEV3(imageData) {
    const ctx = createContext(imageData);
    await runPipeline(PIPELINE, ctx, (info) => {
        console.log(info);
    });
    console.log(ctx);
    return ctx.image.output;
}