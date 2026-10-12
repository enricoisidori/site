import { pipeline, env, RawImage } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2';
import { captionTerms } from './caption-terms.js?v=runtime-51';
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
let captioner;
const model = 'ViT–GPT2 · descrizione libera · q8 · CPU';
self.onmessage = async ({ data }) => {
  try {
    captioner ||= await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning', { dtype: 'q8', device: 'wasm' });
    if (data.type === 'warmup') { self.postMessage({ id:data.id, ready:true, model }); return; }
    const frame = new RawImage(new Uint8ClampedArray(data.pixels), data.width, data.height, 4);
    const started = performance.now();
    const result = await captioner(frame, { max_new_tokens: 32, num_beams: 1, do_sample: false });
    const caption = result[0]?.generated_text?.trim() || '';
    // Generated keywords have no calibrated class confidence: don't invent percentages.
    const predictions = captionTerms(caption).map(label=>({label,score:null}));
    self.postMessage({ id:data.id, predictions, caption, model, inferenceMs:performance.now()-started });
  } catch (error) { self.postMessage({ id:data.id, error:error.message }); }
};
