import {
  pipeline,
  env,
  RawImage,
} from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2";
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
let model;
self.onmessage = async ({ data }) => {
  try {
    model ||= await pipeline(
      "image-to-text",
      "Xenova/vit-gpt2-image-captioning",
      {
        dtype: "q8",
        device: "wasm",
        progress_callback: (p) => self.postMessage({ progress: p }),
      },
    );
    const start = performance.now();
    const result = await model(
      new RawImage(
        new Uint8ClampedArray(data.pixels),
        data.width,
        data.height,
        4,
      ),
      { max_new_tokens: 28, num_beams: 1, do_sample: false },
    );
    self.postMessage({
      caption: result[0].generated_text,
      ms: performance.now() - start,
    });
  } catch (e) {
    self.postMessage({ error: e.message });
  }
};
