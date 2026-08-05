#!/usr/bin/env python3
import argparse
import subprocess
from pathlib import Path

import librosa
import numpy as np
from PIL import Image
import matplotlib.cm as cm

# === CONFIGURAZIONE ===
AUDIO_FILE = "Organismo Glaciale.mp3"
VIDEO_WIDTH = 1080         # video verticale 1080x1920
VIDEO_HEIGHT = 1920
FPS = 30

COLORMAP_NAME = "inferno"  # e.g. "inferno", "magma", "plasma", "viridis", ...
COLORMAP_GAMMA = 1.1       # gamma exponent for artistic control (>=1.0 emphasizes high intensities)

SPECTROGRAM_PNG = "spectrogram_Organismo_Glaciale.png"
OUTPUT_VIDEO = "Organismo_Glaciale_1080x1920_spectrogram.mp4"


def _make_palette():
    """
    Create a 256x3 RGB palette from a perceptually uniform colormap.
    The colormap and contrast are controlled by COLORMAP_NAME and COLORMAP_GAMMA.
    """
    vals = np.linspace(0.0, 1.0, 256) ** COLORMAP_GAMMA
    cmap = cm.get_cmap(COLORMAP_NAME, 256)
    palette = (cmap(vals)[:, :3] * 255).astype(np.uint8)
    return palette


def main():
    parser = argparse.ArgumentParser(description="Genera un video verticale con spettrogramma scorrevole")
    parser.add_argument("--start-seconds", type=float, default=0.0, help="Secondo iniziale del segmento audio")
    parser.add_argument("--max-seconds", type=float, default=None, help="Durata massima (in secondi) del segmento audio")
    parser.add_argument("--orientation", choices=["vertical", "horizontal"], default="vertical",
                        help="Direzione di scorrimento del tempo (default: vertical, dall'alto verso il basso)")
    parser.add_argument("--hop-length", type=int, default=4096,
                        help="Passo per STFT/melspectrogram (più piccolo = più dettagli/altezza)")
    args = parser.parse_args()

    audio_path = Path(AUDIO_FILE)
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    print(f"Loading audio: {audio_path}")
    # sr=None => non ricampiona, usa il sample rate nativo
    y, sr = librosa.load(audio_path, sr=None, mono=True)
    duration_total = len(y) / sr
    print(f"Total duration: {duration_total:.2f} s")

    # Applica finestra [start, start+max] se richiesto
    start_sec = max(0.0, float(args.start_seconds))
    if start_sec >= duration_total:
        raise ValueError(f"start-seconds ({start_sec}) >= durata audio ({duration_total:.2f})")
    start_idx = int(start_sec * sr)
    if args.max_seconds is not None:
        end_sec = min(duration_total, start_sec + float(args.max_seconds))
    else:
        end_sec = duration_total
    end_idx = int(end_sec * sr)
    if end_idx <= start_idx:
        raise ValueError("Intervallo audio selezionato vuoto")

    if start_idx != 0 or end_idx != len(y):
        print(f"Using segment: {start_sec:.3f}s → {end_sec:.3f}s")
        y = y[start_idx:end_idx]

    duration_sec = len(y) / sr
    print(f"Working duration: {duration_sec:.2f} s")

    # Parametri STFT pensati per 1h25' (larghezza/altezza gestibile)
    n_fft = max(4096, int(args.hop_length))
    hop_length = int(args.hop_length)
    n_mels = 512

    print("Computing mel spectrogram...")
    S = librosa.feature.melspectrogram(
        y=y,
        sr=sr,
        n_fft=n_fft,
        hop_length=hop_length,
        n_mels=n_mels,
        power=2.0,
    )
    S_db = librosa.power_to_db(S, ref=np.max)

    # Normalizza in [0, 255]
    S_min, S_max = S_db.min(), S_db.max()
    S_norm = (S_db - S_min) / (S_max - S_min + 1e-9)
    S_img = (S_norm * 255.0).astype(np.uint8)

    # Costruzione immagine e orientamento
    palette = _make_palette()
    if args.orientation == "vertical":
        # Tempo in verticale: (frames, mels)
        arr2d = S_img.T  # shape: (n_frames, n_mels)
        # lasciamo le basse frequenze a sinistra (row 0 in S_img -> col 0 qui)
        # Applica palette colore
        color_arr = palette[arr2d]
        height, width = color_arr.shape[0], color_arr.shape[1]
        print(f"Raw vertical spectrogram size: {width}x{height}")

        # Ridimensiona la larghezza a VIDEO_WIDTH e scala altezza di conseguenza
        if width != VIDEO_WIDTH:
            scale = VIDEO_WIDTH / float(width)
            new_height = max(int(round(height * scale)), VIDEO_HEIGHT + 1)  # garantisce scorrimento
            img = Image.fromarray(color_arr, mode="RGB").resize((VIDEO_WIDTH, new_height), resample=Image.BICUBIC)
            width, height = img.size
            print(f"Resized vertical spectrogram size: {width}x{height}")
        else:
            img = Image.fromarray(color_arr, mode="RGB")
            if height <= VIDEO_HEIGHT:
                # forza ad almeno un pixel di scroll
                img = img.resize((width, VIDEO_HEIGHT + 1), resample=Image.BICUBIC)
                width, height = img.size
                print(f"Upscaled to ensure scrolling: {width}x{height}")
    else:
        # Tempo in orizzontale (come versione iniziale): frequenze basse in basso
        arr2d = np.flipud(S_img)  # (n_mels, n_frames) con bassi in basso
        color_arr = palette[arr2d]
        height, width = color_arr.shape[0], color_arr.shape[1]
        print(f"Raw horizontal spectrogram size: {width}x{height}")
        # Ridimensiona altezza a VIDEO_HEIGHT mantenendo proporzioni
        if height != VIDEO_HEIGHT:
            new_width = int(round(width * (VIDEO_HEIGHT / float(height))))
            img = Image.fromarray(color_arr, mode="RGB").resize((new_width, VIDEO_HEIGHT), resample=Image.BICUBIC)
            width, height = img.size
            print(f"Resized horizontal spectrogram size: {width}x{height}")
        else:
            img = Image.fromarray(color_arr, mode="RGB")

    # Output filenames (aggiunge suffisso se segmentato)
    suffix = ""
    if start_sec > 0.0 or args.max_seconds is not None:
        end_mark = start_sec + duration_sec
        suffix = f"_{int(round(start_sec))}-{int(round(end_mark))}s"

    spectrogram_png = Path(SPECTROGRAM_PNG)
    if suffix:
        spectrogram_png = spectrogram_png.with_name(spectrogram_png.stem + suffix + spectrogram_png.suffix)
    img.save(spectrogram_png)
    print(f"Saved spectrogram image: {spectrogram_png}")

    if args.orientation == "horizontal":
        if width <= VIDEO_WIDTH:
            raise RuntimeError(
                f"Spectrogram width ({width}px) must be larger than VIDEO_WIDTH ({VIDEO_WIDTH}px) "
                "to allow horizontal scrolling."
            )
        print(f"Scrollable width: {width - VIDEO_WIDTH} px")
    else:
        if height <= VIDEO_HEIGHT:
            raise RuntimeError(
                f"Spectrogram height ({height}px) must be larger than VIDEO_HEIGHT ({VIDEO_HEIGHT}px) "
                "to allow vertical scrolling."
            )
        print(f"Scrollable height: {height - VIDEO_HEIGHT} px")

    # Costruiamo il filtro di crop in modo che:
    # x(t) = (iw - VIDEO_WIDTH) * t / duration_sec
    # cioè la finestra 1080x1920 scorre da sinistra a destra e arriva in fondo esattamente
    # quando finisce l'audio.
    duration_str = f"{duration_sec:.3f}"
    if args.orientation == "horizontal":
        crop_filter = (
            f"[0:v]crop={VIDEO_WIDTH}:{VIDEO_HEIGHT}:"
            f"(iw-{VIDEO_WIDTH})*t/{duration_str}:0,setsar=1[v]"
        )
    else:
        crop_filter = (
            f"[0:v]crop={VIDEO_WIDTH}:{VIDEO_HEIGHT}:"
            f"0:(ih-{VIDEO_HEIGHT})*t/{duration_str},setsar=1[v]"
        )

    output_video = Path(OUTPUT_VIDEO)
    if suffix:
        output_video = output_video.with_name(output_video.stem + suffix + output_video.suffix)

    cmd = [
        "ffmpeg",
        "-y",
        "-loop", "1",                  # loop dell'immagine
        "-framerate", str(FPS),        # fps del video
        "-i", str(spectrogram_png),    # input video (immagine)
    ]

    # Se necessario, seek nell'audio all'inizio del segmento
    if start_sec > 0:
        cmd += ["-ss", f"{start_sec:.3f}"]
    cmd += ["-i", str(audio_path)]

    cmd += [
        "-filter_complex", crop_filter,
        "-map", "[v]",
        "-map", "1:a",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "18",
        "-c:a", "aac",
        "-b:a", "192k",
        "-t", duration_str,            # limita la durata all'esatto segmento
        "-shortest",                   # doppia sicurezza: taglia video all'audio
        "-pix_fmt", "yuv420p",
        str(output_video),
    ]

    print("Running ffmpeg...")
    print(" ".join(cmd))
    subprocess.run(cmd, check=True)
    print(f"Done. Output video: {output_video}")


if __name__ == "__main__":
    main()
