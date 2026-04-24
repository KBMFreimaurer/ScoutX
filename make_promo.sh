#!/bin/bash
# ScoutX Promo Builder — Codex/Apple Produkt-Video Stil
# Struktur: Text-Slide → Demo-Clip → Text-Slide → Demo-Clip (abwechselnd)
# Ästhetik: Weißer Hintergrund, große saubere Helvetica Neue Bold, kein Outline
set -e

INPUT="/Users/playboiiboggos/.openclaw/workspace/ScoutX/2026-04-21 19-00-00.mov"
OUTPUT="/Users/playboiiboggos/.openclaw/workspace/ScoutX/scoutx_promo.mp4"
WORK="/tmp/scoutx_promo"
FONT="/System/Library/Fonts/HelveticaNeue.ttc"

mkdir -p "$WORK"
echo "=============================================="
echo " ScoutX Promo Builder (Codex-Stil)"
echo "=============================================="

# ── Python: Text-Slides auf weißem Hintergrund ────────────────────────────
echo "[1/5] Erzeuge Text-Slides..."

cat > "$WORK/mkslide.py" << 'PYEOF'
from PIL import Image, ImageDraw, ImageFont
import sys, textwrap

lines  = sys.argv[1].split('|')   # | als Zeilenumbruch
output = sys.argv[2]
W, H   = 1920, 1080
BG     = (255, 255, 255)          # Weißer Hintergrund wie im Referenz-Video
FG     = (10,  10,  10)           # Fast-Schwarz

img  = Image.new('RGB', (W, H), BG)
draw = ImageDraw.Draw(img)

# Helvetica Neue Bold, index=1
font_big = ImageFont.truetype(
    '/System/Library/Fonts/HelveticaNeue.ttc', 96, index=1
)
font_sub = ImageFont.truetype(
    '/System/Library/Fonts/HelveticaNeue.ttc', 52, index=0
)

# Messe Gesamthöhe aller Zeilen
total_h = 0
line_sizes = []
for i, line in enumerate(lines):
    fnt = font_big if i == 0 else font_sub
    bb  = draw.textbbox((0, 0), line, font=fnt)
    lw, lh = bb[2] - bb[0], bb[3] - bb[1]
    line_sizes.append((lw, lh, fnt))
    total_h += lh + (24 if i > 0 else 0)

# Vertikal zentrieren
y = (H - total_h) // 2

for i, (line, (lw, lh, fnt)) in enumerate(zip(lines, line_sizes)):
    x = (W - lw) // 2
    if i > 0:
        y += 24
    draw.text((x, y), line, font=fnt, fill=FG)
    y += lh

img.save(output)
PYEOF

# Slide-Inhalte: Zeile1|Zeile2 (| = Zeilenumbruch; Zeile1 groß, Rest kleiner)
declare -a SLIDES=(
  "ScoutX.|KI-gestütztes Scouting für Borussia NLZ"
  "Region. Kreis. Altersklasse.|In 7 Schritten konfiguriert."
  "47 Spiele.|Automatisch geladen."
  "Direktlink zu fussball.de.|Kein manuelles Suchen."
  "Scout-Plan generiert.|Fahrtkosten, Route, Zeitplan — alles drin."
  "ScoutX.|Niederrhein / FVN"
)

for i in "${!SLIDES[@]}"; do
  n=$(printf "%02d" $((i+1)))
  python3 "$WORK/mkslide.py" "${SLIDES[$i]}" "$WORK/slide${n}.png"
  echo "      Slide${n}: ${SLIDES[$i]}"
done

# ── FFmpeg: PNGs → kurze Video-Clips (2.5s) mit Fade-In/Out ───────────────
echo "[2/5] Rendere Text-Slide-Videos..."

for i in "${!SLIDES[@]}"; do
  n=$(printf "%02d" $((i+1)))
  DUR=2.5
  # Letzter Slide etwas länger
  [ "$i" -eq "$((${#SLIDES[@]}-1))" ] && DUR=3.0
  ffmpeg -loop 1 -i "$WORK/slide${n}.png" \
    -vf "fade=t=in:st=0:d=0.25,fade=t=out:st=$(python3 -c "print($DUR-0.25)"):d=0.25" \
    -t "$DUR" -r 30 -pix_fmt yuv420p \
    -c:v libx264 -preset fast -crf 17 \
    -an \
    -y "$WORK/slide${n}.mp4" -loglevel quiet
  echo "      slide${n}.mp4 (${DUR}s)"
done

# ── FFmpeg: Demo-Segmente aus dem Raw-Video ────────────────────────────────
echo "[3/5] Extrahiere Demo-Clips..."

# Funktion: START END SPEED OUTPUT_NAME
demo() {
  local ss=$1 to=$2 spd=$3 name=$4
  local out="$WORK/${name}.mp4"
  if [ "$spd" = "1.0" ]; then
    ffmpeg -ss "$ss" -to "$to" -i "$INPUT" \
      -vf "scale=1728:1080,pad=1920:1080:96:0:black,fps=30" \
      -c:v libx264 -preset fast -crf 17 -pix_fmt yuv420p \
      -c:a aac -b:a 128k -y "$out" -loglevel quiet
  else
    ffmpeg -ss "$ss" -to "$to" -i "$INPUT" \
      -vf "setpts=PTS/${spd},scale=1728:1080,pad=1920:1080:96:0:black,fps=30" \
      -af "atempo=${spd}" \
      -c:v libx264 -preset fast -crf 17 -pix_fmt yuv420p \
      -c:a aac -b:a 128k -y "$out" -loglevel quiet
  fi
  echo "      ${name}: ${ss}s-${to}s @ ${spd}x"
}

# Demo 1: Setup Schritt 1-4 (Region → Altersklasse → Zeitraum → Startpunkt)
demo  3  42  2.0  demo01

# Demo 2: Summary → Spieleliste laden
demo  42  78  1.5  demo02

# Demo 3: fussball.de Direktlink kurz
demo  78  87  2.0  demo03

# Demo 4: Spielauswahl + Plan-Seite
demo  87  125  1.5  demo04

# ── Concat-Liste: Text-Slides + Demo-Clips abwechselnd ────────────────────
echo "[4/5] Zusammenfuegen..."

# Struktur wie Referenz-Video: Slide → Demo → Slide → Demo → ...
# slide01: ScoutX Hook
# demo01:  Setup-Flow
# slide02: Region / Konfiguration
# demo02:  Spieleliste
# slide03: 47 Spiele
# demo03:  fussball.de
# slide04: Direktlink
# demo04:  Plan
# slide05: Plan generiert
# slide06: Outro

cat > "$WORK/concat.txt" << 'CONCATEOF'
file '/tmp/scoutx_promo/slide01.mp4'
file '/tmp/scoutx_promo/demo01.mp4'
file '/tmp/scoutx_promo/slide02.mp4'
file '/tmp/scoutx_promo/demo02.mp4'
file '/tmp/scoutx_promo/slide03.mp4'
file '/tmp/scoutx_promo/demo03.mp4'
file '/tmp/scoutx_promo/slide04.mp4'
file '/tmp/scoutx_promo/demo04.mp4'
file '/tmp/scoutx_promo/slide05.mp4'
file '/tmp/scoutx_promo/slide06.mp4'
CONCATEOF

# Demo-Clips haben Audio, Slides nicht → stille Audio-Spur zu Slides hinzufügen
for i in $(seq -f "%02g" 1 6); do
  ffmpeg -i "$WORK/slide${i}.mp4" \
    -f lavfi -i "anullsrc=r=48000:cl=stereo" \
    -c:v copy -c:a aac -b:a 128k \
    -shortest -y "$WORK/slide${i}_a.mp4" -loglevel quiet

  # Ersetze in concat-Liste
  sed -i '' "s|slide${i}.mp4|slide${i}_a.mp4|g" "$WORK/concat.txt"
done

ffmpeg -f concat -safe 0 -i "$WORK/concat.txt" \
  -c copy "$WORK/raw_concat.mp4" -y -loglevel quiet

DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$WORK/raw_concat.mp4" | xargs printf "%.1f")
echo "      Gesamt-Dauer: ${DUR}s"

# ── Finaler Fade-Out ───────────────────────────────────────────────────────
echo "[5/5] Finaler Render..."
FADE_ST=$(python3 -c "print($DUR-1.5)")

ffmpeg -i "$WORK/raw_concat.mp4" \
  -vf "fade=t=out:st=${FADE_ST}:d=1.5" \
  -c:v libx264 -preset fast -crf 17 -pix_fmt yuv420p \
  -c:a aac -b:a 192k \
  -y "$OUTPUT" -loglevel warning

echo ""
echo "=============================================="
echo " FERTIG!"
echo "=============================================="
echo " Output: $OUTPUT"
echo ""
ffprobe -v quiet \
  -show_entries "format=duration : stream=width,height,codec_name,codec_type" \
  -of default=noprint_wrappers=1 "$OUTPUT" 2>/dev/null \
  | grep -E "width|height|codec_name|duration"
echo ""
echo " Vorschau: open \"$OUTPUT\""
