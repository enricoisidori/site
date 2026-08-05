#!/usr/bin/env python3
import argparse
import subprocess
from pathlib import Path

import librosa
import numpy as np
from PIL import Image

# === CONFIGURAZIONE ===
AUDIO_FILE = "Organismo Glaciale.mp3"
VIDEO_WIDTH = 1080         # verticale 1080x1920
VIDEO_HEIGHT = 1920
FPS = 30
LINE_THICKNESS = 4         # spessore linea centrale
LEFT_MARGIN = 0            # nessun margine sinistro

SPECTROGRAM_PNG = "spectrogram_Organismo_Glaciale.png"
OUTPUT_VIDEO = "Organismo_Glaciale_1080x1920_spectrogram.mp4"


def _make_palette():
    """Create a 256x3 RGB palette going Blue→Purple→Red→Orange→Yellow.

    The mapping is designed for spectrogram-like heatmaps where low values are
    bluish and high values are yellow/orange/red.
    """
    # Stops: (position in [0,1], (R,G,B))
    stops = [
        (0.00, (10,  12, 120)),   # deep blue
        (0.25, (90,   0, 140)),   # purple
        (0.50, (220,  0,   0)),   # red
        (0.75, (255, 120,  0)),   # orange
        (1.00, (255, 255,  0)),   # yellow
    ]

    palette = np.zeros((256, 3), dtype=np.uint8)
    # Linear interpolate across segments
    for i in range(len(stops) - 1):
        p0, c0 = stops[i]
        p1, c1 = stops[i + 1]
        i0 = int(round(p0 * 255))
        i1 = int(round(p1 * 255))
        if i1 <= i0:
            continue
        for ch in range(3):
            palette[i0:i1 + 1, ch] = np.linspace(c0[ch], c1[ch], i1 - i0 + 1)
    # Ensure last entry equals last stop
    palette[-1] = stops[-1][1]
    return palette


def main():
    parser = argparse.ArgumentParser(description="Genera un video verticale con spettrogramma scorrevole")
    parser.add_argument("--start-seconds", type=float, default=0.0, help="Secondo iniziale del segmento audio")
    parser.add_argument("--max-seconds", type=float, default=None, help="Durata massima (in secondi) del segmento audio")
    parser.add_argument("--orientation", choices=["vertical", "horizontal"], default="vertical",
                        help="Direzione di scorrimento del tempo (default: vertical, dall'alto verso il basso)")
    parser.add_argument("--hop-length", type=int, default=4096,
                        help="Passo per STFT/melspectrogram (più piccolo = più dettagli/altezza)")
    parser.add_argument("--video-width", type=int, default=None,
                        help="Larghezza del video in px (override del default)")
    parser.add_argument("--video-height", type=int, default=None,
                        help="Altezza del video in px (override del default)")
    parser.add_argument("--output", type=str, default=None,
                        help="Percorso file di output (override nome automatico)")
    parser.add_argument("--audio-file", type=str, default=None,
                        help="Percorso del file audio da usare (override del default)")
    parser.add_argument("--preview-frame", action="store_true",
                        help="Esporta un solo frame PNG per anteprima (nessun audio)")
    parser.add_argument("--preview-frac", type=float, default=0.5,
                        help="Posizione di anteprima nel range di scorrimento [0..1] (default 0.5)")
    parser.add_argument("--line-length", type=int, default=124,
                        help="Lunghezza della linea verde in pixel (default 124)")
    parser.add_argument("--pre-roll-seconds", type=float, default=None,
                        help="Secondi di spettrogramma da includere PRIMA del punto di inizio (per avere contenuto sopra la linea)")
    parser.add_argument("--post-roll-seconds", type=float, default=None,
                        help="Secondi di spettrogramma da includere DOPO la fine (per avere contenuto sotto la linea)")
    parser.add_argument("--rotate-ccw", action="store_true",
                        help="Ruota l'output di 90° in senso antiorario")
    parser.add_argument("--png-only", action="store_true",
                        help="Genera solo il PNG dello spettrogramma (salta l'export del video)")
    args = parser.parse_args()

    # Audio: consenti override da CLI
    audio_path = Path(args.audio_file) if args.audio_file else Path(AUDIO_FILE)
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
    print(f"Using segment: {start_sec:.3f}s → {end_sec:.3f}s")
    main_duration_sec = end_sec - start_sec
    print(f"Working duration (main): {main_duration_sec:.2f} s")

    # Parametri STFT pensati per 1h25' (larghezza/altezza gestibile)
    n_fft = max(4096, int(args.hop_length))
    hop_length = int(args.hop_length)
    n_mels = 512

    # Parametri video e roll visivo (pre/post) per evitare vuoti sopra/sotto la linea
    video_width = int(args.video_width) if args.video_width else VIDEO_WIDTH
    video_height = int(args.video_height) if args.video_height else VIDEO_HEIGHT
    center_y = int(round(video_height / 2))
    frame_time = hop_length / float(sr)
    px_per_sec = (video_width * sr) / float(n_mels * hop_length)
    auto_roll_sec = float(np.ceil(center_y / max(1e-9, px_per_sec)))
    pre_roll_sec = float(args.pre_roll_seconds) if args.pre_roll_seconds is not None else auto_roll_sec
    post_roll_sec = float(args.post_roll_seconds) if args.post_roll_seconds is not None else auto_roll_sec
    pre_roll_sec = min(pre_roll_sec, start_sec)
    spec_start_sec = max(0.0, start_sec - pre_roll_sec)
    spec_end_sec = min(duration_total, end_sec + post_roll_sec)
    spec_start_idx = int(spec_start_sec * sr)
    spec_end_idx = int(spec_end_sec * sr)

    print("Computing mel spectrogram...")
    y_spec = y[spec_start_idx:spec_end_idx]
    S = librosa.feature.melspectrogram(
        y=y_spec,
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

    if LEFT_MARGIN >= video_width:
        raise ValueError("LEFT_MARGIN troppo grande rispetto alla larghezza del video")

    # Costruzione immagine e orientamento (con eventuale riuso PNG)
    palette = _make_palette()
    spec_h = None
    width = None
    height = None

    # Output filenames (aggiunge suffisso se segmentato)
    suffix = ""
    if start_sec > 0.0 or args.max_seconds is not None:
        end_mark = end_sec
        suffix = f"_{int(round(start_sec))}-{int(round(end_mark))}s"
        if pre_roll_sec > 0:
            suffix += f"_pre{int(round(pre_roll_sec))}s"
        if post_roll_sec > 0:
            suffix += f"_post{int(round(post_roll_sec))}s"

    # Base name del PNG dinamico in base al nome audio
    def _sanitize_stem(s: str) -> str:
        return "".join(ch if (ch.isalnum() or ch in ("_", "-")) else "_" for ch in s)

    base_stem = _sanitize_stem(audio_path.stem)
    spectrogram_png = Path(f"spectrogram_{base_stem}.png")
    if suffix:
        spectrogram_png = spectrogram_png.with_name(spectrogram_png.stem + suffix + spectrogram_png.suffix)
    png_exists = spectrogram_png.exists()

    if args.orientation == "vertical":
        if not png_exists:
            # Tempo in verticale: (frames, mels)
            arr2d = S_img.T  # shape: (n_frames, n_mels)
            color_arr = palette[arr2d]
            height, width = color_arr.shape[0], color_arr.shape[1]
            print(f"Raw vertical spectrogram size: {width}x{height}")
            
            if width != video_width:
                scale = video_width / float(width)
                new_height = int(round(height * scale))
                img = Image.fromarray(color_arr, mode="RGB").resize((video_width, new_height), resample=Image.BICUBIC)
                width, height = img.size
                print(f"Resized vertical spectrogram size: {width}x{height}")
            else:
                img = Image.fromarray(color_arr, mode="RGB")
            img.save(spectrogram_png)
            print(f"Saved spectrogram image: {spectrogram_png}")
        else:
            with Image.open(spectrogram_png) as existing_img:
                width, height = existing_img.size
            # Se necessario, si potrebbe rigenerare se width!=video_width, ma per 1080x1920 default va bene
            print(f"Reusing existing spectrogram image: {spectrogram_png} ({width}x{height})")
        
        if not args.png_only and height <= video_height:
            raise RuntimeError(
                f"Spectrogram height ({height}px) must be larger than VIDEO_HEIGHT ({video_height}px) "
                "to allow vertical scrolling."
            )
        scroll_range_px = height - video_height
        print(f"Scrollable height: {scroll_range_px} px")
    else:
        if not png_exists:
            arr2d = np.flipud(S_img)
            color_arr = palette[arr2d]
            height, width = color_arr.shape[0], color_arr.shape[1]
            print(f"Raw horizontal spectrogram size: {width}x{height}")
            if height != video_height:
                new_width = int(round(width * (video_height / float(height))))
                img = Image.fromarray(color_arr, mode="RGB").resize((new_width, video_height), resample=Image.BICUBIC)
                width, height = img.size
                print(f"Resized horizontal spectrogram size: {width}x{height}")
            else:
                img = Image.fromarray(color_arr, mode="RGB")

            img.save(spectrogram_png)
            print(f"Saved spectrogram image: {spectrogram_png}")
        else:
            with Image.open(spectrogram_png) as existing_img:
                width, height = existing_img.size
            print(f"Reusing existing spectrogram image: {spectrogram_png} ({width}x{height})")
        
        if not args.png_only and width <= video_width:
            raise RuntimeError(
                f"Spectrogram width ({width}px) must be larger than VIDEO_WIDTH ({video_width}px) "
                "to allow horizontal scrolling."
            )
        print(f"Scrollable width: {width - video_width} px")

    # NOTE: scrollable width/height already validated in branches above

    # Solo PNG: fermati qui dopo aver creato/rigenerato l'immagine
    if args.png_only:
        print(f"PNG only requested. Generated/Reused: {spectrogram_png}")
        return

    # Scrolling sincronizzato 1:1 con l'audio (niente adelay):
    duration_str = f"{main_duration_sec:.3f}"
    audio_delay_ms = 0
    if args.orientation == "horizontal":
        # Scorrimento orizzontale con linea verticale al centro
        center_y = int(round(video_height / 2))
        half = max(1, LINE_THICKNESS // 2)
        # Linea verticale allineata a sinistra, lunga line_length px, centrata verticalmente
        line_draw_x = 0
        line_draw_y = max(0, center_y - args.line_length // 2)
        # x(t) scorre da sinistra a destra linearmente
        x_expr = f"(iw-{video_width})*t/{duration_str}"
        # ritardo audio: tempo perché il punto x=center_x venga raggiunto
        scroll_w = max(1, width - video_width)
        audio_delay_ms = int(round((video_width / 2) * main_duration_sec / scroll_w * 1000))
        if args.preview_frame:
            # Anteprima: usa posizione costante lungo lo scorrimento
            frac = min(max(args.preview_frac, 0.0), 1.0)
            x_const = int(round((width - video_width) * frac))
            if args.rotate_ccw:
                filter_complex = (
                    f"[0:v]crop={video_width}:{video_height}:{x_const}:0,setsar=1[base];"
                    f"[base]drawbox=x={line_draw_x}:y={line_draw_y}:w={LINE_THICKNESS}:h={args.line_length}:color=0x00ff00@1.0:t=fill[d];"
                    f"[d]transpose=2[v]"
                )
            else:
                filter_complex = (
                    f"[0:v]crop={video_width}:{video_height}:{x_const}:0,setsar=1[base];"
                    f"[base]drawbox=x={line_draw_x}:y={line_draw_y}:w={LINE_THICKNESS}:h={args.line_length}:color=0x00ff00@1.0:t=fill[v]"
                )
        else:
            # Video completo con audio
            if args.rotate_ccw:
                filter_complex = (
                    f"[0:v]crop={video_width}:{video_height}:{x_expr}:0,setsar=1[base];"
                    f"[base]drawbox=x={line_draw_x}:y={line_draw_y}:w={LINE_THICKNESS}:h={args.line_length}:color=0x00ff00@1.0:t=fill[d];"
                    f"[d]transpose=2[v];"
                    f"[1:a]adelay={audio_delay_ms}|{audio_delay_ms}[a]"
                )
            else:
                filter_complex = (
                    f"[0:v]crop={video_width}:{video_height}:{x_expr}:0,setsar=1[base];"
                    f"[base]drawbox=x={line_draw_x}:y={line_draw_y}:w={LINE_THICKNESS}:h={args.line_length}:color=0x00ff00@1.0:t=fill[v];"
                    f"[1:a]adelay={audio_delay_ms}|{audio_delay_ms}[a]"
                )
    else:
        # Scorrimento verticale con linea orizzontale al centro, perfettamente sincronizzato
        center_y = int(round(video_height / 2))
        half = max(1, LINE_THICKNESS // 2)
        line_draw_y = max(0, center_y - half)
        # y(t) = (px_start - center_y) + px_per_sec * t, clampato entro l'immagine
        pre_sec_eff = start_sec - spec_start_sec
        px_start = pre_sec_eff * px_per_sec
        y0 = max(0.0, px_start - center_y)
        max_y = max(0, height - video_height)
        # Nota: la virgola nella min() va escapata per ffmpeg filtergraph
        y_expr = f"min({max_y:.6f}\\, {y0:.6f}+{px_per_sec:.6f}*t)"
        if args.preview_frame:
            # Anteprima: posizione costante lungo lo scorrimento
            frac = min(max(args.preview_frac, 0.0), 1.0)
            y_const = min(max_y, y0 + px_per_sec * (main_duration_sec * frac))
            if args.rotate_ccw:
                filter_complex = (
                    f"[0:v]crop={video_width}:{video_height}:0:{y_const:.6f},setsar=1[base];"
                    f"[base]drawbox=x=0:y={line_draw_y}:w={args.line_length}:h={LINE_THICKNESS}:color=0x00ff00@1.0:t=fill[d];"
                    f"[d]transpose=2[v]"
                )
            else:
                filter_complex = (
                    f"[0:v]crop={video_width}:{video_height}:0:{y_const:.6f},setsar=1[base];"
                    f"[base]drawbox=x=0:y={line_draw_y}:w={args.line_length}:h={LINE_THICKNESS}:color=0x00ff00@1.0:t=fill[v]"
                )
        else:
            # Video completo con audio (senza adelay): inoltra l'audio con anull
            if args.rotate_ccw:
                filter_complex = (
                    f"[0:v]crop={video_width}:{video_height}:0:{y_expr},setsar=1[base];"
                    f"[base]drawbox=x=0:y={line_draw_y}:w={args.line_length}:h={LINE_THICKNESS}:color=0x00ff00@1.0:t=fill[d];"
                    f"[d]transpose=2[v];"
                    f"[1:a]anull[a]"
                )
            else:
                filter_complex = (
                    f"[0:v]crop={video_width}:{video_height}:0:{y_expr},setsar=1[base];"
                    f"[base]drawbox=x=0:y={line_draw_y}:w={args.line_length}:h={LINE_THICKNESS}:color=0x00ff00@1.0:t=fill[v];"
                    f"[1:a]anull[a]"
                )

    output_video = Path(args.output) if hasattr(args, "output") and args.output else Path(OUTPUT_VIDEO)
    if suffix:
        output_video = output_video.with_name(output_video.stem + suffix + output_video.suffix)

    cmd = [
        "ffmpeg",
        "-y",
        "-loop", "1",                  # loop dell'immagine
        "-framerate", str(FPS),        # fps del video
        "-i", str(spectrogram_png),    # input video (immagine)
    ]

    # Se necessario, seek nell'audio all'inizio del segmento (solo video completo)
    if not args.preview_frame:
        if start_sec > 0:
            cmd += ["-ss", f"{start_sec:.3f}"]
        cmd += ["-i", str(audio_path)]

    if args.preview_frame:
        # Output singolo frame PNG
        preview_path = output_video.with_suffix(".preview.png")
        cmd += [
            "-filter_complex", filter_complex,
            "-map", "[v]",
            "-frames:v", "1",
            str(preview_path),
        ]
    else:
        cmd += [
            "-filter_complex", filter_complex,
            "-map", "[v]",
            "-map", "[a]",
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
