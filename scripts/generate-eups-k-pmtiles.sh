#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
source_file="${1:-$project_root/Embrapa/dataset-6340.gpkg}"
output_file="${2:-$project_root/public/eups/k-erodibilidade.pmtiles}"
layer_name="bra_erodibilidade_2024_sirgas2000"

if [[ ! -f "$source_file" ]]; then
  echo "GeoPackage não encontrado: $source_file" >&2
  exit 1
fi

if [[ -e "$output_file" ]]; then
  echo "O arquivo de saída já existe: $output_file" >&2
  echo "Remova-o ou informe outro caminho para gerar novamente." >&2
  exit 1
fi

mkdir -p "$(dirname "$output_file")"

ogr2ogr \
  -f PMTiles \
  "$output_file" \
  "$source_file" \
  "$layer_name" \
  -nln k_erodibilidade \
  -select "ogc_fid,cod_um,k_solos,erod_um,fator_k_um,legenda" \
  -dsco NAME="Erodibilidade dos solos do Brasil" \
  -dsco DESCRIPTION="Fator K derivado da camada oficial Embrapa 6340" \
  -dsco MINZOOM=7 \
  -dsco MAXZOOM=12 \
  -dsco SIMPLIFICATION=0 \
  -dsco SIMPLIFICATION_MAX_ZOOM=0 \
  -dsco BUFFER=256 \
  -dsco MAX_SIZE=5000000 \
  -dsco MAX_FEATURES=200000

echo "PMTiles gerado: $output_file"
