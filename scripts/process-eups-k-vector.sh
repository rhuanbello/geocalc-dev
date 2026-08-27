#!/usr/bin/env bash

# Produz os derivados vetoriais locais do mapa de erodibilidade (K) da Embrapa.
#
# Uso:
#   rtk bash scripts/process-eups-k-vector.sh /caminho/6340-k-mapa.gpkg /caminho/saida
#
# Pré-requisitos: Docker, rtk, GDAL, Tippecanoe e PMTiles nas imagens fixadas
# abaixo. O script não baixa dados, não altera a fonte e se recusa a
# sobrescrever saídas existentes.

set -euo pipefail

readonly LAYER_NAME="bra_erodibilidade_2024_sirgas2000"
readonly FGB_NAME="k-erodibilidade-6340.fgb"
readonly MBTILES_NAME="k-erodibilidade-6340.mbtiles"
readonly PMTILES_NAME="k-erodibilidade-6340.pmtiles"
readonly MANIFEST_NAME="k-erodibilidade-6340.local-manifest.txt"
readonly GDAL_IMAGE="ghcr.io/osgeo/gdal:ubuntu-small-3.10.3"
readonly TIPPECANOE_IMAGE="ghcr.io/openwatersio/tippecanoe:2.79.0@sha256:54e5aaa9c558b44c5402f585ab693d596b996a5df24b66f58769d3a537805636"
readonly PMTILES_IMAGE="protomaps/go-pmtiles:latest"

if [[ $# -ne 2 ]]; then
  echo "Uso: $0 <fonte-6340-k-mapa.gpkg> <diretorio-de-saida>" >&2
  exit 64
fi

source_gpkg="$1"
output_dir="$2"

if [[ ! -f "$source_gpkg" ]]; then
  echo "Fonte não encontrada: $source_gpkg" >&2
  exit 66
fi

source_gpkg="$(rtk realpath "$source_gpkg")"
source_dir="$(rtk dirname "$source_gpkg")"
source_file="$(rtk basename "$source_gpkg")"

rtk mkdir -p "$output_dir"
output_dir="$(rtk realpath "$output_dir")"

for artifact in "$FGB_NAME" "$MBTILES_NAME" "$PMTILES_NAME" "$MANIFEST_NAME"; do
  if [[ -e "$output_dir/$artifact" ]]; then
    echo "A saída já existe e não será sobrescrita: $output_dir/$artifact" >&2
    exit 73
  fi
done

# FlatGeobuf é a fonte de consulta: mantém todas as colunas e geometrias da
# camada 6340, com índice espacial para consultas por ponto/bounding box.
rtk docker run --rm \
  -v "$source_dir:/input:ro" \
  -v "$output_dir:/output" \
  "$GDAL_IMAGE" \
  ogr2ogr --config OGR2OGR_USE_ARROW_API NO -f FlatGeobuf \
  "/output/$FGB_NAME" \
  "/input/$source_file" \
  "$LAYER_NAME" \
  -lco SPATIAL_INDEX=YES \
  -lco TITLE="Erodibilidade dos solos do Brasil (K) — dataset 6340" \
  -lco DESCRIPTION="Derivado local do GeoPackage 6340; preserva atributos e geometrias para consulta espacial."

# PMTiles é exclusivamente a camada de visualização. O Tippecanoe consome o
# FlatGeobuf indexado e guarda somente os atributos necessários para estilo e
# contexto. A coalescência é permitida apenas nos tiles de menor zoom: jamais
# use este artefato para determinar o K selecionado.
rtk docker run --rm \
  -v "$output_dir:/data" \
  "$TIPPECANOE_IMAGE" \
  tippecanoe \
  "--output=/data/$MBTILES_NAME" \
  --layer=k_erodibilidade_6340 \
  --name="Erodibilidade dos solos do Brasil (K) — 6340" \
  --description="Camada de visualização derivada localmente do dataset 6340. Consulte o FlatGeobuf para atributos e geometria completos." \
  --minimum-zoom=4 \
  --maximum-zoom=12 \
  --read-parallel \
  --detect-shared-borders \
  --coalesce-densest-as-needed \
  --extend-zooms-if-still-dropping \
  --exclude-all \
  --include=ogc_fid \
  --include=cd_fcim \
  --include=nom_unidad \
  --include=cod_um \
  --include=cod_um2 \
  --include=legenda \
  --include=erod_um \
  --include=fator_k_um \
  --include=k_solos \
  "/data/$FGB_NAME"

rtk docker run --rm \
  -v "$output_dir:/data" \
  "$PMTILES_IMAGE" \
  convert "/data/$MBTILES_NAME" "/data/$PMTILES_NAME"

{
  echo "source_file=$source_file"
  echo "source_sha256=$(rtk sha256sum "$source_gpkg" | rtk awk '{print $1}')"
  echo "source_layer=$LAYER_NAME"
  echo "flatgeobuf=$FGB_NAME"
  echo "flatgeobuf_sha256=$(rtk sha256sum "$output_dir/$FGB_NAME" | rtk awk '{print $1}')"
  echo "mbtiles=$MBTILES_NAME"
  echo "mbtiles_sha256=$(rtk sha256sum "$output_dir/$MBTILES_NAME" | rtk awk '{print $1}')"
  echo "pmtiles=$PMTILES_NAME"
  echo "pmtiles_sha256=$(rtk sha256sum "$output_dir/$PMTILES_NAME" | rtk awk '{print $1}')"
  echo "generated_at_utc=$(rtk date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "gdal_image=$GDAL_IMAGE"
  echo "tippecanoe_image=$TIPPECANOE_IMAGE"
  echo "pmtiles_image=$PMTILES_IMAGE"
} > "$output_dir/$MANIFEST_NAME"

echo "Concluído. Valide os artefatos antes de publicação: $output_dir"
