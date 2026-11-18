#!/bin/bash
# Assets livianos del hero scroll world: stills WebP en dos tamaños + video de detección recomprimido.
# Las escenas se animan en vivo en el navegador (transformaciones GPU), no hay clips pre-renderizados.
# Uso: bash scripts/build-world-assets.sh   (requiere ffmpeg y cwebp: brew install ffmpeg webp)
set -euo pipefail
cd "$(dirname "$0")/.."
A=src/assets
OUT=public/world
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

# img <nombre> <fuente> [filtro de color de ffmpeg]
img() {
  local grade="${3:-null}"
  ffmpeg -v error -y -i "$2" -vf "scale='min(1600,iw)':-2:flags=lanczos,$grade" "$TMP/$1.png"
  ffmpeg -v error -y -i "$2" -vf "scale=900:-2:flags=lanczos,$grade" "$TMP/$1-sm.png"
  cwebp -quiet -q 72 "$TMP/$1.png" -o "$OUT/$1.webp"
  cwebp -quiet -q 68 "$TMP/$1-sm.png" -o "$OUT/$1-sm.webp"
}

# El rajo original es una toma nocturna casi negra: se levantan sombras y medios tonos para que
# el pozo, la rampa y los camiones se lean bajo el degradé del texto.
RAJO_GRADE="curves=all='0/0.04 0.25/0.36 0.5/0.62 1/1',eq=saturation=1.15"

img 01-rajo $A/hero-mine.jpg "$RAJO_GRADE"
img 03-mineria $A/ind-mining.jpg
img 06-equipo $A/hero-cam04.jpg
ffmpeg -v error -y -ss 0 -i $A/source/demo-mina.mp4 -frames:v 1 "$TMP/02-deteccion.png"
cwebp -quiet -q 70 "$TMP/02-deteccion.png" -o "$OUT/02-deteccion.webp"
ffmpeg -v error -y -i $A/source/demo-mina.mp4 -an -vf "fps=24" -c:v libx264 -preset slow -crf 30 \
  -pix_fmt yuv420p -profile:v main -movflags +faststart "$OUT/02-deteccion.mp4"
ls -la "$OUT"
