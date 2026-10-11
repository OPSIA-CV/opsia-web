#!/bin/bash
# Assets livianos del hero scroll world: stills WebP en dos tamaños + video de detección recomprimido.
# Las escenas se animan en vivo en el navegador (transformaciones GPU), no hay clips pre-renderizados.
# Uso: bash scripts/build-world-assets.sh   (requiere ffmpeg con libwebp)
set -euo pipefail
cd "$(dirname "$0")/.."
A=src/assets
OUT=public/world
mkdir -p "$OUT"
img() {
  ffmpeg -v error -y -i "$2" -vf "scale='min(1600,iw)':-2:flags=lanczos" -c:v libwebp -quality 72 "$OUT/$1.webp"
  ffmpeg -v error -y -i "$2" -vf "scale=900:-2:flags=lanczos" -c:v libwebp -quality 68 "$OUT/$1-sm.webp"
}
img 01-rajo $A/hero-mine.jpg
img 03-mineria $A/ind-mining.jpg
img 06-equipo $A/hero-cam04.jpg
ffmpeg -v error -y -ss 0 -i $A/source/demo-mina.mp4 -frames:v 1 -c:v libwebp -quality 70 "$OUT/02-deteccion.webp"
ffmpeg -v error -y -i $A/source/demo-mina.mp4 -an -vf "fps=24" -c:v libx264 -preset slow -crf 30 \
  -pix_fmt yuv420p -profile:v main -movflags +faststart "$OUT/02-deteccion.mp4"
ls -la "$OUT"
