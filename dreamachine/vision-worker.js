import { pipeline, env, RawImage } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2';
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
let classifier;
self.onmessage = async ({ data }) => {
  try {
    classifier ||= await pipeline('image-classification', 'Xenova/mobilevit-small', { dtype: 'q8', device: 'wasm' });
    if (data.type === 'warmup') {
      self.postMessage({ id: data.id, ready: true });
      return;
    }
    const frame = new RawImage(new Uint8ClampedArray(data.pixels), data.width, data.height, 4);
    const predictions = await classifier(frame, { top_k: 5 });
    self.postMessage({ id: data.id, predictions });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  }
};
