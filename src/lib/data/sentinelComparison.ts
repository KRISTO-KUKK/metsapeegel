import { bbox as turfBbox } from "@turf/turf";
import type { Geometry } from "geojson";
import jpeg from "jpeg-js";
import proj4 from "proj4";
import type {
  SentinelComparisonImage,
  SentinelComparisonResult,
  SentinelImageStats
} from "@/lib/types/forestry";

const esthubCatalogUrl = "https://esthub.maaruum.ee/index.php";
const defaultProbeWidth = 600;
const defaultImageWidth = 1200;
const defaultMaxDatesToScan = 18;
const defaultMaxCloudRatio = 0.35;
const sensorCatalogCodes: Record<string, string> = { "sentinel-2": "S2" };

proj4.defs(
  "EPSG:3301",
  "+proj=lcc +lat_1=59.33333333333334 +lat_2=58 +lat_0=57.51755393055556 +lon_0=24 +x_0=500000 +y_0=6375000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +axis=neu +no_defs"
);

type DecodedImage = {
  width: number;
  height: number;
  data: Uint8Array | Buffer;
};

type Candidate = {
  date: string;
  score: number;
  cloudRatio: number;
  isBlank: boolean;
  isCloudy: boolean;
  isValid: boolean;
  imageUrl: string;
  stats: SentinelImageStats;
};

function monthBounds(referenceDate: Date): [Date, Date] {
  const start = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1));
  const end = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 0));
  return [start, end];
}

function previousMonthBounds(referenceDate: Date): [Date, Date] {
  return monthBounds(new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - 1, 1)));
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function sensorCatalogCode(sensor: string): string {
  const code = sensorCatalogCodes[sensor];
  if (!code) {
    throw new Error(`Unsupported sensor for catalogue lookup: ${sensor}`);
  }
  return code;
}

function epsg3301BboxFromGeometry(geometry: Geometry): [number, number, number, number] {
  const [west, south, east, north] = turfBbox({
    type: "Feature",
    properties: {},
    geometry
  });
  const corners = [
    [west, south],
    [west, north],
    [east, south],
    [east, north]
  ].map(([lng, lat]) => proj4("EPSG:4326", "EPSG:3301", [lng, lat]));
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function mapboxFromGeometry(geometry: Geometry): string {
  return epsg3301BboxFromGeometry(geometry)
    .map((coordinate) => coordinate.toFixed(2))
    .join(",");
}

function imageDimensionsForMapbox(mapbox: string, width: number): [number, number] {
  const [west, south, east, north] = mapbox.split(",").map(Number);
  if ([west, south, east, north].some((coordinate) => !Number.isFinite(coordinate))) {
    throw new Error("Sentinel BBOX is invalid.");
  }
  const aspectRatio = (east - west) / (north - south);
  let imageWidth = Math.max(1, Math.min(4000, width));
  let imageHeight = Math.round(imageWidth / aspectRatio);
  if (imageHeight > 4000) {
    imageHeight = 4000;
    imageWidth = Math.max(1, Math.round(imageHeight * aspectRatio));
  }
  return [imageWidth, Math.max(1, imageHeight)];
}

function buildSatelliteImageUrl({
  imageDate,
  mapbox,
  sensor,
  imageFilter,
  resample,
  width,
  height
}: {
  imageDate: string;
  mapbox: string;
  sensor: string;
  imageFilter: string;
  resample: string;
  width: number;
  height: number;
}): string {
  const layerFilter = imageFilter === "msi" ? "msi" : imageFilter;
  const layerName = `${sensor.replace(/-/g, "_")}_${layerFilter}`;
  const params = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.1.1",
    REQUEST: "GetMap",
    FORMAT: "image/jpeg",
    LAYERS: layerName,
    STYLES: "",
    SRS: "EPSG:3301",
    BBOX: mapbox,
    WIDTH: String(width),
    HEIGHT: String(height),
    date: imageDate,
    resample
  });

  return `https://teenus.maaamet.ee/ows/wms-${sensor}-${layerFilter}?${params.toString()}`;
}

async function fetchEsthubDates(startDate: Date, endDate: Date, sensor: string): Promise<string[]> {
  const url = new URL(esthubCatalogUrl);
  url.search = new URLSearchParams({
    page_id: "1",
    satelliit: sensorCatalogCode(sensor),
    kuupaev_algus: isoDate(startDate),
    kuupaev_lopp: isoDate(endDate),
    formaat: "json"
  }).toString();

  const response = await fetch(url, {
    headers: { "User-Agent": "metsapeegel/0.1" },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`ESTHub catalogue request failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    return [];
  }

  const dates = new Set<string>();
  for (const item of payload) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const product = String((item as { product?: unknown }).product ?? "RGB").toUpperCase();
    const itemDate = (item as { date?: unknown }).date;
    if (product !== "RGB" || typeof itemDate !== "string") {
      continue;
    }
    dates.add(itemDate);
  }

  return Array.from(dates).sort((left, right) => right.localeCompare(left));
}

async function fetchImageBytes(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { "User-Agent": "metsapeegel/0.1" },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`WMS image request failed with HTTP ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!contentType.startsWith("image/")) {
    throw new Error(bytes.toString("utf-8") || "The WMS server did not return an image.");
  }
  return bytes;
}

function decodeJpeg(bytes: Buffer): DecodedImage {
  return jpeg.decode(bytes, { useTArray: true }) as DecodedImage;
}

function shannonEntropy(histogram: number[], total: number): number {
  let entropy = 0;
  for (const count of histogram) {
    if (count > 0) {
      const probability = count / total;
      entropy -= probability * Math.log2(probability);
    }
  }
  return entropy;
}

function grayscaleAt(decoded: DecodedImage, x: number, y: number): number {
  const offset = (y * decoded.width + x) * 4;
  return Math.round(
    decoded.data[offset] * 0.299 +
      decoded.data[offset + 1] * 0.587 +
      decoded.data[offset + 2] * 0.114
  );
}

function imageContentStats(bytes: Buffer, decoded: DecodedImage): SentinelImageStats {
  const histogram = Array.from({ length: 256 }, () => 0);
  let sum = 0;
  let sumSquares = 0;
  const total = decoded.width * decoded.height;

  for (let y = 0; y < decoded.height; y += 1) {
    for (let x = 0; x < decoded.width; x += 1) {
      const gray = grayscaleAt(decoded, x, y);
      histogram[gray] += 1;
      sum += gray;
      sumSquares += gray * gray;
    }
  }

  const mean = sum / total;
  const variance = Math.max(0, sumSquares / total - mean * mean);
  const sampleValues = new Set<number>();
  for (let y = 0; y < 64; y += 1) {
    for (let x = 0; x < 64; x += 1) {
      const sourceX = Math.min(decoded.width - 1, Math.round((x / 63) * (decoded.width - 1)));
      const sourceY = Math.min(decoded.height - 1, Math.round((y / 63) * (decoded.height - 1)));
      sampleValues.add(grayscaleAt(decoded, sourceX, sourceY));
    }
  }

  return {
    width: decoded.width,
    height: decoded.height,
    sizeBytes: bytes.length,
    grayscaleStddev: Math.sqrt(variance),
    grayscaleEntropy: shannonEntropy(histogram, total),
    uniqueSampleValues: sampleValues.size
  };
}

function imageLooksBlank(stats: SentinelImageStats): boolean {
  return (
    stats.sizeBytes < 2000 ||
    stats.grayscaleStddev < 3.0 ||
    stats.grayscaleEntropy < 1.0 ||
    stats.uniqueSampleValues < 12
  );
}

function estimateCloudRatio(decoded: DecodedImage): number {
  let cloudyPixels = 0;
  const sampleSize = 96;
  for (let y = 0; y < sampleSize; y += 1) {
    for (let x = 0; x < sampleSize; x += 1) {
      const sourceX = Math.min(decoded.width - 1, Math.round((x / (sampleSize - 1)) * (decoded.width - 1)));
      const sourceY = Math.min(decoded.height - 1, Math.round((y / (sampleSize - 1)) * (decoded.height - 1)));
      const offset = (sourceY * decoded.width + sourceX) * 4;
      const red = decoded.data[offset];
      const green = decoded.data[offset + 1];
      const blue = decoded.data[offset + 2];
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      const brightness = (red + green + blue) / 3;
      const saturation = maximum === 0 ? 0 : (maximum - minimum) / maximum;
      if (brightness >= 180 && saturation <= 0.28) {
        cloudyPixels += 1;
      }
    }
  }
  return cloudyPixels / (sampleSize * sampleSize);
}

function qualityScore(stats: SentinelImageStats, cloudRatio: number): number {
  return (
    stats.grayscaleEntropy * 2.0 +
    Math.min(stats.grayscaleStddev / 8.0, 6.0) +
    Math.min(stats.uniqueSampleValues / 40.0, 5.0) +
    Math.min(Math.log10(Math.max(stats.sizeBytes, 1)) - 3.0, 2.0) -
    cloudRatio * 12.0
  );
}

async function probeCandidateDate({
  imageDate,
  mapbox,
  sensor,
  imageFilter,
  resample,
  probeWidth,
  maxCloudRatio
}: {
  imageDate: string;
  mapbox: string;
  sensor: string;
  imageFilter: string;
  resample: string;
  probeWidth: number;
  maxCloudRatio: number;
}): Promise<Candidate> {
  const [width, height] = imageDimensionsForMapbox(mapbox, probeWidth);
  const imageUrl = buildSatelliteImageUrl({
    imageDate,
    mapbox,
    sensor,
    imageFilter,
    resample,
    width,
    height
  });
  const bytes = await fetchImageBytes(imageUrl);
  const decoded = decodeJpeg(bytes);
  const stats = imageContentStats(bytes, decoded);
  const cloudRatio = estimateCloudRatio(decoded);
  const isBlank = imageLooksBlank(stats);
  const isCloudy = cloudRatio > maxCloudRatio;
  return {
    date: imageDate,
    score: qualityScore(stats, cloudRatio),
    cloudRatio,
    isBlank,
    isCloudy,
    isValid: !isBlank && !isCloudy,
    imageUrl,
    stats
  };
}

async function rankMonthCandidates({
  startDate,
  endDate,
  mapbox,
  sensor,
  imageFilter,
  resample,
  probeWidth,
  maxDatesToScan,
  maxCloudRatio
}: {
  startDate: Date;
  endDate: Date;
  mapbox: string;
  sensor: string;
  imageFilter: string;
  resample: string;
  probeWidth: number;
  maxDatesToScan: number;
  maxCloudRatio: number;
}): Promise<Candidate[]> {
  const dates = (await fetchEsthubDates(startDate, endDate, sensor)).slice(0, maxDatesToScan);
  const candidates: Candidate[] = [];

  for (const imageDate of dates) {
    try {
      candidates.push(
        await probeCandidateDate({
          imageDate,
          mapbox,
          sensor,
          imageFilter,
          resample,
          probeWidth,
          maxCloudRatio
        })
      );
    } catch {
      continue;
    }
  }

  const validCandidates = candidates.filter((candidate) => candidate.isValid);
  if (validCandidates.length > 0) {
    return validCandidates.sort((left, right) => right.score - left.score);
  }

  const nonblankCandidates = candidates.filter((candidate) => !candidate.isBlank);
  return (nonblankCandidates.length > 0 ? nonblankCandidates : candidates).sort(
    (left, right) => right.score - left.score
  );
}

function selectedImage(candidate: Candidate, mapbox: string): SentinelComparisonImage {
  const [width, height] = imageDimensionsForMapbox(mapbox, defaultImageWidth);
  return {
    date: candidate.date,
    score: Math.round(candidate.score * 100) / 100,
    cloudRatio: Math.round(candidate.cloudRatio * 1000) / 1000,
    imageUrl: buildSatelliteImageUrl({
      imageDate: candidate.date,
      mapbox,
      sensor: "sentinel-2",
      imageFilter: "rgb",
      resample: "nearest",
      width,
      height
    }),
    stats: candidate.stats
  };
}

export async function findSentinelComparisonImages(
  geometry: Geometry,
  referenceDate = new Date()
): Promise<SentinelComparisonResult> {
  const sensor = "sentinel-2";
  const imageFilter = "rgb";
  const resample = "nearest";
  const mapbox = mapboxFromGeometry(geometry);
  const [currentStart, currentEnd] = monthBounds(referenceDate);
  const [previousStart, previousEnd] = previousMonthBounds(referenceDate);
  const [currentCandidates, previousCandidates] = await Promise.all([
    rankMonthCandidates({
      startDate: currentStart,
      endDate: currentEnd,
      mapbox,
      sensor,
      imageFilter,
      resample,
      probeWidth: defaultProbeWidth,
      maxDatesToScan: defaultMaxDatesToScan,
      maxCloudRatio: defaultMaxCloudRatio
    }),
    rankMonthCandidates({
      startDate: previousStart,
      endDate: previousEnd,
      mapbox,
      sensor,
      imageFilter,
      resample,
      probeWidth: defaultProbeWidth,
      maxDatesToScan: defaultMaxDatesToScan,
      maxCloudRatio: defaultMaxCloudRatio
    })
  ]);

  const currentCandidate = currentCandidates[0];
  const previousCandidate = previousCandidates[0];
  if (!currentCandidate || !previousCandidate) {
    throw new Error("Sentinel võrdluspilte ei leitud valitud ala jaoks.");
  }

  return {
    generatedAt: new Date().toISOString(),
    mapbox,
    sensor,
    filter: imageFilter,
    resample,
    currentMonth: {
      start: isoDate(currentStart),
      end: isoDate(currentEnd),
      selected: selectedImage(currentCandidate, mapbox),
      candidatesScanned: currentCandidates.length
    },
    previousMonth: {
      start: isoDate(previousStart),
      end: isoDate(previousEnd),
      selected: selectedImage(previousCandidate, mapbox),
      candidatesScanned: previousCandidates.length
    }
  };
}
