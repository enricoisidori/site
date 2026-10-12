// All inference is on the device. No frame is uploaded to a model API.
let captioner, RawImage;
let loading;
async function warmup() {
  if (!loading) loading = (async () => {
    const lib = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js');
    RawImage = lib.RawImage;
    lib.env.allowLocalModels = false;
    lib.env.backends.onnx.wasm.numThreads = 1;
    lib.env.backends.onnx.wasm.proxy = false;
    captioner = await lib.pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning', {
      revision: '215b4edcb7ec1fad5905a18a03f7b2007f6fabd0', dtype: 'q8', device: 'wasm',
      progress_callback: data => self.postMessage({ type: 'progress', file: data.file, progress: data.progress, status: data.status }),
    });
  })().catch(error => { loading = null; throw error; });
  return loading;
}
async function handle(data) {
  try {
    await warmup();
    if (data.type === 'warmup') { self.postMessage({ id: data.id, ready: true }); return; }
    const started = performance.now();
    const image = new RawImage(new Uint8ClampedArray(data.pixels), data.width, data.height, 4);
    const output = await captioner(image, { max_new_tokens: 24, num_beams: 1, do_sample: false });
    self.postMessage({ id: data.id, caption: output[0]?.generated_text?.trim() || '', inferenceMs: performance.now() - started });
  } catch (error) { self.postMessage({ id: data.id, error: error.message || String(error) }); }
}

let jobs = Promise.resolve();
self.onmessage = ({ data }) => { jobs = jobs.then(() => handle(data)); };
