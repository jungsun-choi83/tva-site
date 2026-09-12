const EPSILON = 1e-9;
const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function hashSeed(value) {
  const text = String(value ?? "fracture");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function clipToSite(polygon, site, other) {
  const nx = other.x - site.x;
  const ny = other.y - site.y;
  const limit = (other.x * other.x + other.y * other.y - site.x * site.x - site.y * site.y) / 2;
  const result = [];

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const startDistance = start.x * nx + start.y * ny - limit;
    const endDistance = end.x * nx + end.y * ny - limit;
    const startInside = startDistance <= EPSILON;
    const endInside = endDistance <= EPSILON;

    if (startInside) result.push(start);
    if (startInside !== endInside) {
      const ratio = startDistance / (startDistance - endDistance);
      result.push({
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      });
    }
  }
  return result;
}

function polygonMetrics(points) {
  let twiceArea = 0;
  let weightedX = 0;
  let weightedY = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const next = points[(index + 1) % points.length];
    const cross = point.x * next.y - next.x * point.y;
    twiceArea += cross;
    weightedX += (point.x + next.x) * cross;
    weightedY += (point.y + next.y) * cross;
  }
  const area = Math.abs(twiceArea) / 2;
  const divisor = 3 * twiceArea;
  return {
    area,
    centroid: {
      x: weightedX / divisor,
      y: weightedY / divisor,
    },
  };
}

function cleanPolygon(points, width, height) {
  const cleaned = [];
  for (const point of points) {
    const bounded = {
      x: clamp(Math.abs(point.x) < EPSILON ? 0 : point.x, 0, width),
      y: clamp(Math.abs(point.y) < EPSILON ? 0 : point.y, 0, height),
    };
    const previous = cleaned.at(-1);
    if (!previous || Math.hypot(bounded.x - previous.x, bounded.y - previous.y) > EPSILON) {
      cleaned.push(bounded);
    }
  }
  if (cleaned.length > 1) {
    const first = cleaned[0];
    const last = cleaned.at(-1);
    if (Math.hypot(first.x - last.x, first.y - last.y) <= EPSILON) cleaned.pop();
  }
  return cleaned;
}

function makePath(points) {
  const number = (value) => Number(value.toFixed(6));
  return `${points.map((point, index) => `${index ? "L" : "M"}${number(point.x)} ${number(point.y)}`).join(" ")} Z`;
}

function makeSites(width, height, count, impact, random) {
  const sites = [{ x: impact.x, y: impact.y }];
  const farthest = Math.max(
    Math.hypot(impact.x, impact.y),
    Math.hypot(width - impact.x, impact.y),
    Math.hypot(impact.x, height - impact.y),
    Math.hypot(width - impact.x, height - impact.y),
  );

  const spokeCount = Math.max(7, Math.round(Math.sqrt(count) * 1.55));
  const ringCount = Math.ceil((count - 1) / spokeCount);
  for (let index = 1; index < count; index += 1) {
    const spoke = (index - 1) % spokeCount;
    const ring = Math.floor((index - 1) / spokeCount);
    const ringProgress = (ring + .42 + random() * .22) / Math.max(1, ringCount);
    const radius = farthest * Math.pow(ringProgress, .84);
    const angle = spoke / spokeCount * TAU + ring * GOLDEN_ANGLE * .17 + (random() - .5) * .13;
    sites.push({
      x: clamp(impact.x + Math.cos(angle) * radius, 0, width),
      y: clamp(impact.y + Math.sin(angle) * radius, 0, height),
    });
  }

  // Clamping can stack outer sites at corners. A tiny deterministic inset keeps
  // every requested shard represented without changing the authored pattern.
  for (let index = 0; index < sites.length; index += 1) {
    for (let prior = 0; prior < index; prior += 1) {
      if (Math.hypot(sites[index].x - sites[prior].x, sites[index].y - sites[prior].y) < EPSILON) {
        const inset = Math.min(width, height) * (index + 1) * 1e-6;
        sites[index] = {
          x: clamp(sites[index].x + Math.cos(index * GOLDEN_ANGLE) * inset, 0, width),
          y: clamp(sites[index].y + Math.sin(index * GOLDEN_ANGLE) * inset, 0, height),
        };
      }
    }
  }
  return sites;
}

function makeMotion(cell, impact, width, height, random) {
  let dx = cell.centroid.x - impact.x;
  let dy = cell.centroid.y - impact.y;
  const distance = Math.hypot(dx, dy);
  if (distance < EPSILON) {
    const angle = random() * TAU;
    dx = Math.cos(angle);
    dy = Math.sin(angle);
  } else {
    dx /= distance;
    dy /= distance;
  }
  const diagonal = Math.hypot(width, height);
  const tangent = (random() - 0.5) * 0.24;
  const outward = { x: dx - dy * tangent, y: dy + dx * tangent };
  const length = Math.hypot(outward.x, outward.y);
  outward.x /= length;
  outward.y /= length;

  const axisAngle = random() * TAU;
  const axisZ = (random() - 0.5) * 0.5;
  const axisLength = Math.hypot(Math.cos(axisAngle), Math.sin(axisAngle), axisZ);
  return {
    pivot: { ...cell.centroid },
    outward,
    rotationAxis: {
      x: Math.cos(axisAngle) / axisLength,
      y: Math.sin(axisAngle) / axisLength,
      z: axisZ / axisLength,
    },
    delay: clamp(distance / diagonal * 0.28 + random() * 0.055, 0, 0.34),
    damping: 1.65 + random() * 1.15,
    exitDistance: diagonal * (0.54 + random() * 0.38),
    lift: diagonal * (0.035 + random() * 0.11),
    depth: diagonal * (0.22 + random() * 0.34),
    rotation: (0.42 + random() * 1.18) * (random() < 0.5 ? -1 : 1),
  };
}

/**
 * Builds a deterministic Voronoi partition of a rectangular glass pane.
 * Cell polygons are the single shared source for intact glass and shards.
 */
export function createFracture({ width, height, seed, count, impact = {} }) {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new RangeError("width and height must be positive finite numbers");
  }
  if (!Number.isInteger(count) || count < 2) {
    throw new RangeError("count must be an integer of at least 2");
  }

  const boundedImpact = {
    x: clamp(Number.isFinite(impact.x) ? impact.x : width / 2, 0, width),
    y: clamp(Number.isFinite(impact.y) ? impact.y : height / 2, 0, height),
  };
  const random = mulberry32(hashSeed(seed));
  const sites = makeSites(width, height, count, boundedImpact, random);
  const rectangle = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];

  const cells = sites.map((site, id) => {
    let polygon = rectangle.map((point) => ({ ...point }));
    for (let otherIndex = 0; otherIndex < sites.length && polygon.length; otherIndex += 1) {
      if (otherIndex !== id) polygon = clipToSite(polygon, site, sites[otherIndex]);
    }
    polygon = cleanPolygon(polygon, width, height);
    if (polygon.length < 3) throw new Error(`Unable to construct fracture cell ${id}`);
    const metrics = polygonMetrics(polygon);
    const cell = { id, site: { ...site }, polygon, path: makePath(polygon), ...metrics };
    return { ...cell, motion: makeMotion(cell, boundedImpact, width, height, random) };
  });

  return {
    width,
    height,
    seed,
    impact: boundedImpact,
    area: width * height,
    cells,
  };
}

/** Evaluates one cell's authored trajectory directly from progress. */
export function sampleShard(cell, progress) {
  if (!cell?.motion) throw new TypeError("cell must come from createFracture");
  const p = clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
  const local = clamp((p - cell.motion.delay) / (1 - cell.motion.delay), 0, 1);
  if (local === 0) {
    return { x: 0, y: 0, z: 0, rotation: 0, rotationAxis: { ...cell.motion.rotationAxis } };
  }
  const eased = 1 - Math.exp(-cell.motion.damping * local);
  const normalized = eased / (1 - Math.exp(-cell.motion.damping));
  const arc = Math.sin(Math.PI * local) * cell.motion.lift;
  return {
    x: cell.motion.outward.x * cell.motion.exitDistance * normalized,
    y: cell.motion.outward.y * cell.motion.exitDistance * normalized - arc,
    z: cell.motion.depth * normalized,
    rotation: cell.motion.rotation * normalized,
    rotationAxis: { ...cell.motion.rotationAxis },
  };
}
