// lib/util/get-readable-names.ts
import {
  getReadableNameForElement,
  getBoundsOfPcbElements,
  getReadableNameForPcbTrace,
  getPrimaryId
} from "@tscircuit/circuit-json-util";
var CIRCUIT_JSON_ID_PATTERN = /\b(?:pcb|source|schematic|subcircuit)_[a-z0-9_]+\b/i;
var sanitizeReadableName = (candidate, id, fallbackLabel) => {
  if (!candidate || candidate === id || id.length > 0 && candidate.includes(id) || CIRCUIT_JSON_ID_PATTERN.test(candidate)) {
    return fallbackLabel;
  }
  return candidate;
};
var firstReadableName = (candidates, id) => {
  for (const candidate of candidates) {
    const readableName = sanitizeReadableName(candidate, id, "");
    if (readableName) return readableName;
  }
  return "";
};
var getReadableNameForComponent = (circuitJson, pcbComponentId) => getReadableNameForElementId(circuitJson, pcbComponentId);
var getReadableNameForPort = (circuitJson, pcbPortId) => {
  const pcbPort = circuitJson.find(
    (element) => element.type === "pcb_port" && element.pcb_port_id === pcbPortId
  );
  if (pcbPort?.type === "pcb_port") {
    const sourcePort = circuitJson.find(
      (element) => element.type === "source_port" && element.source_port_id === pcbPort.source_port_id
    );
    const sourceComponent = sourcePort?.type === "source_port" ? circuitJson.find(
      (element) => element.type === "source_component" && element.source_component_id === sourcePort.source_component_id
    ) : null;
    const readableSourceComponentName = firstReadableName(
      [
        sourceComponent?.type === "source_component" ? sourceComponent.name : null
      ],
      sourceComponent?.type === "source_component" ? sourceComponent.source_component_id : ""
    );
    const readableSourcePortName = firstReadableName(
      [
        sourcePort?.type === "source_port" ? sourcePort.name : null,
        sourcePort?.type === "source_port" ? sourcePort.pin_number?.toString() : null,
        sourcePort?.type === "source_port" ? sourcePort.port_hints?.[0] : null
      ],
      sourcePort?.type === "source_port" ? sourcePort.source_port_id : ""
    );
    if (readableSourceComponentName && readableSourcePortName) {
      return `${readableSourceComponentName}.${readableSourcePortName}`;
    }
    if (readableSourcePortName) {
      return readableSourcePortName;
    }
  }
  return "unnamed port";
};
var getReadableNameForSourceTrace = (circuitJson, sourceTrace) => {
  const displayName = sanitizeReadableName(
    sourceTrace.display_name,
    sourceTrace.source_trace_id,
    ""
  );
  if (displayName) return displayName;
  const connectedPortNames = (sourceTrace.connected_source_port_ids ?? []).map((sourcePortId) => {
    const pcbPort = circuitJson.find(
      (element) => element.type === "pcb_port" && element.source_port_id === sourcePortId
    );
    if (pcbPort?.type === "pcb_port") {
      const name = getReadableNameForPort(circuitJson, pcbPort.pcb_port_id);
      return name === "unnamed port" ? null : name;
    }
    const sourcePort = circuitJson.find(
      (element) => element.type === "source_port" && element.source_port_id === sourcePortId
    );
    if (sourcePort?.type !== "source_port") return null;
    const sourceComponent = circuitJson.find(
      (element) => element.type === "source_component" && element.source_component_id === sourcePort.source_component_id
    );
    const sourceComponentName = sourceComponent?.type === "source_component" ? sanitizeReadableName(
      sourceComponent.name,
      sourceComponent.source_component_id,
      ""
    ) : "";
    const sourcePortName = firstReadableName(
      [
        sourcePort.name,
        sourcePort.pin_number?.toString(),
        sourcePort.port_hints?.[0]
      ],
      sourcePort.source_port_id
    );
    if (sourceComponentName && sourcePortName) {
      return `${sourceComponentName}.${sourcePortName}`;
    }
    return sourcePortName || null;
  }).filter((name) => Boolean(name));
  if (connectedPortNames.length >= 2) {
    return `${connectedPortNames[0]} to ${connectedPortNames[1]}`;
  }
  if (connectedPortNames.length === 1) {
    return `trace connected to ${connectedPortNames[0]}`;
  }
  return "unnamed trace";
};
var getReadableNameForElementId = (circuitJson, elementId) => {
  const element = circuitJson.find(
    (record) => getPrimaryId(record) === elementId
  );
  if (!element) return "unnamed element";
  if (element.type === "pcb_component" || element.type === "schematic_component") {
    const component = circuitJson.find(
      (record) => record.type === "source_component" && record.source_component_id === element.source_component_id
    );
    if (component?.type === "source_component")
      return sanitizeReadableName(
        component.name,
        component.source_component_id,
        "unnamed component"
      );
  }
  if ((element.type === "pcb_smtpad" || element.type === "pcb_plated_hole") && element.pcb_port_id) {
    const portName = getReadableNameForPort(circuitJson, element.pcb_port_id);
    if (portName !== "unnamed port") return portName;
  }
  if (element.type === "pcb_trace")
    return getReadableNameForTrace(circuitJson, elementId);
  const labels = {
    pcb_smtpad: "SMD pad",
    pcb_plated_hole: "through-hole pad",
    pcb_via: "via",
    pcb_hole: "hole",
    pcb_bend: "bend",
    pcb_stiffener: "stiffener",
    pcb_keepout: "keepout",
    pcb_cutout: "cutout",
    pcb_copper_pour: "copper pour"
  };
  const label = labels[element.type] ?? element.type.replace(/^(pcb|source|schematic)_/, "").replaceAll("_", " ");
  const explicitName = "name" in element ? element.name : void 0;
  const description = "description" in element ? element.description : void 0;
  return firstReadableName(
    [
      explicitName,
      description,
      getReadableNameForElement(circuitJson, elementId)
    ],
    elementId
  ) || `unnamed ${label}`;
};
var getReadableNameForTrace = (circuitJson, pcbTraceId) => {
  const trace = circuitJson.find(
    (record) => record.type === "pcb_trace" && record.pcb_trace_id === pcbTraceId
  );
  if (trace?.type === "pcb_trace" && trace.source_trace_id) {
    const sourceTrace = circuitJson.find(
      (record) => record.type === "source_trace" && record.source_trace_id === trace.source_trace_id
    );
    if (sourceTrace?.type === "source_trace")
      return getReadableNameForSourceTrace(circuitJson, sourceTrace);
  }
  return sanitizeReadableName(
    getReadableNameForPcbTrace(circuitJson, pcbTraceId),
    pcbTraceId,
    "unnamed trace"
  );
};
var containsCircuitJsonId = (message) => CIRCUIT_JSON_ID_PATTERN.test(message);
function getReadableNameForFootprintPad(circuitJson, pad, ordinal) {
  const padKind = pad.type === "pcb_smtpad" ? "SMD pad" : "through-hole pad";
  const portRef = pad.pcb_port_id ? getReadableNameForPort(circuitJson, pad.pcb_port_id) : null;
  const bounds = getBoundsOfPcbElements([pad]);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const location = `(${centerX.toFixed(2)}mm, ${centerY.toFixed(2)}mm)`;
  if (portRef) return `${padKind} ${portRef} at ${location}`;
  return `${padKind} #${ordinal + 1} at ${location}`;
}

// lib/check-traces-are-contiguous/is-point-in-pad.ts
import { pointToSegmentDistance } from "@tscircuit/math-utils";

// lib/check-each-pcb-trace-non-overlapping/segment-to-polygon-clearance.ts
import {
  distSq,
  getSegmentIntersection,
  isPointInsidePolygon,
  pointToSegmentClosestPoint,
  segmentToSegmentMinDistance
} from "@tscircuit/math-utils";
var rotatePoint = (point2, angleDegrees) => {
  const angle = angleDegrees * Math.PI / 180;
  return {
    x: point2.x * Math.cos(angle) - point2.y * Math.sin(angle),
    y: point2.x * Math.sin(angle) + point2.y * Math.cos(angle)
  };
};
var getRotatedRectPoints = ({
  x,
  y,
  width,
  height,
  ccwRotation
}) => {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  return [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight }
  ].map((point2) => {
    const rotated = rotatePoint(point2, ccwRotation);
    return { x: x + rotated.x, y: y + rotated.y };
  });
};
var getPillCenterLineForPad = (pad) => {
  let width;
  let height;
  let radius;
  let ccwRotation = 0;
  if (pad.type === "pcb_hole") {
    width = pad.hole_width;
    height = pad.hole_height;
    radius = Math.min(width, height) / 2;
    if (pad.hole_shape === "rotated_pill") ccwRotation = pad.ccw_rotation;
  } else if (pad.type === "pcb_plated_hole") {
    width = pad.outer_width;
    height = pad.outer_height;
    radius = Math.min(width, height) / 2;
    ccwRotation = pad.ccw_rotation;
  } else {
    width = pad.width;
    height = pad.height;
    radius = pad.radius;
    if (pad.shape === "rotated_pill") ccwRotation = pad.ccw_rotation;
  }
  const halfLineLength = Math.max(Math.max(width, height) / 2 - radius, 0);
  const axis = width >= height ? { x: halfLineLength, y: 0 } : { x: 0, y: halfLineLength };
  const rotatedAxis = rotatePoint(axis, ccwRotation);
  return {
    start: { x: pad.x - rotatedAxis.x, y: pad.y - rotatedAxis.y },
    end: { x: pad.x + rotatedAxis.x, y: pad.y + rotatedAxis.y },
    radius
  };
};
var getPolygonPointsForPad = (pad) => {
  if (pad.type === "pcb_smtpad") {
    if (pad.shape === "polygon") return pad.points;
    if (pad.shape === "rotated_rect") {
      return getRotatedRectPoints({
        x: pad.x,
        y: pad.y,
        width: pad.width,
        height: pad.height,
        ccwRotation: pad.ccw_rotation
      });
    }
  }
  if (pad.type === "pcb_plated_hole" && "rect_pad_width" in pad && "rect_pad_height" in pad) {
    return getRotatedRectPoints({
      x: pad.x,
      y: pad.y,
      width: pad.rect_pad_width,
      height: pad.rect_pad_height,
      ccwRotation: "rect_ccw_rotation" in pad && typeof pad.rect_ccw_rotation === "number" ? pad.rect_ccw_rotation : 0
    });
  }
  throw new Error(
    `Expected polygonal pad geometry, got ${pad.type} with shape "${pad.shape}"`
  );
};
var getPolygonEdges = (points) => points.map(
  (point2, index) => [point2, points[(index + 1) % points.length]]
);
var getClosestPointsBetweenSegments = (a1, a2, b1, b2) => {
  const intersection = getSegmentIntersection(a1, a2, b1, b2);
  if (intersection) {
    return {
      distance: 0,
      pointOnA: intersection,
      pointOnB: intersection,
      center: intersection
    };
  }
  const candidates = [
    { pointOnA: a1, pointOnB: pointToSegmentClosestPoint(a1, b1, b2) },
    { pointOnA: a2, pointOnB: pointToSegmentClosestPoint(a2, b1, b2) },
    { pointOnA: pointToSegmentClosestPoint(b1, a1, a2), pointOnB: b1 },
    { pointOnA: pointToSegmentClosestPoint(b2, a1, a2), pointOnB: b2 }
  ];
  let best = candidates[0];
  let bestDistanceSquared = distSq(best.pointOnA, best.pointOnB);
  for (const candidate of candidates.slice(1)) {
    const candidateDistanceSquared = distSq(
      candidate.pointOnA,
      candidate.pointOnB
    );
    if (candidateDistanceSquared < bestDistanceSquared) {
      best = candidate;
      bestDistanceSquared = candidateDistanceSquared;
    }
  }
  return {
    distance: segmentToSegmentMinDistance(a1, a2, b1, b2),
    pointOnA: best.pointOnA,
    pointOnB: best.pointOnB,
    center: {
      x: (best.pointOnA.x + best.pointOnB.x) / 2,
      y: (best.pointOnA.y + best.pointOnB.y) / 2
    }
  };
};
var getSegmentToPolygonClearanceFromPoints = (start, end, polygon) => {
  if (polygon.length < 3) {
    return {
      distance: Number.POSITIVE_INFINITY,
      center: start,
      tracePoint: start,
      obstaclePoint: start
    };
  }
  const intersections = getPolygonEdges(polygon).map(
    ([edgeStart, edgeEnd]) => getSegmentIntersection(start, end, edgeStart, edgeEnd)
  ).filter((point2) => point2 !== null);
  if (intersections.length > 0) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    intersections.sort((a, b) => {
      const ta = ((a.x - start.x) * dx + (a.y - start.y) * dy) / lengthSquared;
      const tb = ((b.x - start.x) * dx + (b.y - start.y) * dy) / lengthSquared;
      return ta - tb;
    });
    return {
      distance: 0,
      center: intersections[0],
      tracePoint: intersections[0],
      obstaclePoint: intersections[0]
    };
  }
  if (isPointInsidePolygon(start, polygon) || isPointInsidePolygon(end, polygon)) {
    const center = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2
    };
    return {
      distance: 0,
      center,
      tracePoint: center,
      obstaclePoint: center
    };
  }
  let best = getClosestPointsBetweenSegments(
    start,
    end,
    polygon[0],
    polygon[1]
  );
  for (const [edgeStart, edgeEnd] of getPolygonEdges(polygon).slice(1)) {
    const candidate = getClosestPointsBetweenSegments(
      start,
      end,
      edgeStart,
      edgeEnd
    );
    if (candidate.distance < best.distance) best = candidate;
  }
  return {
    distance: best.distance,
    center: best.center,
    tracePoint: best.pointOnA,
    obstaclePoint: best.pointOnB
  };
};
var getSegmentToPillClearance = (segment, pad) => {
  const pill = getPillCenterLineForPad(pad);
  const closest = getClosestPointsBetweenSegments(
    { x: segment.x1, y: segment.y1 },
    { x: segment.x2, y: segment.y2 },
    pill.start,
    pill.end
  );
  return {
    distance: closest.distance,
    center: closest.center,
    radius: pill.radius,
    tracePoint: closest.pointOnA,
    obstaclePoint: closest.pointOnB
  };
};

// lib/check-traces-are-contiguous/is-point-in-pad.ts
function getDistanceBetweenPoints(pointA, pointB) {
  return Math.sqrt((pointB.x - pointA.x) ** 2 + (pointB.y - pointA.y) ** 2);
}
var POINT_ON_SEGMENT_TOLERANCE_MM = 1e-9;
var POINT_IN_PAD_TOLERANCE_MM = 1e-9;
function isPointOnSegment(point2, segment) {
  const crossProduct = (point2.y - segment.start.y) * (segment.end.x - segment.start.x) - (point2.x - segment.start.x) * (segment.end.y - segment.start.y);
  if (Math.abs(crossProduct) > POINT_ON_SEGMENT_TOLERANCE_MM) return false;
  const dotProduct = (point2.x - segment.start.x) * (segment.end.x - segment.start.x) + (point2.y - segment.start.y) * (segment.end.y - segment.start.y);
  if (dotProduct < -POINT_ON_SEGMENT_TOLERANCE_MM) return false;
  const squaredLength = (segment.end.x - segment.start.x) ** 2 + (segment.end.y - segment.start.y) ** 2;
  return dotProduct <= squaredLength + POINT_ON_SEGMENT_TOLERANCE_MM;
}
function isPointInPolygon(point2, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    if (isPointOnSegment(point2, { start: pi, end: pj })) return true;
    const intersects = pi.y > point2.y !== pj.y > point2.y && point2.x < (pj.x - pi.x) * (point2.y - pi.y) / (pj.y - pi.y) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}
function isPointInPad(point2, pad) {
  if (pad.type === "pcb_smtpad") {
    if (pad.shape === "circle") {
      return getDistanceBetweenPoints(point2, pad) <= pad.radius + POINT_IN_PAD_TOLERANCE_MM;
    }
    if (pad.shape === "rect") {
      const halfWidth = pad.width / 2;
      const halfHeight = pad.height / 2;
      return Math.abs(point2.x - pad.x) <= halfWidth + POINT_IN_PAD_TOLERANCE_MM && Math.abs(point2.y - pad.y) <= halfHeight + POINT_IN_PAD_TOLERANCE_MM;
    }
    if (pad.shape === "rotated_rect") {
      return isPointInPolygon(point2, getPolygonPointsForPad(pad));
    }
    if (pad.shape === "pill" || pad.shape === "rotated_pill") {
      if (pad.shape === "rotated_pill") {
        const pill = getPillCenterLineForPad(pad);
        return pointToSegmentDistance(point2, pill.start, pill.end) <= pill.radius + POINT_IN_PAD_TOLERANCE_MM;
      }
      const halfWidth = pad.width / 2;
      const halfHeight = pad.height / 2;
      const radius = pad.radius;
      if (Math.abs(point2.x - pad.x) <= halfWidth - radius + POINT_IN_PAD_TOLERANCE_MM && Math.abs(point2.y - pad.y) <= halfHeight + POINT_IN_PAD_TOLERANCE_MM) {
        return true;
      }
      const cornerX = Math.max(
        Math.abs(point2.x - pad.x) - (halfWidth - radius),
        0
      );
      const cornerY = Math.max(
        Math.abs(point2.y - pad.y) - (halfHeight - radius),
        0
      );
      const radiusWithTolerance = radius + POINT_IN_PAD_TOLERANCE_MM;
      return cornerX * cornerX + cornerY * cornerY <= radiusWithTolerance * radiusWithTolerance;
    }
    if (pad.shape === "polygon") {
      return isPointInPolygon(point2, pad.points);
    }
  }
  if (pad.type === "pcb_plated_hole") {
    if (pad.shape === "circle") {
      return getDistanceBetweenPoints(point2, pad) <= pad.outer_diameter / 2 + POINT_IN_PAD_TOLERANCE_MM;
    }
    if ("rect_pad_width" in pad && "rect_pad_height" in pad) {
      return isPointInPolygon(point2, getPolygonPointsForPad(pad));
    }
    if (pad.shape === "oval" || pad.shape === "pill") {
      return Math.abs(point2.x - pad.x) <= pad.outer_width / 2 + POINT_IN_PAD_TOLERANCE_MM && Math.abs(point2.y - pad.y) <= pad.outer_height / 2 + POINT_IN_PAD_TOLERANCE_MM;
    }
  }
  return false;
}

// lib/util/getLayersOfPcbElement.ts
import { all_layers } from "circuit-json";
function getLayersOfPcbElement(obj) {
  if (obj.type === "pcb_trace_segment") {
    return [obj.layer];
  }
  if (obj.type === "pcb_smtpad") {
    return [obj.layer];
  }
  if (obj.type === "pcb_plated_hole") {
    return Array.isArray(obj.layers) ? obj.layers : [...all_layers];
  }
  if (obj.type === "pcb_hole") {
    return [...all_layers];
  }
  if (obj.type === "pcb_via") {
    return Array.isArray(obj.layers) ? obj.layers : [...all_layers];
  }
  if (obj.type === "pcb_keepout") {
    return Array.isArray(obj.layers) ? obj.layers : [];
  }
  return [];
}

// lib/util/route-point-touches-pad.ts
function routePointTouchesPad(point2, pad) {
  return point2.route_type === "wire" && getLayersOfPcbElement(pad).includes(point2.layer) && isPointInPad(point2, pad);
}

// lib/check-dangling-traces/types.ts
var CONTACT_EPSILON_MM = 1e-9;

// lib/check-dangling-traces/endpoint-contact.ts
import { pointToSegmentDistance as pointToSegmentDistance3 } from "@tscircuit/math-utils";
import {
  getFullConnectivityMapFromCircuitJson
} from "circuit-json-to-connectivity-map";

// lib/check-dangling-traces/pour-contact-index.ts
import { Circle, Point, Polygon } from "@flatten-js/core";
import { getPourPolygon, getViaPolygon } from "@tscircuit/circuit-json-util";

// lib/copper-pour-connectivity/create-copper-polygon-contact-tester.ts
import {
  Box
} from "@flatten-js/core";
function createCopperPolygonContactTester(tolerance) {
  const cache = /* @__PURE__ */ new WeakMap();
  const getGeometry = (polygon) => {
    let geometry = cache.get(polygon);
    if (!geometry) {
      geometry = {
        box: polygon.box,
        facePoints: [...polygon.faces].map((face) => face.first.start),
        edges: [...polygon.edges].map((edge) => edge.shape),
        edgeIndex: polygon.edges
      };
      cache.set(polygon, geometry);
    }
    return geometry;
  };
  return (a, b) => {
    if (a.isEmpty() || b.isEmpty()) return false;
    const ga = getGeometry(a);
    const gb = getGeometry(b);
    if (ga.box.xmin > gb.box.xmax + tolerance || ga.box.xmax < gb.box.xmin - tolerance || ga.box.ymin > gb.box.ymax + tolerance || ga.box.ymax < gb.box.ymin - tolerance)
      return false;
    if (ga.facePoints.some(
      (point2) => gb.box.contains(point2) && b.contains(point2)
    ) || gb.facePoints.some((point2) => ga.box.contains(point2) && a.contains(point2)))
      return true;
    const [small, large] = ga.edges.length <= gb.edges.length ? [ga, gb] : [gb, ga];
    for (const edge of small.edges) {
      const box = edge.box;
      const queryBox = new Box(
        box.xmin - tolerance,
        box.ymin - tolerance,
        box.xmax + tolerance,
        box.ymax + tolerance
      );
      const candidates = large.edgeIndex.search(
        queryBox
      );
      for (const candidate of candidates) {
        if (edge.distanceTo(candidate.shape)[0] <= tolerance) return true;
      }
    }
    return false;
  };
}

// lib/check-dangling-traces/pour-contact-index.ts
var POLYGON_SCALE = 1e6;
function getContactCopperPolygon({
  center,
  radius,
  holeRadius = 0
}) {
  if (holeRadius > 0) {
    return getViaPolygon(center, radius * 2, holeRadius * 2).scale(
      POLYGON_SCALE,
      POLYGON_SCALE
    );
  }
  return new Polygon(
    new Circle(
      new Point(center.x * POLYGON_SCALE, center.y * POLYGON_SCALE),
      radius * POLYGON_SCALE
    )
  );
}
function getPourContactTester(circuitJson, connMap) {
  const pourPolygonsByNetId = /* @__PURE__ */ new Map();
  for (const pour of circuitJson) {
    if (pour.type !== "pcb_copper_pour" || !pour.source_net_id) continue;
    const netId = connMap.getNetConnectedToId(pour.source_net_id);
    if (!netId) continue;
    const pours = pourPolygonsByNetId.get(netId) ?? [];
    pours.push({
      layer: pour.layer,
      polygon: getPourPolygon(pour).scale(POLYGON_SCALE, POLYGON_SCALE)
    });
    pourPolygonsByNetId.set(netId, pours);
  }
  const copperPolygonsTouch = createCopperPolygonContactTester(
    CONTACT_EPSILON_MM * POLYGON_SCALE
  );
  return (contact) => {
    const pours = (pourPolygonsByNetId.get(contact.netId) ?? []).filter(
      (pour) => contact.layers.includes(pour.layer)
    );
    if (contact.radius === 0) {
      const contactPoint = new Point(
        contact.center.x * POLYGON_SCALE,
        contact.center.y * POLYGON_SCALE
      );
      return pours.some((pour) => pour.polygon.contains(contactPoint));
    }
    if (pours.length === 0) return false;
    const contactPolygon = getContactCopperPolygon(contact);
    return pours.some(
      (pour) => copperPolygonsTouch(contactPolygon, pour.polygon)
    );
  };
}

// lib/check-dangling-traces/via-contact-index.ts
import {
  all_layers as all_layers2
} from "circuit-json";
import { getPrimaryId as getPrimaryId2 } from "@tscircuit/circuit-json-util";
import { pointToSegmentDistance as pointToSegmentDistance2 } from "@tscircuit/math-utils";

// lib/check-pad-clearance/common.ts
import {
  cju,
  distanceBetweenCircleAndCircle,
  distanceBetweenCircleAndPolygon,
  distanceBetweenPolygonAndPolygon,
  getBoundsOfPcbElements as getBoundsOfPcbElements2
} from "@tscircuit/circuit-json-util";
import {
  midpoint,
  pointToSegmentClosestPoint as pointToSegmentClosestPoint2,
  segmentToCircleMinDistance,
  segmentToSegmentMinDistance as segmentToSegmentMinDistance2
} from "@tscircuit/math-utils";

// node_modules/@tscircuit/jlcpcb-manufacturing-specs/lib/jlcpcb-manufacturing-specs.ts
var jlcMinTolerances = {
  min_trace_width: 0.1,
  min_via_hole_edge_to_via_hole_edge_clearance: 0.1,
  min_plated_hole_drill_edge_to_drill_edge_clearance: 0.15,
  min_trace_to_hole_edge_clearance: 0.2,
  min_trace_to_pad_edge_clearance: 0.1,
  min_pad_edge_to_pad_edge_clearance: 0.1,
  min_board_edge_clearance: 0.2,
  min_via_hole_diameter: 0.2,
  min_via_pad_diameter: 0.3
};

// lib/drc-defaults.ts
var DEFAULT_TRACE_MARGIN = 0.1;
var DEFAULT_TRACE_THICKNESS = jlcMinTolerances.min_trace_width;
var DEFAULT_VIA_DIAMETER = jlcMinTolerances.min_via_pad_diameter;
var DEFAULT_VIA_BOARD_MARGIN = jlcMinTolerances.min_board_edge_clearance;
var DEFAULT_SAME_NET_VIA_MARGIN = jlcMinTolerances.min_via_hole_edge_to_via_hole_edge_clearance;
var DEFAULT_DIFFERENT_NET_VIA_MARGIN = jlcMinTolerances.min_via_hole_edge_to_via_hole_edge_clearance;
var DEFAULT_PAD_PAD_CLEARANCE = jlcMinTolerances.min_pad_edge_to_pad_edge_clearance;
var EPSILON = 5e-3;
var getPcbBoard = (circuitJson) => circuitJson.find((el) => el.type === "pcb_board");
var getBoardDrcValue = (board, key) => board?.[key];

// lib/check-pad-clearance/common.ts
var getPadBounds = (pad) => {
  if (pad.type === "pcb_keepout") {
    if (pad.shape === "outline") {
      return {
        minX: Math.min(...pad.outline.map((point2) => point2.x)),
        minY: Math.min(...pad.outline.map((point2) => point2.y)),
        maxX: Math.max(...pad.outline.map((point2) => point2.x)),
        maxY: Math.max(...pad.outline.map((point2) => point2.y))
      };
    }
    if (pad.shape === "circle") {
      return {
        minX: pad.center.x - pad.radius,
        minY: pad.center.y - pad.radius,
        maxX: pad.center.x + pad.radius,
        maxY: pad.center.y + pad.radius
      };
    }
    return {
      minX: pad.center.x - pad.width / 2,
      minY: pad.center.y - pad.height / 2,
      maxX: pad.center.x + pad.width / 2,
      maxY: pad.center.y + pad.height / 2
    };
  }
  return getBoundsOfPcbElements2([pad]);
};
var getPadCenter = (pad) => {
  if (pad.type === "pcb_keepout" && pad.shape !== "outline") return pad.center;
  const bounds = getPadBounds(pad);
  return midpoint(
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY }
  );
};
var getPadRadius = (pad) => {
  if (pad.type === "pcb_keepout" && pad.shape === "circle") return pad.radius;
  const bounds = getPadBounds(pad);
  return Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2;
};
var isCircularPad = (pad) => pad.type === "pcb_via" || pad.shape === "circle";
var isPillPad = (pad) => pad.type === "pcb_smtpad" && (pad.shape === "pill" || pad.shape === "rotated_pill") || pad.type === "pcb_plated_hole" && (pad.shape === "oval" || pad.shape === "pill");
var getCircleShape = (pad) => {
  const center = getPadCenter(pad);
  return {
    kind: "circle",
    x: center.x,
    y: center.y,
    radius: getPadRadius(pad)
  };
};
var getPolygonShape = (pad) => {
  if (pad.type === "pcb_keepout") {
    if (pad.shape === "outline") {
      return {
        kind: "polygon",
        points: pad.outline
      };
    }
    if (pad.shape !== "rect") {
      throw new Error(`Expected rectangular keepout, got ${pad.shape}`);
    }
    return {
      kind: "polygon",
      points: [
        {
          x: pad.center.x - pad.width / 2,
          y: pad.center.y - pad.height / 2
        },
        {
          x: pad.center.x + pad.width / 2,
          y: pad.center.y - pad.height / 2
        },
        {
          x: pad.center.x + pad.width / 2,
          y: pad.center.y + pad.height / 2
        },
        {
          x: pad.center.x - pad.width / 2,
          y: pad.center.y + pad.height / 2
        }
      ]
    };
  }
  if (pad.type === "pcb_smtpad" && (pad.shape === "polygon" || pad.shape === "rotated_rect")) {
    return {
      kind: "polygon",
      points: getPolygonPointsForPad(pad)
    };
  }
  if (pad.type === "pcb_plated_hole" && "rect_pad_width" in pad && "rect_pad_height" in pad) {
    return {
      kind: "polygon",
      points: getPolygonPointsForPad(pad)
    };
  }
  const bounds = getPadBounds(pad);
  return {
    kind: "polygon",
    points: [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY },
      { x: bounds.minX, y: bounds.maxY }
    ]
  };
};
var getRoundedPadCore = (pad) => {
  if (pad.type !== "pcb_smtpad" || pad.shape !== "rect" && pad.shape !== "rotated_rect" || !pad.corner_radius || pad.corner_radius <= 0)
    return null;
  const radius = Math.min(pad.corner_radius, pad.width / 2, pad.height / 2);
  if (radius === Math.min(pad.width, pad.height) / 2) {
    const core = {
      ...pad,
      shape: "rotated_pill",
      radius,
      ccw_rotation: pad.shape === "rotated_rect" ? pad.ccw_rotation : 0
    };
    return { core, radius: 0 };
  }
  return {
    core: {
      ...pad,
      width: pad.width - 2 * radius,
      height: pad.height - 2 * radius,
      corner_radius: 0
    },
    radius
  };
};
var getPadToPadGap = (padA, padB) => {
  const roundedA = getRoundedPadCore(padA);
  const roundedB = getRoundedPadCore(padB);
  if (roundedA || roundedB) {
    return getPadToPadGap(roundedA?.core ?? padA, roundedB?.core ?? padB) - (roundedA?.radius ?? 0) - (roundedB?.radius ?? 0);
  }
  if (isPillPad(padA) && isPillPad(padB)) {
    const pillA = getPillCenterLineForPad(padA);
    const pillB = getPillCenterLineForPad(padB);
    return segmentToSegmentMinDistance2(
      pillA.start,
      pillA.end,
      pillB.start,
      pillB.end
    ) - pillA.radius - pillB.radius;
  }
  if (isPillPad(padA) && isCircularPad(padB)) {
    const pill = getPillCenterLineForPad(padA);
    return segmentToCircleMinDistance(pill.start, pill.end, getCircleShape(padB)) - pill.radius;
  }
  if (isCircularPad(padA) && isPillPad(padB)) {
    const pill = getPillCenterLineForPad(padB);
    return segmentToCircleMinDistance(pill.start, pill.end, getCircleShape(padA)) - pill.radius;
  }
  if (isPillPad(padA)) {
    const pill = getPillCenterLineForPad(padA);
    return getSegmentToPolygonClearanceFromPoints(
      pill.start,
      pill.end,
      getPolygonShape(padB).points
    ).distance - pill.radius;
  }
  if (isPillPad(padB)) {
    const pill = getPillCenterLineForPad(padB);
    return getSegmentToPolygonClearanceFromPoints(
      pill.start,
      pill.end,
      getPolygonShape(padA).points
    ).distance - pill.radius;
  }
  if (isCircularPad(padA) && isCircularPad(padB)) {
    return distanceBetweenCircleAndCircle(
      getCircleShape(padA),
      getCircleShape(padB)
    );
  }
  if (isCircularPad(padA)) {
    return distanceBetweenCircleAndPolygon(
      getCircleShape(padA),
      getPolygonShape(padB)
    );
  }
  if (isCircularPad(padB)) {
    return distanceBetweenCircleAndPolygon(
      getCircleShape(padB),
      getPolygonShape(padA)
    );
  }
  return distanceBetweenPolygonAndPolygon(
    getPolygonShape(padA),
    getPolygonShape(padB)
  );
};
var getPads = (circuitJson) => [
  ...cju(circuitJson).pcb_smtpad.list(),
  ...cju(circuitJson).pcb_plated_hole.list()
];
var getTraceSegments = (circuitJson) => {
  const pcbTraces = cju(circuitJson).pcb_trace.list();
  return pcbTraces.flatMap((pcbTrace) => {
    const segments = [];
    for (let i = 0; i < pcbTrace.route.length - 1; i++) {
      const p1 = pcbTrace.route[i];
      const p2 = pcbTrace.route[i + 1];
      if (p1.route_type !== "wire") continue;
      if (p2.route_type !== "wire") continue;
      if (p1.layer !== p2.layer) continue;
      segments.push({
        type: "pcb_trace_segment",
        pcb_trace_id: pcbTrace.pcb_trace_id,
        _pcbTrace: pcbTrace,
        thickness: "width" in p1 ? p1.width : "width" in p2 ? p2.width : DEFAULT_TRACE_THICKNESS,
        layer: p1.layer,
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y
      });
    }
    return segments;
  });
};
var getCenterBetweenCopperEdges = ({
  tracePoint,
  obstaclePoint,
  traceRadius,
  obstacleRadius
}) => {
  const dx = obstaclePoint.x - tracePoint.x;
  const dy = obstaclePoint.y - tracePoint.y;
  const distance5 = Math.hypot(dx, dy);
  if (distance5 === 0) return midpoint(tracePoint, obstaclePoint);
  const unitX = dx / distance5;
  const unitY = dy / distance5;
  if (distance5 <= traceRadius + obstacleRadius) {
    const overlapStart = Math.max(-traceRadius, distance5 - obstacleRadius);
    const overlapEnd = Math.min(traceRadius, distance5 + obstacleRadius);
    const offset = (overlapStart + overlapEnd) / 2;
    return {
      x: tracePoint.x + unitX * offset,
      y: tracePoint.y + unitY * offset
    };
  }
  const traceEdge = {
    x: tracePoint.x + unitX * traceRadius,
    y: tracePoint.y + unitY * traceRadius
  };
  const obstacleEdge = {
    x: obstaclePoint.x - unitX * obstacleRadius,
    y: obstaclePoint.y - unitY * obstacleRadius
  };
  return midpoint(traceEdge, obstacleEdge);
};
var getTraceObstacleClearance = (segment, obstacle) => {
  const rounded = getRoundedPadCore(obstacle);
  if (rounded) obstacle = rounded.core;
  const obstacleRadius = rounded?.radius ?? 0;
  const start = { x: segment.x1, y: segment.y1 };
  const end = { x: segment.x2, y: segment.y2 };
  const traceRadius = segment.thickness / 2;
  if (obstacle.type === "pcb_via" || isCircularPad(obstacle)) {
    const circle2 = obstacle.type === "pcb_via" ? {
      x: obstacle.x,
      y: obstacle.y,
      radius: obstacle.outer_diameter / 2
    } : getCircleShape(obstacle);
    const closestPoint = pointToSegmentClosestPoint2(circle2, start, end);
    return {
      gap: segmentToCircleMinDistance(start, end, circle2) - traceRadius,
      center: getCenterBetweenCopperEdges({
        tracePoint: closestPoint,
        obstaclePoint: circle2,
        traceRadius,
        obstacleRadius: circle2.radius
      })
    };
  }
  if (isPillPad(obstacle)) {
    const clearance2 = getSegmentToPillClearance(segment, obstacle);
    return {
      gap: clearance2.distance - traceRadius - clearance2.radius,
      center: getCenterBetweenCopperEdges({
        tracePoint: clearance2.tracePoint,
        obstaclePoint: clearance2.obstaclePoint,
        traceRadius,
        obstacleRadius: clearance2.radius
      })
    };
  }
  const clearance = getSegmentToPolygonClearanceFromPoints(
    start,
    end,
    getPolygonShape(obstacle).points
  );
  return {
    gap: clearance.distance - traceRadius - obstacleRadius,
    center: getCenterBetweenCopperEdges({
      tracePoint: clearance.tracePoint,
      obstaclePoint: clearance.obstaclePoint,
      traceRadius,
      obstacleRadius
    })
  };
};
var isTraceObstacleOverlap = (gap) => gap <= 0;
var getViaPadClearanceCenter = (via, pad) => getTraceObstacleClearance(
  {
    x1: via.x,
    y1: via.y,
    x2: via.x,
    y2: via.y,
    thickness: via.outer_diameter
  },
  pad
).center;

// lib/check-dangling-traces/via-contact-index.ts
function getBoardLayerStack(circuitJson) {
  const layerCount = circuitJson.find(
    (element) => element.type === "pcb_board"
  )?.num_layers;
  let innerLayers = all_layers2.filter((layer) => layer.startsWith("inner"));
  if (layerCount !== void 0) {
    innerLayers = innerLayers.slice(0, Math.max(0, layerCount - 2));
  }
  const boardLayerStack = ["top", ...innerLayers];
  if (layerCount !== 1) boardLayerStack.push("bottom");
  return boardLayerStack;
}
function getPcbViaCoppers(vias) {
  return vias.filter(
    (via) => Number.isFinite(via.outer_diameter) && via.outer_diameter > 0
  ).map((via) => ({
    id: via.pcb_via_id,
    layers: getLayersOfPcbElement(via),
    x: via.x,
    y: via.y,
    radius: via.outer_diameter / 2,
    holeRadius: via.hole_diameter / 2
  }));
}
function getRouteViaCoppers({ traces, vias }, { circuitJson, connMap }) {
  const boardLayerStack = getBoardLayerStack(circuitJson);
  const viaCoppers = [];
  for (const trace of traces) {
    for (const point2 of trace.route) {
      if (point2.route_type !== "via") continue;
      const hasPcbVia = vias.some(
        (via) => Math.hypot(via.x - point2.x, via.y - point2.y) <= CONTACT_EPSILON_MM && (via.pcb_trace_id === trace.pcb_trace_id || !via.pcb_trace_id && connMap.areIdsConnected(via.pcb_via_id, trace.pcb_trace_id))
      );
      if (hasPcbVia) continue;
      const fromLayerIndex = boardLayerStack.indexOf(point2.from_layer);
      const toLayerIndex = boardLayerStack.indexOf(point2.to_layer);
      if (fromLayerIndex < 0 || toLayerIndex < 0) continue;
      const diameter = point2.outer_diameter;
      let radius;
      if (diameter !== void 0) {
        if (!Number.isFinite(diameter) || diameter <= 0) continue;
        radius = diameter / 2;
      }
      viaCoppers.push({
        id: trace.pcb_trace_id,
        layers: boardLayerStack.slice(
          Math.min(fromLayerIndex, toLayerIndex),
          Math.max(fromLayerIndex, toLayerIndex) + 1
        ),
        x: point2.x,
        y: point2.y,
        radius
      });
    }
  }
  return viaCoppers;
}
function viaTouchesPad({
  viaCopper,
  pad
}) {
  if (viaCopper.radius === void 0) return isPointInPad(viaCopper, pad);
  const viaGeometry = {
    type: "pcb_via",
    pcb_via_id: viaCopper.id,
    x: viaCopper.x,
    y: viaCopper.y,
    outer_diameter: viaCopper.radius * 2,
    hole_diameter: 0,
    layers: all_layers2.filter((layer) => viaCopper.layers.includes(layer))
  };
  return getPadToPadGap(viaGeometry, pad) <= CONTACT_EPSILON_MM;
}
function traceTouchesVia({
  trace,
  viaCopper
}) {
  if (trace.route_thickness_mode === "interpolated") return false;
  for (let i = 1; i < trace.route.length; i++) {
    const segmentStart = trace.route[i - 1];
    const segmentEnd = trace.route[i];
    if (segmentStart.route_type !== "wire" || segmentEnd.route_type !== "wire" || segmentStart.layer !== segmentEnd.layer || !viaCopper.layers.includes(segmentStart.layer) || !Number.isFinite(segmentStart.width) || segmentStart.width <= 0 || Math.hypot(
      segmentStart.x - segmentEnd.x,
      segmentStart.y - segmentEnd.y
    ) <= CONTACT_EPSILON_MM) {
      continue;
    }
    let contactDistance = 0;
    if (viaCopper.radius !== void 0) {
      contactDistance = viaCopper.radius + segmentStart.width / 2;
    }
    if (pointToSegmentDistance2(viaCopper, segmentStart, segmentEnd) <= contactDistance + CONTACT_EPSILON_MM) {
      return true;
    }
  }
  return false;
}
function getViaContactIndex(ctx) {
  const { circuitJson, connMap, touchesPour: touchesPour2 } = ctx;
  const pads = getPads(circuitJson);
  const traces = circuitJson.filter((element) => element.type === "pcb_trace");
  const vias = circuitJson.filter((element) => element.type === "pcb_via");
  const viaCoppers = [
    ...getPcbViaCoppers(vias),
    ...getRouteViaCoppers({ traces, vias }, ctx)
  ];
  const viaContactIndex = /* @__PURE__ */ new Map();
  for (const viaCopper of viaCoppers) {
    if (!Number.isFinite(viaCopper.x) || !Number.isFinite(viaCopper.y)) continue;
    const netId = connMap.getNetConnectedToId(viaCopper.id);
    if (!netId) continue;
    const touchesPadOrPour = touchesPour2({
      netId,
      layers: viaCopper.layers,
      center: viaCopper,
      radius: viaCopper.radius ?? 0,
      holeRadius: viaCopper.holeRadius
    }) || pads.some(
      (pad) => connMap.getNetConnectedToId(getPrimaryId2(pad)) === netId && getLayersOfPcbElement(pad).some(
        (layer) => viaCopper.layers.includes(layer)
      ) && viaTouchesPad({ viaCopper, pad })
    );
    const touchingTraceIds = /* @__PURE__ */ new Set();
    for (const trace of traces) {
      if (connMap.getNetConnectedToId(trace.pcb_trace_id) === netId && traceTouchesVia({ trace, viaCopper })) {
        touchingTraceIds.add(trace.pcb_trace_id);
      }
    }
    const viaContact = {
      viaCopper,
      touchesPadOrPour,
      touchingTraceIds
    };
    const contactsByLayer = viaContactIndex.get(netId) ?? /* @__PURE__ */ new Map();
    for (const layer of viaCopper.layers) {
      const contacts = contactsByLayer.get(layer) ?? [];
      contacts.push(viaContact);
      contactsByLayer.set(layer, contacts);
    }
    viaContactIndex.set(netId, contactsByLayer);
  }
  return viaContactIndex;
}
function endpointTouchesVia({
  trace,
  point: point2,
  width
}, {
  connMap,
  viaContactIndex
}) {
  if (!Number.isFinite(width) || width <= 0) return false;
  const netId = connMap.getNetConnectedToId(trace.pcb_trace_id);
  if (!netId) return false;
  const viaContacts = viaContactIndex.get(netId)?.get(point2.layer) ?? [];
  return viaContacts.some(
    ({ viaCopper, touchesPadOrPour, touchingTraceIds }) => {
      const hasOnwardConnection = touchesPadOrPour || [...touchingTraceIds].some((traceId) => traceId !== trace.pcb_trace_id);
      if (!hasOnwardConnection) return false;
      let contactDistance = 0;
      if (viaCopper.radius !== void 0) {
        contactDistance = viaCopper.radius + width / 2;
      }
      return Math.hypot(point2.x - viaCopper.x, point2.y - viaCopper.y) <= contactDistance + CONTACT_EPSILON_MM;
    }
  );
}

// lib/check-dangling-traces/endpoint-contact.ts
function getStraightRunEnd({
  route,
  anchorPoint,
  fromIndex,
  step
}) {
  let runEnd = anchorPoint;
  for (let i = fromIndex; i >= 0 && i < route.length; i += step) {
    const nextPoint = route[i];
    if (nextPoint.route_type !== "wire" || nextPoint.layer !== anchorPoint.layer || pointToSegmentDistance3(runEnd, anchorPoint, nextPoint) > CONTACT_EPSILON_MM) {
      break;
    }
    runEnd = nextPoint;
  }
  return runEnd;
}
function getTerminalWireSegment(trace, endpoint) {
  if (trace.route_thickness_mode === "interpolated") return void 0;
  const { route } = trace;
  let outerIndex = 0;
  let step = 1;
  if (endpoint === "end") {
    outerIndex = route.length - 1;
    step = -1;
  }
  let innerIndex = outerIndex + step;
  while (innerIndex >= 0 && innerIndex < route.length) {
    const outerPoint = route[outerIndex];
    const innerPoint = route[innerIndex];
    if (outerPoint.route_type !== "wire" || innerPoint.route_type !== "wire" || outerPoint.layer !== innerPoint.layer) {
      return void 0;
    }
    const isDuplicatePoint = Math.hypot(outerPoint.x - innerPoint.x, outerPoint.y - innerPoint.y) <= CONTACT_EPSILON_MM;
    if (!isDuplicatePoint) {
      let width = outerPoint.width;
      if (endpoint === "end") width = innerPoint.width;
      const inwardPoint = getStraightRunEnd({
        route,
        anchorPoint: outerPoint,
        fromIndex: innerIndex,
        step
      });
      return { width, inwardPoint };
    }
    outerIndex = innerIndex;
    innerIndex += step;
  }
  return void 0;
}
function getStraightRunStart({
  route,
  startIndex,
  start,
  end
}) {
  let runStart = start;
  for (let i = startIndex - 1; i >= 0; i--) {
    const previousPoint = route[i];
    if (previousPoint.route_type !== "wire" || previousPoint.layer !== end.layer || pointToSegmentDistance3(runStart, previousPoint, end) > CONTACT_EPSILON_MM) {
      break;
    }
    runStart = previousPoint;
  }
  return runStart;
}
function getTraceWireSegmentsByNetAndLayer(circuitJson, connMap) {
  const segmentsByNetAndLayer = /* @__PURE__ */ new Map();
  for (const trace of circuitJson) {
    if (trace.type !== "pcb_trace") continue;
    if (trace.route_thickness_mode === "interpolated") continue;
    const netId = connMap.getNetConnectedToId(trace.pcb_trace_id);
    if (!netId) continue;
    for (let i = 0; i < trace.route.length - 1; i++) {
      const start = trace.route[i];
      const end = trace.route[i + 1];
      if (start.route_type !== "wire" || end.route_type !== "wire") continue;
      if (start.layer !== end.layer) continue;
      if (Math.hypot(start.x - end.x, start.y - end.y) <= CONTACT_EPSILON_MM) {
        continue;
      }
      const centerlineStart = getStraightRunStart({
        route: trace.route,
        startIndex: i,
        start,
        end
      });
      const centerlineEnd = getStraightRunEnd({
        route: trace.route,
        anchorPoint: centerlineStart,
        fromIndex: i + 1,
        step: 1
      });
      const segmentsByLayer = segmentsByNetAndLayer.get(netId) ?? /* @__PURE__ */ new Map();
      const segments = segmentsByLayer.get(start.layer) ?? [];
      segments.push({ trace, start, end, centerlineStart, centerlineEnd });
      segmentsByLayer.set(start.layer, segments);
      segmentsByNetAndLayer.set(netId, segmentsByLayer);
    }
  }
  return segmentsByNetAndLayer;
}
function endpointTouchesTraceSegment({
  point: point2,
  terminalSegment,
  segment
}) {
  const distance5 = pointToSegmentDistance3(point2, segment.start, segment.end);
  const endpointRadius = terminalSegment.width / 2;
  const segmentRadius = segment.start.width / 2;
  if (distance5 + endpointRadius <= segmentRadius + CONTACT_EPSILON_MM) {
    return true;
  }
  const branchesFromSegment = pointToSegmentDistance3(
    terminalSegment.inwardPoint,
    segment.centerlineStart,
    segment.centerlineEnd
  ) <= CONTACT_EPSILON_MM && pointToSegmentDistance3(
    point2,
    segment.centerlineStart,
    segment.centerlineEnd
  ) > CONTACT_EPSILON_MM;
  if (branchesFromSegment) return false;
  return distance5 <= endpointRadius + segmentRadius + CONTACT_EPSILON_MM;
}
function createEndpointContactContext(circuitJson, connMap) {
  const portPads = circuitJson.filter(
    (element) => element.type === "pcb_smtpad" || element.type === "pcb_plated_hole"
  ).filter((pad) => pad.pcb_port_id);
  return { circuitJson, portPads, connMap };
}
function getCachedConnMap(ctx) {
  ctx.connMap ??= getFullConnectivityMapFromCircuitJson(ctx.circuitJson);
  return ctx.connMap;
}
function getCachedPourContactTester(ctx) {
  ctx.touchesPour ??= getPourContactTester(
    ctx.circuitJson,
    getCachedConnMap(ctx)
  );
  return ctx.touchesPour;
}
function getCachedTraceWireSegments(ctx) {
  ctx.traceWireSegmentsByNetAndLayer ??= getTraceWireSegmentsByNetAndLayer(
    ctx.circuitJson,
    getCachedConnMap(ctx)
  );
  return ctx.traceWireSegmentsByNetAndLayer;
}
function getCachedViaContactIndex(ctx) {
  ctx.viaContactIndex ??= getViaContactIndex({
    circuitJson: ctx.circuitJson,
    connMap: getCachedConnMap(ctx),
    touchesPour: getCachedPourContactTester(ctx)
  });
  return ctx.viaContactIndex;
}
function endpointTouchesNetCopper({
  trace,
  point: point2,
  terminalSegment
}, ctx) {
  const connMap = getCachedConnMap(ctx);
  const netId = connMap.getNetConnectedToId(trace.pcb_trace_id);
  const touchesPour2 = getCachedPourContactTester(ctx);
  if (netId && touchesPour2({
    netId,
    layers: [point2.layer],
    center: point2,
    radius: terminalSegment.width / 2
  })) {
    return true;
  }
  const traceWireSegments = getCachedTraceWireSegments(ctx);
  if (netId) {
    const segments = traceWireSegments.get(netId)?.get(point2.layer) ?? [];
    const touchesTrace = segments.some(
      (segment) => segment.trace.pcb_trace_id !== trace.pcb_trace_id && endpointTouchesTraceSegment({ point: point2, terminalSegment, segment })
    );
    if (touchesTrace) return true;
  }
  return endpointTouchesVia(
    { trace, point: point2, width: terminalSegment.width },
    { connMap, viaContactIndex: getCachedViaContactIndex(ctx) }
  );
}

// lib/check-dangling-traces/check-dangling-traces.ts
function isEndpointDangling({
  trace,
  endpoint,
  point: point2,
  hasExpectedPorts
}, ctx) {
  if (ctx.portPads.some((pad) => routePointTouchesPad(point2, pad))) {
    return false;
  }
  const terminalSegment = getTerminalWireSegment(trace, endpoint);
  if (!terminalSegment) {
    return !hasExpectedPorts;
  }
  return !endpointTouchesNetCopper({ trace, point: point2, terminalSegment }, ctx);
}
function getDanglingEndpoints({ trace, hasExpectedPorts }, ctx) {
  const routeEndpoints = [
    { endpoint: "start", point: trace.route[0] },
    { endpoint: "end", point: trace.route[trace.route.length - 1] }
  ];
  const danglingEndpoints = [];
  for (const { endpoint, point: point2 } of routeEndpoints) {
    if (point2.route_type !== "wire") continue;
    if (isEndpointDangling({ trace, endpoint, point: point2, hasExpectedPorts }, ctx)) {
      danglingEndpoints.push({ endpoint, point: point2 });
    }
  }
  const [start, end] = danglingEndpoints;
  if (start && end && start.point.layer === end.point.layer && Math.hypot(start.point.x - end.point.x, start.point.y - end.point.y) <= CONTACT_EPSILON_MM) {
    danglingEndpoints.pop();
  }
  return danglingEndpoints;
}
function checkDanglingTraces(circuitJson, options = {}) {
  const ctx = createEndpointContactContext(circuitJson, options.connMap);
  const sourceTracesById = /* @__PURE__ */ new Map();
  const sourcePortIdsWithPcbPorts = /* @__PURE__ */ new Set();
  for (const element of circuitJson) {
    if (element.type === "source_trace") {
      sourceTracesById.set(element.source_trace_id, element);
    }
    if (element.type === "pcb_port") {
      sourcePortIdsWithPcbPorts.add(element.source_port_id);
    }
  }
  const errors = [];
  for (const trace of circuitJson) {
    if (trace.type !== "pcb_trace" || trace.route.length === 0) continue;
    if (trace.is_antenna_trace === true) continue;
    let hasExpectedPorts = false;
    if (trace.source_trace_id) {
      const sourceTrace = sourceTracesById.get(trace.source_trace_id);
      hasExpectedPorts = Boolean(
        sourceTrace?.connected_source_port_ids.some(
          (sourcePortId) => sourcePortIdsWithPcbPorts.has(sourcePortId)
        )
      );
    }
    for (const { endpoint, point: point2 } of getDanglingEndpoints(
      { trace, hasExpectedPorts },
      ctx
    )) {
      const traceName = getReadableNameForTrace(
        circuitJson,
        trace.pcb_trace_id
      );
      errors.push({
        type: "pcb_trace_error",
        error_type: "pcb_trace_error",
        pcb_trace_error_id: `disconnected_endpoint_${trace.pcb_trace_id}_${endpoint}`,
        message: `Trace [${traceName}] has dangling endpoint at (${point2.x.toFixed(2)}, ${point2.y.toFixed(2)})`,
        source_trace_id: trace.source_trace_id || `!${trace.pcb_trace_id}`,
        pcb_trace_id: trace.pcb_trace_id,
        center: { x: point2.x, y: point2.y },
        pcb_component_ids: [],
        pcb_port_ids: []
      });
    }
  }
  return errors;
}

// lib/check-pcb-trace-self-shorts.ts
import { cju as cju2 } from "@tscircuit/circuit-json-util";
import { segmentToSegmentMinDistance as segmentToSegmentMinDistance3 } from "@tscircuit/math-utils";
import {
  all_layers as all_layers3
} from "circuit-json";

// lib/check-each-pcb-trace-non-overlapping/getClosestPointBetweenSegments.ts
var getClosestPointBetweenSegments = (segmentA, segmentB) => {
  const a1 = { x: segmentA.x1, y: segmentA.y1 };
  const a2 = { x: segmentA.x2, y: segmentA.y2 };
  const b1 = { x: segmentB.x1, y: segmentB.y1 };
  const b2 = { x: segmentB.x2, y: segmentB.y2 };
  const va = { x: a2.x - a1.x, y: a2.y - a1.y };
  const vb = { x: b2.x - b1.x, y: b2.y - b1.y };
  const lenSqrA = va.x * va.x + va.y * va.y;
  const lenSqrB = vb.x * vb.x + vb.y * vb.y;
  if (lenSqrA === 0 || lenSqrB === 0) {
    if (lenSqrA === 0 && lenSqrB === 0) {
      return {
        x: (a1.x + b1.x) / 2,
        y: (a1.y + b1.y) / 2
      };
    }
    if (lenSqrA === 0) {
      const t2 = clamp(
        ((a1.x - b1.x) * vb.x + (a1.y - b1.y) * vb.y) / lenSqrB,
        0,
        1
      );
      const closestOnB2 = {
        x: b1.x + t2 * vb.x,
        y: b1.y + t2 * vb.y
      };
      return {
        x: (a1.x + closestOnB2.x) / 2,
        y: (a1.y + closestOnB2.y) / 2
      };
    }
    const t = clamp(
      ((b1.x - a1.x) * va.x + (b1.y - a1.y) * va.y) / lenSqrA,
      0,
      1
    );
    const closestOnA2 = {
      x: a1.x + t * va.x,
      y: a1.y + t * va.y
    };
    return {
      x: (closestOnA2.x + b1.x) / 2,
      y: (closestOnA2.y + b1.y) / 2
    };
  }
  const w = { x: a1.x - b1.x, y: a1.y - b1.y };
  const dotAA = va.x * va.x + va.y * va.y;
  const dotAB = va.x * vb.x + va.y * vb.y;
  const dotAW = va.x * w.x + va.y * w.y;
  const dotBB = vb.x * vb.x + vb.y * vb.y;
  const dotBW = vb.x * w.x + vb.y * w.y;
  const denominator = dotAA * dotBB - dotAB * dotAB;
  if (denominator < 1e-10) {
    return closestPointsParallelSegments(
      a1,
      a2,
      b1,
      b2,
      va,
      vb,
      lenSqrA,
      lenSqrB
    );
  }
  let tA = (dotAB * dotBW - dotBB * dotAW) / denominator;
  let tB = (dotAA * dotBW - dotAB * dotAW) / denominator;
  tA = clamp(tA, 0, 1);
  tB = clamp(tB, 0, 1);
  tB = (tA * dotAB + dotBW) / dotBB;
  tB = clamp(tB, 0, 1);
  tA = (tB * dotAB - dotAW) / dotAA;
  tA = clamp(tA, 0, 1);
  const closestOnA = {
    x: a1.x + tA * va.x,
    y: a1.y + tA * va.y
  };
  const closestOnB = {
    x: b1.x + tB * vb.x,
    y: b1.y + tB * vb.y
  };
  const dx = closestOnA.x - closestOnB.x;
  const dy = closestOnA.y - closestOnB.y;
  const distance5 = Math.sqrt(dx * dx + dy * dy);
  const averagePoint = {
    x: (closestOnA.x + closestOnB.x) / 2,
    y: (closestOnA.y + closestOnB.y) / 2
  };
  return averagePoint;
};
var closestPointsParallelSegments = (a1, a2, b1, b2, va, vb, lenSqrA, lenSqrB) => {
  let tA = ((b1.x - a1.x) * va.x + (b1.y - a1.y) * va.y) / lenSqrA;
  tA = clamp(tA, 0, 1);
  const pointOnA1 = { x: a1.x + tA * va.x, y: a1.y + tA * va.y };
  let tA2 = ((b2.x - a1.x) * va.x + (b2.y - a1.y) * va.y) / lenSqrA;
  tA2 = clamp(tA2, 0, 1);
  const pointOnA2 = { x: a1.x + tA2 * va.x, y: a1.y + tA2 * va.y };
  let tB = ((a1.x - b1.x) * vb.x + (a1.y - b1.y) * vb.y) / lenSqrB;
  tB = clamp(tB, 0, 1);
  const pointOnB1 = { x: b1.x + tB * vb.x, y: b1.y + tB * vb.y };
  let tB2 = ((a2.x - b1.x) * vb.x + (a2.y - b1.y) * vb.y) / lenSqrB;
  tB2 = clamp(tB2, 0, 1);
  const pointOnB2 = { x: b1.x + tB2 * vb.x, y: b1.y + tB2 * vb.y };
  const distances = [
    {
      pointA: pointOnA1,
      pointB: b1,
      distance: Math.sqrt(
        (pointOnA1.x - b1.x) ** 2 + (pointOnA1.y - b1.y) ** 2
      )
    },
    {
      pointA: pointOnA2,
      pointB: b2,
      distance: Math.sqrt(
        (pointOnA2.x - b2.x) ** 2 + (pointOnA2.y - b2.y) ** 2
      )
    },
    {
      pointA: a1,
      pointB: pointOnB1,
      distance: Math.sqrt(
        (a1.x - pointOnB1.x) ** 2 + (a1.y - pointOnB1.y) ** 2
      )
    },
    {
      pointA: a2,
      pointB: pointOnB2,
      distance: Math.sqrt(
        (a2.x - pointOnB2.x) ** 2 + (a2.y - pointOnB2.y) ** 2
      )
    }
  ];
  const closestPair = distances.reduce(
    (closest, current) => current.distance < closest.distance ? current : closest
  );
  return {
    x: (closestPair.pointA.x + closestPair.pointB.x) / 2,
    y: (closestPair.pointA.y + closestPair.pointB.y) / 2
  };
};
var clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value));
};

// lib/check-each-pcb-trace-non-overlapping/getPcbPortIdsConnectedToTraces.ts
function getPcbPortIdsConnectedToRoutePoint(routePoint) {
  if (routePoint.route_type !== "wire") return [];
  return [routePoint.start_pcb_port_id, routePoint.end_pcb_port_id].filter(
    (portId) => Boolean(portId)
  );
}
function getPcbPortIdsConnectedToTrace(trace) {
  const connectedPcbPorts = /* @__PURE__ */ new Set();
  for (const segment of trace.route) {
    for (const portId of getPcbPortIdsConnectedToRoutePoint(segment)) {
      connectedPcbPorts.add(portId);
    }
  }
  return Array.from(connectedPcbPorts);
}
function getPcbPortIdsConnectedToTraces(traces) {
  const connectedPorts = /* @__PURE__ */ new Set();
  for (const trace of traces) {
    for (const portId of getPcbPortIdsConnectedToTrace(trace)) {
      connectedPorts.add(portId);
    }
  }
  return Array.from(connectedPorts);
}

// lib/check-pcb-trace-self-shorts.ts
function checkPcbTraceSelfShorts(circuitJson) {
  const matchedSourceTraceIds = new Set(
    circuitJson.flatMap(
      (element) => element.type === "source_bus" && element.max_length_skew !== void 0 ? element.source_trace_ids : []
    )
  );
  const db = cju2(circuitJson);
  const errors = [];
  for (const trace of circuitJson) {
    if (trace.type !== "pcb_trace") continue;
    if (!trace.source_trace_id || !matchedSourceTraceIds.has(trace.source_trace_id))
      continue;
    const segments = [];
    const routeDistances = [];
    let distance5 = 0;
    let run = 0;
    for (let i = 0; i < trace.route.length - 1; i++) {
      routeDistances[i] = distance5;
      const a = trace.route[i];
      const b = trace.route[i + 1];
      if (a.route_type !== "wire" || b.route_type !== "wire" || a.layer !== b.layer) {
        run++;
        continue;
      }
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length === 0) continue;
      segments.push({
        type: "pcb_trace_segment",
        _pcbTrace: trace,
        pcb_trace_id: trace.pcb_trace_id,
        thickness: a.width,
        layer: a.layer,
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        run,
        startDistance: distance5,
        endDistance: distance5 + length
      });
      distance5 += length;
    }
    routeDistances[trace.route.length - 1] = distance5;
    let shortCenter;
    pairs: for (let i = 0; i < segments.length; i++) {
      const a = segments[i];
      for (let j = i + 1; j < segments.length; j++) {
        const b = segments[j];
        if (a.layer !== b.layer) continue;
        const contactDistance = (a.thickness + b.thickness) / 2;
        const dot2 = (a.x2 - a.x1) * (b.x2 - b.x1) + (a.y2 - a.y1) * (b.y2 - b.y1);
        const cross = (a.x2 - a.x1) * (b.y2 - b.y1) - (a.y2 - a.y1) * (b.x2 - b.x1);
        const directionLengthProduct = Math.hypot(a.x2 - a.x1, a.y2 - a.y1) * Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
        const isForwardOrRightAngle = dot2 >= -1e-9 * directionLengthProduct;
        const adjacent = a.run === b.run && b.startDistance === a.endDistance;
        if (adjacent && !(dot2 < 0 && Math.abs(cross) < 1e-9)) continue;
        if (!adjacent && a.run === b.run && // A right-angle connector can have sqrt(2) times the straight-line
        // distance. Its local copper overlap is still part of the same bend.
        b.startDistance - a.endDistance <= Math.SQRT2 * contactDistance && isForwardOrRightAngle)
          continue;
        const gap = segmentToSegmentMinDistance3(
          { x: a.x1, y: a.y1 },
          { x: a.x2, y: a.y2 },
          { x: b.x1, y: b.y1 },
          { x: b.x2, y: b.y2 }
        ) - contactDistance;
        if (gap > 1e-9) continue;
        shortCenter = getClosestPointBetweenSegments(a, b);
        break pairs;
      }
    }
    if (!shortCenter) {
      const board = circuitJson.find((e) => e.type === "pcb_board");
      const stack = [
        "top",
        ...all_layers3.filter((layer) => layer.startsWith("inner")).slice(0, board ? Math.max(0, board.num_layers - 2) : void 0),
        ...board?.num_layers === 1 ? [] : ["bottom"]
      ];
      vias: for (let i = 0; i < trace.route.length; i++) {
        const point2 = trace.route[i];
        if (point2.route_type !== "via") continue;
        const materialized = db.pcb_via.list().find(
          (via) => (via.pcb_trace_id === trace.pcb_trace_id || !via.pcb_trace_id && via.source_trace_id === trace.source_trace_id) && Math.hypot(via.x - point2.x, via.y - point2.y) <= 1e-9
        );
        const diameter = materialized?.outer_diameter ?? point2.outer_diameter;
        if (diameter === void 0 || !Number.isFinite(diameter) || diameter <= 0)
          continue;
        const from = stack.indexOf(point2.from_layer);
        const to = stack.indexOf(point2.to_layer);
        const layers = materialized?.layers ?? (from >= 0 && to >= 0 ? stack.slice(Math.min(from, to), Math.max(from, to) + 1) : []);
        for (const segment of segments) {
          if (!layers.includes(segment.layer)) continue;
          const reach = (diameter + segment.thickness) / 2;
          const alongRouteGap = Math.max(
            segment.startDistance - routeDistances[i],
            routeDistances[i] - segment.endDistance,
            0
          );
          if (alongRouteGap <= reach + 1e-9) continue;
          const viaSegment = {
            ...segment,
            x1: point2.x,
            y1: point2.y,
            x2: point2.x,
            y2: point2.y
          };
          const gap = segmentToSegmentMinDistance3(
            point2,
            point2,
            { x: segment.x1, y: segment.y1 },
            { x: segment.x2, y: segment.y2 }
          ) - reach;
          if (gap > 1e-9) continue;
          shortCenter = getClosestPointBetweenSegments(segment, viaSegment);
          break vias;
        }
      }
    }
    if (shortCenter) {
      const sourceTrace = db.source_trace.get(trace.source_trace_id);
      const endpointNames = (sourceTrace?.connected_source_port_ids ?? []).map((id) => {
        const port = db.source_port.get(id);
        const component = port?.source_component_id ? db.source_component.get(port.source_component_id) : void 0;
        return component?.name && port?.name ? `${component.name}.${port.name}` : void 0;
      }).filter((name) => Boolean(name));
      const traceName = sourceTrace?.name || sourceTrace?.display_name || endpointNames.join(" \u2192 ") || "unnamed";
      errors.push({
        type: "pcb_trace_error",
        error_type: "pcb_trace_error",
        pcb_trace_error_id: `self_short_${trace.pcb_trace_id}`,
        pcb_trace_id: trace.pcb_trace_id,
        source_trace_id: trace.source_trace_id,
        message: `PCB trace "${traceName}" shorts to itself, bypassing part of its length-matched route`,
        center: shortCenter,
        pcb_component_ids: [],
        pcb_port_ids: getPcbPortIdsConnectedToTraces([trace]),
        subcircuit_id: trace.subcircuit_id
      });
    }
  }
  return errors;
}

// lib/check-copper-pour-shorts.ts
import Flatbush from "flatbush";
import "@flatten-js/core";

// node_modules/@tscircuit/circuit-json-to-flattenjs/dist/index.js
import * as F from "@flatten-js/core";
import { Vector as Vector2 } from "@flatten-js/core";
import { BooleanOperations, Matrix } from "@flatten-js/core";
import { Arc as Arc2 } from "@flatten-js/core";
var EPS = 1e-9;
var point = (p) => new F.Point(p.x, p.y);
function positive(value, name) {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`${name} must be finite and positive`);
  return value;
}
function circle(center, radius) {
  positive(radius, "radius");
  return new F.Polygon(new F.Circle(point(center), radius));
}
function ring(vertices) {
  const clean = vertices.filter(
    (p, i) => i === 0 || point(p).distanceTo(point(vertices[i - 1]))[0] > EPS
  );
  if (clean.length > 1 && point(clean[0]).distanceTo(point(clean.at(-1)))[0] <= EPS)
    clean.pop();
  if (clean.length < 2)
    throw new Error("A ring needs at least two distinct vertices");
  const edges = clean.map((a, i) => {
    const b = clean[(i + 1) % clean.length];
    if (![a.x, a.y, a.bulge ?? 0].every(Number.isFinite))
      throw new Error("Non-finite ring vertex");
    const bulge = a.bulge ?? 0;
    if (Math.abs(bulge) <= EPS) return new F.Segment(point(a), point(b));
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    const offset = length * (1 - bulge * bulge) / (4 * bulge);
    const center = new F.Point(
      (a.x + b.x) / 2 - dy / length * offset,
      (a.y + b.y) / 2 + dx / length * offset
    );
    return new F.Arc(
      center,
      length * (1 + bulge * bulge) / (4 * Math.abs(bulge)),
      Math.atan2(a.y - center.y, a.x - center.x),
      Math.atan2(b.y - center.y, b.x - center.x),
      bulge > 0
    );
  });
  const polygon = new F.Polygon();
  polygon.addFace(edges);
  if (polygon.area() <= EPS)
    throw new Error("A ring must enclose a non-zero area");
  return polygon;
}
function rectangle(center, width, height, rotation = 0, radius = 0) {
  positive(width, "width");
  positive(height, "height");
  if (!Number.isFinite(rotation) || !Number.isFinite(radius) || radius < 0)
    throw new Error("Invalid rectangle rotation or corner radius");
  const r = Math.min(radius, width / 2, height / 2);
  const x = width / 2, y = height / 2;
  let polygon;
  if (r <= EPS)
    polygon = ring([
      { x: -x, y: -y },
      { x, y: -y },
      { x, y },
      { x: -x, y }
    ]);
  else {
    const corners = [
      new F.Point(x - r, -y + r),
      new F.Point(x - r, y - r),
      new F.Point(-x + r, y - r),
      new F.Point(-x + r, -y + r)
    ];
    const edges = [];
    for (let i = 0; i < 4; i++) {
      const angle = -Math.PI / 2 + i * Math.PI / 2;
      const arc = new F.Arc(corners[i], r, angle, angle + Math.PI / 2, true);
      const next = corners[(i + 1) % 4];
      const nextStart = new F.Point(
        next.x + r * Math.cos(angle + Math.PI / 2),
        next.y + r * Math.sin(angle + Math.PI / 2)
      );
      edges.push(arc);
      if (arc.end.distanceTo(nextStart)[0] > EPS)
        edges.push(new F.Segment(arc.end, nextStart));
    }
    polygon = new F.Polygon();
    polygon.addFace(edges);
  }
  return polygon.rotate(rotation * Math.PI / 180).translate(new F.Vector(center.x, center.y));
}
function stroke(a, b, widthA, widthB = widthA) {
  const r1 = positive(widthA, "trace width") / 2, r2 = positive(widthB, "trace width") / 2;
  const d = point(a).distanceTo(point(b))[0];
  if (d <= Math.abs(r1 - r2) + EPS)
    return circle(r1 >= r2 ? a : b, Math.max(r1, r2));
  const theta = Math.atan2(b.y - a.y, b.x - a.x);
  const alpha = Math.acos((r1 - r2) / d);
  const low = theta - alpha, high = theta + alpha;
  const p = (c, r, angle) => new F.Point(c.x + r * Math.cos(angle), c.y + r * Math.sin(angle));
  const polygon = new F.Polygon();
  polygon.addFace([
    new F.Segment(p(a, r1, low), p(b, r2, low)),
    new F.Arc(point(b), r2, low, high, true),
    new F.Segment(p(b, r2, high), p(a, r1, high)),
    new F.Arc(point(a), r1, high, low, true)
  ]);
  return polygon;
}
function withHoles(outer, holes) {
  const result = outer.clone();
  const orientation = [...result.faces][0].orientation();
  for (const hole of holes) {
    const copy = hole.clone();
    if ([...copy.faces][0].orientation() === orientation) copy.reverse();
    for (const face of copy.faces) result.addFace(face.shapes);
  }
  return result;
}
function ellipse(center, width, height, rotation = 0, tolerance = 1e-3) {
  positive(width, "ellipse width");
  positive(height, "ellipse height");
  positive(tolerance, "curveTolerance");
  if (Math.abs(width - height) < EPS) return circle(center, width / 2);
  const radius = Math.max(width, height) / 2;
  const count = Math.max(
    16,
    Math.ceil(Math.PI / Math.acos(Math.max(-1, 1 - tolerance / radius)))
  );
  if (count > 1e5)
    throw new Error("curveTolerance requires more than 100000 ellipse segments");
  return ring(
    Array.from({ length: count }, (_, i) => ({
      x: width / 2 * Math.cos(i * 2 * Math.PI / count),
      y: height / 2 * Math.sin(i * 2 * Math.PI / count)
    }))
  ).rotate(rotation * Math.PI / 180).translate(new F.Vector(center.x, center.y));
}
function getCopperLayers(json, options) {
  if (options.copperLayers) {
    if (!options.copperLayers.length || new Set(options.copperLayers).size !== options.copperLayers.length)
      throw new Error(
        "copperLayers must be a non-empty list without duplicates"
      );
    return [...options.copperLayers];
  }
  const board = json.find((e) => e.type === "pcb_board");
  let count = board?.num_layers ?? 2;
  for (const element of json) {
    const layers = "layers" in element ? element.layers : "layer" in element ? [element.layer] : [];
    if (Array.isArray(layers))
      for (const layer of layers) {
        const match = typeof layer === "string" && /^inner(\d+)$/.exec(layer);
        if (match) count = Math.max(count, Number(match[1]) + 2);
      }
    if (element.type === "pcb_trace")
      for (const p of element.route) {
        for (const layer of p.route_type === "wire" ? [p.layer] : p.route_type === "via" ? [p.from_layer, p.to_layer] : [p.start_layer, p.end_layer]) {
          const match = /^inner(\d+)$/.exec(layer);
          if (match) count = Math.max(count, Number(match[1]) + 2);
        }
      }
  }
  if (!Number.isInteger(count) || count < 1 || count > 10)
    throw new Error("Supported copper layer count is 1\u201310");
  return count === 1 ? ["top"] : [
    "top",
    ...Array.from(
      { length: count - 2 },
      (_, i) => `inner${i + 1}`
    ),
    "bottom"
  ];
}
function spanLayers(layers, stack) {
  if (!layers.length) return [];
  const indices = layers.map((layer) => stack.indexOf(layer));
  if (indices.some((i) => i < 0))
    throw new Error(`Layer is missing from copperLayers: ${layers.join(", ")}`);
  return stack.slice(Math.min(...indices), Math.max(...indices) + 1);
}
function smtPad(pad) {
  switch (pad.shape) {
    case "circle":
      return circle(pad, pad.radius);
    case "polygon":
      return ring(pad.points);
    case "rect":
    case "rotated_rect":
      return rectangle(
        pad,
        pad.width,
        pad.height,
        "ccw_rotation" in pad ? pad.ccw_rotation : 0,
        pad.rect_border_radius ?? pad.corner_radius ?? 0
      );
    case "pill":
    case "rotated_pill":
      return rectangle(
        pad,
        pad.width,
        pad.height,
        "ccw_rotation" in pad ? pad.ccw_rotation : 0,
        pad.radius
      );
  }
}
function nonPlatedHole(hole, tolerance) {
  switch (hole.hole_shape) {
    case "circle":
      return circle(hole, hole.hole_diameter / 2);
    case "square":
      return rectangle(hole, hole.hole_diameter, hole.hole_diameter);
    case "rect":
      return rectangle(hole, hole.hole_width, hole.hole_height);
    case "oval":
      return ellipse(hole, hole.hole_width, hole.hole_height, 0, tolerance);
    case "pill":
    case "rotated_pill":
      return rectangle(
        hole,
        hole.hole_width,
        hole.hole_height,
        "ccw_rotation" in hole ? hole.ccw_rotation : 0,
        Math.min(hole.hole_width, hole.hole_height) / 2
      );
  }
}
function platedHole(hole, componentRotation, includeDrill, tolerance) {
  let outer;
  let drill;
  const drillCenter = {
    x: hole.x + ("hole_offset_x" in hole ? hole.hole_offset_x ?? 0 : 0),
    y: hole.y + ("hole_offset_y" in hole ? hole.hole_offset_y ?? 0 : 0)
  };
  switch (hole.shape) {
    case "circle":
      outer = circle(hole, hole.outer_diameter / 2);
      drill = circle(hole, hole.hole_diameter / 2);
      break;
    case "oval":
      outer = ellipse(
        hole,
        hole.outer_width,
        hole.outer_height,
        hole.ccw_rotation,
        tolerance
      );
      drill = ellipse(
        hole,
        hole.hole_width,
        hole.hole_height,
        hole.ccw_rotation,
        tolerance
      );
      break;
    case "pill":
      outer = rectangle(
        hole,
        hole.outer_width,
        hole.outer_height,
        hole.ccw_rotation,
        Math.min(hole.outer_width, hole.outer_height) / 2
      );
      drill = rectangle(
        hole,
        hole.hole_width,
        hole.hole_height,
        hole.ccw_rotation,
        Math.min(hole.hole_width, hole.hole_height) / 2
      );
      break;
    case "circular_hole_with_rect_pad":
    case "pill_hole_with_rect_pad":
    case "rotated_pill_hole_with_rect_pad":
      outer = rectangle(
        hole,
        hole.rect_pad_width,
        hole.rect_pad_height,
        "rect_ccw_rotation" in hole ? hole.rect_ccw_rotation : 0,
        hole.rect_border_radius ?? 0
      );
      drill = hole.shape === "circular_hole_with_rect_pad" ? circle(drillCenter, hole.hole_diameter / 2) : rectangle(
        drillCenter,
        hole.hole_width,
        hole.hole_height,
        "hole_ccw_rotation" in hole ? hole.hole_ccw_rotation : 0,
        Math.min(hole.hole_width, hole.hole_height) / 2
      );
      break;
    case "hole_with_polygon_pad": {
      const rotation = hole.ccw_rotation ?? componentRotation;
      outer = ring(hole.pad_outline).rotate(rotation * Math.PI / 180).translate(new Vector2(hole.x, hole.y));
      drill = hole.hole_shape === "circle" ? circle(drillCenter, hole.hole_diameter / 2) : hole.hole_shape === "oval" ? ellipse(
        drillCenter,
        hole.hole_width,
        hole.hole_height,
        rotation,
        tolerance
      ) : rectangle(
        drillCenter,
        hole.hole_width,
        hole.hole_height,
        rotation,
        Math.min(hole.hole_width, hole.hole_height) / 2
      );
      break;
    }
  }
  return includeDrill ? withHoles(outer, [drill]) : outer;
}
var samePoint = (a, b) => a.x === b.x && a.y === b.y;
var unit = (x, y) => {
  const length = Math.hypot(x, y);
  return length ? { x: x / length, y: y / length } : { x: 1, y: 0 };
};
function interpolatedPolygon(segments) {
  const points = [
    { ...segments[0].start, width: segments[0].startWidth },
    ...segments.map((s) => ({ ...s.end, width: s.endWidth }))
  ];
  const directions2 = segments.map(
    (s) => unit(s.end.x - s.start.x, s.end.y - s.start.y)
  );
  const left = [], right = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    positive(p.width, "interpolated trace width");
    const before = directions2[Math.max(0, i - 1)], after = directions2[Math.min(i, directions2.length - 1)];
    const d = unit(before.x + after.x, before.y + after.y);
    const nx = -d.y * p.width / 2, ny = d.x * p.width / 2;
    left.push({ x: p.x + nx, y: p.y + ny });
    right.push({ x: p.x - nx, y: p.y - ny });
  }
  return ring([...left, ...right.reverse()]);
}
function subtractDrill(shape, hole) {
  try {
    return BooleanOperations.subtract(shape, hole);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "Unresolved boundary conflict in boolean operation")
      throw error;
    const toMicrometers = new Matrix(1e3, 0, 0, 1e3, 0, 0);
    const toMillimeters = new Matrix(1e-3, 0, 0, 1e-3, 0, 0);
    return BooleanOperations.subtract(
      shape.transform(toMicrometers),
      hole.transform(toMicrometers)
    ).transform(toMillimeters);
  }
}
function traceGeometry(trace, stack, includeDrill) {
  const result = /* @__PURE__ */ new Map();
  const drills = /* @__PURE__ */ new Map();
  const segments = [];
  const add = (layer, shape) => result.set(layer, [...result.get(layer) ?? [], shape]);
  for (const p of trace.route) {
    if (p.route_type === "via") {
      const legacy = p;
      const outerDiameter = p.outer_diameter ?? legacy.via_diameter;
      if (outerDiameter === void 0) continue;
      const holeDiameter = p.hole_diameter ?? legacy.via_hole_diameter;
      const shape = circle(p, outerDiameter / 2);
      const drill = includeDrill && holeDiameter ? circle(p, holeDiameter / 2) : void 0;
      for (const layer of spanLayers([p.from_layer, p.to_layer], stack)) {
        add(layer, drill ? withHoles(shape, [drill]) : shape);
        if (drill) drills.set(layer, [...drills.get(layer) ?? [], drill]);
      }
    }
    if (p.route_type === "through_pad") {
      for (const layer of /* @__PURE__ */ new Set([p.start_layer, p.end_layer]))
        add(layer, stroke(p.start, p.end, p.width));
    }
  }
  for (let i = 0; i < trace.route.length - 1; i++) {
    const a = trace.route[i], b = trace.route[i + 1];
    const start = a.route_type === "through_pad" ? a.end : a;
    const end = b.route_type === "through_pad" ? b.start : b;
    if (samePoint(start, end)) continue;
    const startLayers = a.route_type === "wire" ? [a.layer] : a.route_type === "via" ? spanLayers([a.from_layer, a.to_layer], stack) : [a.end_layer];
    const endLayers = b.route_type === "wire" ? [b.layer] : b.route_type === "via" ? spanLayers([b.from_layer, b.to_layer], stack) : [b.start_layer];
    const sharedLayers = startLayers.filter(
      (layer) => endLayers.includes(layer)
    );
    if (sharedLayers.length !== 1)
      throw new Error(
        `Cannot determine one wire layer between route points ${i} and ${i + 1}`
      );
    const startLayer = sharedLayers[0];
    const width = "width" in a ? a.width : "width" in b ? b.width : void 0;
    if (width === void 0 || samePoint(start, end)) continue;
    segments.push({
      start,
      end,
      layer: startLayer,
      startWidth: width,
      endWidth: "width" in b ? b.width : width
    });
  }
  if (trace.route_thickness_mode === "interpolated") {
    let group = [];
    const flush = () => {
      if (group.length) {
        add(group[0].layer, interpolatedPolygon(group));
        group = [];
      }
    };
    for (const segment of segments) {
      const last = group.at(-1);
      if (last && (last.layer !== segment.layer || !samePoint(last.end, segment.start) || last.endWidth !== segment.startWidth))
        flush();
      group.push(segment);
    }
    flush();
  } else
    for (const s of segments) add(s.layer, stroke(s.start, s.end, s.startWidth));
  for (const [layer, holes] of drills) {
    result.set(
      layer,
      result.get(layer).map(
        (shape) => holes.reduce((shape2, hole) => subtractDrill(shape2, hole), shape)
      ).filter((shape) => shape.faces.size > 0)
    );
  }
  return result;
}
var supportedElementTypes = [
  "pcb_board",
  "pcb_smtpad",
  "pcb_plated_hole",
  "pcb_hole",
  "pcb_via",
  "pcb_trace",
  "pcb_copper_pour",
  "pcb_cutout",
  "pcb_keepout",
  "pcb_courtyard_rect",
  "pcb_courtyard_circle",
  "pcb_courtyard_pill",
  "pcb_courtyard_polygon",
  "pcb_courtyard_outline"
];
function cutoutGeometry(cutout) {
  switch (cutout.shape) {
    case "circle":
      return [circle(cutout.center, cutout.radius)];
    case "rect":
      return [
        rectangle(
          cutout.center,
          cutout.width,
          cutout.height,
          cutout.rotation,
          cutout.corner_radius
        )
      ];
    case "polygon":
      return [ring(cutout.points)];
    case "path": {
      if (cutout.slot_length !== void 0 || cutout.space_between_slots !== void 0 || cutout.slot_corner_radius !== void 0) {
        throw new Error(
          "Patterned/custom-corner path cutouts are not supported; use explicit rect/polygon cutouts"
        );
      }
      return cutout.route.slice(1).map((p, i) => stroke(cutout.route[i], p, cutout.slot_width));
    }
  }
}
function convertCircuitJsonToFlattenJs(json, options = {}) {
  if (options.layer && options.layers)
    throw new Error("Specify layer or layers, not both");
  const selectedLayers = options.layer ? [options.layer] : options.layers;
  const stack = getCopperLayers(json, options);
  const result = {
    elements: [],
    warnings: [],
    bounds: void 0,
    copperLayers: stack
  };
  const rotations = new Map(
    json.filter((e) => e.type === "pcb_component").map((e) => [e.pcb_component_id, e.rotation])
  );
  const tolerance = options.curveTolerance ?? 1e-3;
  if (!Number.isFinite(tolerance) || tolerance <= 0)
    throw new Error("curveTolerance must be finite and positive");
  const includeDrill = options.includeDrillHoles !== false;
  for (const element of json) {
    if (!supportedElementTypes.includes(element.type))
      continue;
    const elementId = element[`${element.type}_id`];
    if (options.elementTypes && !options.elementTypes.includes(element.type))
      continue;
    if (options.elementIds && !options.elementIds.includes(elementId)) continue;
    let role = "copper";
    let layers = [null];
    let shapes = [];
    let byLayer;
    try {
      switch (element.type) {
        case "pcb_smtpad":
          layers = [element.layer];
          shapes = [smtPad(element)];
          break;
        case "pcb_plated_hole":
          layers = spanLayers(element.layers, stack);
          shapes = [
            platedHole(
              element,
              rotations.get(element.pcb_component_id ?? "") ?? 0,
              includeDrill,
              tolerance
            )
          ];
          break;
        case "pcb_via": {
          layers = spanLayers(element.layers, stack);
          const outer = circle(element, element.outer_diameter / 2);
          shapes = [
            includeDrill ? withHoles(outer, [circle(element, element.hole_diameter / 2)]) : outer
          ];
          break;
        }
        case "pcb_trace":
          byLayer = traceGeometry(element, stack, includeDrill);
          layers = [...byLayer.keys()];
          break;
        case "pcb_copper_pour":
          layers = [element.layer];
          shapes = [
            element.shape === "rect" ? rectangle(
              element.center,
              element.width,
              element.height,
              element.rotation
            ) : element.shape === "polygon" ? ring(element.points) : withHoles(
              ring(element.brep_shape.outer_ring.vertices),
              element.brep_shape.inner_rings.map(
                (h) => ring(h.vertices)
              )
            )
          ];
          break;
        case "pcb_board":
          role = "board";
          shapes = [
            element.outline?.length ? ring(element.outline) : rectangle(element.center, element.width, element.height)
          ];
          break;
        case "pcb_hole":
          role = "drill";
          shapes = [nonPlatedHole(element, tolerance)];
          break;
        case "pcb_cutout":
          role = "cutout";
          shapes = cutoutGeometry(element);
          break;
        case "pcb_keepout":
          role = "keepout";
          layers = element.layers;
          shapes = [
            element.shape === "circle" ? circle(element.center, element.radius) : element.shape === "rect" ? rectangle(element.center, element.width, element.height) : ring(element.outline)
          ];
          break;
        case "pcb_courtyard_rect":
          role = "courtyard";
          layers = [element.layer];
          shapes = [
            rectangle(
              element.center,
              element.width,
              element.height,
              element.ccw_rotation
            )
          ];
          break;
        case "pcb_courtyard_circle":
          role = "courtyard";
          layers = [element.layer];
          shapes = [circle(element.center, element.radius)];
          break;
        case "pcb_courtyard_pill":
          role = "courtyard";
          layers = [element.layer];
          shapes = [
            rectangle(
              element.center,
              element.width,
              element.height,
              0,
              element.radius
            )
          ];
          break;
        case "pcb_courtyard_polygon":
          role = "courtyard";
          layers = [element.layer];
          shapes = [ring(element.points)];
          break;
        case "pcb_courtyard_outline":
          role = "courtyard";
          layers = [element.layer];
          shapes = [ring(element.outline)];
          break;
      }
      if (options.roles && !options.roles.includes(role)) continue;
      const convertedElements = [];
      for (const layer of new Set(layers)) {
        if (layer === null ? options.includeLayerless === false : selectedLayers && !selectedLayers.includes(layer))
          continue;
        const layerShapes = byLayer?.get(layer) ?? shapes;
        if (!layerShapes.length) continue;
        const bounds = layerShapes.reduce(
          (box, shape) => box.merge(shape.box),
          layerShapes[0].box
        );
        if (![bounds.xmin, bounds.ymin, bounds.xmax, bounds.ymax].every(
          Number.isFinite
        ))
          throw new Error("Non-finite geometry bounds");
        const converted = {
          elementId,
          elementType: element.type,
          sourceElement: element,
          role,
          layer,
          shapes: layerShapes,
          bounds
        };
        convertedElements.push(converted);
      }
      for (const converted of convertedElements) {
        result.elements.push(converted);
        result.bounds = result.bounds ? result.bounds.merge(converted.bounds) : converted.bounds;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (options.strict) throw new Error(`${elementId}: ${message}`);
      result.warnings.push({ elementId, elementType: element.type, message });
    }
  }
  return result;
}

// lib/check-copper-pour-shorts.ts
import {
  getFullConnectivityMapFromCircuitJson as getFullConnectivityMapFromCircuitJson2
} from "circuit-json-to-connectivity-map";
function touchesPour(pour, geometry) {
  if (!pour.box.intersect(geometry.box)) return false;
  return pour.intersect(geometry).length > 0 || [...geometry.faces].some((face) => pour.contains(face.first.start)) || [...pour.faces].some((face) => geometry.contains(face.first.start));
}
function checkCopperPourShorts(circuitJson, { connMap } = {}) {
  if (!circuitJson.some((e) => e.type === "pcb_copper_pour")) return [];
  connMap ??= getFullConnectivityMapFromCircuitJson2(circuitJson);
  const { elements: copper } = convertCircuitJsonToFlattenJs(circuitJson, {
    elementTypes: [
      "pcb_smtpad",
      "pcb_plated_hole",
      "pcb_via",
      "pcb_trace",
      "pcb_copper_pour"
    ],
    strict: true
  });
  const layers = /* @__PURE__ */ new Map();
  for (const element of copper) {
    const entries = layers.get(element.layer) ?? [];
    for (const shape of element.shapes) entries.push({ element, shape });
    layers.set(element.layer, entries);
  }
  const indexes = new Map(
    [...layers].map(([layer, entries]) => {
      const index = new Flatbush(entries.length);
      for (const { shape } of entries) {
        const b = shape.box;
        index.add(b.xmin, b.ymin, b.xmax, b.ymax);
      }
      index.finish();
      return [layer, { index, entries }];
    })
  );
  const errors = /* @__PURE__ */ new Map();
  for (const pour of copper) {
    const element = pour.sourceElement;
    if (element.type !== "pcb_copper_pour") continue;
    const netId = element.source_net_id;
    const { index, entries } = indexes.get(pour.layer);
    const candidates = /* @__PURE__ */ new Set();
    for (const shape of pour.shapes) {
      const b = shape.box;
      for (const i of index.search(b.xmin, b.ymin, b.xmax, b.ymax))
        candidates.add(i);
    }
    for (const i of [...candidates].sort((a, b) => a - b)) {
      const { element: other, shape: otherShape } = entries[i];
      if (pour.elementId === other.elementId) continue;
      const otherNetId = other.sourceElement.type === "pcb_copper_pour" ? other.sourceElement.source_net_id : other.elementId;
      if (netId && otherNetId && (netId === otherNetId || connMap.areIdsConnected(netId, otherNetId)))
        continue;
      const id = `copper_pour_short_${[pour.elementId, other.elementId].sort().join("_")}`;
      if (errors.has(id) || !pour.shapes.some((shape) => touchesPour(shape, otherShape)))
        continue;
      errors.set(id, {
        type: "pcb_placement_error",
        pcb_placement_error_id: id,
        error_type: "pcb_placement_error",
        message: `Copper pour ${getReadableNameForElementId(circuitJson, pour.elementId)} (${netId ? getReadableNameForElementId(circuitJson, netId) : "unassigned net"}) shorts to ${getReadableNameForElementId(circuitJson, other.elementId)} on ${pour.layer} (accidental copper contact)`,
        subcircuit_id: element.subcircuit_id
      });
    }
  }
  return [...errors.values()];
}

// lib/util/trace-port-layer-connectivity.ts
import {
  all_layers as all_layers4
} from "circuit-json";
var EPSILON2 = 1e-9;
function createTracePortLayerConnectivity(circuit) {
  const ports = new Map(
    circuit.filter((e) => e.type === "pcb_port").map((p) => [p.pcb_port_id, p])
  );
  const pads = circuit.filter(
    (e) => e.type === "pcb_smtpad" || e.type === "pcb_plated_hole"
  );
  const padsByPort = /* @__PURE__ */ new Map();
  for (const pad of pads) {
    if (!pad.pcb_port_id) continue;
    const entries = padsByPort.get(pad.pcb_port_id) ?? [];
    entries.push(pad);
    padsByPort.set(pad.pcb_port_id, entries);
  }
  const emittedVias = circuit.filter((e) => e.type === "pcb_via");
  let bridges;
  const getBridges = () => {
    if (bridges) return bridges;
    bridges = emittedVias.map((v) => ({ ...v, diameter: v.outer_diameter }));
    const board = circuit.find((e) => e.type === "pcb_board");
    const stack = [
      "top",
      ...all_layers4.filter((l) => l.startsWith("inner")).slice(0, board ? Math.max(0, board.num_layers - 2) : void 0),
      ...board?.num_layers === 1 ? [] : ["bottom"]
    ];
    for (const trace of circuit) {
      if (trace.type !== "pcb_trace") continue;
      for (const point2 of trace.route) {
        if (point2.route_type !== "via") continue;
        if (emittedVias.some(
          (v) => Math.hypot(v.x - point2.x, v.y - point2.y) <= EPSILON2
        ))
          continue;
        const from = stack.indexOf(point2.from_layer), to = stack.indexOf(point2.to_layer);
        if (from < 0 || to < 0) continue;
        bridges.push({
          ...point2,
          layers: stack.slice(Math.min(from, to), Math.max(from, to) + 1),
          diameter: point2.outer_diameter
        });
      }
    }
    return bridges;
  };
  const layersForPort = (port) => {
    const portPads = padsByPort.get(port.pcb_port_id);
    return portPads?.length ? [...new Set(portPads.flatMap(getLayersOfPcbElement))] : port.layers;
  };
  const canConnect = (point2, portId) => {
    const port = ports.get(portId);
    if (!port) return true;
    const layers = layersForPort(port);
    if (layers.includes(point2.layer)) return true;
    const portPads = padsByPort.get(portId) ?? [];
    return getBridges().some((via) => {
      if (!via.layers.includes(point2.layer) || !layers.some((l) => via.layers.includes(l)))
        return false;
      if (via.diameter !== void 0 && (!Number.isFinite(via.diameter) || via.diameter <= 0))
        return false;
      const reach = via.diameter === void 0 ? 0 : via.diameter / 2 + point2.width / 2;
      if (Math.hypot(point2.x - via.x, point2.y - via.y) > reach + EPSILON2)
        return false;
      if (portPads.length === 0)
        return Math.hypot(port.x - via.x, port.y - via.y) <= EPSILON2;
      return portPads.some((pad) => {
        if (!getLayersOfPcbElement(pad).some((l) => via.layers.includes(l)))
          return false;
        if (via.diameter === void 0) return isPointInPad(via, pad);
        return getPadToPadGap(
          {
            type: "pcb_via",
            pcb_via_id: "layer-contact",
            x: via.x,
            y: via.y,
            outer_diameter: via.diameter,
            hole_diameter: 0,
            layers: via.layers
          },
          pad
        ) <= EPSILON2;
      });
    });
  };
  return { ports, layersForPort, canConnect };
}
function getTracePortLayerMismatches(circuit) {
  const contact = createTracePortLayerConnectivity(circuit);
  return circuit.flatMap((trace) => {
    if (trace.type !== "pcb_trace") return [];
    return trace.route.flatMap((point2, index) => {
      if (point2.route_type !== "wire") return [];
      return [
        .../* @__PURE__ */ new Set([point2.start_pcb_port_id, point2.end_pcb_port_id])
      ].flatMap((portId) => {
        if (!portId || contact.canConnect(point2, portId)) return [];
        const port = contact.ports.get(portId);
        return [
          { trace, point: point2, index, port, padLayers: contact.layersForPort(port) }
        ];
      });
    });
  });
}

// lib/util/create-indexed-pcb-connectivity-map.ts
import {
  ConnectivityMap,
  findConnectedNetworks,
  PcbConnectivityMap
} from "circuit-json-to-connectivity-map";
import Flatbush3 from "flatbush";

// lib/util/get-via-and-pour-connections.ts
import { all_layers as all_layers5 } from "circuit-json";
import {
  circlePolygon,
  getPourPolygon as getPourPolygon2,
  getTraceSegmentPolygon
} from "@tscircuit/circuit-json-util";
import Flatbush2 from "flatbush";
function getViaAndPourConnections(circuit) {
  if (!circuit.some(
    (e) => e.type === "pcb_via" || e.type === "pcb_copper_pour" || e.type === "pcb_trace" && e.route.some((p) => p.route_type === "via")
  ))
    return [];
  const conductors = [];
  const connections = [];
  const scale = 1e6;
  const tolerance = 1e-7 * scale;
  const touches = createCopperPolygonContactTester(tolerance);
  const add = (id, layers, polygon, bridges = false) => {
    if (!polygon.isEmpty())
      conductors.push({
        id,
        layers,
        polygon: polygon.scale(scale, scale),
        bridges
      });
  };
  const vias = circuit.filter((e) => e.type === "pcb_via");
  const board = circuit.find((e) => e.type === "pcb_board");
  const stack = [
    "top",
    ...all_layers5.filter((l) => l.startsWith("inner")).slice(0, board ? Math.max(0, board.num_layers - 2) : void 0),
    ...board?.num_layers === 1 ? [] : ["bottom"]
  ];
  for (const copper of circuit) {
    if (copper.type === "pcb_via") {
      add(
        copper.pcb_via_id,
        copper.layers,
        circlePolygon(copper, copper.outer_diameter / 2),
        true
      );
      if (copper.pcb_trace_id)
        connections.push([copper.pcb_via_id, copper.pcb_trace_id]);
    } else if (copper.type === "pcb_copper_pour") {
      add(
        copper.pcb_copper_pour_id,
        [copper.layer],
        getPourPolygon2(copper),
        true
      );
    } else if (copper.type === "pcb_trace") {
      if (copper.route_thickness_mode === "interpolated") continue;
      for (let i = 0; i < copper.route.length; i++) {
        const a = copper.route[i], b = copper.route[i + 1];
        if (a.route_type === "wire" && b?.route_type === "wire" && a.layer === b.layer && (a.x !== b.x || a.y !== b.y)) {
          add(
            copper.pcb_trace_id,
            [a.layer],
            getTraceSegmentPolygon(a, b, a.width)
          );
        } else if (a.route_type === "via") {
          if (vias.some(
            (v) => v.pcb_trace_id === copper.pcb_trace_id && Math.hypot(v.x - a.x, v.y - a.y) < 1e-9
          ))
            continue;
          const from = stack.indexOf(a.from_layer), to = stack.indexOf(a.to_layer);
          if (from < 0 || to < 0 || !a.outer_diameter) continue;
          const via = {
            type: "pcb_via",
            pcb_via_id: `${copper.pcb_trace_id}_via_${i}`,
            x: a.x,
            y: a.y,
            outer_diameter: a.outer_diameter,
            hole_diameter: 0,
            layers: stack.slice(Math.min(from, to), Math.max(from, to) + 1)
          };
          add(
            copper.pcb_trace_id,
            via.layers,
            circlePolygon(via, via.outer_diameter / 2),
            true
          );
        }
      }
    }
  }
  if (!conductors.length) return connections;
  const index = new Flatbush2(conductors.length);
  for (const { polygon } of conductors) {
    const b = polygon.box;
    index.add(b.xmin, b.ymin, b.xmax, b.ymax);
  }
  index.finish();
  for (const [i, a] of conductors.entries()) {
    if (!a.bridges) continue;
    const box = a.polygon.box;
    for (const j of index.search(
      box.xmin - tolerance,
      box.ymin - tolerance,
      box.xmax + tolerance,
      box.ymax + tolerance
    )) {
      const b = conductors[j];
      if (i === j || a.id === b.id || b.bridges && j < i || !a.layers.some((l) => b.layers.includes(l)))
        continue;
      if (touches(a.polygon, b.polygon)) connections.push([a.id, b.id]);
    }
  }
  return connections;
}

// lib/util/create-indexed-pcb-connectivity-map.ts
function createIndexedPcbConnectivityMap(circuitJson) {
  const map = new PcbConnectivityMap();
  map.circuitJson = circuitJson;
  for (const element of circuitJson) {
    if (element.type === "pcb_trace") {
      map.traceIdToElm.set(element.pcb_trace_id, element);
    } else if (element.type === "pcb_port") {
      map.portIdToElm.set(element.pcb_port_id, element);
    }
  }
  const traces = [...map.traceIdToElm.values()];
  const boundsByLayer = /* @__PURE__ */ new Map();
  for (const [traceIndex, trace] of traces.entries()) {
    const boundsForTrace = /* @__PURE__ */ new Map();
    for (let i = 0; i < trace.route.length - 1; i++) {
      const a = trace.route[i];
      const b = trace.route[i + 1];
      if (a.route_type !== "wire" || b.route_type !== "wire" || a.layer !== b.layer)
        continue;
      const bounds = boundsForTrace.get(a.layer) ?? {
        traceIndex,
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity
      };
      const radius = a.width / 2 + 1e-9;
      bounds.minX = Math.min(bounds.minX, a.x - radius, b.x - radius);
      bounds.minY = Math.min(bounds.minY, a.y - radius, b.y - radius);
      bounds.maxX = Math.max(bounds.maxX, a.x + radius, b.x + radius);
      bounds.maxY = Math.max(bounds.maxY, a.y + radius, b.y + radius);
      boundsForTrace.set(a.layer, bounds);
    }
    for (const [layer, bounds] of boundsForTrace) {
      const entries = boundsByLayer.get(layer) ?? [];
      entries.push(bounds);
      boundsByLayer.set(layer, entries);
    }
  }
  const candidates = traces.map(() => /* @__PURE__ */ new Set());
  for (const bounds of boundsByLayer.values()) {
    const index = new Flatbush3(bounds.length);
    for (const box of bounds) index.add(box.minX, box.minY, box.maxX, box.maxY);
    index.finish();
    for (const box of bounds) {
      for (const hit of index.search(box.minX, box.minY, box.maxX, box.maxY)) {
        const other = bounds[hit].traceIndex;
        if (other > box.traceIndex) candidates[box.traceIndex].add(other);
      }
    }
  }
  const connections = [];
  for (const [i, neighbors] of candidates.entries()) {
    for (const j of [...neighbors].sort((a, b) => a - b)) {
      if (map._arePcbTracesConnected(traces[i], traces[j])) {
        connections.push([traces[i].pcb_trace_id, traces[j].pcb_trace_id]);
      }
    }
  }
  const layerConnectivity = createTracePortLayerConnectivity(circuitJson);
  const connectionsByPort = /* @__PURE__ */ new Map();
  for (const trace of traces) {
    for (const point2 of trace.route) {
      if (point2.route_type !== "wire") continue;
      for (const portId of /* @__PURE__ */ new Set([
        point2.start_pcb_port_id,
        point2.end_pcb_port_id
      ])) {
        if (!portId || !map.portIdToElm.has(portId)) continue;
        if (!layerConnectivity.canConnect(point2, portId)) continue;
        const entries = connectionsByPort.get(portId) ?? [];
        entries.push(
          point2.start_pcb_port_id === portId ? [portId, trace.pcb_trace_id] : [trace.pcb_trace_id, portId]
        );
        connectionsByPort.set(portId, entries);
      }
    }
  }
  for (const portId of map.portIdToElm.keys()) {
    for (const connection of connectionsByPort.get(portId) ?? [])
      connections.push(connection);
  }
  connections.push(...getViaAndPourConnections(circuitJson));
  map.connMap = new ConnectivityMap(findConnectedNetworks(connections));
  return map;
}

// lib/add-start-and-end-port-ids-if-missing.ts
function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}
var addStartAndEndPortIdsIfMissing = (soup) => {
  const pcbPorts = soup.filter((item) => item.type === "pcb_port");
  const pcbSmtPads = soup.filter(
    (item) => item.type === "pcb_smtpad"
  );
  const pcbTraces = soup.filter((item) => item.type === "pcb_trace");
  function findPortIdOverlappingPoint(point2, options = {}) {
    const traceWidth = options.traceWidth || 0;
    const directPort = pcbPorts.find(
      (port) => port.layers.includes(point2.layer) && distance(port.x, port.y, point2.x, point2.y) < 0.01
    );
    if (directPort) return directPort.pcb_port_id;
    if (options.isFirstOrLastPoint) {
      const smtPad2 = pcbSmtPads.find((pad) => {
        if (pad.layer !== point2.layer) return false;
        if (pad.shape === "rect") {
          return Math.abs(point2.x - pad.x) < pad.width / 2 + traceWidth / 2 && Math.abs(point2.y - pad.y) < pad.height / 2 + traceWidth / 2;
        } else if (pad.shape === "circle") {
          return distance(point2.x, point2.y, pad.x, pad.y) < pad.radius;
        } else if (pad.shape === "pill" || pad.shape === "rotated_pill") {
          return isPointInPad(point2, pad);
        }
      });
      if (smtPad2) return smtPad2.pcb_port_id ?? null;
    }
    return null;
  }
  for (const trace of pcbTraces) {
    for (let index = 0; index < trace.route.length; index++) {
      const segment = trace.route[index];
      const isFirstOrLastPoint = index === 0 || index === trace.route.length - 1;
      if (segment.route_type === "wire") {
        if (!segment.start_pcb_port_id && index === 0) {
          const startPortId = findPortIdOverlappingPoint(segment, {
            isFirstOrLastPoint,
            traceWidth: segment.width
          });
          if (startPortId) {
            segment.start_pcb_port_id = startPortId;
          }
        }
        if (!segment.end_pcb_port_id && index === trace.route.length - 1) {
          const endPortId = findPortIdOverlappingPoint(segment, {
            isFirstOrLastPoint,
            traceWidth: segment.width
          });
          if (endPortId) {
            segment.end_pcb_port_id = endPortId;
          }
        }
      }
    }
  }
};

// lib/check-each-pcb-port-connected-to-pcb-trace.ts
import {
  getFullConnectivityMapFromCircuitJson as getFullConnectivityMapFromCircuitJson3
} from "circuit-json-to-connectivity-map";

// lib/copper-pour-connectivity/get-copper-pour-connectivity.ts
import {
  getPrimaryId as getPrimaryId3,
  getPlatedHolePolygon,
  getPourPolygon as getPourPolygon3,
  getSmtPadPolygon,
  getTraceSegmentPolygon as getTraceSegmentPolygon2,
  getViaPolygon as getViaPolygon2
} from "@tscircuit/circuit-json-util";
function getCopperPourConnectivity(circuitJson, connectivity) {
  const scale = 1e6;
  const tolerance = 1e-7 * scale;
  const copperPolygonsTouch = createCopperPolygonContactTester(tolerance);
  const conductors = [];
  const pouredNets = /* @__PURE__ */ new Set();
  const netForId = (id) => connectivity.getNetConnectedToId(id);
  const add = (conductor) => {
    if (!conductor.polygon.isEmpty()) {
      conductors.push({
        ...conductor,
        polygon: conductor.polygon.scale(scale, scale)
      });
    }
  };
  for (const pour of circuitJson) {
    if (pour.type !== "pcb_copper_pour" || !pour.source_net_id) continue;
    const netId = netForId(pour.source_net_id);
    if (!netId) continue;
    pouredNets.add(netId);
    add({
      polygon: getPourPolygon3(pour),
      layers: [pour.layer],
      netId,
      isPour: true
    });
  }
  const components = new Map(
    circuitJson.filter((e) => e.type === "pcb_component").map((e) => [e.pcb_component_id, e])
  );
  if (pouredNets.size > 0) {
    for (const copper of circuitJson) {
      if (copper.type === "pcb_trace") {
        const netId2 = netForId(copper.pcb_trace_id);
        if (!netId2 || !pouredNets.has(netId2) || copper.route_thickness_mode === "interpolated")
          continue;
        for (let i = 0; i < copper.route.length - 1; i++) {
          const start = copper.route[i];
          const end = copper.route[i + 1];
          if (start.route_type !== "wire" || end.route_type !== "wire" || start.layer !== end.layer)
            continue;
          add({
            polygon: getTraceSegmentPolygon2(start, end, start.width),
            layers: [start.layer],
            netId: netId2
          });
        }
        continue;
      }
      if (copper.type !== "pcb_smtpad" && copper.type !== "pcb_plated_hole" && copper.type !== "pcb_via")
        continue;
      const netId = netForId(getPrimaryId3(copper));
      if (!netId || !pouredNets.has(netId)) continue;
      if (copper.type === "pcb_smtpad") {
        add({
          polygon: getSmtPadPolygon(copper),
          layers: [copper.layer],
          netId,
          portIds: copper.pcb_port_id ? [copper.pcb_port_id] : []
        });
      } else if (copper.type === "pcb_plated_hole") {
        add({
          polygon: getPlatedHolePolygon(
            copper,
            copper.pcb_component_id ? components.get(copper.pcb_component_id)?.rotation : 0
          ),
          layers: copper.layers,
          netId,
          portIds: copper.pcb_port_id ? [copper.pcb_port_id] : []
        });
      } else {
        add({
          polygon: getViaPolygon2(
            copper,
            copper.outer_diameter,
            copper.hole_diameter
          ),
          layers: copper.layers,
          netId,
          portIds: copper.pcb_port_ids
        });
      }
    }
  }
  const parent = conductors.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const bounds = conductors.map((c) => c.polygon.box);
  const order = conductors.map((_, i) => i).sort((a, b) => bounds[a].xmin - bounds[b].xmin);
  for (let a = 0; a < order.length; a++) {
    const i = order[a];
    for (let b = a + 1; b < order.length; b++) {
      const j = order[b];
      if (bounds[j].xmin > bounds[i].xmax + tolerance) break;
      if (find(i) === find(j) || conductors[i].netId !== conductors[j].netId)
        continue;
      if (bounds[j].ymin > bounds[i].ymax + tolerance || bounds[j].ymax < bounds[i].ymin - tolerance)
        continue;
      if (!conductors[i].layers.some(
        (layer) => conductors[j].layers.includes(layer)
      ))
        continue;
      if (copperPolygonsTouch(conductors[i].polygon, conductors[j].polygon))
        parent[find(j)] = find(i);
    }
  }
  const pourRoots = new Set(
    conductors.flatMap((c, i) => c.isPour ? [find(i)] : [])
  );
  const rootsByPort = /* @__PURE__ */ new Map();
  for (const [i, conductor] of conductors.entries()) {
    if (!pourRoots.has(find(i))) continue;
    for (const portId of conductor.portIds ?? []) {
      const roots = rootsByPort.get(portId) ?? /* @__PURE__ */ new Set();
      roots.add(find(i));
      rootsByPort.set(portId, roots);
    }
  }
  const portsByNet = /* @__PURE__ */ new Map();
  for (const port of circuitJson) {
    if (port.type !== "pcb_port") continue;
    const netId = netForId(port.pcb_port_id);
    if (!netId || !pouredNets.has(netId)) continue;
    const ports = portsByNet.get(netId) ?? [];
    ports.push(port.pcb_port_id);
    portsByNet.set(netId, ports);
  }
  return {
    isPortConnectedToNet(portId, sourceNetIds) {
      const roots = rootsByPort.get(portId);
      return sourceNetIds.every(
        (id) => [...roots ?? []].some(
          (root) => conductors[root].netId === netForId(id) && // Distinct same-net islands are not a physical connection.
          (portsByNet.get(conductors[root].netId) ?? []).every(
            (peer) => rootsByPort.get(peer)?.has(root)
          )
        )
      );
    },
    arePortsConnected(portIds) {
      if (portIds.length < 2) return false;
      return [...rootsByPort.get(portIds[0]) ?? []].some(
        (root) => portIds.every((id) => rootsByPort.get(id)?.has(root))
      );
    }
  };
}

// lib/check-each-pcb-port-connected-to-pcb-trace.ts
function checkEachPcbPortConnectedToPcbTraces(circuitJson, {
  connMap,
  pcbConnectivityMap
} = {}) {
  addStartAndEndPortIdsIfMissing(circuitJson);
  const sourceTraces = circuitJson.filter(
    (item) => item.type === "source_trace"
  );
  const pcbPorts = circuitJson.filter(
    (item) => item.type === "pcb_port"
  );
  const sourceNets = circuitJson.filter(
    (item) => item.type === "source_net"
  );
  const errors = getTracePortLayerMismatches(
    circuitJson
  ).map(({ trace, point: point2, index, port, padLayers }) => ({
    type: "pcb_port_not_connected_error",
    error_type: "pcb_port_not_connected_error",
    pcb_port_not_connected_error_id: `missing_layer_connection_${trace.pcb_trace_id}_${index}_${port.pcb_port_id}`,
    pcb_port_ids: [port.pcb_port_id],
    pcb_component_ids: port.pcb_component_id ? [port.pcb_component_id] : [],
    center: { x: point2.x, y: point2.y },
    message: `Port [${getReadableNameForPort(circuitJson, port.pcb_port_id)}] on ${padLayers.join(", ")} is not connected to trace [${getReadableNameForTrace(circuitJson, trace.pcb_trace_id)}] on ${point2.layer}: missing via connection.`
  }));
  const connectivityMap = connMap ?? getFullConnectivityMapFromCircuitJson3(circuitJson);
  pcbConnectivityMap ??= createIndexedPcbConnectivityMap(circuitJson);
  let pourConnectivity;
  const getPourConnectivity = () => pourConnectivity ??= getCopperPourConnectivity(
    circuitJson,
    connectivityMap
  );
  const sourcePortToPcbPort = /* @__PURE__ */ new Map();
  for (const pcbPort of pcbPorts) {
    sourcePortToPcbPort.set(pcbPort.source_port_id, pcbPort);
  }
  const sourceNetNameById = new Map(
    sourceNets.map((sourceNet) => [sourceNet.source_net_id, sourceNet.name])
  );
  for (const sourceTrace of sourceTraces) {
    const connectedSourcePortIds = sourceTrace.connected_source_port_ids;
    if (connectedSourcePortIds.length === 1 && sourceTrace.connected_source_net_ids.length > 0) {
      const pcbPort = sourcePortToPcbPort.get(connectedSourcePortIds[0]);
      if (!pcbPort) continue;
      const connectedPcbTraces = pcbConnectivityMap.getAllTracesConnectedToPort(
        pcbPort.pcb_port_id
      );
      if (connectedPcbTraces.length === 0 && !getPourConnectivity().isPortConnectedToNet(
        pcbPort.pcb_port_id,
        sourceTrace.connected_source_net_ids
      )) {
        const connectedNetNames = sourceTrace.connected_source_net_ids.map((sourceNetId) => sourceNetNameById.get(sourceNetId)).filter((name) => Boolean(name));
        const netDescription = connectedNetNames.length > 0 ? `net [${connectedNetNames.join(", ")}]` : "its connected net";
        errors.push({
          type: "pcb_port_not_connected_error",
          message: `Port [${getReadableNameForPort(circuitJson, pcbPort.pcb_port_id)}] is not connected to ${netDescription} by a PCB trace.`,
          error_type: "pcb_port_not_connected_error",
          pcb_port_ids: [pcbPort.pcb_port_id],
          pcb_component_ids: pcbPort.pcb_component_id ? [pcbPort.pcb_component_id] : [],
          pcb_port_not_connected_error_id: `pcb_port_not_connected_error_trace_${sourceTrace.source_trace_id}`
        });
      }
      continue;
    }
    if (connectedSourcePortIds.length < 2) {
      continue;
    }
    const pcbPortsInTrace = [];
    const missingPcbPorts = [];
    for (const sourcePortId of connectedSourcePortIds) {
      const pcbPort = sourcePortToPcbPort.get(sourcePortId);
      if (pcbPort) {
        pcbPortsInTrace.push(pcbPort);
      } else {
        missingPcbPorts.push(sourcePortId);
      }
    }
    if (pcbPortsInTrace.length < 2) {
      continue;
    }
    const firstPcbPort = pcbPortsInTrace[0];
    const referenceNetId = connectivityMap.getNetConnectedToId(
      firstPcbPort.pcb_port_id
    );
    const netElementIds = connectivityMap.getIdsConnectedToNet(referenceNetId);
    const pcbTraceIds = netElementIds.filter(
      (id) => circuitJson.some(
        (element) => element.type === "pcb_trace" && ("pcb_trace_id" in element && element.pcb_trace_id === id || "route_id" in element && element.route_id === id)
      )
    );
    if (pcbTraceIds.length === 0 && !getPourConnectivity().arePortsConnected(
      pcbPortsInTrace.map((port) => port.pcb_port_id)
    )) {
      const uniqueComponentIds = new Set(
        pcbPortsInTrace.map((p) => p.pcb_component_id)
      );
      if (uniqueComponentIds.size > 1) {
        errors.push({
          type: "pcb_port_not_connected_error",
          message: `Ports [${pcbPortsInTrace.map((p) => getReadableNameForPort(circuitJson, p.pcb_port_id)).join(", ")}] are not connected together through the same net.`,
          error_type: "pcb_port_not_connected_error",
          pcb_port_ids: pcbPortsInTrace.map((p) => p.pcb_port_id),
          pcb_component_ids: pcbPortsInTrace.map((p) => p.pcb_component_id).filter((id) => id !== void 0),
          pcb_port_not_connected_error_id: `pcb_port_not_connected_error_trace_${sourceTrace.source_trace_id}`
        });
      }
    }
  }
  return errors;
}

// lib/check-hole-clearance/common.ts
import { Point as Point3, Segment as Segment2 } from "@flatten-js/core";
import {
  pointToSegmentClosestPoint as pointToSegmentClosestPoint3,
  pointToSegmentDistance as pointToSegmentDistance4
} from "@tscircuit/math-utils";
var getHoleGeometries = (circuitJson) => convertCircuitJsonToFlattenJs(
  circuitJson.filter((e) => e.type === "pcb_hole"),
  {
    elementTypes: ["pcb_hole"],
    strict: true,
    curveTolerance: 1e-6
  }
).elements;
var getTraceHoleClearance = (trace, geometry) => {
  const hole = geometry.sourceElement;
  if (hole.type !== "pcb_hole") {
    throw new Error(`Expected hole geometry`);
  }
  const a = new Point3(trace.x1, trace.y1);
  const b = new Point3(trace.x2, trace.y2);
  let distance5 = Infinity;
  let center = pointToSegmentClosestPoint3(hole, a, b);
  if (hole.hole_shape === "circle") {
    distance5 = pointToSegmentDistance4(hole, a, b) - hole.hole_diameter / 2;
  } else {
    const segment = new Segment2(a, b);
    for (const shape of geometry.shapes) {
      const [boundaryDistance, shortest] = shape.distanceTo(segment);
      const shapeDistance = shape.contains(a) || shape.contains(b) ? 0 : boundaryDistance;
      if (shapeDistance < distance5) {
        distance5 = shapeDistance;
        center = shortest.end;
      }
    }
  }
  return { gap: distance5 - trace.thickness / 2, center };
};

// lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping.ts
import { cju as cju3 } from "@tscircuit/circuit-json-util";
import { getPrimaryId as getPrimaryId4 } from "@tscircuit/circuit-json-util";
import { segmentToBoundsMinDistance } from "@tscircuit/math-utils";
import { segmentToSegmentMinDistance as segmentToSegmentMinDistance4 } from "@tscircuit/math-utils";
import {
  getFullConnectivityMapFromCircuitJson as getFullConnectivityMapFromCircuitJson4
} from "circuit-json-to-connectivity-map";

// lib/data-structures/SpatialIndex.ts
var SpatialObjectIndex = class {
  buckets;
  objectsById;
  getBounds;
  getId;
  CELL_SIZE = 0.4;
  constructor({
    objects,
    getBounds,
    getId,
    CELL_SIZE
  }) {
    this.buckets = /* @__PURE__ */ new Map();
    this.objectsById = /* @__PURE__ */ new Map();
    this.getBounds = getBounds;
    this.getId = getId ?? (() => this._getNextId());
    this.CELL_SIZE = CELL_SIZE ?? this.CELL_SIZE;
    for (const obj of objects) {
      this.addObject(obj);
    }
  }
  _idCounter = 0;
  _getNextId() {
    return `${this._idCounter++}`;
  }
  addObject(obj) {
    const bounds = this.getBounds(obj);
    const spatialIndexId = this.getId(obj);
    const objWithId = { ...obj, spatialIndexId };
    this.objectsById.set(spatialIndexId, objWithId);
    const minBucketX = Math.floor(bounds.minX / this.CELL_SIZE);
    const minBucketY = Math.floor(bounds.minY / this.CELL_SIZE);
    const maxBucketX = Math.floor(bounds.maxX / this.CELL_SIZE);
    const maxBucketY = Math.floor(bounds.maxY / this.CELL_SIZE);
    for (let bx = minBucketX; bx <= maxBucketX; bx++) {
      for (let by = minBucketY; by <= maxBucketY; by++) {
        const bucketKey = `${bx}x${by}`;
        const bucket = this.buckets.get(bucketKey);
        if (!bucket) {
          this.buckets.set(bucketKey, [objWithId]);
        } else {
          bucket.push(objWithId);
        }
      }
    }
  }
  removeObject(id) {
    const obj = this.objectsById.get(id);
    if (!obj) return false;
    this.objectsById.delete(id);
    const bounds = this.getBounds(obj);
    const minBucketX = Math.floor(bounds.minX / this.CELL_SIZE);
    const minBucketY = Math.floor(bounds.minY / this.CELL_SIZE);
    const maxBucketX = Math.floor(bounds.maxX / this.CELL_SIZE);
    const maxBucketY = Math.floor(bounds.maxY / this.CELL_SIZE);
    for (let bx = minBucketX; bx <= maxBucketX; bx++) {
      for (let by = minBucketY; by <= maxBucketY; by++) {
        const bucketKey = `${bx}x${by}`;
        const bucket = this.buckets.get(bucketKey);
        if (bucket) {
          const index = bucket.findIndex((item) => item.spatialIndexId === id);
          if (index !== -1) {
            bucket.splice(index, 1);
            if (bucket.length === 0) {
              this.buckets.delete(bucketKey);
            }
          }
        }
      }
    }
    return true;
  }
  getBucketKey(x, y) {
    return `${Math.floor(x / this.CELL_SIZE)}x${Math.floor(y / this.CELL_SIZE)}`;
  }
  getObjectsInBounds(bounds, margin = 0) {
    const objects = [];
    const addedIds = /* @__PURE__ */ new Set();
    const minBucketX = Math.floor((bounds.minX - margin) / this.CELL_SIZE);
    const minBucketY = Math.floor((bounds.minY - margin) / this.CELL_SIZE);
    const maxBucketX = Math.floor((bounds.maxX + margin) / this.CELL_SIZE);
    const maxBucketY = Math.floor((bounds.maxY + margin) / this.CELL_SIZE);
    for (let bx = minBucketX; bx <= maxBucketX; bx++) {
      for (let by = minBucketY; by <= maxBucketY; by++) {
        const bucketKey = `${bx}x${by}`;
        const bucket = this.buckets.get(bucketKey) || [];
        for (const obj of bucket) {
          const id = obj.spatialIndexId;
          if (addedIds.has(id)) continue;
          addedIds.add(id);
          objects.push(obj);
        }
      }
    }
    return objects;
  }
};

// lib/check-each-pcb-trace-non-overlapping/getClosestPointBetweenSegmentAndBounds.ts
var getClosestPointBetweenSegmentAndBounds = (segment, bounds) => {
  const p1 = { x: segment.x1, y: segment.y1 };
  const p2 = { x: segment.x2, y: segment.y2 };
  const minX = bounds.minX;
  const minY = bounds.minY;
  const maxX = bounds.maxX;
  const maxY = bounds.maxY;
  if (p1.x === p2.x && p1.y === p2.y) {
    const closestX = Math.max(minX, Math.min(maxX, p1.x));
    const closestY = Math.max(minY, Math.min(maxY, p1.y));
    if (closestX === p1.x && closestY === p1.y) {
      return { x: p1.x, y: p1.y };
    }
    return { x: closestX, y: closestY };
  }
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const tMinX = dx !== 0 ? (minX - p1.x) / dx : Number.NEGATIVE_INFINITY;
  const tMaxX = dx !== 0 ? (maxX - p1.x) / dx : Number.POSITIVE_INFINITY;
  const tMinY = dy !== 0 ? (minY - p1.y) / dy : Number.NEGATIVE_INFINITY;
  const tMaxY = dy !== 0 ? (maxY - p1.y) / dy : Number.POSITIVE_INFINITY;
  const tEnter = Math.max(Math.min(tMinX, tMaxX), Math.min(tMinY, tMaxY));
  const tExit = Math.min(Math.max(tMinX, tMaxX), Math.max(tMinY, tMaxY));
  if (tEnter <= tExit && tExit >= 0 && tEnter <= 1) {
    const t = Math.max(0, Math.min(1, tEnter));
    return {
      x: p1.x + t * dx,
      y: p1.y + t * dy
    };
  }
  const closestToP1 = {
    x: Math.max(minX, Math.min(maxX, p1.x)),
    y: Math.max(minY, Math.min(maxY, p1.y))
  };
  const closestToP2 = {
    x: Math.max(minX, Math.min(maxX, p2.x)),
    y: Math.max(minY, Math.min(maxY, p2.y))
  };
  const distToP1Squared = (closestToP1.x - p1.x) ** 2 + (closestToP1.y - p1.y) ** 2;
  const distToP2Squared = (closestToP2.x - p2.x) ** 2 + (closestToP2.y - p2.y) ** 2;
  const edges = [
    { start: { x: minX, y: minY }, end: { x: maxX, y: minY } },
    // Bottom edge
    { start: { x: maxX, y: minY }, end: { x: maxX, y: maxY } },
    // Right edge
    { start: { x: maxX, y: maxY }, end: { x: minX, y: maxY } },
    // Top edge
    { start: { x: minX, y: maxY }, end: { x: minX, y: minY } }
    // Left edge
  ];
  let minDistance = Math.min(distToP1Squared, distToP2Squared);
  let closestPoint = distToP1Squared <= distToP2Squared ? closestToP1 : closestToP2;
  const clamp2 = (value, min, max) => {
    return Math.max(min, Math.min(max, value));
  };
  for (const edge of edges) {
    const va = { x: p2.x - p1.x, y: p2.y - p1.y };
    const vb = { x: edge.end.x - edge.start.x, y: edge.end.y - edge.start.y };
    const w = { x: p1.x - edge.start.x, y: p1.y - edge.start.y };
    const dotAA = va.x * va.x + va.y * va.y;
    const dotAB = va.x * vb.x + va.y * vb.y;
    const dotAW = va.x * w.x + va.y * w.y;
    const dotBB = vb.x * vb.x + vb.y * vb.y;
    const dotBW = vb.x * w.x + vb.y * w.y;
    const denominator = dotAA * dotBB - dotAB * dotAB;
    if (Math.abs(denominator) < 1e-10) continue;
    let tA = (dotAB * dotBW - dotBB * dotAW) / denominator;
    let tB = (dotAA * dotBW - dotAB * dotAW) / denominator;
    tA = clamp2(tA, 0, 1);
    tB = clamp2(tB, 0, 1);
    const closestOnSegment = {
      x: p1.x + tA * va.x,
      y: p1.y + tA * va.y
    };
    const closestOnEdge = {
      x: edge.start.x + tB * vb.x,
      y: edge.start.y + tB * vb.y
    };
    const dx2 = closestOnSegment.x - closestOnEdge.x;
    const dy2 = closestOnSegment.y - closestOnEdge.y;
    const distSquared = dx2 * dx2 + dy2 * dy2;
    if (distSquared < minDistance) {
      minDistance = distSquared;
      closestPoint = {
        x: (closestOnSegment.x + closestOnEdge.x) / 2,
        y: (closestOnSegment.y + closestOnEdge.y) / 2
      };
    }
  }
  return closestPoint;
};

// lib/check-each-pcb-trace-non-overlapping/getCollidableBounds.ts
import { getBoundsOfPcbElements as getBoundsOfPcbElements3 } from "@tscircuit/circuit-json-util";
var getCollidableBounds = (collidable) => {
  if (collidable.type === "pcb_hole" && (collidable.hole_shape === "pill" || collidable.hole_shape === "rotated_pill") || collidable.type === "pcb_smtpad" && collidable.shape === "rotated_pill") {
    const pill = getPillCenterLineForPad(collidable);
    return {
      minX: Math.min(pill.start.x, pill.end.x) - pill.radius,
      minY: Math.min(pill.start.y, pill.end.y) - pill.radius,
      maxX: Math.max(pill.start.x, pill.end.x) + pill.radius,
      maxY: Math.max(pill.start.y, pill.end.y) + pill.radius
    };
  }
  if (collidable.type === "pcb_trace_segment") {
    return {
      minX: Math.min(collidable.x1, collidable.x2),
      minY: Math.min(collidable.y1, collidable.y2),
      maxX: Math.max(collidable.x1, collidable.x2),
      maxY: Math.max(collidable.y1, collidable.y2)
    };
  }
  if (collidable.type === "pcb_smtpad" || collidable.type === "pcb_plated_hole") {
    const isPolygon = collidable.type === "pcb_smtpad" && (collidable.shape === "rotated_rect" || collidable.shape === "polygon") || collidable.type === "pcb_plated_hole" && "rect_pad_width" in collidable && "rect_pad_height" in collidable;
    if (isPolygon) {
      const polygonPoints = getPolygonPointsForPad(collidable);
      return {
        minX: Math.min(...polygonPoints.map((point2) => point2.x)),
        minY: Math.min(...polygonPoints.map((point2) => point2.y)),
        maxX: Math.max(...polygonPoints.map((point2) => point2.x)),
        maxY: Math.max(...polygonPoints.map((point2) => point2.y))
      };
    }
  }
  return getBoundsOfPcbElements3([collidable]);
};

// lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping.ts
var getPcbComponentConnectionElementId = (element) => {
  if (element.type === "pcb_port") return element.pcb_port_id;
  if (element.type === "pcb_smtpad") return element.pcb_smtpad_id;
  return element.pcb_plated_hole_id;
};
function checkEachPcbTraceNonOverlapping(circuitJson, {
  connMap,
  minClearance
} = {}) {
  const errors = checkPcbTraceSelfShorts(circuitJson);
  addStartAndEndPortIdsIfMissing(circuitJson);
  connMap ??= getFullConnectivityMapFromCircuitJson4(circuitJson);
  const board = getPcbBoard(circuitJson);
  minClearance ??= getBoardDrcValue(board, "min_trace_to_pad_edge_clearance") ?? DEFAULT_TRACE_MARGIN;
  const pcbTraces = cju3(circuitJson).pcb_trace.list();
  const pcbTraceSegments = pcbTraces.flatMap((pcbTrace) => {
    const segments = [];
    for (let i = 0; i < pcbTrace.route.length - 1; i++) {
      const p1 = pcbTrace.route[i];
      const p2 = pcbTrace.route[i + 1];
      if (p1.route_type !== "wire" && p1.route_type !== "via" || p2.route_type !== "wire" && p2.route_type !== "via")
        continue;
      const wire = p1.route_type === "wire" ? p1 : p2;
      if (wire.route_type !== "wire") continue;
      if (p1.route_type === "wire" && p2.route_type === "wire" && p1.layer !== p2.layer)
        continue;
      segments.push({
        type: "pcb_trace_segment",
        pcb_trace_id: pcbTrace.pcb_trace_id,
        _pcbTrace: pcbTrace,
        thickness: Math.max(
          p1.route_type === "wire" ? p1.width ?? DEFAULT_TRACE_THICKNESS : 0,
          p2.route_type === "wire" ? p2.width ?? DEFAULT_TRACE_THICKNESS : 0
        ),
        layer: wire.layer,
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y
      });
    }
    return segments;
  });
  const pcbSmtPads = cju3(circuitJson).pcb_smtpad.list();
  const pcbPlatedHoles = cju3(circuitJson).pcb_plated_hole.list();
  const pcbPorts = cju3(circuitJson).pcb_port.list();
  const pcbHoles = cju3(circuitJson).pcb_hole.list();
  const holeGeometryById = new Map(
    getHoleGeometries(circuitJson).map((geometry) => [
      geometry.elementId,
      geometry
    ])
  );
  const pcbVias = cju3(circuitJson).pcb_via.list();
  const pcbKeepouts = cju3(circuitJson).pcb_keepout.list().filter((keepout) => !keepout.allow_traces);
  const pcbComponentConnectionElements = [
    ...pcbPorts,
    ...pcbSmtPads,
    ...pcbPlatedHoles
  ];
  const excludedConnectionIdsByKeepoutId = /* @__PURE__ */ new Map();
  for (const keepout of pcbKeepouts) {
    const excludedPcbComponentIds = new Set(
      keepout.excluded_pcb_component_ids ?? []
    );
    if (excludedPcbComponentIds.size === 0) continue;
    excludedConnectionIdsByKeepoutId.set(
      keepout.pcb_keepout_id,
      pcbComponentConnectionElements.filter(
        (element) => element.pcb_component_id && excludedPcbComponentIds.has(element.pcb_component_id)
      ).map(getPcbComponentConnectionElementId)
    );
  }
  const allObjects = [
    ...pcbTraceSegments,
    ...pcbSmtPads,
    ...pcbPlatedHoles,
    ...pcbHoles,
    ...pcbVias,
    ...pcbKeepouts
  ];
  const spatialIndex = new SpatialObjectIndex({
    objects: allObjects,
    getBounds: getCollidableBounds
  });
  const getReadableName = (id) => getReadableNameForElementId(circuitJson, id);
  const constructErrorMessage = (traceName, otherName, gap) => {
    if (isTraceObstacleOverlap(gap)) {
      return `PCB trace ${traceName} overlaps with ${otherName} (accidental contact)`;
    }
    return `PCB trace ${traceName} is too close to ${otherName} (gap: ${gap.toFixed(3)}mm)`;
  };
  const errorIds = /* @__PURE__ */ new Set();
  for (const segmentA of pcbTraceSegments) {
    const requiredMargin = minClearance;
    const bounds = getCollidableBounds(segmentA);
    const nearbyObjects = spatialIndex.getObjectsInBounds(
      bounds,
      requiredMargin + segmentA.thickness / 2
    );
    if (segmentA.x1 === segmentA.x2 && segmentA.y1 === segmentA.y2) continue;
    for (const obj of nearbyObjects) {
      if (!getLayersOfPcbElement(obj).includes(segmentA.layer)) {
        continue;
      }
      if (obj.type === "pcb_keepout" && (excludedConnectionIdsByKeepoutId.get(obj.pcb_keepout_id) ?? []).some(
        (connectionId) => connMap.areIdsConnected(segmentA.pcb_trace_id, connectionId)
      )) {
        continue;
      }
      if (obj.type === "pcb_trace_segment") {
        const segmentB = obj;
        if (segmentA.layer !== segmentB.layer) continue;
        if (connMap.areIdsConnected(segmentA.pcb_trace_id, segmentB.pcb_trace_id))
          continue;
        const gap2 = segmentToSegmentMinDistance4(
          { x: segmentA.x1, y: segmentA.y1 },
          { x: segmentA.x2, y: segmentA.y2 },
          { x: segmentB.x1, y: segmentB.y1 },
          { x: segmentB.x2, y: segmentB.y2 }
        ) - segmentA.thickness / 2 - segmentB.thickness / 2;
        if (gap2 > minClearance - EPSILON) continue;
        const pcb_trace_error_id = `overlap_${segmentA.pcb_trace_id}_${segmentB.pcb_trace_id}`;
        const pcb_trace_error_id_reverse = `overlap_${segmentB.pcb_trace_id}_${segmentA.pcb_trace_id}`;
        if (errorIds.has(pcb_trace_error_id)) continue;
        if (errorIds.has(pcb_trace_error_id_reverse)) continue;
        errorIds.add(pcb_trace_error_id);
        errors.push({
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          message: constructErrorMessage(
            getReadableName(segmentA.pcb_trace_id),
            getReadableName(segmentB.pcb_trace_id),
            gap2
          ),
          pcb_trace_id: segmentA.pcb_trace_id,
          source_trace_id: "",
          pcb_trace_error_id,
          pcb_component_ids: [],
          center: getClosestPointBetweenSegments(segmentA, segmentB),
          pcb_port_ids: getPcbPortIdsConnectedToTraces([
            segmentA._pcbTrace,
            segmentB._pcbTrace
          ])
        });
        continue;
      }
      const primaryObjId = getPrimaryId4(obj);
      if (connMap.areIdsConnected(
        segmentA.pcb_trace_id,
        "pcb_trace_id" in obj ? obj.pcb_trace_id : primaryObjId
      ))
        continue;
      if (obj.type === "pcb_smtpad" || obj.type === "pcb_plated_hole" || obj.type === "pcb_via") {
        const { gap: gap2, center } = getTraceObstacleClearance(segmentA, obj);
        if (!isTraceObstacleOverlap(gap2)) continue;
        const pcb_trace_error_id = `overlap_${segmentA.pcb_trace_id}_${primaryObjId}`;
        if (errorIds.has(pcb_trace_error_id)) continue;
        errorIds.add(pcb_trace_error_id);
        errors.push({
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          message: constructErrorMessage(
            getReadableName(segmentA.pcb_trace_id),
            `${obj.type} "${getReadableName(primaryObjId)}"`,
            gap2
          ),
          pcb_trace_id: segmentA.pcb_trace_id,
          center,
          source_trace_id: "",
          pcb_trace_error_id,
          pcb_component_ids: [
            "pcb_component_id" in obj ? obj.pcb_component_id : void 0
          ].filter(Boolean),
          pcb_port_ids: [
            ...getPcbPortIdsConnectedToTraces([segmentA._pcbTrace]),
            "pcb_port_id" in obj ? obj.pcb_port_id : void 0
          ].filter(Boolean)
        });
        continue;
      }
      if (obj.type === "pcb_hole") {
        const { gap: gap2, center } = getTraceHoleClearance(
          segmentA,
          holeGeometryById.get(obj.pcb_hole_id)
        );
        if (!isTraceObstacleOverlap(gap2)) continue;
        const pcb_trace_error_id = `overlap_${segmentA.pcb_trace_id}_${primaryObjId}`;
        if (errorIds.has(pcb_trace_error_id)) continue;
        errorIds.add(pcb_trace_error_id);
        errors.push({
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          message: constructErrorMessage(
            getReadableName(segmentA.pcb_trace_id),
            `${obj.type} "${getReadableName(primaryObjId)}"`,
            gap2
          ),
          pcb_trace_id: segmentA.pcb_trace_id,
          source_trace_id: segmentA._pcbTrace.source_trace_id ?? "",
          pcb_trace_error_id,
          pcb_component_ids: obj.pcb_component_id ? [obj.pcb_component_id] : [],
          pcb_port_ids: getPcbPortIdsConnectedToTraces([segmentA._pcbTrace]),
          center
        });
        continue;
      }
      const gap = segmentToBoundsMinDistance(
        { x: segmentA.x1, y: segmentA.y1 },
        { x: segmentA.x2, y: segmentA.y2 },
        getCollidableBounds(obj)
      ) - segmentA.thickness / 2;
      if (gap + EPSILON < requiredMargin) {
        const pcb_trace_error_id = `overlap_${segmentA.pcb_trace_id}_${primaryObjId}`;
        if (errorIds.has(pcb_trace_error_id)) continue;
        errorIds.add(pcb_trace_error_id);
        if (obj.type === "pcb_keepout" && obj.warning_only) {
          errors.push({
            type: "pcb_keepout_overlap_warning",
            warning_type: "pcb_keepout_overlap_warning",
            pcb_keepout_overlap_warning_id: `pcb_keepout_overlap_warning_${pcb_trace_error_id}`,
            pcb_keepout_id: obj.pcb_keepout_id,
            pcb_trace_ids: [segmentA.pcb_trace_id],
            message: `PCB trace ${getReadableName(segmentA.pcb_trace_id)} violates advisory PCB keepout "${getReadableNameForElementId(circuitJson, obj.pcb_keepout_id)}"`,
            center: getClosestPointBetweenSegmentAndBounds(
              segmentA,
              getCollidableBounds(obj)
            ),
            subcircuit_id: segmentA._pcbTrace.subcircuit_id ?? obj.subcircuit_id
          });
          continue;
        }
        errors.push({
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          message: constructErrorMessage(
            getReadableName(segmentA.pcb_trace_id),
            `${obj.type} "${getReadableName(getPrimaryId4(obj))}"`,
            gap
          ),
          pcb_trace_id: segmentA.pcb_trace_id,
          source_trace_id: "",
          pcb_trace_error_id,
          pcb_component_ids: [
            "pcb_component_id" in obj ? obj.pcb_component_id : void 0
          ].filter(Boolean),
          center: getClosestPointBetweenSegmentAndBounds(
            segmentA,
            getCollidableBounds(obj)
          ),
          pcb_port_ids: [
            ...getPcbPortIdsConnectedToTraces([segmentA._pcbTrace]),
            "pcb_port_id" in obj ? obj.pcb_port_id : void 0
          ].filter(Boolean)
        });
      }
    }
  }
  return errors;
}

// lib/net-manager.ts
var NetManager = class {
  networks = /* @__PURE__ */ new Set();
  setConnected(nodes) {
    if (nodes.length < 2) return;
    let targetNetwork = null;
    for (const network of this.networks) {
      for (const node of nodes) {
        if (network.has(node)) {
          if (targetNetwork === null) {
            targetNetwork = network;
          } else if (targetNetwork !== network) {
            for (const mergeNode of network) {
              targetNetwork.add(mergeNode);
            }
            this.networks.delete(network);
          }
          break;
        }
      }
      if (targetNetwork !== null && targetNetwork !== network) break;
    }
    if (targetNetwork === null) {
      targetNetwork = new Set(nodes);
      this.networks.add(targetNetwork);
    } else {
      for (const node of nodes) {
        targetNetwork.add(node);
      }
    }
  }
  isConnected(nodes) {
    if (nodes.length < 2) return true;
    for (const network of this.networks) {
      if (nodes.every((node) => network.has(node))) {
        return true;
      }
    }
    return false;
  }
};

// lib/check-copper-to-board-edge-clearance.ts
var GEOMETRY_EPSILON = 1e-9;
var getCopperElementLabel = (element) => {
  if (element.type === "pcb_via") return "Via";
  if (element.type === "pcb_smtpad") return "SMT pad";
  if (element.type === "pcb_plated_hole") return "Plated hole";
  return "Copper pour";
};
function checkCopperToBoardEdgeClearance(circuitJson) {
  const board = getPcbBoard(circuitJson);
  if (!board) return [];
  if (!circuitJson.some(
    (element) => element.type === "pcb_via" || element.type === "pcb_smtpad" || element.type === "pcb_plated_hole" || element.type === "pcb_copper_pour"
  ))
    return [];
  const boardPolygon = convertCircuitJsonToFlattenJs([board], { strict: true }).elements[0]?.shapes[0];
  if (!boardPolygon) return [];
  const requiredClearance = getBoardDrcValue(board, "min_board_edge_clearance") ?? jlcMinTolerances.min_board_edge_clearance;
  if (requiredClearance === void 0) return [];
  const allowedOffBoardComponentIds = new Set(
    circuitJson.filter(
      (element) => element.type === "pcb_component"
    ).filter((component) => component.is_allowed_to_be_off_board).map((component) => component.pcb_component_id)
  );
  const { elements: copperElements } = convertCircuitJsonToFlattenJs(
    circuitJson,
    {
      elementTypes: [
        "pcb_via",
        "pcb_smtpad",
        "pcb_plated_hole",
        "pcb_copper_pour"
      ],
      includeDrillHoles: false,
      strict: true
    }
  );
  const errors = [];
  const seen = /* @__PURE__ */ new Set();
  for (const geometry of copperElements) {
    if (seen.has(geometry.elementId)) continue;
    seen.add(geometry.elementId);
    const element = geometry.sourceElement;
    if ((element.type === "pcb_smtpad" || element.type === "pcb_plated_hole") && element.pcb_component_id && allowedOffBoardComponentIds.has(element.pcb_component_id)) {
      continue;
    }
    const isInside = geometry.shapes.every(
      (shape) => boardPolygon.contains(shape)
    );
    const clearance = isInside ? Math.min(
      ...geometry.shapes.map((shape) => boardPolygon.distanceTo(shape)[0])
    ) : 0;
    if (isInside && clearance + GEOMETRY_EPSILON >= requiredClearance) {
      continue;
    }
    const id = geometry.elementId;
    const label = getCopperElementLabel(element);
    errors.push({
      type: "pcb_placement_error",
      pcb_placement_error_id: `copper_too_close_to_board_edge_${id}`,
      error_type: "pcb_placement_error",
      message: `${label} ${getReadableNameForElementId(circuitJson, id)} violates copper-to-board-edge clearance (measured ${clearance.toFixed(3)}mm, required ${requiredClearance.toFixed(3)}mm)`
    });
  }
  return errors;
}

// lib/check-pcb-components-out-of-board/checkViasOffBoard.ts
function checkViasOffBoard(circuitJson) {
  const vias = circuitJson.filter((element) => element.type === "pcb_via");
  const violationsById = new Map(
    checkCopperToBoardEdgeClearance(
      circuitJson.filter(
        (element) => element.type === "pcb_board" || element.type === "pcb_via"
      )
    ).map((error) => [
      error.pcb_placement_error_id.replace(
        "copper_too_close_to_board_edge_",
        ""
      ),
      error
    ])
  );
  return vias.flatMap((via) => {
    const violation = violationsById.get(via.pcb_via_id);
    if (!violation) return [];
    const viaName = getReadableNameForElementId(circuitJson, via.pcb_via_id);
    return [
      {
        ...violation,
        pcb_placement_error_id: `out_of_board_${via.pcb_via_id}`,
        message: `Via ${viaName} is outside or crossing the board boundary`
      }
    ];
  });
}

// lib/check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard.ts
import * as Flatten3 from "@flatten-js/core";
import { rotateDEG, applyToPoint } from "transformation-matrix";

// lib/check-pcb-components-out-of-board/getCircularPlatedHoleComponentOutline.ts
import * as Flatten2 from "@flatten-js/core";
function getCircularPlatedHoleComponentOutline({
  circuitJson,
  component
}) {
  const footprintElements = circuitJson.filter(
    (element) => (element.type === "pcb_plated_hole" || element.type === "pcb_smtpad" || element.type === "pcb_hole" || element.type === "pcb_courtyard_circle" || element.type === "pcb_courtyard_rect" || element.type === "pcb_courtyard_pill" || element.type === "pcb_courtyard_polygon" || element.type === "pcb_courtyard_outline") && element.pcb_component_id === component.pcb_component_id
  );
  if (footprintElements.length !== 1) return null;
  const pad = footprintElements[0];
  if (pad.type !== "pcb_plated_hole" || pad.shape !== "circle") return null;
  if (!Flatten2.Utils.EQ(component.width, pad.outer_diameter) || !Flatten2.Utils.EQ(component.height, pad.outer_diameter) || !Flatten2.Utils.EQ(component.center.x, pad.x) || !Flatten2.Utils.EQ(component.center.y, pad.y)) {
    return null;
  }
  return new Flatten2.Circle(
    new Flatten2.Point(pad.x, pad.y),
    pad.outer_diameter / 2
  );
}

// lib/check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard.ts
function isPolygonCCW(poly) {
  return poly.area() >= 0;
}
function rectanglePolygon({
  center,
  size,
  rotationDeg = 0
}) {
  const cx = center.x;
  const cy = center.y;
  const hw = size.width / 2;
  const hh = size.height / 2;
  const corners = [
    new Flatten3.Point(cx - hw, cy - hh),
    new Flatten3.Point(cx + hw, cy - hh),
    new Flatten3.Point(cx + hw, cy + hh),
    new Flatten3.Point(cx - hw, cy + hh)
  ];
  let poly = new Flatten3.Polygon(corners);
  if (rotationDeg) {
    const matrix = rotateDEG(rotationDeg, cx, cy);
    const rotatedCorners = corners.map((pt) => {
      const p = applyToPoint(matrix, { x: pt.x, y: pt.y });
      return new Flatten3.Point(p.x, p.y);
    });
    poly = new Flatten3.Polygon(rotatedCorners);
  }
  if (!isPolygonCCW(poly)) poly.reverse();
  return poly;
}
function boardToPolygon({
  board
}) {
  if (board.outline && board.outline.length > 0) {
    const points = board.outline.map((p) => new Flatten3.Point(p.x, p.y));
    const poly = new Flatten3.Polygon(points);
    if (!isPolygonCCW(poly)) {
      poly.reverse();
    }
    return poly;
  }
  if (board.center && typeof board.width === "number" && typeof board.height === "number") {
    return rectanglePolygon({
      center: board.center,
      size: { width: board.width, height: board.height },
      rotationDeg: 0
    });
  }
  return null;
}
function getComponentName({
  circuitJson,
  component
}) {
  if (component.source_component_id) {
    const sourceComponent = circuitJson.find(
      (el) => el.type === "source_component" && el.source_component_id === component.source_component_id
    );
    if (sourceComponent && "name" in sourceComponent && sourceComponent.name) {
      return sourceComponent.name;
    }
  }
  return getReadableNameForComponent(circuitJson, component.pcb_component_id);
}
function computeOverlapDistance(compPoly, boardPoly, componentCenter, componentWidth, componentHeight, rotationDeg) {
  const centerPoint = new Flatten3.Point(componentCenter.x, componentCenter.y);
  if (!boardPoly.contains(centerPoint)) {
    const dist = boardPoly.distanceTo(centerPoint);
    return Array.isArray(dist) ? dist[0] : Number(dist) || 0;
  }
  const hw = componentWidth / 2;
  const hh = componentHeight / 2;
  const corners = [
    { x: componentCenter.x - hw, y: componentCenter.y - hh },
    { x: componentCenter.x + hw, y: componentCenter.y - hh },
    { x: componentCenter.x + hw, y: componentCenter.y + hh },
    { x: componentCenter.x - hw, y: componentCenter.y + hh }
  ];
  const midpoints = [];
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    midpoints.push({
      x: (corners[i].x + corners[next].x) / 2,
      y: (corners[i].y + corners[next].y) / 2
    });
  }
  const matrix = rotateDEG(rotationDeg, componentCenter.x, componentCenter.y);
  const rotatePoint2 = (pt) => {
    const p = applyToPoint(matrix, pt);
    return new Flatten3.Point(p.x, p.y);
  };
  const rotatedPoints = corners.concat(midpoints).map(rotatePoint2);
  let maxDistance = 0;
  for (const pt of rotatedPoints) {
    if (!boardPoly.contains(pt)) {
      const dist = boardPoly.distanceTo(pt);
      const d = Array.isArray(dist) ? dist[0] : Number(dist) || 0;
      if (d > maxDistance) maxDistance = d;
    }
  }
  if (maxDistance > 0) {
    return maxDistance;
  }
  try {
    const intersection = Flatten3.BooleanOperations.intersect(
      compPoly,
      boardPoly
    );
    let intersectionArea = 0;
    if (!intersection) {
      intersectionArea = 0;
    } else if (Array.isArray(intersection)) {
      intersectionArea = intersection.reduce(
        (sum, p) => sum + (typeof p.area === "function" ? p.area() : 0),
        0
      );
    } else if (typeof intersection.area === "function") {
      intersectionArea = intersection.area();
    } else {
      intersectionArea = 0;
    }
    const compArea = compPoly.area();
    if (intersectionArea > 0 && intersectionArea < compArea) {
      const overlapRatio = 1 - intersectionArea / compArea;
      const compWidth = Math.abs(componentWidth);
      const compHeight = Math.abs(componentHeight);
      return Math.min(compWidth, compHeight) * overlapRatio;
    } else if (intersectionArea === 0) {
      return 0.1;
    } else {
      return 0.1;
    }
  } catch {
    return 0.1;
  }
}
function getRepositionSuggestion({
  componentPoly,
  boardPoly
}) {
  const boardBox = boardPoly.box;
  const componentBox = componentPoly.box;
  let deltaX = 0;
  let deltaY = 0;
  if (componentBox.xmin < boardBox.xmin) {
    deltaX = boardBox.xmin - componentBox.xmin;
  } else if (componentBox.xmax > boardBox.xmax) {
    deltaX = boardBox.xmax - componentBox.xmax;
  }
  if (componentBox.ymin < boardBox.ymin) {
    deltaY = boardBox.ymin - componentBox.ymin;
  } else if (componentBox.ymax > boardBox.ymax) {
    deltaY = boardBox.ymax - componentBox.ymax;
  }
  if (deltaX === 0 && deltaY === 0) {
    return null;
  }
  const xDir = deltaX >= 0 ? "right" : "left";
  const yDir = deltaY >= 0 ? "up" : "down";
  const absDx = Math.abs(Math.round(deltaX * 100) / 100);
  const absDy = Math.abs(Math.round(deltaY * 100) / 100);
  if (absDx > 0 && absDy > 0) {
    return `Try moving it ${absDx}mm ${xDir} and ${absDy}mm ${yDir} to fit within the board edge.`;
  }
  if (absDx > 0) {
    return `Try moving it ${absDx}mm ${xDir} to fit within the board edge.`;
  }
  return `Try moving it ${absDy}mm ${yDir} to fit within the board edge.`;
}
function checkPcbComponentsOutOfBoard(circuitJson) {
  const board = circuitJson.find(
    (el) => el.type === "pcb_board"
  );
  if (!board) return [];
  const boardPoly = boardToPolygon({ board });
  if (!boardPoly) return [];
  const components = circuitJson.filter(
    (el) => el.type === "pcb_component"
  );
  if (components.length === 0) return [];
  const errors = [];
  for (const c of components) {
    if (c.is_allowed_to_be_off_board) continue;
    if (!c.center || typeof c.width !== "number" || typeof c.height !== "number")
      continue;
    if (c.width <= 0 || c.height <= 0) continue;
    let compPoly = rectanglePolygon({
      center: c.center,
      size: { width: c.width, height: c.height },
      rotationDeg: 0
    });
    const circularOutline = getCircularPlatedHoleComponentOutline({
      circuitJson,
      component: c
    });
    if (circularOutline) {
      compPoly = new Flatten3.Polygon(circularOutline);
    }
    if (compPoly.area() === 0) continue;
    const isInside = boardPoly.contains(compPoly);
    if (isInside) continue;
    let overlapDistance;
    if (circularOutline) {
      const [distanceToBoundary] = boardPoly.distanceTo(circularOutline.pc);
      overlapDistance = circularOutline.r - distanceToBoundary;
      if (!boardPoly.contains(circularOutline.pc)) {
        overlapDistance = circularOutline.r + distanceToBoundary;
      }
    } else {
      overlapDistance = computeOverlapDistance(
        compPoly,
        boardPoly,
        c.center,
        c.width,
        c.height,
        0
      );
    }
    const compName = getComponentName({ circuitJson, component: c });
    const overlapDistanceMm = Math.round(overlapDistance * 100) / 100;
    const repositionSuggestion = getRepositionSuggestion({
      componentPoly: compPoly,
      boardPoly
    });
    errors.push({
      type: "pcb_component_outside_board_error",
      error_type: "pcb_component_outside_board_error",
      pcb_component_outside_board_error_id: `pcb_component_outside_board_${c.pcb_component_id}`,
      message: `Component ${compName} extends outside board boundaries by ${overlapDistanceMm}mm.${repositionSuggestion ? ` ${repositionSuggestion}` : ""}`,
      pcb_component_id: c.pcb_component_id,
      pcb_board_id: board.pcb_board_id,
      component_center: c.center,
      component_bounds: {
        min_x: compPoly.box.xmin,
        max_x: compPoly.box.xmax,
        min_y: compPoly.box.ymin,
        max_y: compPoly.box.ymax
      },
      subcircuit_id: c.subcircuit_id,
      source_component_id: c.source_component_id
    });
  }
  return errors;
}

// lib/check-pcb-component-over-cutout.ts
import { doBoundsOverlap } from "@tscircuit/math-utils";
import * as Flatten4 from "@flatten-js/core";
import { applyToPoint as applyToPoint2, rotateDEG as rotateDEG2 } from "transformation-matrix";
var CUTOUT_CIRCLE_SEGMENTS = 32;
function rectanglePolygon2({
  center,
  width,
  height,
  rotation = 0
}) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const corners = [
    { x: center.x - halfWidth, y: center.y - halfHeight },
    { x: center.x + halfWidth, y: center.y - halfHeight },
    { x: center.x + halfWidth, y: center.y + halfHeight },
    { x: center.x - halfWidth, y: center.y + halfHeight }
  ];
  const matrix = rotateDEG2(rotation, center.x, center.y);
  return new Flatten4.Polygon(
    corners.map((corner) => {
      const rotated = rotation ? applyToPoint2(matrix, corner) : corner;
      return new Flatten4.Point(rotated.x, rotated.y);
    })
  );
}
function circlePolygon2({
  center,
  radius
}) {
  return new Flatten4.Polygon(
    Array.from({ length: CUTOUT_CIRCLE_SEGMENTS }, (_, index) => {
      const angle = 2 * Math.PI * index / CUTOUT_CIRCLE_SEGMENTS;
      return new Flatten4.Point(
        center.x + Math.cos(angle) * radius,
        center.y + Math.sin(angle) * radius
      );
    })
  );
}
function cutoutToPolygon(cutout) {
  if (cutout.shape === "rect") {
    return rectanglePolygon2({
      center: cutout.center,
      width: cutout.width,
      height: cutout.height,
      rotation: cutout.rotation ?? 0
    });
  }
  if (cutout.shape === "circle") {
    return circlePolygon2({ center: cutout.center, radius: cutout.radius });
  }
  if (cutout.shape === "polygon") {
    return new Flatten4.Polygon(
      cutout.points.map((point2) => new Flatten4.Point(point2.x, point2.y))
    );
  }
  return null;
}
function polygonBoxToBounds(polygon) {
  return {
    minX: polygon.box.xmin,
    minY: polygon.box.ymin,
    maxX: polygon.box.xmax,
    maxY: polygon.box.ymax
  };
}
function doPolygonsOverlap(polygonA, polygonB) {
  if (!doBoundsOverlap(polygonBoxToBounds(polygonA), polygonBoxToBounds(polygonB))) {
    return false;
  }
  if (polygonA.contains(polygonB) || polygonB.contains(polygonA)) return true;
  try {
    const intersections = Flatten4.BooleanOperations.intersect(
      polygonA,
      polygonB
    );
    if (Array.isArray(intersections)) {
      return intersections.some((polygon) => polygon.area() > 0);
    }
    return intersections.area() > 0;
  } catch {
    return false;
  }
}
function checkPcbComponentOverCutout(circuitJson) {
  const cutouts = circuitJson.filter(
    (element) => element.type === "pcb_cutout"
  );
  const components = circuitJson.filter(
    (element) => element.type === "pcb_component"
  );
  if (cutouts.length === 0 || components.length === 0) return [];
  const cutoutPolygons = cutouts.map((cutout) => ({ cutout, polygon: cutoutToPolygon(cutout) })).filter(
    (entry) => entry.polygon !== null && entry.polygon.area() > 0
  );
  const errors = [];
  for (const component of components) {
    if (!component.center || component.width <= 0 || component.height <= 0) {
      continue;
    }
    const componentPolygon = rectanglePolygon2({
      center: component.center,
      width: component.width,
      height: component.height
    });
    for (const { cutout, polygon: cutoutPolygon } of cutoutPolygons) {
      if (cutout.pcb_component_id === component.pcb_component_id) continue;
      if (!doPolygonsOverlap(componentPolygon, cutoutPolygon)) continue;
      const componentName = getReadableNameForComponent(
        circuitJson,
        component.pcb_component_id
      );
      const cutoutId = cutout.pcb_cutout_id;
      errors.push({
        type: "pcb_placement_error",
        pcb_placement_error_id: `component_over_cutout_${component.pcb_component_id}_${cutoutId}`,
        error_type: "pcb_placement_error",
        message: `Component ${componentName} overlaps with cutout [${getReadableNameForElementId(circuitJson, cutoutId)}]`,
        subcircuit_id: component.subcircuit_id
      });
    }
  }
  return errors;
}

// lib/util/courtyard-to-keepout.ts
var getCourtyardId = (courtyard) => {
  switch (courtyard.type) {
    case "pcb_courtyard_circle":
      return courtyard.pcb_courtyard_circle_id;
    case "pcb_courtyard_outline":
      return courtyard.pcb_courtyard_outline_id;
    case "pcb_courtyard_polygon":
      return courtyard.pcb_courtyard_polygon_id;
    case "pcb_courtyard_rect":
      return courtyard.pcb_courtyard_rect_id;
  }
};
var courtyardToKeepout = (courtyard) => {
  const common = {
    type: "pcb_keepout",
    pcb_keepout_id: getCourtyardId(courtyard),
    layers: [courtyard.layer]
  };
  if (courtyard.type === "pcb_courtyard_circle") {
    return {
      ...common,
      shape: "circle",
      center: courtyard.center,
      radius: courtyard.radius
    };
  }
  const outline = courtyard.type === "pcb_courtyard_rect" ? getRotatedRectPoints({
    x: courtyard.center.x,
    y: courtyard.center.y,
    width: courtyard.width,
    height: courtyard.height,
    ccwRotation: courtyard.ccw_rotation ?? 0
  }) : courtyard.type === "pcb_courtyard_polygon" ? courtyard.points : courtyard.outline;
  return {
    ...common,
    shape: "outline",
    outline,
    stroke_width: 0
  };
};

// lib/check-pcb-courtyard-over-keepout.ts
function checkPcbCourtyardOverKeepout(circuitJson) {
  const keepouts = circuitJson.filter(
    (el) => el.type === "pcb_keepout" && !el.allow_placements
  );
  const components = new Map(
    circuitJson.flatMap(
      (el) => el.type === "pcb_component" ? [[el.pcb_component_id, el]] : []
    )
  );
  const courtyards = circuitJson.filter(
    (el) => el.type === "pcb_courtyard_rect" || el.type === "pcb_courtyard_circle" || el.type === "pcb_courtyard_outline" || el.type === "pcb_courtyard_polygon"
  );
  const errors = /* @__PURE__ */ new Map();
  for (const courtyard of courtyards) {
    const componentId = courtyard.pcb_component_id;
    const component = components.get(componentId);
    if (component?.do_not_place) continue;
    const geometry = courtyardToKeepout(courtyard);
    for (const keepout of keepouts) {
      if (!keepout.layers.includes(courtyard.layer)) continue;
      if (keepout.excluded_pcb_component_ids?.includes(componentId)) continue;
      const id = `courtyard_over_keepout_${componentId}_${keepout.pcb_keepout_id}`;
      if (errors.has(id)) continue;
      if (getPadToPadGap(geometry, keepout) > EPSILON) continue;
      const name = getReadableNameForElementId(circuitJson, componentId);
      const description = getReadableNameForElementId(
        circuitJson,
        keepout.pcb_keepout_id
      );
      const subcircuit_id = component?.subcircuit_id ?? keepout.subcircuit_id;
      if (keepout.warning_only) {
        errors.set(id, {
          type: "pcb_keepout_overlap_warning",
          warning_type: "pcb_keepout_overlap_warning",
          pcb_keepout_overlap_warning_id: `pcb_keepout_overlap_warning_${id}`,
          pcb_keepout_id: keepout.pcb_keepout_id,
          pcb_component_ids: [componentId],
          message: `Courtyard of ${name} overlaps advisory PCB keepout "${description}"`,
          subcircuit_id
        });
      } else {
        errors.set(id, {
          type: "pcb_placement_error",
          error_type: "pcb_placement_error",
          pcb_placement_error_id: id,
          message: `Courtyard of ${name} overlaps PCB keepout "${description}"`,
          subcircuit_id
        });
      }
    }
  }
  return [...errors.values()];
}

// lib/check-pcb-copper-over-keepout.ts
import { cju as cju4, getPrimaryId as getPrimaryId5 } from "@tscircuit/circuit-json-util";
var getErrorOwnerId = (copper) => "pcb_component_id" in copper && copper.pcb_component_id ? copper.pcb_component_id : getPrimaryId5(copper);
var getReadableCopperName = (circuitJson, copper) => {
  if ("pcb_component_id" in copper && copper.pcb_component_id) {
    const pcbComponent = circuitJson.find(
      (element) => element.type === "pcb_component" && element.pcb_component_id === copper.pcb_component_id
    );
    const sourceComponent = pcbComponent?.type === "pcb_component" ? circuitJson.find(
      (element) => element.type === "source_component" && element.source_component_id === pcbComponent.source_component_id
    ) : void 0;
    const componentName = sourceComponent?.type === "source_component" && sourceComponent.name ? sourceComponent.name : getReadableNameForComponent(circuitJson, copper.pcb_component_id);
    return `component ${componentName}`;
  }
  return copper.type === "pcb_via" ? `via ${getReadableNameForElementId(circuitJson, copper.pcb_via_id)}` : getReadableNameForElementId(circuitJson, getPrimaryId5(copper));
};
function checkPcbCopperOverKeepout(circuitJson) {
  const keepouts = cju4(circuitJson).pcb_keepout.list();
  if (keepouts.length === 0) return [];
  const copper = [
    ...getPads(circuitJson),
    ...cju4(circuitJson).pcb_via.list()
  ];
  const errors = /* @__PURE__ */ new Map();
  for (const keepout of keepouts) {
    const excludedComponentIds = new Set(
      keepout.excluded_pcb_component_ids ?? []
    );
    for (const copperElement of copper) {
      if (keepout.allow_placements && copperElement.type !== "pcb_via") continue;
      const copperComponentId = "pcb_component_id" in copperElement ? copperElement.pcb_component_id : void 0;
      if (copperComponentId && excludedComponentIds.has(copperComponentId)) {
        continue;
      }
      const copperLayers = getLayersOfPcbElement(copperElement);
      if (!copperLayers.some((layer) => keepout.layers.includes(layer))) {
        continue;
      }
      if (getPadToPadGap(copperElement, keepout) > EPSILON) continue;
      const ownerId = getErrorOwnerId(copperElement);
      const errorId = `copper_over_keepout_${ownerId}_${keepout.pcb_keepout_id}`;
      if (keepout.warning_only) {
        const copperIdField = copperElement.type === "pcb_smtpad" ? "pcb_smtpad_ids" : copperElement.type === "pcb_plated_hole" ? "pcb_plated_hole_ids" : "pcb_via_ids";
        const existing = errors.get(errorId);
        if (existing?.type === "pcb_keepout_overlap_warning") {
          existing[copperIdField] = Array.from(
            /* @__PURE__ */ new Set([
              ...existing[copperIdField] ?? [],
              getPrimaryId5(copperElement)
            ])
          );
        } else {
          errors.set(errorId, {
            type: "pcb_keepout_overlap_warning",
            warning_type: "pcb_keepout_overlap_warning",
            pcb_keepout_overlap_warning_id: `pcb_keepout_overlap_warning_${errorId}`,
            pcb_keepout_id: keepout.pcb_keepout_id,
            message: `Copper for ${getReadableCopperName(circuitJson, copperElement)} overlaps advisory PCB keepout "${getReadableNameForElementId(circuitJson, keepout.pcb_keepout_id)}"`,
            ...copperComponentId ? { pcb_component_ids: [copperComponentId] } : {},
            [copperIdField]: [getPrimaryId5(copperElement)],
            subcircuit_id: copperElement.subcircuit_id ?? keepout.subcircuit_id
          });
        }
        continue;
      }
      if (errors.has(errorId)) continue;
      errors.set(errorId, {
        type: "pcb_placement_error",
        pcb_placement_error_id: errorId,
        error_type: "pcb_placement_error",
        message: `Copper for ${getReadableCopperName(
          circuitJson,
          copperElement
        )} overlaps ${keepout.description ? `PCB keepout "${keepout.description}"` : "a PCB keepout"}`,
        subcircuit_id: copperElement.subcircuit_id ?? keepout.subcircuit_id
      });
    }
  }
  return [...errors.values()];
}

// lib/check-pcb-bend-zones.ts
import { getPrimaryId as getPrimaryId6 } from "@tscircuit/circuit-json-util";
var GEOMETRY_EPSILON2 = 1e-9;
function getBoardOwnerResolver(circuitJson) {
  const boardsBySubcircuit = new Map(
    circuitJson.flatMap(
      (element) => element.type === "pcb_board" && element.subcircuit_id ? [[element.subcircuit_id, element.pcb_board_id]] : []
    )
  );
  const parentSubcircuits = new Map(
    circuitJson.flatMap(
      (element) => element.type === "source_group" && element.is_subcircuit && element.subcircuit_id ? [[element.subcircuit_id, element.parent_subcircuit_id]] : []
    )
  );
  const components = new Map(
    circuitJson.flatMap(
      (element) => element.type === "pcb_component" ? [[element.pcb_component_id, element]] : []
    )
  );
  return (element) => {
    if ("pcb_board_id" in element && element.pcb_board_id)
      return element.pcb_board_id;
    if ("positioned_relative_to_pcb_board_id" in element && element.positioned_relative_to_pcb_board_id)
      return element.positioned_relative_to_pcb_board_id;
    const component = "pcb_component_id" in element && element.pcb_component_id ? components.get(element.pcb_component_id) : void 0;
    if (component?.positioned_relative_to_pcb_board_id)
      return component.positioned_relative_to_pcb_board_id;
    let subcircuitId = ("subcircuit_id" in element ? element.subcircuit_id : void 0) ?? component?.subcircuit_id;
    const visited = /* @__PURE__ */ new Set();
    while (subcircuitId && !visited.has(subcircuitId)) {
      const boardId = boardsBySubcircuit.get(subcircuitId);
      if (boardId) return boardId;
      visited.add(subcircuitId);
      subcircuitId = parentSubcircuits.get(subcircuitId);
    }
  };
}
function getBendZones(circuitJson) {
  const boards = new Map(
    circuitJson.filter((element) => element.type === "pcb_board").map((board) => [board.pcb_board_id, board])
  );
  return circuitJson.flatMap((bend) => {
    if (bend.type !== "pcb_bend") return [];
    const board = boards.get(bend.pcb_board_id);
    if (!board) return [];
    const dx = bend.end.x - bend.start.x;
    const dy = bend.end.y - bend.start.y;
    const length = Math.hypot(dx, dy);
    const width = bend.bend_radius * Math.abs(bend.bend_angle * Math.PI / 180);
    if (!Number.isFinite(length) || !Number.isFinite(width) || length <= GEOMETRY_EPSILON2 || width <= GEOMETRY_EPSILON2)
      return [];
    const tangent = { x: dx / length, y: dy / length };
    const offset = { x: -tangent.y * width / 2, y: tangent.x * width / 2 };
    const start = {
      x: board.center.x + bend.start.x,
      y: board.center.y + bend.start.y
    };
    const end = {
      x: board.center.x + bend.end.x,
      y: board.center.y + bend.end.y
    };
    const outline = [
      { x: start.x + offset.x, y: start.y + offset.y },
      { x: end.x + offset.x, y: end.y + offset.y },
      { x: end.x - offset.x, y: end.y - offset.y },
      { x: start.x - offset.x, y: start.y - offset.y }
    ];
    const keepout = {
      type: "pcb_keepout",
      pcb_keepout_id: bend.pcb_bend_id,
      shape: "outline",
      outline,
      stroke_width: 0,
      layers: ["top", "bottom"]
    };
    return [{ bend, board, tangent, keepout }];
  });
}
function getStiffenerOutline(stiffener, board) {
  const points = stiffener.shape === "polygon" ? stiffener.outline : getRotatedRectPoints({
    x: stiffener.center.x,
    y: stiffener.center.y,
    width: stiffener.width,
    height: stiffener.height,
    ccwRotation: stiffener.rotation ?? 0
  });
  return points.map((point2) => ({
    x: point2.x + board.center.x,
    y: point2.y + board.center.y
  }));
}
function checkPcbBendZonePlacement(circuitJson) {
  const zones = getBendZones(circuitJson);
  if (zones.length === 0) return [];
  const getBoardOwner = getBoardOwnerResolver(circuitJson);
  const copper = [
    ...getPads(circuitJson),
    ...circuitJson.filter((element) => element.type === "pcb_via")
  ].map((element) => ({ element, boardId: getBoardOwner(element) }));
  for (const trace of circuitJson) {
    if (trace.type !== "pcb_trace") continue;
    const boardId = getBoardOwner(trace);
    for (const [index, point2] of trace.route.entries()) {
      if (point2.route_type !== "via") continue;
      const outerDiameter = point2.outer_diameter ?? point2.hole_diameter ?? 0;
      const alreadyMaterialized = copper.some(
        ({ element: element2, boardId: viaBoardId }) => element2.type === "pcb_via" && !(boardId && viaBoardId && boardId !== viaBoardId) && Math.hypot(element2.x - point2.x, element2.y - point2.y) <= GEOMETRY_EPSILON2 && element2.layers.includes(point2.from_layer) && element2.layers.includes(point2.to_layer) && (point2.outer_diameter === void 0 || Math.abs(element2.outer_diameter - outerDiameter) <= GEOMETRY_EPSILON2) && (point2.hole_diameter === void 0 || Math.abs(element2.hole_diameter - point2.hole_diameter) <= GEOMETRY_EPSILON2)
      );
      if (alreadyMaterialized) continue;
      const element = {
        type: "pcb_via",
        pcb_via_id: `${trace.pcb_trace_id}_route_via_${index}`,
        pcb_trace_id: trace.pcb_trace_id,
        x: point2.x,
        y: point2.y,
        outer_diameter: outerDiameter,
        hole_diameter: point2.hole_diameter ?? 0,
        layers: [point2.from_layer, point2.to_layer],
        subcircuit_id: trace.subcircuit_id
      };
      copper.push({ element, boardId });
    }
  }
  const stiffeners = circuitJson.filter(
    (element) => element.type === "pcb_stiffener"
  );
  const errors = [];
  const report = (elementId, bend, subcircuitId) => {
    errors.push({
      type: "pcb_placement_error",
      pcb_placement_error_id: `bend_zone_${bend.pcb_bend_id}_${elementId}`,
      error_type: "pcb_placement_error",
      message: `${getReadableNameForElementId(circuitJson, elementId)} overlaps PCB bend zone ${getReadableNameForElementId(circuitJson, bend.pcb_bend_id)}`,
      subcircuit_id: subcircuitId ?? bend.subcircuit_id
    });
  };
  for (const { bend, board, keepout } of zones) {
    for (const { element, boardId } of copper) {
      if (boardId && boardId !== board.pcb_board_id) continue;
      if (getPadToPadGap(element, keepout) <= GEOMETRY_EPSILON2) {
        report(getPrimaryId6(element), bend, element.subcircuit_id);
      }
    }
    for (const stiffener of stiffeners) {
      if (stiffener.pcb_board_id !== board.pcb_board_id) continue;
      const outline = getStiffenerOutline(stiffener, board);
      if (outline.length < 3) continue;
      if (getPadToPadGap(
        { ...keepout, outline, pcb_keepout_id: stiffener.pcb_stiffener_id },
        keepout
      ) <= GEOMETRY_EPSILON2) {
        report(stiffener.pcb_stiffener_id, bend, stiffener.subcircuit_id);
      }
    }
  }
  return errors;
}
function checkPcbBendZoneTraces(circuitJson) {
  const zones = getBendZones(circuitJson);
  if (zones.length === 0) return [];
  const getBoardOwner = getBoardOwnerResolver(circuitJson);
  const errors = [];
  for (const trace of circuitJson) {
    if (trace.type !== "pcb_trace") continue;
    const boardId = getBoardOwner(trace);
    for (const { bend, tangent, keepout } of zones) {
      if (boardId && boardId !== bend.pcb_board_id) continue;
      let violation;
      for (let i = 1; i < trace.route.length; i++) {
        const a = trace.route[i - 1];
        const b = trace.route[i];
        const wire = a.route_type === "wire" ? a : b.route_type === "wire" ? b : void 0;
        if (!wire) continue;
        const aPoint = a.route_type === "through_pad" ? a.end_layer === wire.layer ? a.end : a.start_layer === wire.layer ? a.start : void 0 : a.route_type === "wire" ? a.layer === wire.layer ? a : void 0 : a.to_layer === wire.layer ? a : void 0;
        const bPoint = b.route_type === "through_pad" ? b.start_layer === wire.layer ? b.start : b.end_layer === wire.layer ? b.end : void 0 : b.route_type === "wire" ? b.layer === wire.layer ? b : void 0 : b.from_layer === wire.layer ? b : void 0;
        if (!aPoint || !bPoint) continue;
        const dx = bPoint.x - aPoint.x;
        const dy = bPoint.y - aPoint.y;
        const length = Math.hypot(dx, dy);
        if (length <= GEOMETRY_EPSILON2) continue;
        const alongBend = Math.abs(dx * tangent.x + dy * tangent.y) / length;
        if (alongBend <= GEOMETRY_EPSILON2) continue;
        const radius = Math.max(wire.width, wire.start_width ?? 0, wire.end_width ?? 0) / 2;
        const clearance = getSegmentToPolygonClearanceFromPoints(
          aPoint,
          bPoint,
          keepout.outline
        );
        if (clearance.distance > radius + GEOMETRY_EPSILON2) continue;
        violation = {
          center: clearance.center,
          reason: "Non-perpendicular trace copper"
        };
        break;
      }
      for (let i = 1; !violation && i < trace.route.length - 1; i++) {
        const point2 = trace.route[i];
        if (point2.route_type !== "wire") continue;
        let previousIndex = i - 1;
        let nextIndex = i + 1;
        while (previousIndex >= 0) {
          const previous2 = trace.route[previousIndex];
          if (previous2.route_type !== "wire" || previous2.layer !== point2.layer || Math.hypot(previous2.x - point2.x, previous2.y - point2.y) > GEOMETRY_EPSILON2)
            break;
          previousIndex--;
        }
        while (nextIndex < trace.route.length) {
          const next2 = trace.route[nextIndex];
          if (next2.route_type !== "wire" || next2.layer !== point2.layer || Math.hypot(next2.x - point2.x, next2.y - point2.y) > GEOMETRY_EPSILON2)
            break;
          nextIndex++;
        }
        const previous = trace.route[previousIndex];
        const next = trace.route[nextIndex];
        if (previous?.route_type !== "wire" || next?.route_type !== "wire" || previous.layer !== point2.layer || next.layer !== point2.layer)
          continue;
        const incoming = { x: point2.x - previous.x, y: point2.y - previous.y };
        const outgoing = { x: next.x - point2.x, y: next.y - point2.y };
        const lengths = Math.hypot(incoming.x, incoming.y) * Math.hypot(outgoing.x, outgoing.y);
        if (lengths <= GEOMETRY_EPSILON2) continue;
        const dot2 = (incoming.x * outgoing.x + incoming.y * outgoing.y) / lengths;
        const cross = (incoming.x * outgoing.y - incoming.y * outgoing.x) / lengths;
        if (dot2 > 0 && Math.abs(cross) <= GEOMETRY_EPSILON2) continue;
        const radius = Math.max(
          previous.width,
          previous.end_width ?? 0,
          point2.width,
          point2.start_width ?? 0
        ) / 2;
        const clearance = getSegmentToPolygonClearanceFromPoints(
          point2,
          point2,
          keepout.outline
        );
        if (clearance.distance > radius + GEOMETRY_EPSILON2) continue;
        violation = { center: point2, reason: "Trace corner" };
      }
      if (!violation) continue;
      errors.push({
        type: "pcb_trace_error",
        pcb_trace_error_id: `bend_zone_${bend.pcb_bend_id}_${trace.pcb_trace_id}`,
        error_type: "pcb_trace_error",
        message: `${violation.reason} for ${getReadableNameForTrace(circuitJson, trace.pcb_trace_id)} overlaps PCB bend zone ${getReadableNameForElementId(circuitJson, bend.pcb_bend_id)}`,
        center: violation.center,
        pcb_trace_id: trace.pcb_trace_id,
        source_trace_id: trace.source_trace_id ?? "",
        pcb_component_ids: trace.pcb_component_id ? [trace.pcb_component_id] : [],
        pcb_port_ids: [],
        subcircuit_id: trace.subcircuit_id ?? bend.subcircuit_id
      });
    }
  }
  return errors;
}

// lib/check-same-net-via-spacing.ts
import {
  getFullConnectivityMapFromCircuitJson as getFullConnectivityMapFromCircuitJson5
} from "circuit-json-to-connectivity-map";

// lib/util/distance.ts
function distance2(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// lib/util/viasAreAtSameLocation.ts
function viasAreAtSameLocation(a, b) {
  return distance2(a, b) <= EPSILON;
}

// lib/check-same-net-via-spacing.ts
function checkSameNetViaSpacing(circuitJson, {
  connMap,
  minClearance
} = {}) {
  const vias = circuitJson.filter((el) => el.type === "pcb_via");
  if (vias.length < 2) return [];
  const board = getPcbBoard(circuitJson);
  minClearance ??= getBoardDrcValue(board, "min_via_hole_edge_to_via_hole_edge_clearance") ?? jlcMinTolerances.min_via_hole_edge_to_via_hole_edge_clearance;
  connMap ??= getFullConnectivityMapFromCircuitJson5(circuitJson);
  const errors = [];
  const reported = /* @__PURE__ */ new Set();
  for (let i = 0; i < vias.length; i++) {
    for (let j = i + 1; j < vias.length; j++) {
      const viaA = vias[i];
      const viaB = vias[j];
      if (viasAreAtSameLocation(viaA, viaB)) continue;
      if (!connMap.areIdsConnected(viaA.pcb_via_id, viaB.pcb_via_id)) continue;
      const gap = distance2(viaA, viaB) - viaA.hole_diameter / 2 - viaB.hole_diameter / 2;
      if (gap + EPSILON >= minClearance) continue;
      const pairId = [viaA.pcb_via_id, viaB.pcb_via_id].sort().join("_");
      if (reported.has(pairId)) continue;
      reported.add(pairId);
      errors.push({
        type: "pcb_via_clearance_error",
        pcb_error_id: `same_net_vias_close_${pairId}`,
        message: `Vias ${getReadableNameForElementId(
          circuitJson,
          viaA.pcb_via_id
        )} and ${getReadableNameForElementId(
          circuitJson,
          viaB.pcb_via_id
        )} are too close together (gap: ${gap.toFixed(3)}mm)`,
        error_type: "pcb_via_clearance_error",
        pcb_via_ids: [viaA.pcb_via_id, viaB.pcb_via_id],
        minimum_clearance: minClearance,
        actual_clearance: gap,
        pcb_center: {
          x: (viaA.x + viaB.x) / 2,
          y: (viaA.y + viaB.y) / 2
        }
      });
    }
  }
  return errors;
}

// lib/check-different-net-via-spacing.ts
import {
  getFullConnectivityMapFromCircuitJson as getFullConnectivityMapFromCircuitJson6
} from "circuit-json-to-connectivity-map";
function checkDifferentNetViaSpacing(circuitJson, {
  connMap,
  minClearance
} = {}) {
  const vias = circuitJson.filter((el) => el.type === "pcb_via");
  if (vias.length < 2) return [];
  const board = getPcbBoard(circuitJson);
  minClearance ??= getBoardDrcValue(board, "min_via_hole_edge_to_via_hole_edge_clearance") ?? jlcMinTolerances.min_via_hole_edge_to_via_hole_edge_clearance;
  const minCopperClearance = getBoardDrcValue(board, "min_pad_edge_to_pad_edge_clearance") ?? jlcMinTolerances.min_pad_edge_to_pad_edge_clearance;
  connMap ??= getFullConnectivityMapFromCircuitJson6(circuitJson);
  const errors = [];
  const reported = /* @__PURE__ */ new Set();
  for (let i = 0; i < vias.length; i++) {
    for (let j = i + 1; j < vias.length; j++) {
      const viaA = vias[i];
      const viaB = vias[j];
      if (connMap.areIdsConnected(viaA.pcb_via_id, viaB.pcb_via_id)) continue;
      const centerDistance = distance2(viaA, viaB);
      let gap = centerDistance - viaA.hole_diameter / 2 - viaB.hole_diameter / 2;
      let minimumClearance = minClearance;
      if (gap + EPSILON >= minimumClearance) {
        if (!viaA.layers.some((layer) => viaB.layers.includes(layer))) continue;
        gap = centerDistance - viaA.outer_diameter / 2 - viaB.outer_diameter / 2;
        minimumClearance = minCopperClearance;
        if (gap >= 0 && gap + EPSILON >= minimumClearance) continue;
      }
      const pairId = [viaA.pcb_via_id, viaB.pcb_via_id].sort().join("_");
      if (reported.has(pairId)) continue;
      reported.add(pairId);
      errors.push({
        type: "pcb_via_clearance_error",
        pcb_error_id: `different_net_vias_close_${pairId}`,
        message: `Vias ${getReadableNameForElementId(
          circuitJson,
          viaA.pcb_via_id
        )} and ${getReadableNameForElementId(
          circuitJson,
          viaB.pcb_via_id
        )} from different nets are too close together (gap: ${gap.toFixed(
          3
        )}mm)`,
        error_type: "pcb_via_clearance_error",
        pcb_via_ids: [viaA.pcb_via_id, viaB.pcb_via_id],
        minimum_clearance: minimumClearance,
        actual_clearance: gap,
        pcb_center: {
          x: (viaA.x + viaB.x) / 2,
          y: (viaA.y + viaB.y) / 2
        }
      });
    }
  }
  return errors;
}

// lib/util/get-trace-endpoint-neckdown-lengths.ts
import { Point as Point7, Segment as Segment3 } from "@flatten-js/core";
function getTraceEndpointNeckdownLengths(trace, circuitJson, maxEscapeLength) {
  const fromStart = /* @__PURE__ */ new Map();
  const fromEnd = /* @__PURE__ */ new Map();
  for (const reverse of [false, true]) {
    const endpoint = trace.route[reverse ? trace.route.length - 1 : 0];
    if (endpoint?.route_type !== "wire") continue;
    const portId = reverse ? endpoint.end_pcb_port_id : endpoint.start_pcb_port_id;
    if (!portId) continue;
    const pads = circuitJson.filter(
      (element) => (element.type === "pcb_smtpad" || element.type === "pcb_plated_hole") && element.pcb_port_id === portId
    );
    if (!pads.length) continue;
    const geometry = convertCircuitJsonToFlattenJs(circuitJson, {
      elementIds: pads.map(
        (pad) => pad.type === "pcb_smtpad" ? pad.pcb_smtpad_id : pad.pcb_plated_hole_id
      ),
      layers: [endpoint.layer],
      roles: ["copper"],
      includeDrillHoles: false
    });
    if (geometry.warnings.length) continue;
    const shapes = geometry.elements.flatMap((element) => element.shapes);
    const contains = (point2) => shapes.some((shape) => shape.contains(point2));
    if (!contains(new Point7(endpoint.x, endpoint.y))) continue;
    let insidePad = true;
    let remainingEscape = maxEscapeLength;
    const lengths = reverse ? fromEnd : fromStart;
    for (let i = reverse ? trace.route.length - 2 : 0; i >= 0 && i < trace.route.length - 1; i += reverse ? -1 : 1) {
      const a = trace.route[reverse ? i + 1 : i];
      const b = trace.route[reverse ? i : i + 1];
      if (a.route_type !== "wire" || b.route_type !== "wire" || a.layer !== endpoint.layer || b.layer !== endpoint.layer)
        break;
      const start = new Point7(a.x, a.y);
      const end = new Point7(b.x, b.y);
      const segment = new Segment3(start, end);
      const length = segment.length;
      if (length === 0) continue;
      let covered = 0;
      if (insidePad) {
        const cuts = [
          0,
          length,
          ...shapes.flatMap(
            (shape) => shape.intersect(segment).map((point2) => start.distanceTo(point2)[0])
          )
        ].sort((a2, b2) => a2 - b2);
        for (let j = 0; j < cuts.length - 1; j++) {
          if (cuts[j + 1] - cuts[j] < 1e-9) continue;
          const fraction = (cuts[j] + cuts[j + 1]) / (2 * length);
          if (!contains(
            new Point7(
              a.x + (b.x - a.x) * fraction,
              a.y + (b.y - a.y) * fraction
            )
          )) {
            insidePad = false;
            break;
          }
          covered = cuts[j + 1];
        }
      }
      const escape = Math.min(length - covered, remainingEscape);
      covered += escape;
      remainingEscape -= escape;
      lengths.set(i, covered);
      if (covered < length) break;
    }
  }
  return { fromStart, fromEnd };
}

// lib/check-source-traces-match-pcb-trace-thickness.ts
import { cju as cju5 } from "@tscircuit/circuit-json-util";
import { getFullConnectivityMapFromCircuitJson as getFullConnectivityMapFromCircuitJson7 } from "circuit-json-to-connectivity-map";
function checkSourceTracesMatchPcbTraceThickness(circuitJson, {
  maxPadNeckdownLength
} = {}) {
  if (maxPadNeckdownLength !== void 0 && (!Number.isFinite(maxPadNeckdownLength) || maxPadNeckdownLength < 0)) {
    throw new Error("maxPadNeckdownLength must be finite and nonnegative");
  }
  const warnings = [];
  const db = cju5(circuitJson);
  const sourceTraces = db.source_trace.list();
  const pcbTraces = db.pcb_trace.list();
  const pcbPorts = db.pcb_port.list();
  const connectivityMap = getFullConnectivityMapFromCircuitJson7(circuitJson);
  for (const sourceTrace of sourceTraces) {
    const requestedThickness = sourceTrace.min_trace_thickness;
    if (requestedThickness === void 0) continue;
    const connectedPcbPorts = pcbPorts.filter(
      (pcbPort) => sourceTrace.connected_source_port_ids?.includes(pcbPort.source_port_id)
    );
    if (connectedPcbPorts.length < 2) continue;
    const referenceNetId = connectivityMap.getNetConnectedToId(
      connectedPcbPorts[0].pcb_port_id
    );
    if (!referenceNetId) continue;
    const netElementIds = connectivityMap.getIdsConnectedToNet(referenceNetId);
    const relatedPcbTraces = pcbTraces.filter(
      (pcbTrace) => netElementIds.includes(pcbTrace.pcb_trace_id)
    );
    if (relatedPcbTraces.length === 0) continue;
    let undersizedSegment;
    for (const relatedPcbTrace of relatedPcbTraces) {
      const neckdowns = getTraceEndpointNeckdownLengths(
        relatedPcbTrace,
        circuitJson,
        maxPadNeckdownLength ?? requestedThickness
      );
      for (let i = 0; i < relatedPcbTrace.route.length - 1; i++) {
        const point2 = relatedPcbTrace.route[i];
        const nextPoint = relatedPcbTrace.route[i + 1];
        if (point2.route_type !== "wire" || nextPoint.route_type !== "wire") {
          continue;
        }
        if (point2.layer !== nextPoint.layer) continue;
        if (point2.x === nextPoint.x && point2.y === nextPoint.y) continue;
        const interpolated = relatedPcbTrace.route_thickness_mode === "interpolated";
        if (Math.min(point2.width, interpolated ? nextPoint.width : point2.width) >= requestedThickness)
          continue;
        let startFraction = 0;
        let endFraction = 1;
        if (interpolated && point2.width !== nextPoint.width) {
          const crossing = (requestedThickness - point2.width) / (nextPoint.width - point2.width);
          if (point2.width >= requestedThickness) startFraction = crossing;
          if (nextPoint.width >= requestedThickness) endFraction = crossing;
        }
        const length = Math.hypot(nextPoint.x - point2.x, nextPoint.y - point2.y);
        startFraction = Math.max(
          startFraction,
          (neckdowns.fromStart.get(i) ?? 0) / length
        );
        endFraction = Math.min(
          endFraction,
          1 - (neckdowns.fromEnd.get(i) ?? 0) / length
        );
        if (endFraction - startFraction < 1e-9) continue;
        const width = interpolated ? Math.min(
          point2.width + (nextPoint.width - point2.width) * startFraction,
          point2.width + (nextPoint.width - point2.width) * endFraction
        ) : point2.width;
        if (undersizedSegment && width >= undersizedSegment.width) continue;
        const fraction = (startFraction + endFraction) / 2;
        undersizedSegment = {
          pcb_trace_id: relatedPcbTrace.pcb_trace_id,
          center: {
            x: point2.x + (nextPoint.x - point2.x) * fraction,
            y: point2.y + (nextPoint.y - point2.y) * fraction
          },
          width
        };
      }
    }
    if (!undersizedSegment) continue;
    warnings.push({
      type: "pcb_trace_warning",
      pcb_trace_warning_id: `pcb_trace_warning_${sourceTrace.source_trace_id}`,
      warning_type: "pcb_trace_warning",
      message: `Trace [${getReadableNameForSourceTrace(circuitJson, sourceTrace)}] is routed thinner than requested (requested: ${requestedThickness}mm, actual: ${undersizedSegment.width}mm).`,
      center: undersizedSegment.center,
      source_trace_id: sourceTrace.source_trace_id,
      pcb_trace_id: undersizedSegment.pcb_trace_id,
      pcb_component_ids: Array.from(
        new Set(
          connectedPcbPorts.map((pcbPort) => pcbPort.pcb_component_id).filter((id) => id !== void 0)
        )
      ),
      pcb_port_ids: connectedPcbPorts.map((pcbPort) => pcbPort.pcb_port_id)
    });
  }
  return warnings;
}

// lib/check-source-traces-have-pcb-traces.ts
import {
  getFullConnectivityMapFromCircuitJson as getFullConnectivityMapFromCircuitJson8
} from "circuit-json-to-connectivity-map";
function checkSourceTracesHavePcbTraces(circuitJson, { connMap } = {}) {
  const errors = [];
  const sourceTraces = circuitJson.filter(
    (el) => el.type === "source_trace"
  );
  const pcbTraces = circuitJson.filter(
    (el) => el.type === "pcb_trace"
  );
  const pcbPorts = circuitJson.filter(
    (el) => el.type === "pcb_port"
  );
  const sourcePortToPcbPort = new Map(
    pcbPorts.map((pcbPort) => [pcbPort.source_port_id, pcbPort])
  );
  const connectivityMap = connMap ?? getFullConnectivityMapFromCircuitJson8(circuitJson);
  let pourConnectivity;
  const getPourConnectivity = () => pourConnectivity ??= getCopperPourConnectivity(
    circuitJson,
    connectivityMap
  );
  for (const sourceTrace of sourceTraces) {
    if (!sourceTrace.connected_source_port_ids?.length) continue;
    if ((sourceTrace.connected_source_net_ids?.length ?? 0) > 0) continue;
    if (sourceTrace.connected_source_port_ids.length < 2) continue;
    const hasPcbTrace = pcbTraces.some(
      (pcbTrace) => connectivityMap.areIdsConnected(
        sourceTrace.source_trace_id,
        pcbTrace.pcb_trace_id
      )
    );
    if (!hasPcbTrace) {
      const connectedPcbPorts = sourceTrace.connected_source_port_ids.map((sourcePortId) => sourcePortToPcbPort.get(sourcePortId)).filter((pcbPort) => pcbPort !== void 0);
      if (connectedPcbPorts.length === sourceTrace.connected_source_port_ids.length && getPourConnectivity().arePortsConnected(
        connectedPcbPorts.map((port) => port.pcb_port_id)
      ))
        continue;
      const connectedPcbComponentIds = Array.from(
        new Set(
          connectedPcbPorts.map((port) => port.pcb_component_id).filter((id) => id !== void 0)
        )
      );
      errors.push({
        type: "pcb_trace_missing_error",
        pcb_trace_missing_error_id: `pcb_trace_missing_${sourceTrace.source_trace_id}`,
        error_type: "pcb_trace_missing_error",
        message: `Trace [${sourceTrace.display_name && !containsCircuitJsonId(sourceTrace.display_name) ? sourceTrace.display_name : "trace"}] is not connected (it has no PCB trace)`,
        source_trace_id: sourceTrace.source_trace_id,
        pcb_component_ids: connectedPcbComponentIds,
        pcb_port_ids: connectedPcbPorts.map((port) => port.pcb_port_id)
      });
    }
  }
  return errors;
}

// lib/check-traces-are-contiguous/check-traces-are-contiguous.ts
import { pointToSegmentDistance as pointToSegmentDistance6 } from "@tscircuit/math-utils";
import {
  getFullConnectivityMapFromCircuitJson as getFullConnectivityMapFromCircuitJson9
} from "circuit-json-to-connectivity-map";

// lib/check-traces-are-contiguous/via-contact-index.ts
import {
  all_layers as all_layers6
} from "circuit-json";
import { getPrimaryId as getPrimaryId7 } from "@tscircuit/circuit-json-util";
import { pointToSegmentDistance as pointToSegmentDistance5 } from "@tscircuit/math-utils";
var CONTACT_EPSILON = 1e-9;
function getViaContactIndex2(circuitJson, connectivity) {
  const index = /* @__PURE__ */ new Map();
  const pads = getPads(circuitJson);
  const traces = circuitJson.filter((element) => element.type === "pcb_trace");
  const vias = circuitJson.filter((element) => element.type === "pcb_via");
  const board = circuitJson.find((element) => element.type === "pcb_board");
  const layerCount = board?.num_layers;
  const innerLayers = all_layers6.filter((layer) => layer.startsWith("inner"));
  const stack = [
    "top",
    ...innerLayers.slice(
      0,
      layerCount === void 0 ? void 0 : Math.max(0, layerCount - 2)
    ),
    ...layerCount === 1 ? [] : ["bottom"]
  ];
  const add = (id, layers, contact) => {
    if (![contact.x, contact.y].every(Number.isFinite)) return;
    const net = connectivity.getNetConnectedToId(id);
    if (!net) return;
    const touchesPad = pads.some((pad) => {
      if (connectivity.getNetConnectedToId(getPrimaryId7(pad)) !== net || !getLayersOfPcbElement(pad).some((layer) => layers.includes(layer)))
        return false;
      if (contact.radius === void 0) return isPointInPad(contact, pad);
      const viaGeometry = {
        type: "pcb_via",
        pcb_via_id: id,
        x: contact.x,
        y: contact.y,
        outer_diameter: contact.radius * 2,
        hole_diameter: 0,
        layers
      };
      return getPadToPadGap(viaGeometry, pad) <= CONTACT_EPSILON;
    });
    const touchingTraceIds = /* @__PURE__ */ new Set();
    for (const trace of traces) {
      if (trace.route_thickness_mode === "interpolated" || connectivity.getNetConnectedToId(trace.pcb_trace_id) !== net)
        continue;
      for (let i = 1; i < trace.route.length; i++) {
        const a = trace.route[i - 1], b = trace.route[i];
        if (a.route_type !== "wire" || b.route_type !== "wire" || a.layer !== b.layer || !layers.includes(a.layer) || !Number.isFinite(a.width) || a.width <= 0 || Math.hypot(a.x - b.x, a.y - b.y) <= CONTACT_EPSILON)
          continue;
        const reach = contact.radius === void 0 ? 0 : contact.radius + a.width / 2;
        if (pointToSegmentDistance5(contact, a, b) <= reach + CONTACT_EPSILON) {
          touchingTraceIds.add(trace.pcb_trace_id);
          break;
        }
      }
    }
    const copper = { ...contact, touchesPad, touchingTraceIds };
    const byLayer = index.get(net) ?? /* @__PURE__ */ new Map();
    for (const layer of layers) {
      const contacts = byLayer.get(layer) ?? [];
      contacts.push(copper);
      byLayer.set(layer, contacts);
    }
    index.set(net, byLayer);
  };
  for (const via of vias) {
    if (!Number.isFinite(via.outer_diameter) || via.outer_diameter <= 0)
      continue;
    add(via.pcb_via_id, getLayersOfPcbElement(via), {
      x: via.x,
      y: via.y,
      ownerTraceId: via.pcb_trace_id,
      radius: via.outer_diameter / 2
    });
  }
  for (const trace of circuitJson) {
    if (trace.type !== "pcb_trace") continue;
    for (const point2 of trace.route) {
      if (point2.route_type !== "via") continue;
      if (vias.some(
        (via) => Math.hypot(via.x - point2.x, via.y - point2.y) <= CONTACT_EPSILON && (via.pcb_trace_id === trace.pcb_trace_id || !via.pcb_trace_id && connectivity.areIdsConnected(
          via.pcb_via_id,
          trace.pcb_trace_id
        ))
      ))
        continue;
      const from = stack.indexOf(point2.from_layer);
      const to = stack.indexOf(point2.to_layer);
      if (from < 0 || to < 0) continue;
      const diameter = point2.outer_diameter;
      if (diameter !== void 0 && (!Number.isFinite(diameter) || diameter <= 0))
        continue;
      add(
        trace.pcb_trace_id,
        stack.slice(Math.min(from, to), Math.max(from, to) + 1),
        {
          x: point2.x,
          y: point2.y,
          ownerTraceId: trace.pcb_trace_id,
          radius: diameter === void 0 ? void 0 : diameter / 2
        }
      );
    }
  }
  return index;
}
function endpointTouchesVia2({
  point: point2,
  width,
  ownerTrace,
  index,
  connectivity
}) {
  if (point2.route_type !== "wire" || !Number.isFinite(width) || width <= 0)
    return false;
  const net = connectivity.getNetConnectedToId(ownerTrace.pcb_trace_id);
  if (!net) return false;
  return (index.get(net)?.get(point2.layer) ?? []).some((via) => {
    if (via.ownerTraceId === ownerTrace.pcb_trace_id) return false;
    if (!via.touchesPad && ![...via.touchingTraceIds].some((id) => id !== ownerTrace.pcb_trace_id))
      return false;
    const contactDistance = via.radius === void 0 ? 0 : via.radius + width / 2;
    return Math.hypot(point2.x - via.x, point2.y - via.y) <= contactDistance + CONTACT_EPSILON;
  });
}

// lib/check-traces-are-contiguous/check-traces-are-contiguous.ts
var ENDPOINT_CONTACT_EPSILON = 1e-9;
var TRACE_SEGMENT_GEOMETRY_EPSILON = 1e-9;
function routePointTouchesPad2(point2, pad) {
  return point2.route_type === "wire" && getLayersOfPcbElement(pad).includes(point2.layer) && isPointInPad(point2, pad);
}
function getTraceWireSegmentsByNetAndLayer2(pcbTraces, fullConnectivityMap) {
  const segmentsByNetAndLayer = /* @__PURE__ */ new Map();
  for (const trace of pcbTraces) {
    if (trace.route_thickness_mode === "interpolated") continue;
    const netId = fullConnectivityMap.getNetConnectedToId(trace.pcb_trace_id);
    if (!netId) continue;
    for (let i = 0; i < trace.route.length - 1; i++) {
      const start = trace.route[i];
      const end = trace.route[i + 1];
      if (start.route_type !== "wire" || end.route_type !== "wire") continue;
      if (start.layer !== end.layer) continue;
      if (Math.hypot(start.x - end.x, start.y - end.y) <= TRACE_SEGMENT_GEOMETRY_EPSILON) {
        continue;
      }
      const segmentsByLayer = segmentsByNetAndLayer.get(netId) ?? /* @__PURE__ */ new Map();
      const segments = segmentsByLayer.get(start.layer) ?? [];
      segments.push({ trace, start, end });
      segmentsByLayer.set(start.layer, segments);
      segmentsByNetAndLayer.set(netId, segmentsByLayer);
    }
  }
  return segmentsByNetAndLayer;
}
function getEndpointTraceCopperWidth(trace, endpoint) {
  if (trace.route_thickness_mode === "interpolated") return void 0;
  let segmentStartIndex = endpoint === "start" ? 0 : trace.route.length - 2;
  const indexStep = endpoint === "start" ? 1 : -1;
  while (segmentStartIndex >= 0 && segmentStartIndex < trace.route.length - 1) {
    const segmentStart = trace.route[segmentStartIndex];
    const segmentEnd = trace.route[segmentStartIndex + 1];
    if (segmentStart?.route_type !== "wire" || segmentEnd?.route_type !== "wire" || segmentStart.layer !== segmentEnd.layer) {
      return void 0;
    }
    if (Math.hypot(segmentStart.x - segmentEnd.x, segmentStart.y - segmentEnd.y) > TRACE_SEGMENT_GEOMETRY_EPSILON) {
      return segmentStart.width;
    }
    segmentStartIndex += indexStep;
  }
  return void 0;
}
function routePointTouchesLogicallyConnectedTraceCopper({
  point: point2,
  endpointTraceCopperWidth,
  ownerTrace,
  traceWireSegmentsByNetAndLayer,
  fullConnectivityMap
}) {
  if (point2.route_type !== "wire") return false;
  const ownerNetId = fullConnectivityMap.getNetConnectedToId(
    ownerTrace.pcb_trace_id
  );
  if (!ownerNetId) return false;
  const candidateSegments = traceWireSegmentsByNetAndLayer.get(ownerNetId)?.get(point2.layer) ?? [];
  for (const segment of candidateSegments) {
    if (segment.trace.pcb_trace_id === ownerTrace.pcb_trace_id) continue;
    const maximumContactDistance = endpointTraceCopperWidth / 2 + segment.start.width / 2 + ENDPOINT_CONTACT_EPSILON;
    if (pointToSegmentDistance6(point2, segment.start, segment.end) <= maximumContactDistance) {
      return true;
    }
  }
  return false;
}
function getRoutePointCenter(point2) {
  if (point2.route_type === "through_pad") {
    return {
      x: (point2.start.x + point2.end.x) / 2,
      y: (point2.start.y + point2.end.y) / 2
    };
  }
  return { x: point2.x, y: point2.y };
}
function routePointConnectsToAnotherExpectedPort(point2, expectedPorts, missingPcbPortId, padMap) {
  return expectedPorts.some((expectedPort) => {
    if (!expectedPort.pcb_port_id || expectedPort.pcb_port_id === missingPcbPortId) {
      return false;
    }
    const expectedPads = padMap.get(expectedPort.pcb_port_id);
    return expectedPads?.some((pad) => routePointTouchesPad2(point2, pad)) ?? false;
  });
}
function getMissingConnectionErrorCenter({
  firstPoint,
  lastPoint,
  port,
  expectedPorts,
  padMap
}) {
  let errorLocation;
  const firstWirePoint = firstPoint.route_type === "wire" ? firstPoint : void 0;
  const lastWirePoint = lastPoint.route_type === "wire" ? lastPoint : void 0;
  const firstWirePointReferencesPort = getPcbPortIdsConnectedToRoutePoint(
    firstPoint
  ).includes(port.pcb_port_id);
  const lastWirePointReferencesPort = getPcbPortIdsConnectedToRoutePoint(
    lastPoint
  ).includes(port.pcb_port_id);
  if (firstWirePointReferencesPort && firstWirePoint) {
    errorLocation = firstWirePoint;
  } else if (lastWirePointReferencesPort && lastWirePoint) {
    errorLocation = lastWirePoint;
  } else if (routePointConnectsToAnotherExpectedPort(
    firstPoint,
    expectedPorts,
    port.pcb_port_id,
    padMap
  ) && lastWirePoint) {
    errorLocation = lastWirePoint;
  } else if (routePointConnectsToAnotherExpectedPort(
    lastPoint,
    expectedPorts,
    port.pcb_port_id,
    padMap
  ) && firstWirePoint) {
    errorLocation = firstWirePoint;
  } else if (firstWirePoint && lastWirePoint) {
    errorLocation = distance2(firstWirePoint, port) <= distance2(lastWirePoint, port) ? firstWirePoint : lastWirePoint;
  } else if (firstWirePoint) {
    errorLocation = firstWirePoint;
  } else if (lastWirePoint) {
    errorLocation = lastWirePoint;
  }
  const firstPointCenter = getRoutePointCenter(firstPoint);
  const lastPointCenter = getRoutePointCenter(lastPoint);
  return errorLocation ? { x: errorLocation.x, y: errorLocation.y } : {
    x: (firstPointCenter.x + lastPointCenter.x) / 2,
    y: (firstPointCenter.y + lastPointCenter.y) / 2
  };
}
function checkTracesAreContiguous(circuitJson, {
  connMap,
  pcbConnectivityMap
} = {}) {
  const errors = getTracePortLayerMismatches(circuitJson).map(
    ({ trace, point: point2, index, port, padLayers }) => ({
      type: "pcb_trace_error",
      error_type: "pcb_trace_error",
      pcb_trace_error_id: `missing_layer_connection_${trace.pcb_trace_id}_${index}_${port.pcb_port_id}`,
      pcb_trace_id: trace.pcb_trace_id,
      source_trace_id: trace.source_trace_id ?? `!${trace.pcb_trace_id}`,
      pcb_port_ids: [port.pcb_port_id],
      pcb_component_ids: port.pcb_component_id ? [port.pcb_component_id] : [],
      center: { x: point2.x, y: point2.y },
      message: `Trace [${getReadableNameForTrace(circuitJson, trace.pcb_trace_id)}] on ${point2.layer} is missing a via connection to port [${getReadableNameForPort(circuitJson, port.pcb_port_id)}] on ${padLayers.join(", ")}.`
    })
  );
  const pcbPorts = circuitJson.filter(
    (el) => el.type === "pcb_port"
  );
  const pcbTraces = circuitJson.filter(
    (el) => el.type === "pcb_trace"
  );
  const sourceTraces = circuitJson.filter(
    (el) => el.type === "source_trace"
  );
  const pcbSmtPads = circuitJson.filter(
    (el) => el.type === "pcb_smtpad"
  );
  const pcbPlatedHoles = circuitJson.filter(
    (el) => el.type === "pcb_plated_hole"
  );
  const padMap = /* @__PURE__ */ new Map();
  pcbConnectivityMap ??= createIndexedPcbConnectivityMap(circuitJson);
  let fullConnectivityMap = connMap;
  let traceWireSegmentsByNetAndLayer;
  const getFullConnectivityMap = () => {
    fullConnectivityMap ??= getFullConnectivityMapFromCircuitJson9(circuitJson);
    return fullConnectivityMap;
  };
  const getTraceWireSegmentIndex = () => {
    traceWireSegmentsByNetAndLayer ??= getTraceWireSegmentsByNetAndLayer2(
      pcbTraces,
      getFullConnectivityMap()
    );
    return traceWireSegmentsByNetAndLayer;
  };
  let viaContactIndex;
  const getViaIndex = () => {
    viaContactIndex ??= getViaContactIndex2(
      circuitJson,
      getFullConnectivityMap()
    );
    return viaContactIndex;
  };
  const checkedSourceTraceIds = /* @__PURE__ */ new Set();
  for (const pad of pcbSmtPads) {
    if (pad.pcb_port_id) {
      padMap.set(pad.pcb_port_id, [...padMap.get(pad.pcb_port_id) ?? [], pad]);
    }
  }
  for (const hole of pcbPlatedHoles) {
    if (hole.pcb_port_id) {
      padMap.set(hole.pcb_port_id, [
        ...padMap.get(hole.pcb_port_id) ?? [],
        hole
      ]);
    }
  }
  const touchedPortIdsByTraceId = /* @__PURE__ */ new Map();
  const traceIdsByTouchedPortId = /* @__PURE__ */ new Map();
  for (const trace of pcbTraces) {
    const touchedPortIds = /* @__PURE__ */ new Set();
    const firstPoint = trace.route[0];
    const lastPoint = trace.route.at(-1);
    for (const point2 of [firstPoint, lastPoint]) {
      if (!point2) continue;
      for (const [pcbPortId, pads] of padMap) {
        if (pads.some((pad) => routePointTouchesPad2(point2, pad))) {
          touchedPortIds.add(pcbPortId);
        }
      }
    }
    touchedPortIdsByTraceId.set(trace.pcb_trace_id, touchedPortIds);
    for (const pcbPortId of touchedPortIds) {
      const traceIds = traceIdsByTouchedPortId.get(pcbPortId) ?? /* @__PURE__ */ new Set();
      traceIds.add(trace.pcb_trace_id);
      traceIdsByTouchedPortId.set(pcbPortId, traceIds);
    }
  }
  const physicallyConnectedTracesByTraceId = /* @__PURE__ */ new Map();
  const getPhysicallyConnectedTraces = (startTrace) => {
    const cached = physicallyConnectedTracesByTraceId.get(
      startTrace.pcb_trace_id
    );
    if (cached) return cached;
    const connectedTraceIds = /* @__PURE__ */ new Set();
    const pendingTraceIds = [startTrace.pcb_trace_id];
    while (pendingTraceIds.length > 0) {
      const traceId = pendingTraceIds.pop();
      if (connectedTraceIds.has(traceId)) continue;
      connectedTraceIds.add(traceId);
      for (const connectedTrace of pcbConnectivityMap.getAllTracesConnectedToTrace(
        traceId
      )) {
        if (!connectedTraceIds.has(connectedTrace.pcb_trace_id)) {
          pendingTraceIds.push(connectedTrace.pcb_trace_id);
        }
      }
      for (const pcbPortId of touchedPortIdsByTraceId.get(traceId) ?? []) {
        for (const touchingTraceId of traceIdsByTouchedPortId.get(pcbPortId) ?? []) {
          if (!connectedTraceIds.has(touchingTraceId)) {
            pendingTraceIds.push(touchingTraceId);
          }
        }
      }
    }
    const connectedTraces = pcbTraces.filter(
      (trace) => connectedTraceIds.has(trace.pcb_trace_id)
    );
    for (const trace of connectedTraces) {
      physicallyConnectedTracesByTraceId.set(
        trace.pcb_trace_id,
        connectedTraces
      );
    }
    return connectedTraces;
  };
  for (const trace of pcbTraces) {
    if (trace.route.length === 0) continue;
    const firstPoint = trace.route[0];
    const lastPoint = trace.route[trace.route.length - 1];
    const sourceTrace = sourceTraces.find(
      (st) => st.source_trace_id === trace.source_trace_id
    );
    const expectedPorts = sourceTrace ? pcbPorts.filter(
      (port) => sourceTrace.connected_source_port_ids?.includes(port.source_port_id)
    ) : [];
    for (let i = 1; i < trace.route.length - 1; i++) {
      const prevPoint = trace.route[i - 1];
      const currentPoint = trace.route[i];
      const nextPoint = trace.route[i + 1];
      if (currentPoint.route_type === "via") {
        const prevIsWire = prevPoint.route_type === "wire";
        const nextIsWire = nextPoint.route_type === "wire";
        if (prevIsWire && nextIsWire) {
          const prevAligned = Math.abs(prevPoint.x - currentPoint.x) < 0.01 && Math.abs(prevPoint.y - currentPoint.y) < 0.01;
          const nextAligned = Math.abs(nextPoint.x - currentPoint.x) < 0.01 && Math.abs(nextPoint.y - currentPoint.y) < 0.01;
          if (!prevAligned || !nextAligned) {
            const traceName2 = getReadableNameForTrace(
              circuitJson,
              trace.pcb_trace_id
            );
            errors.push({
              type: "pcb_trace_error",
              message: `Via in trace [${traceName2}] is misaligned at position {x: ${currentPoint.x}, y: ${currentPoint.y}}.`,
              source_trace_id: sourceTrace?.source_trace_id || trace.source_trace_id || `!${trace.pcb_trace_id}`,
              error_type: "pcb_trace_error",
              pcb_trace_id: trace.pcb_trace_id,
              pcb_trace_error_id: `misaligned_via_${trace.pcb_trace_id}_${i}`,
              pcb_component_ids: [],
              pcb_port_ids: []
            });
          }
        }
      }
    }
    const traceName = getReadableNameForTrace(
      circuitJson,
      trace.pcb_trace_id
    );
    if (sourceTrace && expectedPorts.length > 0) {
      if (checkedSourceTraceIds.has(sourceTrace.source_trace_id)) continue;
      checkedSourceTraceIds.add(sourceTrace.source_trace_id);
    }
    for (const port of expectedPorts) {
      if (!port.pcb_port_id) continue;
      const pads = padMap.get(port.pcb_port_id);
      if (!pads?.length) continue;
      const isConnectedByRoutedSourceTrace = getPhysicallyConnectedTraces(
        trace
      ).some(
        (candidateTrace) => touchedPortIdsByTraceId.get(candidateTrace.pcb_trace_id)?.has(port.pcb_port_id)
      );
      if (isConnectedByRoutedSourceTrace) continue;
      const isFirstPointConnected = pads.some(
        (pad) => routePointTouchesPad2(firstPoint, pad)
      );
      const isLastPointConnected = pads.some(
        (pad) => routePointTouchesPad2(lastPoint, pad)
      );
      if (!isFirstPointConnected && !isLastPointConnected) {
        const portName = getReadableNameForPort(
          circuitJson,
          port.pcb_port_id
        );
        const padType = pads[0].type === "pcb_smtpad" ? "SMD pad" : "through-hole pad";
        const errorCenter = getMissingConnectionErrorCenter({
          firstPoint,
          lastPoint,
          port,
          expectedPorts,
          padMap
        });
        errors.push({
          type: "pcb_trace_error",
          message: `Trace [${traceName}] is missing a connection to ${padType} ${portName}`,
          source_trace_id: sourceTrace?.source_trace_id || trace.source_trace_id || `!${trace.pcb_trace_id}`,
          error_type: "pcb_trace_error",
          pcb_trace_id: trace.pcb_trace_id,
          pcb_trace_error_id: `missing_connection_${trace.pcb_trace_id}_${port.pcb_port_id}`,
          center: errorCenter,
          pcb_component_ids: [],
          pcb_port_ids: [port.pcb_port_id]
        });
      }
    }
    if (expectedPorts.length === 0) {
      let firstConnectsToAnyPad = false;
      let lastConnectsToAnyPad = false;
      for (const pads of padMap.values()) {
        if (pads.some((pad) => routePointTouchesPad2(firstPoint, pad))) {
          firstConnectsToAnyPad = true;
        }
        if (pads.some((pad) => routePointTouchesPad2(lastPoint, pad))) {
          lastConnectsToAnyPad = true;
        }
      }
      const firstEndpointTraceCopperWidth = !firstConnectsToAnyPad ? getEndpointTraceCopperWidth(trace, "start") : void 0;
      const lastEndpointTraceCopperWidth = !lastConnectsToAnyPad ? getEndpointTraceCopperWidth(trace, "end") : void 0;
      const firstConnectsToLogicallyConnectedTraceCopper = firstEndpointTraceCopperWidth !== void 0 && routePointTouchesLogicallyConnectedTraceCopper({
        point: firstPoint,
        endpointTraceCopperWidth: firstEndpointTraceCopperWidth,
        ownerTrace: trace,
        traceWireSegmentsByNetAndLayer: getTraceWireSegmentIndex(),
        fullConnectivityMap: getFullConnectivityMap()
      });
      const lastConnectsToLogicallyConnectedTraceCopper = lastEndpointTraceCopperWidth !== void 0 && routePointTouchesLogicallyConnectedTraceCopper({
        point: lastPoint,
        endpointTraceCopperWidth: lastEndpointTraceCopperWidth,
        ownerTrace: trace,
        traceWireSegmentsByNetAndLayer: getTraceWireSegmentIndex(),
        fullConnectivityMap: getFullConnectivityMap()
      });
      const firstIsConnected = firstConnectsToAnyPad || firstConnectsToLogicallyConnectedTraceCopper || firstEndpointTraceCopperWidth !== void 0 && endpointTouchesVia2({
        point: firstPoint,
        width: firstEndpointTraceCopperWidth,
        ownerTrace: trace,
        index: getViaIndex(),
        connectivity: getFullConnectivityMap()
      });
      const lastIsConnected = lastConnectsToAnyPad || lastConnectsToLogicallyConnectedTraceCopper || lastEndpointTraceCopperWidth !== void 0 && endpointTouchesVia2({
        point: lastPoint,
        width: lastEndpointTraceCopperWidth,
        ownerTrace: trace,
        index: getViaIndex(),
        connectivity: getFullConnectivityMap()
      });
      const endpointsAreSame = firstPoint.route_type === "wire" && lastPoint.route_type === "wire" && firstPoint.layer === lastPoint.layer && Math.hypot(firstPoint.x - lastPoint.x, firstPoint.y - lastPoint.y) <= ENDPOINT_CONTACT_EPSILON;
      if (!firstIsConnected && firstPoint.route_type === "wire") {
        errors.push({
          type: "pcb_trace_error",
          message: `Trace [${traceName}] has disconnected endpoint at (${firstPoint.x.toFixed(2)}, ${firstPoint.y.toFixed(2)})`,
          source_trace_id: sourceTrace?.source_trace_id || trace.source_trace_id || `!${trace.pcb_trace_id}`,
          error_type: "pcb_trace_error",
          pcb_trace_id: trace.pcb_trace_id,
          pcb_trace_error_id: `disconnected_endpoint_${trace.pcb_trace_id}_start`,
          center: { x: firstPoint.x, y: firstPoint.y },
          pcb_component_ids: [],
          pcb_port_ids: []
        });
      }
      if (!lastIsConnected && lastPoint.route_type === "wire" && !(endpointsAreSame && !firstIsConnected)) {
        errors.push({
          type: "pcb_trace_error",
          message: `Trace [${traceName}] has disconnected endpoint at (${lastPoint.x.toFixed(2)}, ${lastPoint.y.toFixed(2)})`,
          source_trace_id: sourceTrace?.source_trace_id || trace.source_trace_id || `!${trace.pcb_trace_id}`,
          error_type: "pcb_trace_error",
          pcb_trace_id: trace.pcb_trace_id,
          pcb_trace_error_id: `disconnected_endpoint_${trace.pcb_trace_id}_end`,
          center: { x: lastPoint.x, y: lastPoint.y },
          pcb_component_ids: [],
          pcb_port_ids: []
        });
      }
    }
  }
  return errors;
}

// lib/check-trace-out-of-board/checkTraceOutOfBoard.ts
import { cju as cju6 } from "@tscircuit/circuit-json-util";
import { segmentToSegmentMinDistance as segmentToSegmentMinDistance5 } from "@tscircuit/math-utils";
function getBoardPolygonPoints(board) {
  if (board.outline && board.outline.length > 0) {
    return board.outline.map((p) => ({ x: p.x, y: p.y }));
  }
  if (board.center && typeof board.width === "number" && typeof board.height === "number") {
    const cx = board.center.x;
    const cy = board.center.y;
    const hw = board.width / 2;
    const hh = board.height / 2;
    return [
      { x: cx - hw, y: cy - hh },
      // bottom-left
      { x: cx + hw, y: cy - hh },
      // bottom-right
      { x: cx + hw, y: cy + hh },
      // top-right
      { x: cx - hw, y: cy + hh }
      // top-left
    ];
  }
  return null;
}
function checkPcbTracesOutOfBoard(circuitJson, config = {}) {
  const errors = [];
  const board = getPcbBoard(circuitJson);
  if (!board) return errors;
  const margin = config.margin ?? getBoardDrcValue(board, "min_board_edge_clearance") ?? jlcMinTolerances.min_board_edge_clearance;
  const boardPoints = getBoardPolygonPoints(board);
  if (!boardPoints) return errors;
  const pcbTraces = cju6(circuitJson).pcb_trace.list();
  for (const trace of pcbTraces) {
    if (trace.route.length < 2) continue;
    for (let i = 0; i < trace.route.length - 1; i++) {
      const p1 = trace.route[i];
      const p2 = trace.route[i + 1];
      if (p1.route_type !== "wire" || p2.route_type !== "wire") continue;
      const traceWidth = "width" in p1 ? p1.width : "width" in p2 ? p2.width : 0.1;
      const segmentStart = { x: p1.x, y: p1.y };
      const segmentEnd = { x: p2.x, y: p2.y };
      let minDistance = Number.POSITIVE_INFINITY;
      for (let j = 0; j < boardPoints.length; j++) {
        const edgeStart = boardPoints[j];
        const edgeEnd = boardPoints[(j + 1) % boardPoints.length];
        const distance5 = segmentToSegmentMinDistance5(
          segmentStart,
          segmentEnd,
          edgeStart,
          edgeEnd
        );
        if (distance5 < minDistance) {
          minDistance = distance5;
        }
      }
      const minimumDistance = traceWidth / 2 + margin;
      if (minDistance < minimumDistance) {
        const error = {
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          pcb_trace_error_id: `trace_too_close_to_board_${trace.pcb_trace_id}_segment_${i}`,
          message: `Trace too close to board edge (${minDistance.toFixed(3)}mm < ${minimumDistance.toFixed(3)}mm required, margin: ${margin}mm)`,
          pcb_trace_id: trace.pcb_trace_id,
          source_trace_id: trace.source_trace_id || "",
          center: {
            x: (segmentStart.x + segmentEnd.x) / 2,
            y: (segmentStart.y + segmentEnd.y) / 2
          },
          pcb_component_ids: [],
          pcb_port_ids: []
        };
        errors.push(error);
      }
    }
  }
  return errors;
}

// lib/check-pcb-components-overlap/checkPcbComponentOverlap.ts
import {
  cju as cju7,
  getBoundsOfPcbElements as getBoundsOfPcbElements5,
  getPrimaryId as getPrimaryId8
} from "@tscircuit/circuit-json-util";
import { doBoundsOverlap as doBoundsOverlap3 } from "@tscircuit/math-utils";
import { getFullConnectivityMapFromCircuitJson as getFullConnectivityMapFromCircuitJson10 } from "circuit-json-to-connectivity-map";

// lib/check-pcb-components-overlap/doPcbElementsOverlap.ts
import { getBoundsOfPcbElements as getBoundsOfPcbElements4 } from "@tscircuit/circuit-json-util";
import { doBoundsOverlap as doBoundsOverlap2 } from "@tscircuit/math-utils";
var isCourtyardElement = (element) => element.type === "pcb_courtyard_circle" || element.type === "pcb_courtyard_outline" || element.type === "pcb_courtyard_polygon" || element.type === "pcb_courtyard_rect";
function getElementLayers(elem) {
  if (isCourtyardElement(elem)) {
    return [elem.layer];
  }
  return getLayersOfPcbElement(elem);
}
function doLayersOverlap(layers1, layers2) {
  if (layers1.length === 0 || layers2.length === 0) return true;
  return layers1.some((l) => layers2.includes(l));
}
function doPcbElementsOverlap(elem1, elem2) {
  const layers1 = getElementLayers(elem1);
  const layers2 = getElementLayers(elem2);
  if (!doLayersOverlap(layers1, layers2)) return false;
  if (elem1.type === "pcb_smtpad" && elem2.type === "pcb_smtpad") {
    return getPadToPadGap(elem1, elem2) <= 0;
  }
  if (elem1.type === "pcb_plated_hole" && isCourtyardElement(elem2)) {
    return getPadToPadGap(elem1, courtyardToKeepout(elem2)) <= 0;
  }
  if (isCourtyardElement(elem1) && elem2.type === "pcb_plated_hole") {
    return getPadToPadGap(elem2, courtyardToKeepout(elem1)) <= 0;
  }
  const bounds1 = getBoundsOfPcbElements4([elem1]);
  const bounds2 = getBoundsOfPcbElements4([elem2]);
  return doBoundsOverlap2(bounds1, bounds2);
}

// lib/check-pcb-components-overlap/checkPcbComponentOverlap.ts
var isCourtyardElement2 = (element) => element.type === "pcb_courtyard_circle" || element.type === "pcb_courtyard_outline" || element.type === "pcb_courtyard_polygon" || element.type === "pcb_courtyard_rect";
var isHoleElement = (element) => element.type === "pcb_hole" || element.type === "pcb_plated_hole";
var formatOverlapElementDescription = (circuitJson, element) => {
  if ("pcb_port_id" in element && element.pcb_port_id) {
    return getReadableNameForPort(circuitJson, element.pcb_port_id);
  }
  const id = getPrimaryId8(element);
  const readableName = getReadableNameForElementId(circuitJson, id);
  return readableName;
};
function checkPcbComponentOverlap(circuitJson) {
  const errors = [];
  const doNotPlaceComponentIds = new Set(
    circuitJson.flatMap(
      (element) => element.type === "pcb_component" && element.do_not_place ? [element.pcb_component_id] : []
    )
  );
  const connMap = getFullConnectivityMapFromCircuitJson10(circuitJson);
  const smtPads = cju7(circuitJson).pcb_smtpad.list();
  const platedHoles = cju7(circuitJson).pcb_plated_hole.list();
  const holes = cju7(circuitJson).pcb_hole.list();
  const courtyards = circuitJson.filter(isCourtyardElement2);
  const componentMap = /* @__PURE__ */ new Map();
  for (const pad of smtPads) {
    const componentId = pad.pcb_component_id || `standalone_pad_${getPrimaryId8(pad)}`;
    if (!componentMap.has(componentId)) {
      componentMap.set(componentId, {
        component_id: componentId,
        elements: []
      });
    }
    componentMap.get(componentId).elements.push(pad);
  }
  for (const hole of platedHoles) {
    const componentId = hole.pcb_component_id || `standalone_plated_hole_${getPrimaryId8(hole)}`;
    if (!componentMap.has(componentId)) {
      componentMap.set(componentId, {
        component_id: componentId,
        elements: []
      });
    }
    componentMap.get(componentId).elements.push(hole);
  }
  for (const hole of holes) {
    const componentId = hole.pcb_component_id || `standalone_hole_${getPrimaryId8(hole)}`;
    if (!componentMap.has(componentId)) {
      componentMap.set(componentId, {
        component_id: componentId,
        elements: [hole]
      });
    }
  }
  for (const courtyard of courtyards) {
    const componentId = courtyard.pcb_component_id;
    if (!componentMap.has(componentId)) {
      componentMap.set(componentId, {
        component_id: componentId,
        elements: []
      });
    }
    componentMap.get(componentId).elements.push(courtyard);
  }
  for (const [componentId, componentData] of componentMap) {
    if (componentData.elements.length > 0) {
      componentData.bounds = getBoundsOfPcbElements5(componentData.elements);
    }
  }
  const componentsWithElements = Array.from(componentMap.values());
  for (let i = 0; i < componentsWithElements.length; i++) {
    for (let j = i + 1; j < componentsWithElements.length; j++) {
      const comp1 = componentsWithElements[i];
      const comp2 = componentsWithElements[j];
      const pairIncludesDoNotPlaceComponent = doNotPlaceComponentIds.has(comp1.component_id) || doNotPlaceComponentIds.has(comp2.component_id);
      if (!comp1.bounds || !comp2.bounds) {
        continue;
      }
      if (!doBoundsOverlap3(comp1.bounds, comp2.bounds)) {
        continue;
      }
      for (const elem1 of comp1.elements) {
        for (const elem2 of comp2.elements) {
          const id1 = getPrimaryId8(elem1);
          const id2 = getPrimaryId8(elem2);
          if (pairIncludesDoNotPlaceComponent && (isCourtyardElement2(elem1) || isCourtyardElement2(elem2))) {
            continue;
          }
          if ((isCourtyardElement2(elem1) || isCourtyardElement2(elem2)) && !isHoleElement(elem1) && !isHoleElement(elem2)) {
            continue;
          }
          if (elem1.type === "pcb_smtpad" && elem2.type === "pcb_smtpad" && connMap.areIdsConnected(id1, id2)) {
            continue;
          }
          if (doPcbElementsOverlap(elem1, elem2)) {
            const elem1Description = formatOverlapElementDescription(
              circuitJson,
              elem1
            );
            const elem2Description = formatOverlapElementDescription(
              circuitJson,
              elem2
            );
            const error = {
              type: "pcb_footprint_overlap_error",
              pcb_error_id: `pcb_footprint_overlap_${id1}_${id2}`,
              error_type: "pcb_footprint_overlap_error",
              message: `${elem1.type} ${elem1Description} overlaps with ${elem2.type} ${elem2Description}`,
              pcb_component_ids: [
                elem1.pcb_component_id,
                elem2.pcb_component_id
              ].filter((id) => Boolean(id))
            };
            if (elem1.type === "pcb_smtpad" || elem2.type === "pcb_smtpad") {
              error.pcb_smtpad_ids = [];
              if (elem1.type === "pcb_smtpad") error.pcb_smtpad_ids.push(id1);
              if (elem2.type === "pcb_smtpad") error.pcb_smtpad_ids.push(id2);
            }
            if (elem1.type === "pcb_plated_hole" || elem2.type === "pcb_plated_hole") {
              error.pcb_plated_hole_ids = [];
              if (elem1.type === "pcb_plated_hole")
                error.pcb_plated_hole_ids.push(id1);
              if (elem2.type === "pcb_plated_hole")
                error.pcb_plated_hole_ids.push(id2);
            }
            if (elem1.type === "pcb_hole" || elem2.type === "pcb_hole") {
              error.pcb_hole_ids = [];
              if (elem1.type === "pcb_hole") error.pcb_hole_ids.push(id1);
              if (elem2.type === "pcb_hole") error.pcb_hole_ids.push(id2);
            }
            errors.push(error);
          }
        }
      }
    }
  }
  return errors;
}

// lib/check-pcb-components-missing-courtyard.ts
var courtyardTypes = /* @__PURE__ */ new Set([
  "pcb_courtyard_circle",
  "pcb_courtyard_outline",
  "pcb_courtyard_polygon",
  "pcb_courtyard_pill",
  "pcb_courtyard_rect"
]);
function checkPcbComponentsMissingCourtyard(circuitJson) {
  const manuallyPlacedViaSourceIds = new Set(
    circuitJson.filter((element) => element.type === "source_manually_placed_via").map((element) => element.source_manually_placed_via_id)
  );
  const componentIdsWithCourtyards = new Set(
    circuitJson.filter((element) => courtyardTypes.has(element.type)).flatMap(
      (element) => "pcb_component_id" in element && element.pcb_component_id ? [element.pcb_component_id] : []
    )
  );
  return circuitJson.filter(
    (element) => element.type === "pcb_component"
  ).filter(
    (component) => !componentIdsWithCourtyards.has(component.pcb_component_id) && (!component.source_component_id || !manuallyPlacedViaSourceIds.has(component.source_component_id))
  ).map((component) => {
    const sourceComponent = component.source_component_id ? circuitJson.find(
      (element) => element.type === "source_component" && element.source_component_id === component.source_component_id
    ) : void 0;
    const componentName = sourceComponent?.type === "source_component" ? sourceComponent.name : getReadableNameForComponent(circuitJson, component.pcb_component_id);
    return {
      type: "pcb_component_missing_courtyard_warning",
      pcb_component_missing_courtyard_warning_id: `pcb_component_missing_courtyard_warning_${component.pcb_component_id}`,
      warning_type: "pcb_component_missing_courtyard_warning",
      message: `${componentName} has no courtyard`,
      pcb_component_id: component.pcb_component_id,
      source_component_id: component.source_component_id,
      subcircuit_id: component.subcircuit_id
    };
  });
}

// lib/util/get-pcb-trace-length.ts
var getPcbTraceLength = (trace) => {
  if (trace.trace_length !== void 0) return trace.trace_length;
  let length = 0;
  let previousEnd;
  for (const point2 of trace.route) {
    const start = point2.route_type === "through_pad" ? point2.start : point2;
    if (previousEnd)
      length += Math.hypot(start.x - previousEnd.x, start.y - previousEnd.y);
    if (point2.route_type === "via") length += 1.6;
    if (point2.route_type === "through_pad") {
      length += Math.hypot(
        point2.end.x - point2.start.x,
        point2.end.y - point2.start.y
      );
      previousEnd = point2.end;
    } else {
      previousEnd = point2;
    }
  }
  return length;
};

// lib/check-pcb-trace-lengths.ts
var getReferencedPcbPortIds = (pcbTrace) => {
  const pcbPortIds = /* @__PURE__ */ new Set();
  for (const routePoint of pcbTrace.route) {
    if (routePoint.route_type !== "wire") continue;
    if (routePoint.start_pcb_port_id) {
      pcbPortIds.add(routePoint.start_pcb_port_id);
    }
    if (routePoint.end_pcb_port_id) {
      pcbPortIds.add(routePoint.end_pcb_port_id);
    }
  }
  return pcbPortIds;
};
var getPcbTracesBySourceTraceId = (circuitJson) => {
  const sourceTraces = circuitJson.filter(
    (element) => element.type === "source_trace"
  );
  const pcbTraces = circuitJson.filter(
    (element) => element.type === "pcb_trace"
  );
  const pcbPorts = circuitJson.filter(
    (element) => element.type === "pcb_port"
  );
  const pcbPortIdsBySourcePortId = /* @__PURE__ */ new Map();
  for (const pcbPort of pcbPorts) {
    if (!pcbPort.source_port_id) continue;
    const pcbPortIds = pcbPortIdsBySourcePortId.get(pcbPort.source_port_id) ?? /* @__PURE__ */ new Set();
    pcbPortIds.add(pcbPort.pcb_port_id);
    pcbPortIdsBySourcePortId.set(pcbPort.source_port_id, pcbPortIds);
  }
  const pcbTracesBySourceTraceId = /* @__PURE__ */ new Map();
  for (const pcbTrace of pcbTraces) {
    if (!pcbTrace.source_trace_id) continue;
    const matchingPcbTraces = pcbTracesBySourceTraceId.get(pcbTrace.source_trace_id) ?? [];
    matchingPcbTraces.push(pcbTrace);
    pcbTracesBySourceTraceId.set(pcbTrace.source_trace_id, matchingPcbTraces);
  }
  const exactEndpointPcbTraceIdsBySourceTraceId = /* @__PURE__ */ new Map();
  for (const sourceTrace of sourceTraces) {
    if (sourceTrace.connected_source_port_ids.length !== 2) continue;
    const endpointPcbPortIds = sourceTrace.connected_source_port_ids.map(
      (sourcePortId) => pcbPortIdsBySourcePortId.get(sourcePortId)
    );
    if (endpointPcbPortIds.some((pcbPortIds) => !pcbPortIds?.size)) continue;
    const exactEndpointPcbTraceIds = new Set(
      (pcbTracesBySourceTraceId.get(sourceTrace.source_trace_id) ?? []).filter((pcbTrace) => {
        const referencedPcbPortIds = getReferencedPcbPortIds(pcbTrace);
        return endpointPcbPortIds.every(
          (pcbPortIds) => [...pcbPortIds].some(
            (pcbPortId) => referencedPcbPortIds.has(pcbPortId)
          )
        );
      }).map((pcbTrace) => pcbTrace.pcb_trace_id)
    );
    if (exactEndpointPcbTraceIds.size > 0) {
      exactEndpointPcbTraceIdsBySourceTraceId.set(
        sourceTrace.source_trace_id,
        exactEndpointPcbTraceIds
      );
    }
  }
  for (const [id, exactIds] of exactEndpointPcbTraceIdsBySourceTraceId) {
    pcbTracesBySourceTraceId.set(
      id,
      pcbTracesBySourceTraceId.get(id).filter((trace) => exactIds.has(trace.pcb_trace_id))
    );
  }
  return pcbTracesBySourceTraceId;
};
var checkPcbTraceLengths = (circuitJson) => {
  const sourceTracesById = new Map(
    circuitJson.filter((e) => e.type === "source_trace").map((e) => [e.source_trace_id, e])
  );
  const pcbTracesBySourceTraceId = getPcbTracesBySourceTraceId(circuitJson);
  const errors = [];
  for (const [sourceTraceId, pcbTraces] of pcbTracesBySourceTraceId) {
    const pcbTrace = pcbTraces[0];
    const sourceTrace = sourceTracesById.get(sourceTraceId);
    if (!sourceTrace) continue;
    const maximumTraceLength = sourceTrace.max_length;
    if (typeof maximumTraceLength !== "number") continue;
    const actualTraceLength = pcbTraces.reduce(
      (sum, trace) => sum + getPcbTraceLength(trace),
      0
    );
    if (actualTraceLength <= maximumTraceLength + 1e-9) continue;
    errors.push({
      type: "pcb_trace_too_long_error",
      pcb_trace_too_long_error_id: `pcb_trace_too_long_error_${pcbTrace.pcb_trace_id}`,
      error_type: "pcb_trace_too_long_error",
      message: `PCB trace is ${actualTraceLength.toFixed(2)}mm long, exceeding the ${maximumTraceLength}mm maximum`,
      pcb_trace_id: pcbTrace.pcb_trace_id,
      source_trace_id: sourceTrace.source_trace_id,
      source_net_id: sourceTrace.connected_source_net_ids[0],
      actual_trace_length: actualTraceLength,
      maximum_trace_length: maximumTraceLength,
      subcircuit_id: pcbTrace.subcircuit_id ?? sourceTrace.subcircuit_id
    });
  }
  return errors;
};

// lib/check-pcb-trace-via-counts.ts
var checkPcbTraceViaCounts = (circuitJson) => {
  const sourceTraces = circuitJson.filter(
    (element) => element.type === "source_trace"
  );
  const pcbTraces = circuitJson.filter(
    (element) => element.type === "pcb_trace"
  );
  const pcbPorts = circuitJson.filter(
    (element) => element.type === "pcb_port"
  );
  const errors = [];
  for (const sourceTrace of sourceTraces) {
    const maximumViaCount = sourceTrace.max_via_count;
    if (typeof maximumViaCount !== "number") continue;
    const routedPcbTraces = pcbTraces.filter(
      (pcbTrace) => pcbTrace.source_trace_id === sourceTrace.source_trace_id
    );
    if (routedPcbTraces.length === 0) continue;
    const actualViaCount = routedPcbTraces.reduce(
      (viaCount, pcbTrace) => viaCount + pcbTrace.route.filter((routePoint) => routePoint.route_type === "via").length,
      0
    );
    if (actualViaCount <= maximumViaCount) continue;
    const connectedPcbPorts = pcbPorts.filter(
      (pcbPort) => pcbPort.source_port_id !== void 0 && sourceTrace.connected_source_port_ids.includes(pcbPort.source_port_id)
    );
    errors.push({
      type: "pcb_trace_error",
      pcb_trace_error_id: `max_via_count_exceeded_${sourceTrace.source_trace_id}`,
      error_type: "pcb_trace_error",
      message: `PCB trace uses ${actualViaCount} vias, exceeding the ${maximumViaCount} maximum`,
      pcb_trace_id: routedPcbTraces[0].pcb_trace_id,
      source_trace_id: sourceTrace.source_trace_id,
      pcb_component_ids: [
        ...new Set(
          connectedPcbPorts.map((pcbPort) => pcbPort.pcb_component_id).filter(
            (pcbComponentId) => pcbComponentId !== void 0
          )
        )
      ],
      pcb_port_ids: connectedPcbPorts.map((pcbPort) => pcbPort.pcb_port_id),
      subcircuit_id: routedPcbTraces[0].subcircuit_id ?? sourceTrace.subcircuit_id
    });
  }
  return errors;
};

// lib/check-pad-pad-clearance.ts
import { getPrimaryId as getPrimaryId9 } from "@tscircuit/circuit-json-util";
import { formatMm } from "format-si-unit";
import {
  getFullConnectivityMapFromCircuitJson as getFullConnectivityMapFromCircuitJson11
} from "circuit-json-to-connectivity-map";
function checkPadPadClearance(circuitJson, {
  connMap,
  minClearance
} = {}) {
  const pads = getPads(circuitJson);
  if (pads.length < 2) return [];
  const board = getPcbBoard(circuitJson);
  minClearance ??= getBoardDrcValue(board, "min_pad_edge_to_pad_edge_clearance") ?? jlcMinTolerances.min_pad_edge_to_pad_edge_clearance;
  connMap ??= getFullConnectivityMapFromCircuitJson11(circuitJson);
  const spatialIndex = new SpatialObjectIndex({
    objects: pads,
    getBounds: getPadBounds,
    getId: (pad) => getPrimaryId9(pad)
  });
  const errors = /* @__PURE__ */ new Map();
  for (const padA of pads) {
    const padAId = getPrimaryId9(padA);
    const nearbyPads = spatialIndex.getObjectsInBounds(
      getPadBounds(padA),
      minClearance
    );
    for (const padB of nearbyPads) {
      const padBId = getPrimaryId9(padB);
      if (padAId === padBId) continue;
      if (!getLayersOfPcbElement(padA).some(
        (layer) => getLayersOfPcbElement(padB).includes(layer)
      )) {
        continue;
      }
      if (connMap.areIdsConnected(padAId, padBId)) continue;
      const pairId = [padAId, padBId].sort().join("_");
      const gap = getPadToPadGap(padA, padB);
      if (gap + EPSILON >= minClearance) continue;
      const centerA = getPadCenter(padA);
      const centerB = getPadCenter(padB);
      const nextError = {
        type: "pcb_pad_pad_clearance_error",
        pcb_pad_pad_clearance_error_id: `pad_pad_clearance_${pairId}`,
        error_type: "pcb_pad_pad_clearance_error",
        message: `Pads ${getReadableNameForElementId(circuitJson, padAId)} and ${getReadableNameForElementId(circuitJson, padBId)} are too close (clearance: ${formatMm(gap)}, minimum: ${formatMm(minClearance)})`,
        pcb_pad_ids: [padAId, padBId],
        minimum_clearance: minClearance,
        actual_clearance: gap,
        center: {
          x: (centerA.x + centerB.x) / 2,
          y: (centerA.y + centerB.y) / 2
        }
      };
      if (!errors.has(pairId)) {
        errors.set(pairId, nextError);
      }
    }
  }
  return Array.from(errors.values());
}

// lib/check-pad-trace-clearance.ts
import { getPrimaryId as getPrimaryId10 } from "@tscircuit/circuit-json-util";
import { formatMm as formatMm2 } from "format-si-unit";
import {
  getFullConnectivityMapFromCircuitJson as getFullConnectivityMapFromCircuitJson12
} from "circuit-json-to-connectivity-map";
function checkPadTraceClearance(circuitJson, {
  connMap,
  minClearance
} = {}) {
  const pads = getPads(circuitJson);
  const segments = getTraceSegments(circuitJson);
  if (pads.length === 0 || segments.length === 0) return [];
  const board = getPcbBoard(circuitJson);
  minClearance ??= getBoardDrcValue(board, "min_trace_to_pad_edge_clearance") ?? jlcMinTolerances.min_trace_to_pad_edge_clearance;
  connMap ??= getFullConnectivityMapFromCircuitJson12(circuitJson);
  const spatialIndex = new SpatialObjectIndex({
    objects: pads,
    getBounds: getPadBounds,
    getId: (pad) => getPrimaryId10(pad)
  });
  const errors = /* @__PURE__ */ new Map();
  const overlappingPairIds = /* @__PURE__ */ new Set();
  for (const segment of segments) {
    const nearbyPads = spatialIndex.getObjectsInBounds(
      getCollidableBounds(segment),
      minClearance + segment.thickness / 2
    );
    for (const pad of nearbyPads) {
      const padId = getPrimaryId10(pad);
      if (!getLayersOfPcbElement(pad).includes(segment.layer)) continue;
      if (connMap.areIdsConnected(segment.pcb_trace_id, padId)) continue;
      const pairId = `${padId}_${segment.pcb_trace_id}`;
      const { gap, center } = getTraceObstacleClearance(segment, pad);
      if (isTraceObstacleOverlap(gap)) {
        errors.delete(pairId);
        overlappingPairIds.add(pairId);
        continue;
      }
      if (overlappingPairIds.has(pairId)) continue;
      if (gap + EPSILON >= minClearance) continue;
      const nextError = {
        type: "pcb_pad_trace_clearance_error",
        pcb_pad_trace_clearance_error_id: `pad_trace_clearance_${pairId}`,
        error_type: "pcb_pad_trace_clearance_error",
        message: `Pad ${getReadableNameForElementId(circuitJson, padId)} and trace ${getReadableNameForElementId(circuitJson, segment.pcb_trace_id)} are too close (clearance: ${formatMm2(gap)}, minimum: ${formatMm2(minClearance)})`,
        pcb_pad_id: padId,
        pcb_trace_id: segment.pcb_trace_id,
        minimum_clearance: minClearance,
        actual_clearance: gap,
        center
      };
      const current = errors.get(pairId);
      if (!current || gap < current.gap) {
        errors.set(pairId, { error: nextError, gap });
      }
    }
  }
  return Array.from(errors.values()).map(({ error }) => error);
}

// lib/check-via-trace-clearance.ts
import { formatMm as formatMm3 } from "format-si-unit";
import {
  getFullConnectivityMapFromCircuitJson as getFullConnectivityMapFromCircuitJson13
} from "circuit-json-to-connectivity-map";
function checkViaTraceClearance(circuitJson, {
  connMap,
  minClearance
} = {}) {
  const vias = circuitJson.filter((el) => el.type === "pcb_via");
  const segments = getTraceSegments(circuitJson);
  if (vias.length === 0 || segments.length === 0) return [];
  const board = getPcbBoard(circuitJson);
  minClearance ??= getBoardDrcValue(board, "min_trace_to_pad_edge_clearance") ?? jlcMinTolerances.min_trace_to_pad_edge_clearance;
  connMap ??= getFullConnectivityMapFromCircuitJson13(circuitJson);
  const errors = /* @__PURE__ */ new Map();
  const overlappingPairIds = /* @__PURE__ */ new Set();
  for (const via of vias) {
    for (const segment of segments) {
      if (!getLayersOfPcbElement(via).includes(segment.layer)) continue;
      if (connMap.areIdsConnected(segment.pcb_trace_id, via.pcb_via_id))
        continue;
      const pairId = `${via.pcb_via_id}_${segment.pcb_trace_id}`;
      const { gap, center } = getTraceObstacleClearance(segment, via);
      if (isTraceObstacleOverlap(gap)) {
        errors.delete(pairId);
        overlappingPairIds.add(pairId);
        continue;
      }
      if (overlappingPairIds.has(pairId)) continue;
      if (gap + EPSILON >= minClearance) continue;
      const nextError = {
        type: "pcb_via_trace_clearance_error",
        pcb_via_trace_clearance_error_id: `via_trace_clearance_${pairId}`,
        error_type: "pcb_via_trace_clearance_error",
        message: `Via ${getReadableNameForElementId(circuitJson, via.pcb_via_id)} and trace ${getReadableNameForElementId(circuitJson, segment.pcb_trace_id)} are too close (clearance: ${formatMm3(gap)}, minimum: ${formatMm3(minClearance)})`,
        pcb_via_id: via.pcb_via_id,
        pcb_trace_id: segment.pcb_trace_id,
        minimum_clearance: minClearance,
        actual_clearance: gap,
        center
      };
      const current = errors.get(pairId);
      if (!current || gap < current.gap) {
        errors.set(pairId, { error: nextError, gap });
      }
    }
  }
  return Array.from(errors.values()).map(({ error }) => error);
}

// lib/check-via-pad-clearance.ts
import { getPrimaryId as getPrimaryId11 } from "@tscircuit/circuit-json-util";
import { formatMm as formatMm4 } from "format-si-unit";
import {
  getFullConnectivityMapFromCircuitJson as getFullConnectivityMapFromCircuitJson14
} from "circuit-json-to-connectivity-map";
function checkViaPadClearance(circuitJson, {
  connMap,
  minClearance
} = {}) {
  const vias = circuitJson.filter(
    (element) => element.type === "pcb_via"
  );
  const pads = getPads(circuitJson);
  if (vias.length === 0 || pads.length === 0) return [];
  const board = getPcbBoard(circuitJson);
  const requiredClearance = minClearance ?? getBoardDrcValue(board, "min_pad_edge_to_pad_edge_clearance") ?? jlcMinTolerances.min_pad_edge_to_pad_edge_clearance;
  connMap ??= getFullConnectivityMapFromCircuitJson14(circuitJson);
  const padIndex = new SpatialObjectIndex({
    objects: pads,
    getBounds: getPadBounds,
    getId: getPrimaryId11
  });
  const errors = [];
  for (const via of vias) {
    const nearbyPads = padIndex.getObjectsInBounds(
      getPadBounds(via),
      requiredClearance
    );
    for (const pad of nearbyPads) {
      const padId = getPrimaryId11(pad);
      if (!getLayersOfPcbElement(via).some(
        (layer) => getLayersOfPcbElement(pad).includes(layer)
      )) {
        continue;
      }
      if (connMap.areIdsConnected(via.pcb_via_id, padId)) continue;
      const gap = getPadToPadGap(via, pad);
      if (gap + EPSILON >= requiredClearance) continue;
      errors.push({
        type: "pcb_pad_pad_clearance_error",
        pcb_pad_pad_clearance_error_id: `via_pad_clearance_${via.pcb_via_id}_${padId}`,
        error_type: "pcb_pad_pad_clearance_error",
        message: `Via ${getReadableNameForElementId(circuitJson, via.pcb_via_id)} and pad ${getReadableNameForElementId(circuitJson, padId)} are too close (clearance: ${formatMm4(gap)}, minimum: ${formatMm4(requiredClearance)})`,
        pcb_pad_ids: [via.pcb_via_id, padId],
        minimum_clearance: requiredClearance,
        actual_clearance: gap,
        center: getViaPadClearanceCenter(via, pad)
      });
    }
  }
  return errors;
}

// lib/check-vias-in-pads.ts
import { getPrimaryId as getPrimaryId12 } from "@tscircuit/circuit-json-util";

// lib/check-vias-in-pads/does-via-hole-overlap-pad.ts
var GEOMETRY_EPSILON_MM = 1e-9;
function doesViaHoleOverlapPad(via, pad) {
  const { gap } = getTraceObstacleClearance(
    {
      x1: via.x,
      y1: via.y,
      x2: via.x,
      y2: via.y,
      thickness: via.hole_diameter
    },
    pad
  );
  return gap < -GEOMETRY_EPSILON_MM;
}

// lib/check-vias-in-pads.ts
function checkViasInPads(circuitJson) {
  const board = getPcbBoard(circuitJson);
  if (board && "is_via_in_pad_allowed" in board && board.is_via_in_pad_allowed === true) {
    return [];
  }
  const vias = circuitJson.filter(
    (element) => element.type === "pcb_via"
  );
  const pads = getPads(circuitJson);
  if (vias.length === 0 || pads.length === 0) return [];
  const padOrdinals = new Map(
    pads.map((pad, index) => [getPrimaryId12(pad), index])
  );
  const padIndex = new SpatialObjectIndex({
    objects: pads,
    getBounds: getPadBounds,
    getId: getPrimaryId12
  });
  const errors = [];
  for (const via of vias) {
    const nearbyPads = padIndex.getObjectsInBounds(getPadBounds(via));
    for (const pad of nearbyPads) {
      const padId = getPrimaryId12(pad);
      const viaLayers = getLayersOfPcbElement(via);
      const padLayers = getLayersOfPcbElement(pad);
      if (!viaLayers.some((layer) => padLayers.includes(layer))) continue;
      if (!doesViaHoleOverlapPad(via, pad)) continue;
      const padOrdinal = padOrdinals.get(padId) ?? 0;
      const padName = getReadableNameForFootprintPad(
        circuitJson,
        pad,
        padOrdinal
      );
      errors.push({
        type: "pcb_placement_error",
        pcb_placement_error_id: `via_in_pad_${via.pcb_via_id}_${padId}`,
        error_type: "pcb_placement_error",
        message: `Via hole at (${via.x.toFixed(2)}mm, ${via.y.toFixed(2)}mm) overlaps ${padName}`,
        subcircuit_id: via.subcircuit_id ?? pad.subcircuit_id
      });
    }
  }
  return errors;
}

// lib/dedupe-pcb-drc-errors.ts
var dedupePcbDrcErrors = (errors) => {
  const specificallyReportedPairIds = /* @__PURE__ */ new Set();
  for (const error of errors) {
    if (error.type === "pcb_pad_trace_clearance_error" && typeof error.pcb_trace_id === "string" && typeof error.pcb_pad_id === "string") {
      specificallyReportedPairIds.add(
        `overlap_${error.pcb_trace_id}_${error.pcb_pad_id}`
      );
    }
    if (error.type === "pcb_via_trace_clearance_error" && typeof error.pcb_trace_id === "string" && typeof error.pcb_via_id === "string") {
      specificallyReportedPairIds.add(
        `overlap_${error.pcb_trace_id}_${error.pcb_via_id}`
      );
    }
  }
  return errors.filter((element) => {
    const error = element;
    return !(error.type === "pcb_trace_error" && typeof error.pcb_trace_error_id === "string" && specificallyReportedPairIds.has(error.pcb_trace_error_id));
  });
};

// lib/check-pin-must-be-connected.ts
function checkPinMustBeConnected(circuitJson) {
  const errors = [];
  const sourceComponents = circuitJson.filter(
    (el) => "source_component_id" in el && (el.type === "source_component" || el.type.startsWith("source_simple_"))
  );
  const sourcePorts = circuitJson.filter(
    (el) => el.type === "source_port"
  );
  const sourceTraces = circuitJson.filter(
    (el) => el.type === "source_trace"
  );
  const connectedPortIds = /* @__PURE__ */ new Set();
  for (const trace of sourceTraces) {
    for (const portId of trace.connected_source_port_ids ?? []) {
      connectedPortIds.add(portId);
    }
  }
  const componentInternalConnections = /* @__PURE__ */ new Map();
  for (const component of sourceComponents) {
    if ("internally_connected_source_port_ids" in component && component.internally_connected_source_port_ids) {
      componentInternalConnections.set(
        component.source_component_id,
        component.internally_connected_source_port_ids
      );
    }
  }
  for (const internalGroups of componentInternalConnections.values()) {
    for (const group of internalGroups) {
      if (group.some((portId) => connectedPortIds.has(portId))) {
        for (const portId of group) {
          connectedPortIds.add(portId);
        }
      }
    }
  }
  for (const port of sourcePorts) {
    if (port.must_be_connected === true) {
      if (!connectedPortIds.has(port.source_port_id)) {
        const component = sourceComponents.find(
          (c) => c.source_component_id === port.source_component_id
        );
        const componentName = component?.name ?? "Unknown";
        errors.push({
          type: "source_pin_must_be_connected_error",
          source_pin_must_be_connected_error_id: `source_pin_must_be_connected_error_${port.source_port_id}`,
          error_type: "source_pin_must_be_connected_error",
          message: `Port ${port.name} on ${componentName} must be connected but is floating`,
          source_component_id: port.source_component_id ?? "",
          source_port_id: port.source_port_id,
          subcircuit_id: port.subcircuit_id
        });
      }
    }
  }
  return errors;
}

// lib/check-two-terminal-switch-contacts-on-different-nets.ts
import {
  source_component_misconfigured_error
} from "circuit-json";
function checkTwoTerminalSwitchContactsOnDifferentNets(circuitJson) {
  const switchingComponents = circuitJson.filter(
    (element) => element.type === "source_component" && (element.ftype === "simple_push_button" || element.ftype === "simple_switch")
  );
  const sourcePorts = circuitJson.filter(
    (element) => element.type === "source_port"
  );
  const schematicPorts = circuitJson.filter(
    (element) => element.type === "schematic_port"
  );
  const errors = [];
  for (const switchingComponent of switchingComponents) {
    const schematicContactSourcePorts = schematicPorts.flatMap(
      (schematicPort) => {
        const sourcePort = sourcePorts.find(
          (sourcePort2) => sourcePort2.source_port_id === schematicPort.source_port_id && sourcePort2.source_component_id === switchingComponent.source_component_id
        );
        if (!sourcePort) return [];
        return [sourcePort];
      }
    );
    if (schematicContactSourcePorts.length !== 2) continue;
    const firstContactConnectivityKey = schematicContactSourcePorts[0].subcircuit_connectivity_map_key;
    const secondContactConnectivityKey = schematicContactSourcePorts[1].subcircuit_connectivity_map_key;
    if (!firstContactConnectivityKey) continue;
    if (firstContactConnectivityKey !== secondContactConnectivityKey) continue;
    errors.push(
      source_component_misconfigured_error.parse({
        type: "source_component_misconfigured_error",
        message: `Switch ${switchingComponent.name} has both schematic contacts connected to the same net. Check internallyConnectedPins and the footprint pin mapping.`,
        source_component_ids: [switchingComponent.source_component_id],
        source_port_ids: schematicContactSourcePorts.map(
          (sourcePort) => sourcePort.source_port_id
        ),
        is_fatal: true
      })
    );
  }
  return errors;
}

// lib/check-all-pins-in-component-are-underspecified.ts
import { cju as cju8 } from "@tscircuit/circuit-json-util";
var PIN_ATTRIBUTE_KEYS = [
  "must_be_connected",
  "provides_power",
  "requires_power",
  "provides_ground",
  "requires_ground",
  "provides_voltage",
  "requires_voltage",
  "do_not_connect",
  "include_in_board_pinout",
  "can_use_internal_pullup",
  "is_using_internal_pullup",
  "needs_external_pullup",
  "can_use_internal_pulldown",
  "is_using_internal_pulldown",
  "needs_external_pulldown",
  "can_use_open_drain",
  "is_using_open_drain",
  "can_use_push_pull",
  "is_using_push_pull",
  "should_have_decoupling_capacitor",
  "recommended_decoupling_capacitor_capacitance",
  "is_configured_for_i2c_sda",
  "is_configured_for_i2c_scl",
  "is_configured_for_spi_mosi",
  "is_configured_for_spi_miso",
  "is_configured_for_spi_sck",
  "is_configured_for_spi_cs",
  "is_configured_for_uart_tx",
  "is_configured_for_uart_rx",
  "supports_i2c_sda",
  "supports_i2c_scl",
  "supports_spi_mosi",
  "supports_spi_miso",
  "supports_spi_sck",
  "supports_spi_cs",
  "supports_uart_tx",
  "supports_uart_rx"
];
function hasAnyPinAttribute(port) {
  return PIN_ATTRIBUTE_KEYS.some((key) => port[key] !== void 0);
}
function checkAllPinsInComponentAreUnderspecified(circuitJson) {
  const warnings = [];
  const db = cju8(circuitJson);
  const sourceComponents = db.source_component.list();
  const sourcePorts = db.source_port.list();
  const portsByComponent = /* @__PURE__ */ new Map();
  for (const port of sourcePorts) {
    if (!port.source_component_id) continue;
    const existing = portsByComponent.get(port.source_component_id) ?? [];
    existing.push(port);
    portsByComponent.set(port.source_component_id, existing);
  }
  for (const component of sourceComponents) {
    if (component.ftype !== "simple_chip") continue;
    const componentPorts = portsByComponent.get(component.source_component_id) ?? [];
    if (componentPorts.length === 0) continue;
    const hasAnySpecifiedAttributes = componentPorts.some(
      (port) => hasAnyPinAttribute(port)
    );
    if (hasAnySpecifiedAttributes) continue;
    warnings.push({
      type: "source_component_pins_underspecified_warning",
      source_component_pins_underspecified_warning_id: `source_component_pins_underspecified_warning_${component.source_component_id}`,
      warning_type: "source_component_pins_underspecified_warning",
      message: `All pins on ${component.name} are underspecified (no pinAttributes set)`,
      source_component_id: component.source_component_id,
      source_port_ids: componentPorts.map((port) => port.source_port_id),
      subcircuit_id: componentPorts[0]?.subcircuit_id
    });
  }
  return warnings;
}

// lib/check-no-power-pin-defined.ts
import { cju as cju9 } from "@tscircuit/circuit-json-util";

// lib/util/should-check-chip-power-ground-pins.ts
var shouldCheckChipPowerGroundPins = (component, ports) => component.ftype === "simple_chip" && ports.filter((port) => port.do_not_connect !== true).length >= 2;

// lib/check-no-power-pin-defined.ts
function checkNoPowerPinDefined(circuitJson) {
  const warnings = [];
  const db = cju9(circuitJson);
  const sourceComponents = db.source_component.list();
  const sourcePorts = db.source_port.list();
  const portsByComponent = /* @__PURE__ */ new Map();
  for (const port of sourcePorts) {
    if (!port.source_component_id) continue;
    const existing = portsByComponent.get(port.source_component_id) ?? [];
    existing.push(port);
    portsByComponent.set(port.source_component_id, existing);
  }
  for (const component of sourceComponents) {
    const componentPorts = portsByComponent.get(component.source_component_id) ?? [];
    if (!shouldCheckChipPowerGroundPins(component, componentPorts)) continue;
    const hasRequiredPowerPin = componentPorts.some(
      (port) => port.requires_power === true
    );
    if (hasRequiredPowerPin) continue;
    warnings.push({
      type: "source_no_power_pin_defined_warning",
      source_no_power_pin_defined_warning_id: `source_no_power_pin_defined_warning_${component.source_component_id}`,
      warning_type: "source_no_power_pin_defined_warning",
      message: `${component.name} has no pin with requires_power=true`,
      source_component_id: component.source_component_id,
      source_port_ids: componentPorts.map((port) => port.source_port_id),
      subcircuit_id: componentPorts[0]?.subcircuit_id
    });
  }
  return warnings;
}

// lib/check-no-ground-pin-defined.ts
import { cju as cju10 } from "@tscircuit/circuit-json-util";
function checkNoGroundPinDefined(circuitJson) {
  const warnings = [];
  const db = cju10(circuitJson);
  const sourceComponents = db.source_component.list();
  const sourcePorts = db.source_port.list();
  const portsByComponent = /* @__PURE__ */ new Map();
  for (const port of sourcePorts) {
    if (!port.source_component_id) continue;
    const existing = portsByComponent.get(port.source_component_id) ?? [];
    existing.push(port);
    portsByComponent.set(port.source_component_id, existing);
  }
  for (const component of sourceComponents) {
    const componentPorts = portsByComponent.get(component.source_component_id) ?? [];
    if (!shouldCheckChipPowerGroundPins(component, componentPorts)) continue;
    const hasRequiredGroundPin = componentPorts.some(
      (port) => port.requires_ground === true
    );
    if (hasRequiredGroundPin) continue;
    warnings.push({
      type: "source_no_ground_pin_defined_warning",
      source_no_ground_pin_defined_warning_id: `source_no_ground_pin_defined_warning_${component.source_component_id}`,
      warning_type: "source_no_ground_pin_defined_warning",
      message: `${component.name} has no pin with requires_ground=true`,
      source_component_id: component.source_component_id,
      source_port_ids: componentPorts.map((port) => port.source_port_id),
      subcircuit_id: componentPorts[0]?.subcircuit_id
    });
  }
  return warnings;
}

// lib/check-schematic-component-excessive-vertical-padding.ts
var DEFAULT_PIN_SPACING = 0.2;
var MAX_VERTICAL_PADDING_IN_PIN_SPACINGS = 3;
var FLOATING_POINT_TOLERANCE = 1e-9;
function checkSchematicComponentExcessiveVerticalPadding(circuitJson) {
  const schematicComponents = circuitJson.filter(
    (element) => element.type === "schematic_component"
  );
  const schematicPorts = circuitJson.filter(
    (element) => element.type === "schematic_port"
  );
  const portsByComponentId = /* @__PURE__ */ new Map();
  for (const port of schematicPorts) {
    if (!port.schematic_component_id) continue;
    const componentPorts = portsByComponentId.get(port.schematic_component_id) ?? [];
    componentPorts.push(port);
    portsByComponentId.set(port.schematic_component_id, componentPorts);
  }
  const warnings = [];
  for (const component of schematicComponents) {
    if (!component.is_box_with_pins || component.size.height <= 0) continue;
    const sidePorts = (portsByComponentId.get(component.schematic_component_id) ?? []).filter(
      (port) => port.side_of_component === "left" || port.side_of_component === "right"
    );
    if (sidePorts.length < 2) continue;
    const pinYs = sidePorts.map((port) => port.center.y);
    const highestPinY = Math.max(...pinYs);
    const lowestPinY = Math.min(...pinYs);
    const componentTopY = component.center.y + component.size.height / 2;
    const componentBottomY = component.center.y - component.size.height / 2;
    const pinSpacing = component.pin_spacing ?? DEFAULT_PIN_SPACING;
    const maximumPadding = pinSpacing * MAX_VERTICAL_PADDING_IN_PIN_SPACINGS;
    const paddingBySide = {
      top: componentTopY - highestPinY,
      bottom: lowestPinY - componentBottomY
    };
    const componentName = getReadableNameForElementId(
      circuitJson,
      component.schematic_component_id
    );
    for (const side of ["top", "bottom"]) {
      const padding = paddingBySide[side];
      if (padding <= maximumPadding + FLOATING_POINT_TOLERANCE || padding <= 0) {
        continue;
      }
      const relativePosition = side === "top" ? "above" : "below";
      const stylingIssueType = `excessive_${side}_padding`;
      warnings.push({
        type: "schematic_component_styling_warning",
        schematic_component_styling_warning_id: `schematic_component_styling_warning_${component.schematic_component_id}_${stylingIssueType}`,
        warning_type: "schematic_component_styling_warning",
        message: `${componentName} has excessive empty space ${relativePosition} its pins (${padding.toFixed(2)}mm, more than ${MAX_VERTICAL_PADDING_IN_PIN_SPACINGS} pin spacings)`,
        schematic_component_id: component.schematic_component_id,
        styling_issue_type: stylingIssueType,
        schematic_port_ids: sidePorts.map((port) => port.schematic_port_id),
        source_component_id: component.source_component_id,
        schematic_sheet_id: component.schematic_sheet_id,
        subcircuit_id: component.subcircuit_id
      });
    }
  }
  return warnings;
}

// lib/check-schematic-component-missing-reference-designator-text.ts
var isFallbackReferenceDesignator = (name) => /^unnamed_[a-z0-9_-]+\d+$/i.test(name);
var isTextWithinComponentBounds = (schematicText, schematicComponent) => {
  const { center, size } = schematicComponent;
  const tolerance = 1e-9;
  return schematicText.position.x >= center.x - size.width / 2 - tolerance && schematicText.position.x <= center.x + size.width / 2 + tolerance && schematicText.position.y >= center.y - size.height / 2 - tolerance && schematicText.position.y <= center.y + size.height / 2 + tolerance;
};
function checkSchematicComponentMissingReferenceDesignatorText(circuitJson) {
  const schematicComponents = circuitJson.filter(
    (element) => element.type === "schematic_component"
  );
  const sourceComponents = circuitJson.filter(
    (element) => element.type === "source_component"
  );
  const schematicTexts = circuitJson.filter(
    (element) => element.type === "schematic_text"
  );
  const sourceComponentById = new Map(
    sourceComponents.map((component) => [
      component.source_component_id,
      component
    ])
  );
  const textBySchematicComponentId = /* @__PURE__ */ new Map();
  const customSymbolTexts = [];
  for (const schematicText of schematicTexts) {
    if (!schematicText.schematic_component_id) {
      if (schematicText.schematic_symbol_id) {
        customSymbolTexts.push(schematicText);
      }
      continue;
    }
    const componentTexts = textBySchematicComponentId.get(schematicText.schematic_component_id) ?? /* @__PURE__ */ new Set();
    componentTexts.add(schematicText.text.trim());
    textBySchematicComponentId.set(
      schematicText.schematic_component_id,
      componentTexts
    );
  }
  const warnings = [];
  for (const schematicComponent of schematicComponents) {
    if (schematicComponent.symbol_name) continue;
    if (schematicComponent.is_box_with_pins) continue;
    if (!schematicComponent.source_component_id) continue;
    const sourceComponent = sourceComponentById.get(
      schematicComponent.source_component_id
    );
    if (!sourceComponent) continue;
    const referenceDesignators = new Set(
      [sourceComponent.name, sourceComponent.display_name].map((name) => name?.trim()).filter((name) => Boolean(name))
    );
    const nonFallbackReferenceDesignator = [...referenceDesignators].find(
      (referenceDesignator) => !isFallbackReferenceDesignator(referenceDesignator)
    );
    const componentTexts = textBySchematicComponentId.get(
      schematicComponent.schematic_component_id
    );
    const hasReferenceDesignatorText = [...referenceDesignators].some(
      (referenceDesignator) => componentTexts?.has(referenceDesignator)
    ) || customSymbolTexts.some(
      (schematicText) => referenceDesignators.has(schematicText.text.trim()) && isTextWithinComponentBounds(schematicText, schematicComponent)
    );
    if (nonFallbackReferenceDesignator && hasReferenceDesignatorText) {
      continue;
    }
    const readableComponentName = nonFallbackReferenceDesignator ?? "Schematic component";
    warnings.push({
      type: "schematic_component_styling_warning",
      schematic_component_styling_warning_id: `schematic_component_styling_warning_${schematicComponent.schematic_component_id}_missing_reference_designator_text`,
      warning_type: "schematic_component_styling_warning",
      message: `${readableComponentName} is missing schematic reference designator text. For a custom symbol, add name="{REFDES}" inside the symbol.`,
      schematic_component_id: schematicComponent.schematic_component_id,
      styling_issue_type: "missing_reference_designator_text",
      source_component_id: schematicComponent.source_component_id,
      schematic_sheet_id: schematicComponent.schematic_sheet_id,
      subcircuit_id: schematicComponent.subcircuit_id
    });
  }
  return warnings;
}

// lib/check-schematic-component-ports-outside-body.ts
var FLOATING_POINT_TOLERANCE2 = 1e-9;
var getPortLabel = (port) => port.display_pin_label ?? `pin ${port.pin_number}`;
function checkSchematicComponentPortsOutsideBody(circuitJson) {
  const schematicComponents = circuitJson.filter(
    (element) => element.type === "schematic_component"
  );
  const schematicPorts = circuitJson.filter(
    (element) => element.type === "schematic_port"
  );
  const portsByComponentId = /* @__PURE__ */ new Map();
  for (const port of schematicPorts) {
    if (!port.schematic_component_id) continue;
    const componentPorts = portsByComponentId.get(port.schematic_component_id) ?? [];
    componentPorts.push(port);
    portsByComponentId.set(port.schematic_component_id, componentPorts);
  }
  const warnings = [];
  for (const component of schematicComponents) {
    if (component.is_box_with_pins === false || component.size.width <= 0 || component.size.height <= 0) {
      continue;
    }
    const componentLeftX = component.center.x - component.size.width / 2;
    const componentRightX = component.center.x + component.size.width / 2;
    const componentBottomY = component.center.y - component.size.height / 2;
    const componentTopY = component.center.y + component.size.height / 2;
    const componentPorts = portsByComponentId.get(component.schematic_component_id) ?? [];
    const portsOutsideBody = componentPorts.filter((port) => {
      if (port.side_of_component === "left" || port.side_of_component === "right") {
        return port.center.y < componentBottomY - FLOATING_POINT_TOLERANCE2 || port.center.y > componentTopY + FLOATING_POINT_TOLERANCE2;
      }
      if (port.side_of_component === "top" || port.side_of_component === "bottom") {
        return port.center.x < componentLeftX - FLOATING_POINT_TOLERANCE2 || port.center.x > componentRightX + FLOATING_POINT_TOLERANCE2;
      }
      return false;
    }).sort((portA, portB) => {
      const portAIsVertical = portA.side_of_component === "left" || portA.side_of_component === "right";
      const portBIsVertical = portB.side_of_component === "left" || portB.side_of_component === "right";
      if (portAIsVertical && portBIsVertical) {
        return portB.center.y - portA.center.y;
      }
      if (!portAIsVertical && !portBIsVertical) {
        return portA.center.x - portB.center.x;
      }
      return portAIsVertical ? -1 : 1;
    });
    if (portsOutsideBody.length === 0) continue;
    const requiredHeight = Math.max(
      component.size.height,
      ...portsOutsideBody.filter(
        (port) => port.side_of_component === "left" || port.side_of_component === "right"
      ).map((port) => 2 * Math.abs(port.center.y - component.center.y))
    );
    const requiredWidth = Math.max(
      component.size.width,
      ...portsOutsideBody.filter(
        (port) => port.side_of_component === "top" || port.side_of_component === "bottom"
      ).map((port) => 2 * Math.abs(port.center.x - component.center.x))
    );
    const suggestedDimensionChanges = [];
    if (requiredHeight > component.size.height + FLOATING_POINT_TOLERANCE2) {
      suggestedDimensionChanges.push(
        `increase schHeight to at least ${requiredHeight.toFixed(2)}mm`
      );
    }
    if (requiredWidth > component.size.width + FLOATING_POINT_TOLERANCE2) {
      suggestedDimensionChanges.push(
        `increase schWidth to at least ${requiredWidth.toFixed(2)}mm`
      );
    }
    const componentName = getReadableNameForElementId(
      circuitJson,
      component.schematic_component_id
    );
    const portLabels = portsOutsideBody.map(getPortLabel).join(", ");
    warnings.push({
      type: "schematic_component_styling_warning",
      schematic_component_styling_warning_id: `schematic_component_styling_warning_${component.schematic_component_id}_ports_outside_body`,
      warning_type: "schematic_component_styling_warning",
      message: `${componentName} has schematic pins outside its body (${portLabels}); ${suggestedDimensionChanges.join(" and ")}`,
      schematic_component_id: component.schematic_component_id,
      styling_issue_type: "ports_outside_body",
      schematic_port_ids: portsOutsideBody.map(
        (port) => port.schematic_port_id
      ),
      source_component_id: component.source_component_id,
      schematic_sheet_id: component.schematic_sheet_id,
      subcircuit_id: component.subcircuit_id
    });
  }
  return warnings;
}

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/MosfetGateNetworkPlacementSolver/MosfetGateNetworkPlacementSolver.ts
import { BaseSolver } from "@tscircuit/solver-utils";

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/utils/format.ts
var fmtNumber = (value) => {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
};
var fmtDelta = (value) => {
  const formatted = fmtNumber(value);
  return value > 0 ? `+${formatted}` : formatted;
};
var escapeAttr = (value) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
var addAttr = (attrs, key, value, options) => {
  if (value === void 0) return;
  const stringValue = typeof value === "number" ? options?.formatDelta ? fmtDelta(value) : fmtNumber(value) : escapeAttr(value);
  attrs.push(`${key}="${stringValue}"`);
};

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/utils/source-connectivity.ts
function getSourceConnectivity(circuitJson) {
  const parent = /* @__PURE__ */ new Map();
  const find = (id) => {
    const next = parent.get(id);
    if (next === void 0 || next === id) return id;
    const root = find(next);
    parent.set(id, root);
    return root;
  };
  const join = (ids) => {
    const first = ids[0];
    if (!first) return;
    const root = find(first);
    for (const id of ids.slice(1)) parent.set(find(id), root);
  };
  for (const element of circuitJson) {
    if (element.type === "source_port" || element.type === "source_net") {
      const id = element.type === "source_port" ? element.source_port_id : element.source_net_id;
      if (element.subcircuit_connectivity_map_key)
        join([id, `connectivity:${element.subcircuit_connectivity_map_key}`]);
    }
    if (element.type === "source_trace") {
      join([
        ...element.connected_source_port_ids,
        ...element.connected_source_net_ids,
        ...element.subcircuit_connectivity_map_key ? [`connectivity:${element.subcircuit_connectivity_map_key}`] : []
      ]);
    }
    if (element.type === "source_component_internal_connection")
      join(element.source_port_ids);
    if (element.type === "source_component") {
      for (const ids of element.internally_connected_source_port_ids ?? [])
        join(ids);
    }
  }
  return find;
}

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/utils/placement-network-index.ts
var PlacementNetworkIndex = class {
  connected;
  components = /* @__PURE__ */ new Map();
  portsByComponent = /* @__PURE__ */ new Map();
  portsByNet = /* @__PURE__ */ new Map();
  powerNets = /* @__PURE__ */ new Set();
  groundNets = /* @__PURE__ */ new Set();
  placements = /* @__PURE__ */ new Map();
  schematicComponents = /* @__PURE__ */ new Map();
  schematicPorts = /* @__PURE__ */ new Map();
  constructor(ctx) {
    this.connected = getSourceConnectivity(ctx.circuitJson);
    for (const placement of ctx.componentPlacements) {
      if (placement.sourceComponentId)
        append(this.placements, placement.sourceComponentId, placement);
    }
    for (const element of ctx.circuitJson) {
      if (element.type === "source_component")
        this.components.set(element.source_component_id, element);
      if (element.type === "source_port" && element.source_component_id) {
        append(
          this.portsByComponent,
          element.source_component_id,
          element
        );
        append(
          this.portsByNet,
          this.connected(element.source_port_id),
          element
        );
      }
      if (element.type === "source_net") {
        const net = this.connected(element.source_net_id);
        if (element.is_power || element.is_positive_voltage_source)
          this.powerNets.add(net);
        if (element.is_ground) this.groundNets.add(net);
      }
      if (element.type === "schematic_component")
        this.schematicComponents.set(element.schematic_component_id, element);
      if (element.type === "schematic_port" && element.source_port_id)
        append(this.schematicPorts, element.source_port_id, element);
    }
  }
  placement(componentId) {
    const placements = this.placements.get(componentId);
    return placements?.length === 1 ? placements[0] : void 0;
  }
  port(sourcePort) {
    const placement = this.placement(sourcePort.source_component_id);
    const ports = this.schematicPorts.get(sourcePort.source_port_id)?.filter(
      (port) => port.schematic_component_id === placement?.schematicComponentId
    );
    return ports?.length === 1 ? ports[0] : void 0;
  }
  namedPort(componentId, name) {
    const ports = this.portsByComponent.get(componentId)?.filter((port) => port.name === name || port.port_hints?.includes(name));
    return ports?.length === 1 ? ports[0] : void 0;
  }
  twoTerminalNets(componentId) {
    const ports = this.portsByComponent.get(componentId);
    if (ports?.length !== 2) return;
    const first = this.connected(ports[0].source_port_id);
    const second = this.connected(ports[1].source_port_id);
    if (first !== second) return [first, second];
  }
  isRail(net) {
    return this.powerNets.has(net) || this.groundNets.has(net);
  }
  /** Direct feedback may return to either input; grounded output loads do not count. */
  isDirectOpAmpFeedback(componentId) {
    const nets = this.twoTerminalNets(componentId);
    if (!nets || nets.some((net) => this.isRail(net))) return false;
    return nets.some(
      (net) => (this.portsByNet.get(net) ?? []).some((port) => {
        const hostId = port.source_component_id;
        if (this.components.get(hostId)?.ftype !== "simple_op_amp") return false;
        const output = this.namedPort(hostId, "output");
        if (output?.source_port_id !== port.source_port_id) return false;
        return ["inverting_input", "non_inverting_input"].some((name) => {
          const input = this.namedPort(hostId, name);
          if (!input) return false;
          const inputNet = this.connected(input.source_port_id);
          return inputNet !== net && nets.includes(inputNet);
        });
      })
    );
  }
  sameLocalScope(first, second) {
    if (first.schematicSheetId !== second.schematicSheetId || first.subcircuitId !== second.subcircuitId)
      return false;
    const a = this.schematicComponents.get(first.schematicComponentId ?? "");
    const b = this.schematicComponents.get(second.schematicComponentId ?? "");
    if (!a || !b || a.schematic_group_id !== b.schematic_group_id) return false;
    const firstSource = this.components.get(first.sourceComponentId ?? "");
    const secondSource = this.components.get(second.sourceComponentId ?? "");
    return firstSource?.source_group_id === secondSource?.source_group_id && firstSource?.subcircuit_id === secondSource?.subcircuit_id;
  }
};
function append(map, key, value) {
  const values = map.get(key);
  if (values) values.push(value);
  else map.set(key, [value]);
}

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/MosfetGateNetworkPlacementSolver/MosfetGateNetworkPlacementSolver.ts
var MosfetGateNetworkPlacementSolver = class extends BaseSolver {
  constructor(params) {
    super();
    this.params = params;
    this.index = new PlacementNetworkIndex(params.ctx);
    this.mosfetIds = [...this.index.components.keys()].filter(
      (id) => this.mosfetPorts(id)
    );
    this.solved = this.mosfetIds.length === 0;
  }
  params;
  index;
  mosfetIds;
  currentIndex = 0;
  _step() {
    const id = this.mosfetIds[this.currentIndex++];
    this.solved = this.currentIndex >= this.mosfetIds.length;
    if (!id) return;
    const index = this.index;
    const mosfet = index.placement(id);
    const roles = this.mosfetPorts(id);
    if (!mosfet) return;
    const gateNet = index.connected(roles.gate.source_port_id);
    const sourceNet = index.connected(roles.sources[0].source_port_id);
    const drainNet = index.connected(roles.drains[0].source_port_id);
    if ((/* @__PURE__ */ new Set([gateNet, sourceNet, drainNet])).size !== 3 || index.isRail(gateNet))
      return;
    if ([roles.gate, ...roles.sources, ...roles.drains].some((p) => {
      const pin = index.port(p);
      return !pin || pin.schematic_sheet_id !== mosfet.schematicSheetId;
    }))
      return;
    const peers = (index.portsByNet.get(gateNet) ?? []).filter(
      (p) => p.source_component_id !== id
    );
    if (peers.length !== 2) return;
    const resistors = peers.map((p) => {
      const resistorId = p.source_component_id;
      const component = index.components.get(resistorId);
      const placement = index.placement(resistorId);
      const nets = index.twoTerminalNets(resistorId);
      if (component?.ftype !== "simple_resistor" || !Number.isFinite(component.resistance) || component.resistance <= 0 || !placement || !nets || !index.sameLocalScope(mosfet, placement) || index.portsByComponent.get(resistorId).some((port) => {
        const pin = index.port(port);
        return port.do_not_connect || !pin || pin.schematic_sheet_id !== mosfet.schematicSheetId;
      }))
        return;
      return { placement, otherNet: nets.find((net) => net !== gateNet) };
    });
    if (resistors.some((r) => !r)) return;
    const shunts = resistors.filter((r) => r.otherNet === sourceNet);
    const series = resistors.filter((r) => r.otherNet !== sourceNet);
    if (shunts.length !== 1 || series.length !== 1) return;
    const gateSourceResistor = shunts[0].placement;
    const seriesGateResistor = series[0].placement;
    if (series[0].otherNet === drainNet || index.isRail(series[0].otherNet))
      return;
    const maxRecommendedBodyGap = Math.max(
      6,
      3 * Math.max(mosfet.width, mosfet.height)
    );
    const maxBodyGap = Math.max(
      bodyGap(mosfet, seriesGateResistor),
      bodyGap(mosfet, gateSourceResistor)
    );
    if (maxBodyGap <= maxRecommendedBodyGap) return;
    this.params.issues.push({
      lineItemType: "MosfetGateNetworkNotGrouped",
      mosfetSchematicBox: mosfet,
      seriesGateResistorSchematicBox: seriesGateResistor,
      gateSourceResistorSchematicBox: gateSourceResistor,
      maxBodyGap,
      maxRecommendedBodyGap,
      message: `Group ${seriesGateResistor.sourceComponentName ?? seriesGateResistor.sourceComponentId} and ${gateSourceResistor.sourceComponentName ?? gateSourceResistor.sourceComponentId} beside ${mosfet.sourceComponentName ?? id}'s gate/source pins so the gate-drive branch can be read together. Preserve all pin connections, leave room for labels, and reroute affected traces.`
    });
  }
  mosfetPorts(id) {
    const type = this.index.components.get(id)?.ftype;
    if (type !== "simple_mosfet" && type !== "simple_chip") return;
    const ports = this.index.portsByComponent.get(id) ?? [];
    const gate = ports.filter((p) => hasRole(p, /^(G|GATE)$/));
    const sources = ports.filter((p) => hasRole(p, /^(S|SOURCE)[0-9]*$/));
    const drains = ports.filter((p) => hasRole(p, /^(D|DRAIN)[0-9]*$/));
    if (gate.length !== 1 || !sources.length || !drains.length || gate.length + sources.length + drains.length !== ports.length || (/* @__PURE__ */ new Set([...gate, ...sources, ...drains])).size !== ports.length || ports.some((p) => p.do_not_connect))
      return;
    for (const group of [sources, drains])
      if (new Set(group.map((p) => this.index.connected(p.source_port_id))).size !== 1)
        return;
    return { gate: gate[0], sources, drains };
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(attrs, "mosfetName", issue.mosfetSchematicBox.sourceComponentName);
    addAttr(
      attrs,
      "seriesGateResistorName",
      issue.seriesGateResistorSchematicBox.sourceComponentName
    );
    addAttr(
      attrs,
      "gateSourceResistorName",
      issue.gateSourceResistorSchematicBox.sourceComponentName
    );
    addAttr(attrs, "maxBodyGap", issue.maxBodyGap);
    addAttr(attrs, "maxRecommendedBodyGap", issue.maxRecommendedBodyGap);
    addAttr(attrs, "message", issue.message);
    return `<MosfetGateNetworkNotGrouped ${attrs.join(" ")} />`;
  }
};
function hasRole(port, pattern) {
  return [port.name, ...port.port_hints ?? []].some(
    (hint) => pattern.test(hint.toUpperCase().replace(/[\s_]/g, ""))
  );
}
function bodyGap(a, b) {
  return Math.hypot(
    Math.max(0, Math.abs(a.schX - b.schX) - (a.width + b.width) / 2),
    Math.max(0, Math.abs(a.schY - b.schY) - (a.height + b.height) / 2)
  );
}

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/RelayFlybackDiodePlacementSolver/RelayFlybackDiodePlacementSolver.ts
import { BaseSolver as BaseSolver2 } from "@tscircuit/solver-utils";
var RelayFlybackDiodePlacementSolver = class extends BaseSolver2 {
  constructor(params) {
    super();
    this.params = params;
    this.index = new PlacementNetworkIndex(params.ctx);
    this.relayIds = [...this.index.components.keys()].filter(
      (id) => this.coilPorts(id)
    );
    this.solved = this.relayIds.length === 0;
  }
  params;
  index;
  relayIds;
  currentIndex = 0;
  _step() {
    const relayId = this.relayIds[this.currentIndex++];
    this.solved = this.currentIndex >= this.relayIds.length;
    if (!relayId) return;
    const index = this.index;
    const relay = index.placement(relayId);
    const coil = this.coilPorts(relayId);
    if (!relay || coil.some((p) => p.do_not_connect)) return;
    const nets = coil.map((p) => index.connected(p.source_port_id));
    if (nets[0] === nets[1]) return;
    if (this.relayIds.some(
      (id) => id !== relayId && this.coilPorts(id).every(
        (p) => nets.includes(index.connected(p.source_port_id))
      )
    ))
      return;
    const diodeIds = new Set(
      (index.portsByNet.get(nets[0]) ?? []).filter(
        (p) => index.components.get(p.source_component_id)?.ftype === "simple_diode"
      ).map((p) => p.source_component_id).filter((id) => index.twoTerminalNets(id)?.includes(nets[1]))
    );
    if (diodeIds.size !== 1) return;
    const diodeId = [...diodeIds][0];
    const diode = index.placement(diodeId);
    const anode = this.uniquePort(diodeId, /^(?:ANODE|A)$/);
    const cathode = this.uniquePort(diodeId, /^(?:CATHODE|K)$/);
    if (!diode || !index.sameLocalScope(relay, diode) || !anode || !cathode || anode === cathode || anode.do_not_connect || cathode.do_not_connect)
      return;
    const anodeNet = index.connected(anode.source_port_id);
    const cathodeNet = index.connected(cathode.source_port_id);
    if (index.isRail(anodeNet) || index.groundNets.has(cathodeNet) || !this.hasGroundedDriver(anodeNet, cathodeNet))
      return;
    const coilPins = coil.map((p) => index.port(p));
    const diodePins = [anode, cathode].map((p) => index.port(p));
    if ([...coilPins, ...diodePins].some(
      (p) => !p || p.schematic_sheet_id !== relay.schematicSheetId
    ))
      return;
    const [first, second] = coilPins;
    const left = Math.min(first.center.x, second.center.x);
    const right = Math.max(first.center.x, second.center.x);
    const bottom = Math.min(first.center.y, second.center.y);
    const top = Math.max(first.center.y, second.center.y);
    const gapX = Math.max(
      left - (diode.schX + diode.width / 2),
      diode.schX - diode.width / 2 - right,
      0
    );
    const gapY = Math.max(
      bottom - (diode.schY + diode.height / 2),
      diode.schY - diode.height / 2 - top,
      0
    );
    const distanceFromCoilPins = Math.hypot(gapX, gapY);
    const pinSpan = Math.hypot(right - left, top - bottom);
    if (distanceFromCoilPins <= Math.max(1.5, 2 * pinSpan) || distanceFromCoilPins > Math.max(8, 4 * Math.max(relay.width, relay.height)))
      return;
    if (!this.params.ctx.circuitJson.some(
      (e) => e.type === "schematic_net_label" && e.schematic_sheet_id === relay.schematicSheetId && e.anchor_position && diodePins.some(
        (p) => Math.hypot(
          p.center.x - e.anchor_position.x,
          p.center.y - e.anchor_position.y
        ) < 0.01 && !this.hasWireAtPin(p)
      )
    ))
      return;
    this.params.issues.push({
      lineItemType: "FlybackDiodeSeparatedFromRelayCoil",
      relaySchematicBox: relay,
      diodeSchematicBox: diode,
      coilSourcePortIds: [coil[0].source_port_id, coil[1].source_port_id],
      distanceFromCoilPins,
      message: `Place ${diode.sourceComponentName ?? diodeId} beside ${relay.sourceComponentName ?? relayId}'s coil pins so the flyback protection loop can be read together. Preserve diode polarity and all pin connections; leave room for labels and reroute affected traces.`
    });
  }
  hasWireAtPin(pin) {
    return this.params.ctx.circuitJson.some(
      (e) => e.type === "schematic_trace" && e.schematic_sheet_id === pin.schematic_sheet_id && e.edges.some(({ from, to }) => {
        const dx = to.x - from.x, dy = to.y - from.y;
        const lengthSquared = dx * dx + dy * dy;
        const t = lengthSquared ? Math.max(
          0,
          Math.min(
            1,
            ((pin.center.x - from.x) * dx + (pin.center.y - from.y) * dy) / lengthSquared
          )
        ) : 0;
        return Math.hypot(
          pin.center.x - from.x - t * dx,
          pin.center.y - from.y - t * dy
        ) < 0.01;
      })
    );
  }
  uniquePort(id, pattern) {
    const ports = this.index.portsByComponent.get(id)?.filter((p) => hasHint(p, pattern));
    return ports?.length === 1 ? ports[0] : void 0;
  }
  coilPorts(id) {
    if (this.index.components.get(id)?.ftype !== "simple_chip") return;
    const ports = this.index.portsByComponent.get(id) ?? [];
    if (!this.uniquePort(id, /^(?:COM|COMMON)$/) || !ports.some((p) => hasHint(p, /^(?:NO|NC|NORMALLYOPEN|NORMALLYCLOSED)$/)))
      return;
    const coil = ports.filter((p) => hasHint(p, /^(?:COIL[A-B12]|A[12])$/));
    if (coil.length !== 2) return;
    for (const [a, b] of [
      ["COILA", "COILB"],
      ["COIL1", "COIL2"],
      ["A1", "A2"]
    ]) {
      const first = this.uniquePort(id, new RegExp(`^${a}$`));
      const second = this.uniquePort(id, new RegExp(`^${b}$`));
      if (first && second && first !== second && !hasHint(first, new RegExp(`^${b}$`)) && !hasHint(second, new RegExp(`^${a}$`)))
        return [first, second];
    }
  }
  hasGroundedDriver(anodeNet, cathodeNet) {
    return (this.index.portsByNet.get(anodeNet) ?? []).some((p) => {
      const id = p.source_component_id;
      const component = this.index.components.get(id);
      if (component?.ftype !== "simple_chip" && !(component?.ftype === "simple_transistor" && component.transistor_type === "npn"))
        return false;
      if (this.index.portsByComponent.get(id)?.length !== 3) return false;
      const c = this.uniquePort(id, /^(?:C|COLLECTOR)$/);
      const e = this.uniquePort(id, /^(?:E|EMITTER)$/);
      const b = this.uniquePort(id, /^(?:B|BASE)$/);
      if (!c || !e || !b || (/* @__PURE__ */ new Set([c, e, b])).size !== 3 || [c, e, b].some((p2) => p2.do_not_connect) || c.source_port_id !== p.source_port_id)
        return false;
      const emitterNet = this.index.connected(e.source_port_id), baseNet = this.index.connected(b.source_port_id);
      return this.index.groundNets.has(emitterNet) && !this.index.powerNets.has(emitterNet) && (/* @__PURE__ */ new Set([anodeNet, cathodeNet, emitterNet, baseNet])).size === 4;
    });
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(attrs, "relayName", issue.relaySchematicBox.sourceComponentName);
    addAttr(attrs, "diodeName", issue.diodeSchematicBox.sourceComponentName);
    addAttr(attrs, "distanceFromCoilPins", issue.distanceFromCoilPins);
    addAttr(attrs, "message", issue.message);
    return `<FlybackDiodeSeparatedFromRelayCoil ${attrs.join(" ")} />`;
  }
};
function hasHint(port, pattern) {
  return [port.name, ...port.port_hints ?? []].some(
    (hint) => pattern.test(hint.toUpperCase().replace(/[\s_]/g, ""))
  );
}

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/CurrentSenseShuntPlacementSolver/CurrentSenseShuntPlacementSolver.ts
import { BaseSolver as BaseSolver3 } from "@tscircuit/solver-utils";
var EPSILON3 = 0.01;
var CurrentSenseShuntPlacementSolver = class extends BaseSolver3 {
  constructor(params) {
    super();
    this.params = params;
    this.index = new PlacementNetworkIndex(params.ctx);
    this.hostIds = [...this.index.components.values()].filter((component) => component.ftype === "simple_chip").map((component) => component.source_component_id);
    this.traces = params.ctx.circuitJson.filter(
      (element) => element.type === "schematic_trace"
    );
    this.solved = this.hostIds.length === 0;
  }
  params;
  index;
  hostIds;
  traces;
  currentIndex = 0;
  _step() {
    const hostId = this.hostIds[this.currentIndex++];
    this.solved = this.currentIndex >= this.hostIds.length;
    if (!hostId) return;
    const index = this.index;
    const host = index.placement(hostId);
    const ports = index.portsByComponent.get(hostId) ?? [];
    const positive2 = ports.filter((port) => inputRole(port) === "positive");
    const negative = ports.filter((port) => inputRole(port) === "negative");
    const outputs = ports.filter(
      (port) => hasHint2(port, /^(?:OUT|VOUT|OUTPUT)$/)
    );
    if (!host || positive2.length !== 1 || negative.length !== 1 || outputs.length !== 1 || !ports.some((port) => hasHint2(port, /^(?:VS|VCC|VDD)$/)) || !ports.some((port) => hasHint2(port, /^(?:GND|GROUND|VSS)$/)))
      return;
    const inputs = [positive2[0], negative[0]];
    const nets = inputs.map((port) => index.connected(port.source_port_id));
    if (inputs.some((port) => port.do_not_connect) || nets[0] === nets[1] || nets.includes(index.connected(outputs[0].source_port_id)))
      return;
    const pins = inputs.map((port) => index.port(port));
    const [positivePin, negativePin] = pins;
    if (!positivePin || !negativePin || !positivePin.facing_direction || positivePin.facing_direction !== negativePin.facing_direction || pins.some((pin) => pin.schematic_sheet_id !== host.schematicSheetId))
      return;
    const resistorIds = new Set(
      (index.portsByNet.get(nets[0]) ?? []).filter(
        (port) => index.components.get(port.source_component_id)?.ftype === "simple_resistor"
      ).map((port) => port.source_component_id).filter((id) => index.twoTerminalNets(id)?.includes(nets[1]))
    );
    if (resistorIds.size !== 1) return;
    const shuntId = [...resistorIds][0];
    const component = index.components.get(shuntId);
    if (component?.ftype !== "simple_resistor" || !Number.isFinite(component.resistance) || component.resistance <= 0 || component.resistance > 1)
      return;
    if (nets.some(
      (net) => (index.portsByNet.get(net) ?? []).some(
        (port) => port.source_component_id !== hostId && inputRole(port) !== void 0 && index.components.get(port.source_component_id)?.ftype === "simple_chip"
      )
    ))
      return;
    const shunt = index.placement(shuntId);
    if (!shunt || !index.sameLocalScope(host, shunt)) return;
    const shuntPorts = index.portsByComponent.get(shuntId);
    if (shuntPorts.some((port) => port.do_not_connect)) return;
    const shuntPins = nets.map(
      (net) => index.port(
        shuntPorts.find(
          (port) => index.connected(port.source_port_id) === net
        )
      )
    );
    if (shuntPins.some(
      (pin) => !pin || pin.schematic_sheet_id !== host.schematicSheetId
    ))
      return;
    const horizontalInputs = positivePin.facing_direction === "left" || positivePin.facing_direction === "right";
    const across = (point2) => horizontalInputs ? point2.y : point2.x;
    const first = across(positivePin.center), second = across(negativePin.center);
    const span = Math.abs(first - second);
    if (span < EPSILON3) return;
    const shuntAcross = horizontalInputs ? shunt.schY : shunt.schX;
    const halfSize = (horizontalInputs ? shunt.height : shunt.width) / 2;
    const inputBandGap = Math.max(
      Math.min(first, second) - (shuntAcross + halfSize),
      shuntAcross - halfSize - Math.max(first, second)
    );
    if (inputBandGap <= Math.max(1.5, 2 * span) || Math.hypot(shunt.schX - host.schX, shunt.schY - host.schY) > Math.max(8, 4 * Math.max(host.width, host.height)))
      return;
    const visible = pins.map(
      (pin, i) => this.hasVisibleConnection(shuntPins[i], pin, nets[i])
    );
    if (visible[0] === visible[1]) return;
    const labeledIndex = visible[0] ? 1 : 0;
    const labeledNet = nets[labeledIndex];
    if (!this.params.ctx.circuitJson.some((element) => {
      if (element.type !== "schematic_net_label" || element.schematic_sheet_id !== host.schematicSheetId)
        return false;
      if (element.source_net_id && (index.connected(element.source_net_id) === labeledNet || index.connected(`connectivity:${element.source_net_id}`) === labeledNet))
        return true;
      const pin = shuntPins[labeledIndex].center;
      if (element.anchor_position && Math.hypot(
        element.anchor_position.x - pin.x,
        element.anchor_position.y - pin.y
      ) < EPSILON3)
        return true;
      return element.source_trace_id !== void 0 && this.sourceTraceTouchesNet(element.source_trace_id, labeledNet);
    }))
      return;
    this.params.issues.push({
      lineItemType: "CurrentSenseShuntSeparatedFromInputs",
      amplifierSchematicBox: host,
      shuntSchematicBox: shunt,
      positiveInputSourcePortId: inputs[0].source_port_id,
      negativeInputSourcePortId: inputs[1].source_port_id,
      inputBandGap,
      message: `Place ${shunt.sourceComponentName ?? shuntId} near ${host.sourceComponentName ?? hostId}.${inputs[0].name}/${inputs[1].name}, so both sense connections can be read together. Move or rotate the shunt as needed; preserve all pin connections and leave room for labels.`
    });
  }
  hasVisibleConnection(from, to, net) {
    const edges = this.traces.filter((trace) => {
      if (trace.schematic_sheet_id !== from.schematic_sheet_id) return false;
      if (trace.subcircuit_connectivity_map_key)
        return this.index.connected(
          `connectivity:${trace.subcircuit_connectivity_map_key}`
        ) === net;
      if (this.sourceTraceTouchesNet(trace.source_trace_id, net)) return true;
      const endpoints = [trace.edges[0]?.from, trace.edges.at(-1)?.to];
      const endpointNets = new Set(
        this.params.ctx.circuitJson.flatMap(
          (element) => element.type === "schematic_port" && element.source_port_id && element.schematic_sheet_id === trace.schematic_sheet_id && endpoints.some(
            (point2) => point2 && Math.hypot(
              point2.x - element.center.x,
              point2.y - element.center.y
            ) < EPSILON3
          ) ? [this.index.connected(element.source_port_id)] : []
        )
      );
      return endpointNets.size === 1 && endpointNets.has(net);
    }).flatMap((trace) => trace.edges);
    const reached = edges.filter(
      (edge) => onSegment(from.center, edge.from, edge.to)
    );
    const visited = /* @__PURE__ */ new Set();
    for (let i = 0; i < reached.length; i++) {
      const current = reached[i];
      if (onSegment(to.center, current.from, current.to)) return true;
      for (const [edgeIndex, edge] of edges.entries()) {
        if (visited.has(edgeIndex) || ![current.from, current.to].some(
          (point2) => onSegment(point2, edge.from, edge.to)
        ) && ![edge.from, edge.to].some(
          (point2) => onSegment(point2, current.from, current.to)
        ))
          continue;
        visited.add(edgeIndex);
        reached.push(edge);
      }
    }
    return false;
  }
  sourceTraceTouchesNet(traceId, net) {
    if (!traceId) return false;
    const source = this.params.ctx.circuitJson.find(
      (element) => element.type === "source_trace" && element.source_trace_id === traceId
    );
    return source?.type === "source_trace" && source.connected_source_port_ids.some(
      (id) => this.index.connected(id) === net
    );
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(
      attrs,
      "amplifierName",
      issue.amplifierSchematicBox.sourceComponentName
    );
    addAttr(attrs, "shuntName", issue.shuntSchematicBox.sourceComponentName);
    addAttr(attrs, "inputBandGap", issue.inputBandGap);
    addAttr(attrs, "message", issue.message);
    return `<CurrentSenseShuntSeparatedFromInputs ${attrs.join(" ")} />`;
  }
};
function hasHint2(port, pattern) {
  return [port.name, ...port.port_hints ?? []].some(
    (hint) => pattern.test(hint.toUpperCase().replace(/[\s_]/g, ""))
  );
}
function inputRole(port) {
  const positive2 = hasHint2(port, /^(?:IN\+|VIN\+|INPOS|VINPOS)$/);
  const negative = hasHint2(port, /^(?:IN-|VIN-|INNEG|VINNEG)$/);
  return positive2 === negative ? void 0 : positive2 ? "positive" : "negative";
}
function onSegment(point2, from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < EPSILON3)
    return Math.hypot(point2.x - from.x, point2.y - from.y) < EPSILON3;
  const projection = ((point2.x - from.x) * dx + (point2.y - from.y) * dy) / length;
  return projection >= -EPSILON3 && projection <= length + EPSILON3 && Math.abs((point2.x - from.x) * dy - (point2.y - from.y) * dx) / length < EPSILON3;
}

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/VoltageDividerPlacementSolver/VoltageDividerPlacementSolver.ts
import { BaseSolver as BaseSolver4 } from "@tscircuit/solver-utils";
var VoltageDividerPlacementSolver = class extends BaseSolver4 {
  constructor(params) {
    super();
    this.params = params;
    this.index = new PlacementNetworkIndex(params.ctx);
    this.resistorIds = [...this.index.components.values()].filter((component) => component.ftype === "simple_resistor").map((component) => component.source_component_id);
    for (const element of params.ctx.circuitJson) {
      if (element.type === "source_net" && element.is_positive_voltage_source)
        this.positiveNets.add(this.index.connected(element.source_net_id));
    }
    this.solved = this.resistorIds.length === 0;
  }
  params;
  index;
  positiveNets = /* @__PURE__ */ new Set();
  resistorIds;
  currentIndex = 0;
  _step() {
    const supplyId = this.resistorIds[this.currentIndex++];
    this.solved = this.currentIndex >= this.resistorIds.length;
    if (!supplyId || !this.isResistor(supplyId)) return;
    const index = this.index;
    const nets = index.twoTerminalNets(supplyId);
    if (!nets) return;
    const rails = nets.filter((net) => index.isRail(net));
    if (rails.length !== 1) return;
    const supplyNet = rails[0];
    if (!this.positiveNets.has(supplyNet) || index.groundNets.has(supplyNet))
      return;
    const tap = nets.find((net) => net !== supplyNet);
    const tapPorts = index.portsByNet.get(tap) ?? [];
    const resistorIds = new Set(
      tapPorts.filter(
        (port) => index.components.get(port.source_component_id)?.ftype === "simple_resistor"
      ).map((port) => port.source_component_id)
    );
    if (resistorIds.size !== 2) return;
    const groundId = [...resistorIds].find((id) => id !== supplyId);
    if (!this.isResistor(groundId)) return;
    const groundNets = index.twoTerminalNets(groundId);
    const groundNet = groundNets?.find((net) => net !== tap);
    if (!groundNets?.includes(tap) || !groundNet || !index.groundNets.has(groundNet) || index.powerNets.has(groundNet) || !tapPorts.some((port) => !resistorIds.has(port.source_component_id)))
      return;
    const supply = index.placement(supplyId);
    const ground = index.placement(groundId);
    if (!supply || !ground || !index.sameLocalScope(supply, ground)) return;
    const supplyTap = this.getDownwardResistorPorts(supplyId, supplyNet, tap);
    const groundTap = this.getDownwardResistorPorts(groundId, tap, groundNet);
    if (!supplyTap || !groundTap) return;
    const reversedBodyGap = ground.schY - ground.height / 2 - (supply.schY + supply.height / 2);
    if (reversedBodyGap <= 1.5) return;
    this.params.issues.push({
      lineItemType: "VoltageDividerSupplyResistorBelowGroundResistor",
      supplyResistorSchematicBox: supply,
      groundResistorSchematicBox: ground,
      supplyTapSourcePortId: supplyTap.bottom.source_port_id,
      groundTapSourcePortId: groundTap.top.source_port_id,
      reversedBodyGap,
      message: `Place ${supply.sourceComponentName ?? supplyId} above ${ground.sourceComponentName ?? groundId}, close enough to read their shared divider tap. Preserve all connections and leave room for labels; exact alignment is not required.`
    });
  }
  isResistor(id) {
    const component = this.index.components.get(id);
    return component?.ftype === "simple_resistor" && Number.isFinite(component.resistance) && component.resistance > 0;
  }
  getDownwardResistorPorts(id, topNet, bottomNet) {
    const index = this.index;
    const placement = index.placement(id);
    const ports = index.portsByComponent.get(id);
    if (ports.some((port) => port.do_not_connect)) return;
    const top = ports.find(
      (port) => index.connected(port.source_port_id) === topNet
    );
    const bottom = ports.find(
      (port) => index.connected(port.source_port_id) === bottomNet
    );
    if (!top || !bottom) return;
    const topPin = index.port(top);
    const bottomPin = index.port(bottom);
    if (!topPin || !bottomPin || topPin.schematic_sheet_id !== placement.schematicSheetId || bottomPin.schematic_sheet_id !== placement.schematicSheetId || topPin.facing_direction !== "up" || bottomPin.facing_direction !== "down" || topPin.center.y <= bottomPin.center.y)
      return;
    return { top, bottom };
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(
      attrs,
      "supplyResistorName",
      issue.supplyResistorSchematicBox.sourceComponentName
    );
    addAttr(
      attrs,
      "groundResistorName",
      issue.groundResistorSchematicBox.sourceComponentName
    );
    addAttr(attrs, "reversedBodyGap", issue.reversedBodyGap);
    addAttr(attrs, "message", issue.message);
    return `<VoltageDividerSupplyResistorBelowGroundResistor ${attrs.join(" ")} />`;
  }
};

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/RegulatorInputOutputCapacitorPlacementSolver/RegulatorInputOutputCapacitorPlacementSolver.ts
import { BaseSolver as BaseSolver5 } from "@tscircuit/solver-utils";
var RegulatorInputOutputCapacitorPlacementSolver = class extends BaseSolver5 {
  constructor(params) {
    super();
    this.params = params;
    this.index = new PlacementNetworkIndex(params.ctx);
    this.hostIds = [...this.index.components.values()].filter((component) => component.ftype === "simple_chip").map((component) => component.source_component_id);
    this.solved = this.hostIds.length === 0;
  }
  params;
  index;
  hostIds;
  currentIndex = 0;
  _step() {
    const hostId = this.hostIds[this.currentIndex++];
    this.solved = this.currentIndex >= this.hostIds.length;
    if (!hostId) return;
    const index = this.index;
    const host = index.placement(hostId);
    const ports = index.portsByComponent.get(hostId) ?? [];
    if (!host || ports.some((port) => !portRole(port))) return;
    const inputs = ports.filter((port) => portRole(port) === "input");
    const outputs = ports.filter((port) => portRole(port) === "output");
    const grounds = ports.filter((port) => portRole(port) === "ground");
    if (inputs.length !== 1 || outputs.length !== 1 || !grounds.length) return;
    const input = inputs[0];
    const output = outputs[0];
    if ([input, output, ...grounds].some((port) => port.do_not_connect)) return;
    const inputNet = index.connected(input.source_port_id);
    const outputNet = index.connected(output.source_port_id);
    const groundNets = new Set(
      grounds.map((port) => index.connected(port.source_port_id))
    );
    if (groundNets.size !== 1) return;
    const groundNet = [...groundNets][0];
    if ((/* @__PURE__ */ new Set([inputNet, outputNet, groundNet])).size !== 3 || !(index.groundNets.has(groundNet) || grounds.some((port) => port.requires_ground || port.provides_ground)) || !(index.powerNets.has(inputNet) || input.requires_power) || !(index.powerNets.has(outputNet) || output.provides_power))
      return;
    const inputPin = index.port(input);
    const outputPin = index.port(output);
    if (!inputPin || !outputPin || inputPin.schematic_sheet_id !== host.schematicSheetId || outputPin.schematic_sheet_id !== host.schematicSheetId)
      return;
    const horizontal = inputPin.facing_direction === "left" && outputPin.facing_direction === "right" || inputPin.facing_direction === "right" && outputPin.facing_direction === "left";
    const vertical = inputPin.facing_direction === "up" && outputPin.facing_direction === "down" || inputPin.facing_direction === "down" && outputPin.facing_direction === "up";
    if (!horizontal && !vertical) return;
    const sign = outputPin.facing_direction === "right" || outputPin.facing_direction === "up" ? 1 : -1;
    const pinSeparation = sign * (horizontal ? outputPin.center.x - inputPin.center.x : outputPin.center.y - inputPin.center.y);
    if (pinSeparation <= 0.01) return;
    const inputCap = this.localCapacitor(host, inputNet, groundNet);
    const outputCap = this.localCapacitor(host, outputNet, groundNet);
    if (!inputCap || !outputCap) return;
    const beyondOppositeSide = (cap, side) => {
      const distance5 = side * sign * (horizontal ? cap.schX - host.schX : cap.schY - host.schY);
      const halfBodies = horizontal ? (host.width + cap.width) / 2 : (host.height + cap.height) / 2;
      return distance5 > halfBodies + 0.2;
    };
    if (!beyondOppositeSide(inputCap, 1) || !beyondOppositeSide(outputCap, -1))
      return;
    const name = host.sourceComponentName ?? hostId;
    this.params.issues.push({
      lineItemType: "RegulatorCapacitorsOnWrongSides",
      regulatorSchematicBox: host,
      inputCapacitorSchematicBox: inputCap,
      outputCapacitorSchematicBox: outputCap,
      inputSourcePortId: input.source_port_id,
      outputSourcePortId: output.source_port_id,
      message: `Place ${inputCap.sourceComponentName} near ${name}.${input.name} on the ${inputPin.facing_direction} side and ${outputCap.sourceComponentName} near ${name}.${output.name} on the ${outputPin.facing_direction} side. Preserve all connections and leave room for labels; exact alignment is not required.`
    });
  }
  localCapacitor(host, rail, ground) {
    const index = this.index;
    const candidates = [];
    const maxDistance = Math.max(6, 4 * Math.max(host.width, host.height));
    const ids = new Set(
      (index.portsByNet.get(rail) ?? []).map(
        (port) => port.source_component_id
      )
    );
    for (const id of ids) {
      if (index.components.get(id)?.ftype !== "simple_capacitor") continue;
      const nets = index.twoTerminalNets(id);
      const cap = index.placement(id);
      if (!nets?.includes(ground) || !cap || !index.sameLocalScope(host, cap))
        continue;
      if (Math.hypot(cap.schX - host.schX, cap.schY - host.schY) > maxDistance)
        continue;
      const ports = index.portsByComponent.get(id);
      if (ports.some(
        (port) => port.do_not_connect || !index.port(port) || index.port(port).schematic_sheet_id !== host.schematicSheetId
      ))
        continue;
      candidates.push(cap);
    }
    return candidates.length === 1 ? candidates[0] : void 0;
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(
      attrs,
      "regulatorName",
      issue.regulatorSchematicBox.sourceComponentName
    );
    addAttr(
      attrs,
      "inputCapacitorName",
      issue.inputCapacitorSchematicBox.sourceComponentName
    );
    addAttr(
      attrs,
      "outputCapacitorName",
      issue.outputCapacitorSchematicBox.sourceComponentName
    );
    addAttr(attrs, "message", issue.message);
    return `<RegulatorCapacitorsOnWrongSides ${attrs.join(" ")} />`;
  }
};
function portRole(port) {
  const roles = /* @__PURE__ */ new Set();
  for (const hint of [port.name, ...port.port_hints ?? []]) {
    const name = hint.toUpperCase().replace(/[ _-]/g, "");
    if (/^(?:VIN|IN|INPUT)$/.test(name)) roles.add("input");
    else if (/^(?:VOUT|OUT|OUTPUT)$/.test(name)) roles.add("output");
    else if (/^(?:GND\d*|VSS)$/.test(name)) roles.add("ground");
    else if (/^(?:EN|ENABLE|CE|SHDN|NC\d*|EP|PAD|ADJ|FB|BYP|BYPASS|NR|PG|PGOOD)$/.test(
      name
    ))
      roles.add("control");
  }
  return roles.size === 1 ? [...roles][0] : void 0;
}

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/ConnectorPlacementSolver/ConnectorPlacementSolver.ts
import { BaseSolver as BaseSolver6 } from "@tscircuit/solver-utils";

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/utils/geometry.ts
function centeredRect(cx, cy, w, h) {
  return {
    left: cx - w / 2,
    right: cx + w / 2,
    top: cy + h / 2,
    bottom: cy - h / 2
  };
}
function rectOverlap(a, b) {
  const ow = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const oh = Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom);
  return ow > 0 && oh > 0 ? { ow, oh } : null;
}

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/ConnectorPlacementSolver/ConnectorPlacementSolver.ts
var EPSILON4 = 0.01;
var directions = {
  right: { x: 1, y: 0 },
  left: { x: -1, y: 0 },
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 }
};
var dot = (a, b) => a.x * b.x + a.y * b.y;
var distance3 = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
var near = (a, b) => distance3(a, b) <= EPSILON4;
var round = (value) => Math.round(value * 100) / 100;
var ConnectorPlacementSolver = class extends BaseSolver6 {
  constructor(params) {
    super();
    this.params = params;
  }
  params;
  _step() {
    const { ctx, issues } = this.params;
    const index = new PlacementNetworkIndex(ctx);
    for (const ports of index.portsByComponent.values()) {
      for (const port of ports) {
        const net = index.connected(port.source_port_id);
        if (port.requires_ground || port.provides_ground)
          index.groundNets.add(net);
        if (port.requires_power || port.provides_power) index.powerNets.add(net);
      }
    }
    const allTraces = ctx.circuitJson.filter(
      (e) => e.type === "schematic_trace"
    );
    for (const [id, source] of index.components) {
      if (source.ftype !== "simple_pin_header" && source.ftype !== "simple_connector")
        continue;
      const connector = index.placement(id);
      const sourcePorts = index.portsByComponent.get(id) ?? [];
      if (!connector || sourcePorts.length < 2) continue;
      const pins = sourcePorts.map((p) => index.port(p));
      const facing = pins[0]?.facing_direction;
      if (!facing || pins.some((p) => !p || p.facing_direction !== facing))
        continue;
      const along = directions[facing];
      const across = { x: -along.y, y: along.x };
      const traces = allTraces.filter(
        (t) => t.schematic_sheet_id === connector.schematicSheetId
      );
      const railLabels = ctx.circuitJson.filter(
        (e) => e.type === "schematic_net_label" && e.schematic_sheet_id === connector.schematicSheetId
      );
      const connections = [];
      let ambiguous = false;
      for (const sourcePort of sourcePorts) {
        const pin = index.port(sourcePort);
        const net = index.connected(sourcePort.source_port_id);
        const peers = (index.portsByNet.get(net) ?? []).filter(
          (p) => p.source_port_id !== sourcePort.source_port_id
        );
        const incidentTraces = traces.filter(
          (t) => t.edges.some(
            (edge) => near(edge.from, pin.center) || near(edge.to, pin.center)
          )
        );
        if (index.isRail(net)) {
          if (incidentTraces.some(
            (t) => !railLabels.some(
              (label) => label.anchor_position && joins(t, pin.center, label.anchor_position)
            )
          ))
            ambiguous = true;
          continue;
        }
        if (peers.length === 0) {
          if (incidentTraces.length > 0) ambiguous = true;
          continue;
        }
        const peer = peers.length === 1 ? index.port(peers[0]) : void 0;
        const component = peers.length === 1 ? index.placement(peers[0].source_component_id) : void 0;
        if (!peer?.facing_direction || !component || !index.sameLocalScope(connector, component) || dot(directions[peer.facing_direction], along) !== -1) {
          ambiguous = true;
          break;
        }
        connections.push({ pin, peer, component });
      }
      if (ambiguous || connections.length < 2) continue;
      if (connections.some(
        (c) => dot(c.peer.center, along) >= dot(c.pin.center, along) - 2
      ))
        continue;
      const detouredConnections = connections.map(
        (c) => traces.filter(
          (t) => joins(t, c.pin.center, c.peer.center) && bendCount(t) >= 3
        )
      ).filter((t) => t.length > 0);
      if (detouredConnections.length < 2) continue;
      const detours = detouredConnections.flat();
      const ordered = [...connections].sort(
        (a, b) => dot(a.pin.center, across) - dot(b.pin.center, across)
      );
      if (ordered.some(
        (c, i) => i > 0 && dot(c.peer.center, across) <= dot(ordered[i - 1].peer.center, across) + EPSILON4
      ))
        continue;
      const center = { x: connector.schX, y: connector.schY };
      const pinOffset = Math.max(
        ...connections.map(
          (c) => dot(c.pin.center, along) - dot(center, along)
        )
      );
      const targetAlong = Math.min(...connections.map((c) => dot(c.peer.center, along))) - 2 - pinOffset;
      const offsets = connections.map(
        (c) => dot(c.peer.center, across) - dot(c.pin.center, across) + dot(center, across)
      ).sort((a, b) => a - b);
      const targetAcross = offsets[Math.floor(offsets.length / 2)];
      const target = {
        x: round(along.x * targetAlong + across.x * targetAcross),
        y: round(along.y * targetAlong + across.y * targetAcross)
      };
      const delta = { x: target.x - center.x, y: target.y - center.y };
      const movedPin = (pin) => ({
        x: pin.center.x + delta.x,
        y: pin.center.y + delta.y
      });
      if (connections.some(
        (c) => distance3(movedPin(c.pin), c.peer.center) > distance3(c.pin.center, c.peer.center) + EPSILON4
      ))
        continue;
      const before = connections.reduce(
        (sum, c) => sum + distance3(c.pin.center, c.peer.center),
        0
      );
      const after = connections.reduce(
        (sum, c) => sum + distance3(movedPin(c.pin), c.peer.center),
        0
      );
      if (before - after < 4 || after > before * 0.75) continue;
      const obstacles = ctx.componentPlacements.filter(
        (p) => p.schematicSheetId === connector.schematicSheetId && p.schematicComponentId !== connector.schematicComponentId
      );
      const targetBounds = centeredRect(
        target.x,
        target.y,
        connector.width + 0.4,
        connector.height + 0.4
      );
      if (obstacles.some(
        (p) => rectOverlap(
          targetBounds,
          centeredRect(p.schX, p.schY, p.width, p.height)
        )
      ))
        continue;
      if (connections.some((c) => {
        const start = movedPin(c.pin);
        const end = c.peer.center;
        const middleAlong = (dot(start, along) + dot(end, along)) / 2;
        const points = [
          start,
          {
            x: along.x * middleAlong + across.x * dot(start, across),
            y: along.y * middleAlong + across.y * dot(start, across)
          },
          {
            x: along.x * middleAlong + across.x * dot(end, across),
            y: along.y * middleAlong + across.y * dot(end, across)
          },
          end
        ];
        return obstacles.some(
          (p) => p.schematicComponentId !== c.component.schematicComponentId && points.slice(1).some((point2, i) => segmentCrossesBox(points[i], point2, p))
        );
      }))
        continue;
      const connectedComponents = [
        ...new Map(
          connections.map((c) => [
            c.component.schematicComponentId,
            c.component
          ])
        ).values()
      ];
      const name = connector.sourceComponentName ?? connector.schematicComponentId;
      issues.push({
        lineItemType: "ConnectorPositionCausesTraceDetours",
        connectorSchematicBox: connector,
        connectedComponents,
        schematicTraceIds: [
          ...new Set(detours.map((t) => t.schematic_trace_id))
        ],
        evaluatedSignalCount: connections.length,
        newSchX: target.x,
        newSchY: target.y,
        deltaSchX: round(delta.x),
        deltaSchY: round(delta.y),
        currentTotalSignalDistance: round(before),
        suggestedTotalSignalDistance: round(after),
        message: `Move ${name} to schX=${target.x}, schY=${target.y} so its signal pins face ${connectedComponents.map((p) => p.sourceComponentName ?? p.schematicComponentId).join(", ")}. Preserve rotation and pin assignments; reroute the connections and attached rail labels.`
      });
    }
    this.solved = true;
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(
      attrs,
      "connectorComponentName",
      issue.connectorSchematicBox.sourceComponentName
    );
    addAttr(
      attrs,
      "connectedComponents",
      issue.connectedComponents.map((p) => p.sourceComponentName ?? p.schematicComponentId).join(",")
    );
    for (const key of [
      "evaluatedSignalCount",
      "newSchX",
      "newSchY",
      "deltaSchX",
      "deltaSchY",
      "currentTotalSignalDistance",
      "suggestedTotalSignalDistance"
    ])
      addAttr(attrs, key, issue[key]);
    addAttr(attrs, "message", issue.message);
    return `<ConnectorPositionCausesTraceDetours ${attrs.join(" ")} />`;
  }
};
function joins(trace, a, b) {
  const first = trace.edges[0]?.from;
  const last = trace.edges.at(-1)?.to;
  return !!first && !!last && (near(first, a) && near(last, b) || near(first, b) && near(last, a));
}
function bendCount(trace) {
  let previousAxis;
  let bends = 0;
  for (let i = 0; i < trace.edges.length; i++) {
    const edge = trace.edges[i];
    if (i > 0 && !near(trace.edges[i - 1].to, edge.from)) return 0;
    if (near(edge.from, edge.to)) continue;
    const axis = Math.abs(edge.from.y - edge.to.y) < EPSILON4 ? "x" : Math.abs(edge.from.x - edge.to.x) < EPSILON4 ? "y" : void 0;
    if (!axis) return 0;
    if (previousAxis && previousAxis !== axis) bends++;
    previousAxis = axis;
  }
  return bends;
}
function segmentCrossesBox(a, b, box) {
  const bounds = centeredRect(
    box.schX,
    box.schY,
    box.width + 0.2,
    box.height + 0.2
  );
  return Math.max(a.x, b.x) > bounds.left && Math.min(a.x, b.x) < bounds.right && Math.max(a.y, b.y) > bounds.bottom && Math.min(a.y, b.y) < bounds.top;
}

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/LowSideTransistorPlacementSolver/LowSideTransistorPlacementSolver.ts
import { BaseSolver as BaseSolver7 } from "@tscircuit/solver-utils";
var LowSideTransistorPlacementSolver = class extends BaseSolver7 {
  index;
  positiveNets = /* @__PURE__ */ new Set();
  transistorIds;
  issues;
  currentIndex = 0;
  constructor({
    ctx,
    issues
  }) {
    super();
    this.issues = issues;
    this.index = new PlacementNetworkIndex(ctx);
    for (const element of ctx.circuitJson) {
      if (element.type === "source_net" && element.is_positive_voltage_source)
        this.positiveNets.add(this.index.connected(element.source_net_id));
    }
    this.transistorIds = [...this.index.components.values()].filter(
      (component) => component.ftype === "simple_transistor" && component.transistor_type === "npn"
    ).map((component) => component.source_component_id);
    this.solved = this.transistorIds.length === 0;
  }
  _step() {
    const id = this.transistorIds[this.currentIndex++];
    this.solved = this.currentIndex >= this.transistorIds.length;
    if (!id) return;
    const index = this.index;
    const transistor = index.placement(id);
    if (!transistor || index.portsByComponent.get(id)?.length !== 3) return;
    const base = index.namedPort(id, "base");
    const collector = index.namedPort(id, "collector");
    const emitter = index.namedPort(id, "emitter");
    if (!base || !collector || !emitter) return;
    const baseNet = index.connected(base.source_port_id);
    const collectorNet = index.connected(collector.source_port_id);
    const emitterNet = index.connected(emitter.source_port_id);
    if ((/* @__PURE__ */ new Set([baseNet, collectorNet, emitterNet])).size !== 3 || !index.groundNets.has(emitterNet) || index.powerNets.has(emitterNet) || index.isRail(baseNet) || index.isRail(collectorNet))
      return;
    const basePeers = (index.portsByNet.get(baseNet) ?? []).filter(
      (port) => port.source_component_id !== id
    );
    if (basePeers.length !== 1) return;
    const resistorId = basePeers[0].source_component_id;
    const resistor = index.components.get(resistorId);
    const baseResistor = index.placement(resistorId);
    const resistorNets = index.twoTerminalNets(resistorId);
    const inputNet = resistorNets?.find((net) => net !== baseNet);
    if (resistor?.ftype !== "simple_resistor" || resistor.resistance <= 0 || !baseResistor || !index.sameLocalScope(transistor, baseResistor) || !inputNet || index.isRail(inputNet) || inputNet === collectorNet)
      return;
    const collectorPeers = (index.portsByNet.get(collectorNet) ?? []).filter(
      (port) => port.source_component_id !== id
    );
    const loadPeers = collectorPeers.filter((port) => {
      const type = index.components.get(port.source_component_id)?.ftype;
      return type === "simple_chip";
    });
    if (loadPeers.length !== 1) return;
    const loadId = loadPeers[0].source_component_id;
    const load = index.placement(loadId);
    const loadNets = index.twoTerminalNets(loadId);
    const supplyNet = loadNets?.find((net) => net !== collectorNet);
    if (!load || !index.sameLocalScope(transistor, load) || !supplyNet || !this.positiveNets.has(supplyNet) || index.groundNets.has(supplyNet))
      return;
    const clampPeers = collectorPeers.filter(
      (port) => port.source_component_id !== loadId
    );
    if (clampPeers.length !== 1) return;
    const clampId = clampPeers[0].source_component_id;
    const clamp2 = index.placement(clampId);
    const anode = index.namedPort(clampId, "anode");
    const cathode = index.namedPort(clampId, "cathode");
    if (index.components.get(clampId)?.ftype !== "simple_diode" || !index.twoTerminalNets(clampId) || !anode || !cathode || index.connected(anode.source_port_id) !== collectorNet || index.connected(cathode.source_port_id) !== supplyNet || !clamp2 || !index.sameLocalScope(transistor, clamp2))
      return;
    const collectorPin = index.port(collector);
    const emitterPin = index.port(emitter);
    const basePin = index.port(base);
    if (!collectorPin || !emitterPin || !basePin) return;
    const collectorFacingDirection = collectorPin.facing_direction;
    const emitterFacingDirection = emitterPin.facing_direction;
    if (!collectorFacingDirection || !emitterFacingDirection) return;
    const placementProblems = [];
    if (transistor.schY >= load.schY)
      placementProblems.push("transistor_not_below_load");
    if (collectorFacingDirection !== "up")
      placementProblems.push("collector_not_up");
    if (emitterFacingDirection !== "down")
      placementProblems.push("emitter_not_down");
    if (placementProblems.length === 0) return;
    const name = transistor.sourceComponentName ?? id;
    const loadName = load.sourceComponentName ?? loadId;
    this.issues.push({
      lineItemType: "LowSideTransistorNotAlignedWithLoad",
      transistorSchematicBox: transistor,
      loadSchematicBox: load,
      baseResistorSchematicBox: baseResistor,
      clampDiodeSchematicBox: clamp2,
      collectorSourcePortId: collector.source_port_id,
      emitterSourcePortId: emitter.source_port_id,
      collectorFacingDirection,
      emitterFacingDirection,
      placementProblems,
      message: `Arrange ${name} below ${loadName}, with its collector facing up toward the load and emitter facing down toward ground; place ${baseResistor.sourceComponentName ?? resistorId} beside the base. Preserve all pin connections and reroute affected traces.`
    });
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(
      attrs,
      "transistorName",
      issue.transistorSchematicBox.sourceComponentName
    );
    addAttr(attrs, "loadName", issue.loadSchematicBox.sourceComponentName);
    addAttr(
      attrs,
      "baseResistorName",
      issue.baseResistorSchematicBox.sourceComponentName
    );
    addAttr(
      attrs,
      "clampDiodeName",
      issue.clampDiodeSchematicBox.sourceComponentName
    );
    addAttr(attrs, "placementProblems", issue.placementProblems.join(","));
    addAttr(attrs, "collectorFacingDirection", issue.collectorFacingDirection);
    addAttr(attrs, "emitterFacingDirection", issue.emitterFacingDirection);
    addAttr(attrs, "message", issue.message);
    return `<LowSideTransistorNotAlignedWithLoad ${attrs.join(" ")} />`;
  }
};

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/UsbSeriesResistorPlacementSolver/UsbSeriesResistorPlacementSolver.ts
import { BaseSolver as BaseSolver8 } from "@tscircuit/solver-utils";
var UsbSeriesResistorPlacementSolver = class extends BaseSolver8 {
  constructor(params) {
    super();
    this.params = params;
    this.index = new PlacementNetworkIndex(params.ctx);
    this.hostIds = [...this.index.components.values()].filter((component) => component.ftype === "simple_chip").map((component) => component.source_component_id);
    this.solved = this.hostIds.length === 0;
  }
  params;
  index;
  hostIds;
  reportedPairs = /* @__PURE__ */ new Set();
  currentIndex = 0;
  _step() {
    const hostId = this.hostIds[this.currentIndex++];
    this.solved = this.currentIndex >= this.hostIds.length;
    if (!hostId) return;
    const ports = this.index.portsByComponent.get(hostId) ?? [];
    const positivePorts = ports.filter((port) => usbRole(port) === "positive");
    const negativePorts = ports.filter((port) => usbRole(port) === "negative");
    if (positivePorts.length !== 1 || negativePorts.length !== 1) return;
    const positivePort = positivePorts[0];
    const negativePort = negativePorts[0];
    const positive2 = this.seriesResistor(positivePort);
    const negative = this.seriesResistor(negativePort);
    if (!positive2 || !negative || positive2.axis !== negative.axis || !this.index.sameLocalScope(positive2.placement, negative.placement) || (/* @__PURE__ */ new Set([
      positive2.hostNet,
      negative.hostNet,
      positive2.interfaceNet,
      negative.interfaceNet
    ])).size !== 4 || !this.shareInterface(positive2, negative, hostId))
      return;
    const pairKey = [positive2.id, negative.id].sort().join("\0");
    if (this.reportedPairs.has(pairKey)) return;
    const a = positive2.placement;
    const b = negative.placement;
    const horizontal = positive2.axis === "horizontal";
    const along = Math.abs(horizontal ? a.schX - b.schX : a.schY - b.schY);
    const across = Math.abs(horizontal ? a.schY - b.schY : a.schX - b.schX);
    const alongA = horizontal ? a.width : a.height;
    const alongB = horizontal ? b.width : b.height;
    const acrossA = horizontal ? a.height : a.width;
    const acrossB = horizontal ? b.height : b.width;
    const bodyGap2 = along - (alongA + alongB) / 2;
    if (bodyGap2 < Math.max(alongA, alongB) || across >= (acrossA + acrossB) / 2 - 0.01)
      return;
    this.reportedPairs.add(pairKey);
    const positiveName = a.sourceComponentName ?? positive2.id;
    const negativeName = b.sourceComponentName ?? negative.id;
    this.params.issues.push({
      lineItemType: "UsbSeriesResistorsNotAligned",
      positiveResistorSchematicBox: a,
      negativeResistorSchematicBox: b,
      hostSourceComponentId: hostId,
      positiveSourcePortId: positivePort.source_port_id,
      negativeSourcePortId: negativePort.source_port_id,
      signalAxis: positive2.axis,
      message: `Place ${positiveName} (D+) and ${negativeName} (D\u2212) near each other and draw clear traces to their corresponding USB ports. Exact alignment is not required; preserve pin assignments and leave space for labels.`
    });
  }
  seriesResistor(hostPort) {
    const index = this.index;
    const hostNet = index.connected(hostPort.source_port_id);
    if (index.isRail(hostNet)) return;
    const candidates = new Set(
      (index.portsByNet.get(hostNet) ?? []).filter(
        (port) => index.components.get(port.source_component_id)?.ftype === "simple_resistor"
      ).map((port) => port.source_component_id)
    );
    if (candidates.size !== 1) return;
    const id = [...candidates][0];
    const nets = index.twoTerminalNets(id);
    const interfaceNet = nets?.find((net) => net !== hostNet);
    const placement = index.placement(id);
    if (!interfaceNet || index.isRail(interfaceNet) || !placement) return;
    if ((index.portsByNet.get(interfaceNet) ?? []).some(
      (port) => port.source_component_id !== id && index.components.get(port.source_component_id)?.ftype === "simple_resistor"
    ))
      return;
    const pins = index.portsByComponent.get(id).map((port) => index.port(port));
    const [first, second] = pins;
    if (!first || !second) return;
    const facing = /* @__PURE__ */ new Set([first.facing_direction, second.facing_direction]);
    let axis;
    if (facing.has("left") && facing.has("right") && Math.abs(first.center.y - second.center.y) < 0.01)
      axis = "horizontal";
    else if (facing.has("up") && facing.has("down") && Math.abs(first.center.x - second.center.x) < 0.01)
      axis = "vertical";
    else return;
    return { id, placement, hostNet, interfaceNet, axis };
  }
  shareInterface(positive2, negative, hostId) {
    const peerIds = (net) => new Set(
      (this.index.portsByNet.get(net) ?? []).map((port) => port.source_component_id).filter(
        (id) => id !== hostId && id !== positive2.id && id !== negative.id && (this.index.portsByComponent.get(id)?.length ?? 0) > 2
      )
    );
    const positivePeers = peerIds(positive2.interfaceNet);
    return [...peerIds(negative.interfaceNet)].some(
      (id) => positivePeers.has(id)
    );
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(
      attrs,
      "positiveResistorName",
      issue.positiveResistorSchematicBox.sourceComponentName
    );
    addAttr(
      attrs,
      "negativeResistorName",
      issue.negativeResistorSchematicBox.sourceComponentName
    );
    addAttr(attrs, "signalAxis", issue.signalAxis);
    addAttr(attrs, "message", issue.message);
    return `<UsbSeriesResistorsNotAligned ${attrs.join(" ")} />`;
  }
};
function usbRole(port) {
  const roles = /* @__PURE__ */ new Set();
  for (const hint of [port.name, ...port.port_hints ?? []]) {
    const name = hint.toUpperCase();
    if (/^(?:USB_?)?D(?:P|\+|_POS)$/.test(name)) roles.add("positive");
    if (/^(?:USB_?)?D(?:M|N|-|_NEG)$/.test(name)) roles.add("negative");
  }
  return roles.size === 1 ? [...roles][0] : void 0;
}

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/CapacitorOrientationSolver/CapacitorOrientationSolver.ts
import { BaseSolver as BaseSolver9 } from "@tscircuit/solver-utils";

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/utils/graphics.ts
import { mergeGraphics } from "graphics-debug";
function mergeGraphicsObjects(objects) {
  return objects.filter((o) => o !== void 0).reduce((acc, o) => mergeGraphics(acc, o), {});
}
function highlightPlacement(placement, color, label) {
  return {
    rects: [
      {
        center: { x: placement.schX, y: placement.schY },
        width: placement.width,
        height: placement.height,
        stroke: color,
        fill: color.replace("0.95", "0.15"),
        label
      }
    ]
  };
}
function visualizeCircuitJson(circuitJson) {
  const rects = circuitJson.filter((el) => el.type === "schematic_box").map((el) => {
    const box = el;
    return {
      center: { x: box.x, y: box.y },
      width: box.width,
      height: box.height,
      stroke: "hsl(0,0%,60%)"
    };
  });
  return { rects };
}

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/CapacitorOrientationSolver/CapacitorOrientationSolver.ts
var CapacitorOrientationSolver = class _CapacitorOrientationSolver extends BaseSolver9 {
  static EPSILON = 0.01;
  static ORIENTATION_MESSAGE = 'Use schOrientation="vertical" on this capacitor to fix the symbol orientation';
  ctx;
  out;
  schematicComponentById;
  sourceComponentById;
  capacitorPlacements;
  feedbackCapacitorIds;
  currentPlacementIndex = 0;
  horizontalSymbolNames = /* @__PURE__ */ new Set([
    "capacitor_left",
    "capacitor_right"
  ]);
  constructor({
    ctx,
    issues: out
  }) {
    super();
    this.ctx = ctx;
    this.out = out;
    this.schematicComponentById = this.buildSchematicComponentById(
      ctx.circuitJson
    );
    this.sourceComponentById = this.buildSourceComponentById(ctx.circuitJson);
    this.capacitorPlacements = this.getCapacitorPlacements();
    const networks = new PlacementNetworkIndex(ctx);
    this.feedbackCapacitorIds = new Set(
      this.capacitorPlacements.flatMap(
        (capacitor) => capacitor.sourceComponentId && networks.isDirectOpAmpFeedback(capacitor.sourceComponentId) ? [capacitor.sourceComponentId] : []
      )
    );
    this.solved = this.capacitorPlacements.length === 0;
  }
  getCapacitorPlacements() {
    return this.ctx.componentPlacements.filter(
      (p) => p.sourceComponentId !== void 0 && this.sourceComponentById.get(p.sourceComponentId)?.ftype === "simple_capacitor"
    ).map((p) => ({
      schX: p.schX,
      schY: p.schY,
      width: p.width,
      height: p.height,
      sourceComponentId: p.sourceComponentId,
      sourceComponentName: p.sourceComponentName,
      schematicComponentId: p.schematicComponentId,
      schematicSheetId: p.schematicSheetId,
      schematicSheetName: p.schematicSheetName
    }));
  }
  _step() {
    const currentPlacement = this.capacitorPlacements[this.currentPlacementIndex];
    if (!currentPlacement) {
      this.solved = true;
      return;
    }
    this.currentPlacementIndex += 1;
    this.solved = this.currentPlacementIndex >= this.capacitorPlacements.length;
    const issue = this.getIssueForPlacement(currentPlacement);
    if (issue) this.out.push(issue);
  }
  visualize() {
    const focusedPlacement = this.getFocusedPlacement();
    return mergeGraphicsObjects([
      visualizeCircuitJson(this.ctx.circuitJson),
      focusedPlacement ? highlightPlacement(
        focusedPlacement,
        "hsl(210, 100%, 50%, 0.95)",
        "capacitorOrientation"
      ) : void 0
    ]);
  }
  getFocusedPlacement() {
    if (this.capacitorPlacements.length === 0) return void 0;
    const index = this.iterations === 0 ? this.currentPlacementIndex : Math.max(0, this.currentPlacementIndex - 1);
    return this.capacitorPlacements[index];
  }
  buildSchematicComponentById(circuitJson) {
    return new Map(
      circuitJson.filter(
        (el) => el.type === "schematic_component"
      ).map((sc) => [sc.schematic_component_id, sc])
    );
  }
  buildSourceComponentById(circuitJson) {
    return new Map(
      circuitJson.flatMap((el) => {
        if (el.type !== "source_component" || !("source_component_id" in el) || typeof el.source_component_id !== "string")
          return [];
        return [
          {
            type: "source_component",
            source_component_id: el.source_component_id,
            ftype: "ftype" in el && typeof el.ftype === "string" ? el.ftype : void 0
          }
        ];
      }).map((sc) => [sc.source_component_id, sc])
    );
  }
  createIssuePlacement(placement) {
    return {
      positionAnchor: "center",
      schX: placement.schX,
      schY: placement.schY,
      width: placement.width,
      height: placement.height,
      sourceComponentId: placement.sourceComponentId,
      sourceComponentName: placement.sourceComponentName,
      schematicComponentId: placement.schematicComponentId,
      schematicSheetId: placement.schematicSheetId,
      schematicSheetName: placement.schematicSheetName
    };
  }
  getIssueForPlacement(placement) {
    if (!placement.schematicComponentId || !placement.sourceComponentId) return;
    const schematicComponent = this.schematicComponentById.get(
      placement.schematicComponentId
    );
    if (!schematicComponent) return;
    if (!this.horizontalSymbolNames.has(schematicComponent.symbol_name ?? ""))
      return;
    if (this.feedbackCapacitorIds.has(placement.sourceComponentId)) return;
    if (this.isInlineWithHorizontalTraces(placement.schematicComponentId))
      return;
    return {
      lineItemType: "CapacitorSymbolHorizontal",
      schematicBox: this.createIssuePlacement(placement),
      message: _CapacitorOrientationSolver.ORIENTATION_MESSAGE
    };
  }
  isInlineWithHorizontalTraces(schematicComponentId) {
    const ports = this.ctx.circuitJson.filter(
      (element) => element.type === "schematic_port" && element.schematic_component_id === schematicComponentId
    );
    if (ports.length !== 2) return false;
    const traces = ports.map((port) => this.getOutwardHorizontalTrace(port));
    return traces.every((trace) => trace !== void 0) && traces.some(
      (trace) => trace !== void 0 && trace.edges.every(
        (edge) => Math.abs(edge.from.y - edge.to.y) <= _CapacitorOrientationSolver.EPSILON
      )
    );
  }
  getOutwardHorizontalTrace(port) {
    if (port.facing_direction !== "left" && port.facing_direction !== "right")
      return;
    return this.ctx.circuitJson.find(
      (element) => element.type === "schematic_trace" && element.schematic_sheet_id === port.schematic_sheet_id && element.edges.some((edge) => {
        const other = this.pointsEqual(edge.from, port.center) ? edge.to : this.pointsEqual(edge.to, port.center) ? edge.from : void 0;
        return other !== void 0 && Math.abs(other.y - port.center.y) <= _CapacitorOrientationSolver.EPSILON && (port.facing_direction === "left" ? other.x < port.center.x - _CapacitorOrientationSolver.EPSILON : other.x > port.center.x + _CapacitorOrientationSolver.EPSILON);
      })
    );
  }
  pointsEqual(first, second) {
    return Math.abs(first.x - second.x) <= _CapacitorOrientationSolver.EPSILON && Math.abs(first.y - second.y) <= _CapacitorOrientationSolver.EPSILON;
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(attrs, "componentName", issue.schematicBox.sourceComponentName);
    addAttr(attrs, "schX", issue.schematicBox.schX);
    addAttr(attrs, "schY", issue.schematicBox.schY);
    addAttr(attrs, "width", issue.schematicBox.width);
    addAttr(attrs, "height", issue.schematicBox.height);
    addAttr(attrs, "message", issue.message);
    return `<CapacitorSymbolHorizontal ${attrs.join(" ")} />`;
  }
};

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/DecouplingCapacitorGroupingSolver/DecouplingCapacitorGroupingSolver.ts
import { BaseSolver as BaseSolver10 } from "@tscircuit/solver-utils";
var DecouplingCapacitorGroupingSolver = class _DecouplingCapacitorGroupingSolver extends BaseSolver10 {
  constructor(params) {
    super();
    this.params = params;
    const index = new PlacementNetworkIndex(params.ctx);
    const powerNets = new Set(index.powerNets);
    const groundNets = new Set(index.groundNets);
    for (const element of params.ctx.circuitJson) {
      if (element.type === "source_net") {
        const net = index.connected(element.source_net_id);
        if (!this.netNames.has(net)) this.netNames.set(net, element.name);
      }
    }
    for (const ports of index.portsByComponent.values()) {
      for (const port of ports) {
        if (port.do_not_connect) continue;
        const net = index.connected(port.source_port_id);
        if (port.provides_power || port.requires_power) powerNets.add(net);
        if (port.provides_ground || port.requires_ground) groundNets.add(net);
        if ((powerNets.has(net) || groundNets.has(net)) && !this.netNames.has(net))
          this.netNames.set(net, port.name);
      }
    }
    for (const component of index.components.values()) {
      if (component.ftype !== "simple_capacitor") continue;
      const id = component.source_component_id;
      const placement = index.placement(id);
      const nets = index.twoTerminalNets(id);
      const ports = index.portsByComponent.get(id);
      if (!placement || !nets || !ports || ports.some((port) => {
        const schematicPort = index.port(port);
        return port.do_not_connect || !schematicPort || schematicPort.schematic_sheet_id !== placement.schematicSheetId;
      }))
        continue;
      const power = nets.find(
        (net) => powerNets.has(net) && !groundNets.has(net)
      );
      const ground = nets.find(
        (net) => groundNets.has(net) && !powerNets.has(net)
      );
      if (!power || !ground) continue;
      const bank = this.banks.find(
        (candidate) => candidate.power === power && candidate.ground === ground && index.sameLocalScope(candidate.capacitors[0], placement)
      );
      if (bank) bank.capacitors.push(placement);
      else this.banks.push({ power, ground, capacitors: [placement] });
    }
    this.solved = this.banks.length === 0;
  }
  params;
  // Schematic readability heuristic, measured between component bounds.
  // Larger symbols get proportionally more room; PCB distances do not apply.
  static MIN_BODY_GAP = 4;
  banks = [];
  netNames = /* @__PURE__ */ new Map();
  bankIndex = 0;
  _step() {
    const bank = this.banks[this.bankIndex++];
    this.solved = this.bankIndex >= this.banks.length;
    if (bank.capacitors.length < 2) return;
    const maxRecommendedBodyGap = Math.max(
      _DecouplingCapacitorGroupingSolver.MIN_BODY_GAP,
      ...bank.capacitors.map((box) => 3 * Math.max(box.width, box.height))
    );
    let maxBodyGap = 0;
    for (let i = 0; i < bank.capacitors.length; i++) {
      for (const b of bank.capacitors.slice(i + 1)) {
        const a = bank.capacitors[i];
        const gap = Math.hypot(
          Math.max(0, Math.abs(a.schX - b.schX) - (a.width + b.width) / 2),
          Math.max(0, Math.abs(a.schY - b.schY) - (a.height + b.height) / 2)
        );
        maxBodyGap = Math.max(maxBodyGap, gap);
      }
    }
    if (maxBodyGap <= maxRecommendedBodyGap + 1e-6) return;
    const railName = this.netNames.get(bank.power) ?? bank.power;
    const groundName = this.netNames.get(bank.ground) ?? bank.ground;
    this.params.issues.push({
      lineItemType: "DecouplingCapacitorsNotCloseTogether",
      railName,
      groundName,
      capacitorSchematicBoxes: bank.capacitors,
      maxBodyGap,
      maxRecommendedBodyGap,
      message: `Group the decoupling capacitors between ${railName} and ${groundName} closer together in this schematic block. Preserve their net connections.`
    });
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(attrs, "rail", issue.railName);
    addAttr(attrs, "ground", issue.groundName);
    addAttr(
      attrs,
      "capacitorNames",
      issue.capacitorSchematicBoxes.map((box) => box.sourceComponentName ?? box.schematicComponentId).join(", ")
    );
    addAttr(attrs, "maxBodyGap", issue.maxBodyGap);
    addAttr(attrs, "maxRecommendedBodyGap", issue.maxRecommendedBodyGap);
    addAttr(attrs, "message", issue.message);
    return `<DecouplingCapacitorsNotCloseTogether ${attrs.join(" ")} />`;
  }
};

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/utils/net-label-bounds.ts
function getNetLabelBounds(label) {
  const anchorSide = label.anchor_side;
  const isVertical = anchorSide === "top" || anchorSide === "bottom";
  if (isVertical) {
    const anchorY = label.anchor_position?.y ?? label.center.y;
    const textHalfExtent = (label.text?.length ?? 8) * 0.13 / 2 + 0.1;
    const left = label.center.x - 0.1;
    const right = label.center.x + 0.1;
    if (anchorSide === "top") {
      return {
        left,
        right,
        top: anchorY,
        bottom: anchorY - textHalfExtent * 2
      };
    }
    return { left, right, top: anchorY + textHalfExtent * 2, bottom: anchorY };
  }
  const anchorX = label.anchor_position?.x ?? label.center.x;
  const halfWidth = Math.abs(label.center.x - anchorX);
  const farHalfWidth = halfWidth + 0.1;
  const top = label.center.y + 0.1;
  const bottom = label.center.y - 0.1;
  if (label.center.x >= anchorX) {
    return {
      left: anchorX,
      right: label.center.x + farHalfWidth,
      top,
      bottom
    };
  }
  return { left: label.center.x - farHalfWidth, right: anchorX, top, bottom };
}

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/ComponentNetLabelCollisionSolver/ComponentNetLabelCollisionSolver.ts
import { BaseSolver as BaseSolver11 } from "@tscircuit/solver-utils";
var ComponentNetLabelCollisionSolver = class extends BaseSolver11 {
  constructor(params) {
    super();
    this.params = params;
    this.placements = params.ctx.componentPlacements;
    this.netLabelsByComponentId = this.buildNetLabelsByComponentId(
      params.ctx.circuitJson
    );
    this.solved = this.placements.length < 2;
  }
  params;
  placements;
  netLabelsByComponentId;
  rawCollisions = [];
  firstIndex = 0;
  secondIndex = 1;
  _step() {
    if (this.firstIndex >= this.placements.length - 1) {
      this.buildAndPushIssues();
      this.solved = true;
      return;
    }
    const compA = this.placements[this.firstIndex];
    const compB = this.placements[this.secondIndex];
    this.detectPair(compA, compB);
    this.secondIndex++;
    if (this.secondIndex >= this.placements.length) {
      this.firstIndex++;
      this.secondIndex = this.firstIndex + 1;
    }
  }
  detectPair(compA, compB) {
    if (compA.schematicSheetId !== compB.schematicSheetId) return;
    this.rawCollisions.push(...this.detectLabelLabel(compA, compB));
    this.rawCollisions.push(...this.detectBoxLabel(compA, compB));
    this.rawCollisions.push(...this.detectBoxLabel(compB, compA));
  }
  detectLabelLabel(firstComponent, secondComponent) {
    let leftComp = firstComponent;
    let rightComp = secondComponent;
    if (firstComponent.schX > secondComponent.schX) {
      leftComp = secondComponent;
      rightComp = firstComponent;
    }
    const leftId = leftComp.schematicComponentId;
    const rightId = rightComp.schematicComponentId;
    if (!leftId || !rightId) return [];
    const leftLabels = this.netLabelsByComponentId.get(leftId) ?? [];
    const rightLabels = this.netLabelsByComponentId.get(rightId) ?? [];
    if (leftLabels.length === 0 || rightLabels.length === 0) return [];
    const hits = [];
    for (const leftLabel of leftLabels) {
      for (const rightLabel of rightLabels) {
        const leftBounds = getNetLabelBounds(leftLabel);
        const rightBounds = getNetLabelBounds(rightLabel);
        if (rectOverlap(leftBounds, rightBounds)) {
          hits.push({
            type: "label-label",
            bounds: {
              left: Math.max(leftBounds.left, rightBounds.left),
              right: Math.min(leftBounds.right, rightBounds.right),
              top: Math.min(leftBounds.top, rightBounds.top),
              bottom: Math.max(leftBounds.bottom, rightBounds.bottom)
            },
            leftComp,
            rightComp,
            leftId,
            rightId,
            xSeparation: leftBounds.right - rightBounds.left + 0.1
          });
        }
      }
    }
    return hits;
  }
  detectBoxLabel(boxComp, labelComp) {
    const boxId = boxComp.schematicComponentId;
    const labelId = labelComp.schematicComponentId;
    if (!boxId || !labelId) return [];
    const labels = this.netLabelsByComponentId.get(labelId) ?? [];
    if (labels.length === 0) return [];
    const boxBounds = centeredRect(
      boxComp.schX,
      boxComp.schY,
      boxComp.width,
      boxComp.height
    );
    const boxIsLeft = boxComp.schX <= labelComp.schX;
    const hits = [];
    for (const label of labels) {
      const labelBounds = getNetLabelBounds(label);
      if (!rectOverlap(boxBounds, labelBounds)) continue;
      let xSeparation;
      if (boxIsLeft) {
        xSeparation = boxBounds.right - labelBounds.left + 0.1;
      } else {
        xSeparation = labelBounds.right - boxBounds.left + 0.1;
      }
      hits.push({
        type: "box-label",
        bounds: {
          left: Math.max(boxBounds.left, labelBounds.left),
          right: Math.min(boxBounds.right, labelBounds.right),
          top: Math.min(boxBounds.top, labelBounds.top),
          bottom: Math.max(boxBounds.bottom, labelBounds.bottom)
        },
        boxComp,
        labelComp,
        boxId,
        labelId,
        xSeparation
      });
    }
    return hits;
  }
  buildAndPushIssues() {
    if (this.rawCollisions.length === 0) return;
    const collisionsBySheet = /* @__PURE__ */ new Map();
    for (const collision of this.rawCollisions) {
      const placement = collision.type === "label-label" ? collision.leftComp : collision.boxComp;
      const sheetKey = placement.schematicSheetId ?? "";
      const sheetCollisions = collisionsBySheet.get(sheetKey);
      if (sheetCollisions) sheetCollisions.push(collision);
      else collisionsBySheet.set(sheetKey, [collision]);
    }
    for (const collisions of collisionsBySheet.values()) {
      this.buildAndPushIssueForSheet(collisions);
    }
  }
  buildAndPushIssueForSheet(collisions) {
    const globalFixes = this.computeGlobalFixes(collisions);
    if (globalFixes.size === 0) return;
    const seenPairs = /* @__PURE__ */ new Set();
    const pairs = [];
    for (const collision of collisions) {
      let comp1Name;
      let comp2Name;
      if (collision.type === "label-label") {
        comp1Name = collision.leftComp.sourceComponentName ?? "";
        comp2Name = collision.rightComp.sourceComponentName ?? "";
      } else {
        comp1Name = collision.boxComp.sourceComponentName ?? "";
        comp2Name = collision.labelComp.sourceComponentName ?? "";
      }
      const key = `${comp1Name}/${comp2Name}`;
      if (!seenPairs.has(key)) {
        seenPairs.add(key);
        pairs.push({ comp1Name, comp2Name });
      }
    }
    const firstCollision = collisions[0];
    const firstPlacement = firstCollision.type === "label-label" ? firstCollision.leftComp : firstCollision.boxComp;
    this.params.issues.push({
      lineItemType: "NetLabelCollision",
      schematicSheetId: firstPlacement.schematicSheetId,
      schematicSheetName: firstPlacement.schematicSheetName,
      pairs,
      collisionBounds: collisions.map((collision) => collision.bounds),
      moves: Array.from(globalFixes.values())
    });
  }
  computeGlobalFixes(collisions) {
    const compById = /* @__PURE__ */ new Map();
    for (const placement of this.placements) {
      if (placement.schematicComponentId)
        compById.set(placement.schematicComponentId, placement);
    }
    const constraintMap = /* @__PURE__ */ new Map();
    const addConstraint = (leftId, rightId, xSeparation) => {
      const leftComp = compById.get(leftId);
      const rightComp = compById.get(rightId);
      if (!leftComp || !rightComp) return;
      const minSep = rightComp.schX - leftComp.schX + xSeparation;
      const key = `${leftId}|${rightId}`;
      constraintMap.set(key, Math.max(constraintMap.get(key) ?? 0, minSep));
    };
    for (const collision of collisions) {
      if (collision.type === "label-label") {
        addConstraint(
          collision.leftId,
          collision.rightId,
          collision.xSeparation
        );
      } else if (collision.boxComp.schX <= collision.labelComp.schX) {
        addConstraint(collision.boxId, collision.labelId, collision.xSeparation);
      } else {
        addConstraint(collision.labelId, collision.boxId, collision.xSeparation);
      }
    }
    const constraints = [...constraintMap.entries()].map(
      ([key, minSep]) => {
        const pipeIndex = key.indexOf("|");
        return {
          leftId: key.slice(0, pipeIndex),
          rightId: key.slice(pipeIndex + 1),
          minSep
        };
      }
    );
    const allIds = /* @__PURE__ */ new Set();
    const adjacency = /* @__PURE__ */ new Map();
    for (const { leftId, rightId } of constraints) {
      allIds.add(leftId);
      allIds.add(rightId);
      if (!adjacency.has(leftId)) adjacency.set(leftId, /* @__PURE__ */ new Set());
      if (!adjacency.has(rightId)) adjacency.set(rightId, /* @__PURE__ */ new Set());
      adjacency.get(leftId).add(rightId);
      adjacency.get(rightId).add(leftId);
    }
    const visited = /* @__PURE__ */ new Set();
    const result = /* @__PURE__ */ new Map();
    for (const startId of allIds) {
      if (visited.has(startId)) continue;
      const group = [];
      const queue = [startId];
      visited.add(startId);
      while (queue.length) {
        const compId = queue.shift();
        group.push(compId);
        for (const neighbor of adjacency.get(compId) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      group.sort(
        (idA, idB) => (compById.get(idA)?.schX ?? 0) - (compById.get(idB)?.schX ?? 0)
      );
      const groupIds = new Set(group);
      const groupConstraints = constraints.filter(
        (c) => groupIds.has(c.leftId) && groupIds.has(c.rightId)
      );
      const assigned = /* @__PURE__ */ new Map();
      for (const compId of group) {
        let newX = compById.get(compId)?.schX ?? 0;
        for (const { leftId, rightId, minSep } of groupConstraints) {
          if (rightId === compId && assigned.has(leftId)) {
            newX = Math.max(newX, assigned.get(leftId) + minSep);
          }
        }
        assigned.set(compId, newX);
      }
      const totalPush = [...assigned.entries()].reduce(
        (sum, [compId, newX]) => sum + (newX - (compById.get(compId)?.schX ?? 0)),
        0
      );
      if (totalPush > 1e-9) {
        const pullBack = totalPush / group.length;
        const shifted = /* @__PURE__ */ new Map();
        for (const compId of group) {
          let newX = (compById.get(compId)?.schX ?? 0) - pullBack;
          for (const { leftId, rightId, minSep } of groupConstraints) {
            if (rightId === compId && shifted.has(leftId)) {
              newX = Math.max(newX, shifted.get(leftId) + minSep);
            }
          }
          shifted.set(compId, newX);
        }
        const maxDisplacement = (positions) => [...positions.entries()].reduce(
          (currentMax, [compId, newX]) => Math.max(
            currentMax,
            Math.abs(newX - (compById.get(compId)?.schX ?? 0))
          ),
          0
        );
        if (maxDisplacement(shifted) < maxDisplacement(assigned)) {
          for (const [compId, newX] of shifted) assigned.set(compId, newX);
        }
      }
      for (const [compId, newX] of assigned) {
        const comp = compById.get(compId);
        if (!comp || Math.abs(newX - comp.schX) < 1e-9) continue;
        result.set(compId, {
          componentName: comp.sourceComponentName ?? compId,
          newSchX: Math.round(newX * 100) / 100,
          newSchY: Math.round(comp.schY * 100) / 100
        });
      }
    }
    return result;
  }
  buildNetLabelsByComponentId(circuitJson) {
    const MATCH_EPSILON = 1e-4;
    const portPositions = [];
    for (const element of circuitJson) {
      if (element.type !== "schematic_port") continue;
      const port = element;
      if (!port.schematic_component_id) continue;
      portPositions.push({
        componentId: port.schematic_component_id,
        cx: port.center.x,
        cy: port.center.y,
        schematicSheetId: port.schematic_sheet_id
      });
    }
    const result = /* @__PURE__ */ new Map();
    for (const element of circuitJson) {
      if (element.type !== "schematic_net_label") continue;
      const label = element;
      if (!label.anchor_position) continue;
      const { x: anchorX, y: anchorY } = label.anchor_position;
      const matches = portPositions.filter(
        (port) => port.schematicSheetId === label.schematic_sheet_id && Math.hypot(port.cx - anchorX, port.cy - anchorY) < MATCH_EPSILON
      );
      if (matches.length === 0) continue;
      const componentIds = new Set(matches.map((match) => match.componentId));
      if (componentIds.size !== 1) continue;
      const componentId = matches[0].componentId;
      const labels = result.get(componentId) ?? [];
      labels.push(label);
      result.set(componentId, labels);
    }
    return result;
  }
  static netLabelCollisionToString(issue) {
    const pairAttrs = issue.pairs.map((pair, i) => `pair${i + 1}="${pair.comp1Name}/${pair.comp2Name}"`).join(" ");
    const moves = issue.moves.map(
      (move) => `    <Move componentName="${move.componentName}" newSchX="${move.newSchX}" newSchY="${move.newSchY}" />`
    );
    return [
      `<ComponentNetLabelCollision ${pairAttrs}>`,
      `  <SuggestedFix note="Apply all moves simultaneously. Set schAutoLayoutEnabled on your circuit.">`,
      ...moves,
      `  </SuggestedFix>`,
      `</ComponentNetLabelCollision>`
    ].join("\n");
  }
};

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/ComponentPinAlignmentSolver/ComponentPinAlignmentSolver.ts
import { BaseSolver as BaseSolver12 } from "@tscircuit/solver-utils";
var ComponentPinAlignmentSolver = class _ComponentPinAlignmentSolver extends BaseSolver12 {
  static ALIGNMENT_EPSILON = 0.01;
  ctx;
  out;
  constructor({
    ctx,
    issues
  }) {
    super();
    this.ctx = ctx;
    this.out = issues;
  }
  _step() {
    const portsById = new Map(
      this.ctx.circuitJson.filter((el) => el.type === "schematic_port").map((port) => [port.schematic_port_id, port])
    );
    const placementBySchematicComponentId = new Map(
      this.ctx.componentPlacements.flatMap(
        (placement) => placement.schematicComponentId ? [[placement.schematicComponentId, placement]] : []
      )
    );
    const pinPairsByComponentPair = /* @__PURE__ */ new Map();
    for (const trace of this.ctx.circuitJson.filter(
      (el) => el.type === "schematic_trace"
    )) {
      const pinPair = this.getTracePinPair(trace, portsById);
      if (!pinPair) continue;
      const firstComponentId = pinPair.firstPort.schematic_component_id;
      const secondComponentId = pinPair.secondPort.schematic_component_id;
      if (!firstComponentId || !secondComponentId || firstComponentId === secondComponentId) {
        continue;
      }
      const orderedPair = firstComponentId < secondComponentId ? pinPair : {
        firstPort: pinPair.secondPort,
        secondPort: pinPair.firstPort
      };
      const key = [firstComponentId, secondComponentId].sort().join("\0");
      const pairs = pinPairsByComponentPair.get(key) ?? [];
      const isDuplicate = pairs.some(
        (pair) => pair.firstPort.schematic_port_id === orderedPair.firstPort.schematic_port_id && pair.secondPort.schematic_port_id === orderedPair.secondPort.schematic_port_id
      );
      if (!isDuplicate) pairs.push(orderedPair);
      pinPairsByComponentPair.set(key, pairs);
    }
    for (const pinPairs of pinPairsByComponentPair.values()) {
      const issue = this.findVerticalShiftIssue(
        pinPairs,
        placementBySchematicComponentId
      );
      if (issue) this.out.push(issue);
    }
    this.solved = true;
  }
  getTracePinPair(trace, portsById) {
    const firstEdge = trace.edges?.[0];
    const lastEdge = trace.edges?.at(-1);
    if (!firstEdge || !lastEdge) return;
    const firstPortId = firstEdge.from_schematic_port_id ?? firstEdge.to_schematic_port_id;
    const secondPortId = lastEdge.to_schematic_port_id ?? lastEdge.from_schematic_port_id;
    const ports = [...portsById.values()];
    const firstPort = firstPortId ? portsById.get(firstPortId) : this.findPortAtPoint(ports, firstEdge.from, trace.schematic_sheet_id);
    const secondPort = secondPortId ? portsById.get(secondPortId) : this.findPortAtPoint(ports, lastEdge.to, trace.schematic_sheet_id);
    if (!firstPort || !secondPort) return;
    if (firstPort.schematic_port_id === secondPort.schematic_port_id) return;
    if (firstPort.schematic_sheet_id !== secondPort.schematic_sheet_id) return;
    return { firstPort, secondPort };
  }
  findPortAtPoint(ports, point2, schematicSheetId) {
    const { ALIGNMENT_EPSILON } = _ComponentPinAlignmentSolver;
    return ports.find(
      (port) => port.schematic_sheet_id === schematicSheetId && Math.abs(port.center.x - point2.x) <= ALIGNMENT_EPSILON && Math.abs(port.center.y - point2.y) <= ALIGNMENT_EPSILON
    );
  }
  findVerticalShiftIssue(pinPairs, placementBySchematicComponentId) {
    const firstPair = pinPairs[0];
    if (!firstPair) return;
    const firstPlacement = placementBySchematicComponentId.get(
      firstPair.firstPort.schematic_component_id
    );
    const secondPlacement = placementBySchematicComponentId.get(
      firstPair.secondPort.schematic_component_id
    );
    if (!firstPlacement || !secondPlacement) return;
    const [leftPlacement, rightPlacement] = firstPlacement.schX <= secondPlacement.schX ? [firstPlacement, secondPlacement] : [secondPlacement, firstPlacement];
    const horizontalPairs = pinPairs.flatMap((pair) => {
      const [leftPort, rightPort] = pair.firstPort.center.x <= pair.secondPort.center.x ? [pair.firstPort, pair.secondPort] : [pair.secondPort, pair.firstPort];
      return leftPort.facing_direction === "right" && rightPort.facing_direction === "left" ? [{ leftPort, rightPort }] : [];
    });
    if (horizontalPairs.length < 2) return;
    const { ALIGNMENT_EPSILON } = _ComponentPinAlignmentSolver;
    const currentlyAlignedPinCount = horizontalPairs.filter(
      ({ leftPort, rightPort }) => Math.abs(leftPort.center.y - rightPort.center.y) <= ALIGNMENT_EPSILON
    ).length;
    const candidateGroups = [];
    for (const pair of horizontalPairs) {
      const deltaSchY2 = pair.leftPort.center.y - pair.rightPort.center.y;
      if (Math.abs(deltaSchY2) <= ALIGNMENT_EPSILON) continue;
      const group = candidateGroups.find(
        (candidate) => Math.abs(candidate.deltaSchY - deltaSchY2) <= ALIGNMENT_EPSILON
      );
      if (group) group.pairs.push(pair);
      else candidateGroups.push({ deltaSchY: deltaSchY2, pairs: [pair] });
    }
    const bestCandidate = candidateGroups.sort(
      (a, b) => b.pairs.length - a.pairs.length || Math.abs(a.deltaSchY) - Math.abs(b.deltaSchY)
    )[0];
    if (!bestCandidate || bestCandidate.pairs.length < 2 || bestCandidate.pairs.length <= currentlyAlignedPinCount) {
      return;
    }
    const targetName = rightPlacement.sourceComponentName ?? rightPlacement.schematicComponentId ?? "component";
    const deltaSchY = bestCandidate.deltaSchY;
    const newSchY = rightPlacement.schY + deltaSchY;
    return {
      lineItemType: "ComponentPinsWouldAlignWithVerticalShift",
      firstComponent: leftPlacement,
      secondComponent: rightPlacement,
      targetComponent: rightPlacement,
      deltaSchY,
      newSchY,
      currentlyAlignedPinCount,
      alignedPinCount: bestCandidate.pairs.length,
      alignedPinPairs: bestCandidate.pairs.map(({ leftPort, rightPort }) => ({
        firstPin: this.getPinLabel(leftPort),
        secondPin: this.getPinLabel(rightPort)
      })),
      message: `shift ${targetName} vertically by ${fmtDelta(deltaSchY)} to align ${bestCandidate.pairs.length} connected pin pairs`
    };
  }
  getPinLabel(port) {
    return port.display_pin_label ?? port.pin_number?.toString();
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(
      attrs,
      "firstComponentName",
      issue.firstComponent.sourceComponentName
    );
    addAttr(
      attrs,
      "secondComponentName",
      issue.secondComponent.sourceComponentName
    );
    addAttr(
      attrs,
      "targetComponentName",
      issue.targetComponent.sourceComponentName
    );
    addAttr(attrs, "deltaSchY", issue.deltaSchY);
    addAttr(attrs, "newSchY", issue.newSchY);
    addAttr(attrs, "currentlyAlignedPinCount", issue.currentlyAlignedPinCount);
    addAttr(attrs, "alignedPinCount", issue.alignedPinCount);
    addAttr(attrs, "message", issue.message);
    return `<ComponentPinsWouldAlignWithVerticalShift ${attrs.join(" ")} />`;
  }
};

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/CrystalLoadCapacitorPlacementSolver/CrystalLoadCapacitorPlacementSolver.ts
import { BaseSolver as BaseSolver13 } from "@tscircuit/solver-utils";
var CrystalLoadCapacitorPlacementSolver = class _CrystalLoadCapacitorPlacementSolver extends BaseSolver13 {
  static ALIGNMENT_TOLERANCE = 0.1;
  issues;
  networks;
  currentNetworkIndex = 0;
  constructor({
    ctx,
    issues
  }) {
    super();
    this.issues = issues;
    this.networks = this.findCrystalLoadNetworks(ctx);
    this.solved = this.networks.length === 0;
  }
  _step() {
    const network = this.networks[this.currentNetworkIndex];
    if (!network) {
      this.solved = true;
      return;
    }
    this.currentNetworkIndex += 1;
    this.solved = this.currentNetworkIndex >= this.networks.length;
    const deltaSchX = round2(network.newSchX - network.crystal.schX);
    const deltaSchY = round2(network.newSchY - network.crystal.schY);
    if (Math.abs(deltaSchX) <= _CrystalLoadCapacitorPlacementSolver.ALIGNMENT_TOLERANCE && Math.abs(deltaSchY) <= _CrystalLoadCapacitorPlacementSolver.ALIGNMENT_TOLERANCE) {
      return;
    }
    const crystalName = network.crystal.sourceComponentName ?? "the crystal";
    const firstCapacitorName = network.firstLoadCapacitor.sourceComponentName ?? "the first load capacitor";
    const secondCapacitorName = network.secondLoadCapacitor.sourceComponentName ?? "the second load capacitor";
    this.issues.push({
      lineItemType: "CrystalNotCenteredOverLoadCapacitors",
      crystalSchematicBox: network.crystal,
      firstLoadCapacitorSchematicBox: network.firstLoadCapacitor,
      secondLoadCapacitorSchematicBox: network.secondLoadCapacitor,
      deltaSchX,
      deltaSchY,
      newSchX: network.newSchX,
      newSchY: network.newSchY,
      message: `move ${crystalName} to schX=${network.newSchX}, schY=${network.newSchY} so it is centered between ${firstCapacitorName} and ${secondCapacitorName} and aligned with their load-side pins`
    });
  }
  findCrystalLoadNetworks(ctx) {
    const sourceComponents = /* @__PURE__ */ new Map();
    const sourcePortsByComponentId = /* @__PURE__ */ new Map();
    const schematicPortsBySourcePortId = /* @__PURE__ */ new Map();
    const placementBySourceComponentId = new Map(
      ctx.componentPlacements.flatMap(
        (placement) => placement.sourceComponentId ? [[placement.sourceComponentId, placement]] : []
      )
    );
    for (const element of ctx.circuitJson) {
      if (element.type === "source_component") {
        sourceComponents.set(element.source_component_id, {
          sourceComponentId: element.source_component_id,
          ftype: "ftype" in element && typeof element.ftype === "string" ? element.ftype : void 0
        });
      }
      if (element.type === "source_port" && typeof element.source_component_id === "string" && typeof element.subcircuit_connectivity_map_key === "string") {
        const sourcePort = {
          sourcePortId: element.source_port_id,
          sourceComponentId: element.source_component_id,
          connectivityKey: element.subcircuit_connectivity_map_key
        };
        const componentPorts = sourcePortsByComponentId.get(element.source_component_id) ?? [];
        componentPorts.push(sourcePort);
        sourcePortsByComponentId.set(
          element.source_component_id,
          componentPorts
        );
      }
      if (element.type === "schematic_port" && element.source_port_id) {
        schematicPortsBySourcePortId.set(element.source_port_id, element);
      }
    }
    const capacitorConnectionsByConnectivityKey = /* @__PURE__ */ new Map();
    for (const sourceComponent of sourceComponents.values()) {
      if (sourceComponent.ftype !== "simple_capacitor") continue;
      const capacitorPorts = sourcePortsByComponentId.get(sourceComponent.sourceComponentId) ?? [];
      if (capacitorPorts.length !== 2) continue;
      const firstCapacitorPort = capacitorPorts[0];
      const secondCapacitorPort = capacitorPorts[1];
      const capacitorPlacement = placementBySourceComponentId.get(
        sourceComponent.sourceComponentId
      );
      if (!capacitorPlacement) continue;
      for (const [loadPort, returnPort] of [
        [firstCapacitorPort, secondCapacitorPort],
        [secondCapacitorPort, firstCapacitorPort]
      ]) {
        const schematicLoadPort = schematicPortsBySourcePortId.get(
          loadPort.sourcePortId
        );
        if (!schematicLoadPort) continue;
        const connections = capacitorConnectionsByConnectivityKey.get(loadPort.connectivityKey) ?? [];
        connections.push({
          capacitor: capacitorPlacement,
          loadPort: schematicLoadPort,
          returnConnectivityKey: returnPort.connectivityKey
        });
        capacitorConnectionsByConnectivityKey.set(
          loadPort.connectivityKey,
          connections
        );
      }
    }
    const networks = [];
    for (const sourceComponent of sourceComponents.values()) {
      if (sourceComponent.ftype !== "simple_crystal" && sourceComponent.ftype !== "simple_chip") {
        continue;
      }
      const crystalPorts = sourcePortsByComponentId.get(sourceComponent.sourceComponentId) ?? [];
      if (crystalPorts.length !== 2 || crystalPorts[0].connectivityKey === crystalPorts[1].connectivityKey) {
        continue;
      }
      const firstCrystalConnectivityKey = crystalPorts[0].connectivityKey;
      const secondCrystalConnectivityKey = crystalPorts[1].connectivityKey;
      const hasOscillatorHost = [...sourcePortsByComponentId.entries()].some(
        ([sourceComponentId, sourcePorts]) => sourceComponentId !== sourceComponent.sourceComponentId && sourcePorts.length > 2 && sourcePorts.some(
          (port) => port.connectivityKey === firstCrystalConnectivityKey
        ) && sourcePorts.some(
          (port) => port.connectivityKey === secondCrystalConnectivityKey
        )
      );
      if (!hasOscillatorHost) continue;
      const crystalPlacement = placementBySourceComponentId.get(
        sourceComponent.sourceComponentId
      );
      if (!crystalPlacement) continue;
      const firstConnections = capacitorConnectionsByConnectivityKey.get(
        crystalPorts[0].connectivityKey
      ) ?? [];
      const secondConnections = capacitorConnectionsByConnectivityKey.get(
        crystalPorts[1].connectivityKey
      ) ?? [];
      const candidatePairs = firstConnections.flatMap(
        (firstConnection) => secondConnections.flatMap((secondConnection) => {
          if (firstConnection.capacitor.sourceComponentId === secondConnection.capacitor.sourceComponentId || firstConnection.returnConnectivityKey !== secondConnection.returnConnectivityKey || firstConnection.returnConnectivityKey === firstCrystalConnectivityKey || firstConnection.returnConnectivityKey === secondCrystalConnectivityKey || firstConnection.capacitor.schematicSheetId !== crystalPlacement.schematicSheetId || secondConnection.capacitor.schematicSheetId !== crystalPlacement.schematicSheetId) {
            return [];
          }
          return [{ firstConnection, secondConnection }];
        })
      );
      if (candidatePairs.length === 0) continue;
      const bestPair = candidatePairs.toSorted(
        (a, b) => pairDistance(a, crystalPlacement) - pairDistance(b, crystalPlacement)
      )[0];
      const loadPorts = [
        bestPair.firstConnection.loadPort,
        bestPair.secondConnection.loadPort
      ];
      const capacitors = [
        bestPair.firstConnection.capacitor,
        bestPair.secondConnection.capacitor
      ].toSorted((a, b) => a.schX - b.schX);
      networks.push({
        crystal: crystalPlacement,
        firstLoadCapacitor: capacitors[0],
        secondLoadCapacitor: capacitors[1],
        newSchX: round2((loadPorts[0].center.x + loadPorts[1].center.x) / 2),
        newSchY: round2((loadPorts[0].center.y + loadPorts[1].center.y) / 2)
      });
    }
    return networks;
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(attrs, "crystalName", issue.crystalSchematicBox.sourceComponentName);
    addAttr(
      attrs,
      "firstLoadCapacitorName",
      issue.firstLoadCapacitorSchematicBox.sourceComponentName
    );
    addAttr(
      attrs,
      "secondLoadCapacitorName",
      issue.secondLoadCapacitorSchematicBox.sourceComponentName
    );
    addAttr(attrs, "newSchX", issue.newSchX);
    addAttr(attrs, "newSchY", issue.newSchY);
    addAttr(attrs, "deltaSchX", issue.deltaSchX, { formatDelta: true });
    addAttr(attrs, "deltaSchY", issue.deltaSchY, { formatDelta: true });
    addAttr(attrs, "message", issue.message);
    return `<CrystalNotCenteredOverLoadCapacitors ${attrs.join(" ")} />`;
  }
};
var pairDistance = (pair, crystal) => distance4(pair.firstConnection.capacitor, crystal) + distance4(pair.secondConnection.capacitor, crystal);
var distance4 = (first, second) => Math.hypot(first.schX - second.schX, first.schY - second.schY);
var round2 = (value) => Math.round(value * 100) / 100;

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/DiodeResistorAlignmentSolver/DiodeResistorAlignmentSolver.ts
import { BaseSolver as BaseSolver14 } from "@tscircuit/solver-utils";
import { getSourcePortConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map";
var DiodeResistorAlignmentSolver = class _DiodeResistorAlignmentSolver extends BaseSolver14 {
  static DIODE_FTYPES = /* @__PURE__ */ new Set(["simple_led", "simple_diode"]);
  ctx;
  out;
  schematicTraces;
  currentIndex = 0;
  sourceConnectivity;
  sourceComponentFtypeById;
  sourceComponentIdBySourcePortId;
  schematicPorts;
  schematicBoxBySourceComponentId;
  constructor({
    ctx,
    issues
  }) {
    super();
    this.ctx = ctx;
    this.out = issues;
    const { circuitJson } = ctx;
    this.sourceConnectivity = getSourcePortConnectivityMapFromCircuitJson(circuitJson);
    this.sourceComponentFtypeById = this.buildSourceComponentFtypeById(circuitJson);
    this.sourceComponentIdBySourcePortId = this.buildSourceComponentIdBySourcePortId(circuitJson);
    this.schematicPorts = circuitJson.filter(
      (el) => el.type === "schematic_port"
    );
    this.schematicBoxBySourceComponentId = this.buildSchematicBoxBySourceComponentId();
    this.schematicTraces = circuitJson.filter(
      (el) => el.type === "schematic_trace"
    );
    this.solved = this.schematicTraces.length === 0;
  }
  _step() {
    const trace = this.schematicTraces[this.currentIndex];
    if (!trace) {
      this.solved = true;
      return;
    }
    this.currentIndex++;
    this.solved = this.currentIndex >= this.schematicTraces.length;
    if (!trace.edges || trace.edges.length === 0) return;
    const firstEdge = trace.edges[0];
    const lastEdge = trace.edges[trace.edges.length - 1];
    if (!firstEdge || !lastEdge) return;
    const start = firstEdge.from;
    const end = lastEdge.to;
    const schematicSheetId = trace.schematic_sheet_id;
    const startSourceCompId = this.findSourceComponentIdNearPoint(
      start,
      schematicSheetId
    );
    const endSourceCompId = this.findSourceComponentIdNearPoint(
      end,
      schematicSheetId
    );
    if (!startSourceCompId || !endSourceCompId) return;
    const startFtype = this.sourceComponentFtypeById.get(startSourceCompId);
    const endFtype = this.sourceComponentFtypeById.get(endSourceCompId);
    const { DIODE_FTYPES } = _DiodeResistorAlignmentSolver;
    const isDiodeResistorPair = DIODE_FTYPES.has(startFtype) && endFtype === "simple_resistor" || startFtype === "simple_resistor" && DIODE_FTYPES.has(endFtype);
    if (!isDiodeResistorPair) return;
    const diodeCompId = DIODE_FTYPES.has(startFtype) ? startSourceCompId : endSourceCompId;
    const resistorCompId = startFtype === "simple_resistor" ? startSourceCompId : endSourceCompId;
    const diodeBox = this.schematicBoxBySourceComponentId.get(diodeCompId);
    const resistorBox = this.schematicBoxBySourceComponentId.get(resistorCompId);
    if (!diodeBox || !resistorBox) return;
    const diodePort = this.findNearestPort(
      DIODE_FTYPES.has(startFtype) ? start : end,
      schematicSheetId
    );
    const resistorPort = this.findNearestPort(
      startFtype === "simple_resistor" ? start : end,
      schematicSheetId
    );
    if (!diodePort?.center || !resistorPort?.center) return;
    if (!this.sourceConnectivity.areIdsConnected(
      diodePort.source_port_id,
      resistorPort.source_port_id
    ))
      return;
    const diodeName = diodeBox.sourceComponentName ?? diodeCompId;
    const resistorName = resistorBox.sourceComponentName ?? resistorCompId;
    const diodePin = diodePort?.display_pin_label ?? diodePort?.pin_number?.toString();
    const resistorPin = resistorPort?.display_pin_label ?? resistorPort?.pin_number?.toString();
    const diodeFacing = diodePort?.facing_direction;
    const resistorFacing = resistorPort?.facing_direction;
    const diodePinDesc = diodePin ? `${diodeName}.${diodePin}` : diodeName;
    const resistorPinDesc = resistorPin ? `${resistorName}.${resistorPin}` : resistorName;
    const makeIssue = (message) => ({
      lineItemType: "DiodeResistorNotAligned",
      diodeSchematicBox: diodeBox,
      resistorSchematicBox: resistorBox,
      diodePin,
      resistorPin,
      diodePinFacingDirection: diodeFacing,
      resistorPinFacingDirection: resistorFacing,
      message
    });
    if (!_DiodeResistorAlignmentSolver.isCoLinear(
      diodePort.center,
      resistorPort.center
    )) {
      this.out.push(
        makeIssue(
          `trace has corners \u2014 align ${diodeName} and ${resistorName} on same axis and rotate so ${diodePinDesc} faces ${resistorPinDesc}`
        )
      );
      return;
    }
    if (diodeFacing && resistorFacing && !_DiodeResistorAlignmentSolver.pinsFacingEachOther(
      diodePort.center,
      diodeFacing,
      resistorPort.center,
      resistorFacing
    )) {
      this.out.push(
        makeIssue(
          `${diodePinDesc} and ${resistorPinDesc} face away from each other \u2014 rotate ${diodeName} so ${diodePinDesc} faces ${resistorPinDesc}`
        )
      );
    }
  }
  static isCoLinear(a, b, epsilon = 0.01) {
    return Math.abs(a.x - b.x) < epsilon || Math.abs(a.y - b.y) < epsilon;
  }
  static pinsFacingEachOther(aCenter, aFacing, bCenter, bFacing) {
    const dx = bCenter.x - aCenter.x;
    const dy = bCenter.y - aCenter.y;
    const aToward = aFacing === "right" && dx > 0 || aFacing === "left" && dx < 0 || aFacing === "up" && dy > 0 || aFacing === "down" && dy < 0;
    const bToward = bFacing === "right" && dx < 0 || bFacing === "left" && dx > 0 || bFacing === "up" && dy < 0 || bFacing === "down" && dy > 0;
    return aToward && bToward;
  }
  static dist(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }
  findNearestPort(point2, schematicSheetId) {
    let nearest;
    let minDist = Infinity;
    for (const port of this.schematicPorts) {
      if (port.schematic_sheet_id !== schematicSheetId) continue;
      if (!port.center) continue;
      const d = _DiodeResistorAlignmentSolver.dist(point2, port.center);
      if (d < minDist) {
        minDist = d;
        nearest = port;
      }
    }
    return nearest;
  }
  findSourceComponentIdNearPoint(point2, schematicSheetId) {
    const nearest = this.findNearestPort(point2, schematicSheetId);
    if (!nearest || !nearest.source_port_id) return void 0;
    return this.sourceComponentIdBySourcePortId.get(nearest.source_port_id);
  }
  buildSourceComponentFtypeById(circuitJson) {
    const map = /* @__PURE__ */ new Map();
    for (const el of circuitJson) {
      if (el.type === "source_component" && "source_component_id" in el && "ftype" in el && typeof el.ftype === "string") {
        map.set(el.source_component_id, el.ftype);
      }
    }
    return map;
  }
  buildSourceComponentIdBySourcePortId(circuitJson) {
    const map = /* @__PURE__ */ new Map();
    for (const el of circuitJson) {
      if (el.type === "source_port" && "source_port_id" in el && "source_component_id" in el && typeof el.source_port_id === "string" && typeof el.source_component_id === "string") {
        map.set(el.source_port_id, el.source_component_id);
      }
    }
    return map;
  }
  buildSchematicBoxBySourceComponentId() {
    const map = /* @__PURE__ */ new Map();
    for (const placement of this.ctx.componentPlacements) {
      if (placement.sourceComponentId) {
        map.set(placement.sourceComponentId, placement);
      }
    }
    return map;
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(
      attrs,
      "diodeComponentName",
      issue.diodeSchematicBox.sourceComponentName
    );
    addAttr(attrs, "diodePin", issue.diodePin);
    addAttr(
      attrs,
      "resistorComponentName",
      issue.resistorSchematicBox.sourceComponentName
    );
    addAttr(attrs, "resistorPin", issue.resistorPin);
    addAttr(attrs, "message", issue.message);
    return `<DiodeResistorNotAligned ${attrs.join(" ")} />`;
  }
};

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/FeedbackNetworkPlacementSolver/FeedbackNetworkPlacementSolver.ts
import { BaseSolver as BaseSolver15 } from "@tscircuit/solver-utils";
var FeedbackNetworkPlacementSolver = class _FeedbackNetworkPlacementSolver extends BaseSolver15 {
  // A readability heuristic in schematic units, not a PCB proximity constraint.
  static MIN_BODY_GAP = 4;
  index;
  amplifierIds;
  issues;
  currentIndex = 0;
  constructor({
    ctx,
    issues
  }) {
    super();
    this.issues = issues;
    this.index = new PlacementNetworkIndex(ctx);
    this.amplifierIds = [...this.index.components.values()].filter((component) => component.ftype === "simple_op_amp").map((component) => component.source_component_id);
    this.solved = this.amplifierIds.length === 0;
  }
  _step() {
    const id = this.amplifierIds[this.currentIndex++];
    this.solved = this.currentIndex >= this.amplifierIds.length;
    if (!id) return;
    const index = this.index;
    const amplifier = index.placement(id);
    const output = index.namedPort(id, "output");
    const input = index.namedPort(id, "inverting_input");
    if (!amplifier || !output || !input || !index.port(output) || !index.port(input))
      return;
    const outputNet = index.connected(output.source_port_id);
    const inputNet = index.connected(input.source_port_id);
    if (outputNet === inputNet || index.isRail(outputNet) || index.isRail(inputNet))
      return;
    if ((index.portsByNet.get(inputNet) ?? []).some(
      (port) => port.source_component_id !== id && index.components.get(port.source_component_id)?.ftype === "simple_op_amp"
    ))
      return;
    const feedbackComponents = [];
    const seen = /* @__PURE__ */ new Set();
    for (const port of index.portsByNet.get(outputNet) ?? []) {
      const componentId = port.source_component_id;
      if (seen.has(componentId)) continue;
      seen.add(componentId);
      const component = index.components.get(componentId);
      if (component?.ftype !== "simple_resistor" && component?.ftype !== "simple_capacitor")
        continue;
      if (component.ftype === "simple_resistor" && !(component.resistance > 0))
        continue;
      const nets = index.twoTerminalNets(componentId);
      if (!nets?.includes(inputNet) || !nets.includes(outputNet)) continue;
      const placement = index.placement(componentId);
      if (!placement || !index.sameLocalScope(amplifier, placement)) return;
      feedbackComponents.push(placement);
    }
    const distantComponents = feedbackComponents.flatMap((schematicBox) => {
      const bodyGap2 = distanceBetweenBoxes(amplifier, schematicBox);
      const maxRecommendedBodyGap = Math.max(
        _FeedbackNetworkPlacementSolver.MIN_BODY_GAP,
        3 * Math.max(schematicBox.width, schematicBox.height)
      );
      return bodyGap2 > maxRecommendedBodyGap ? [{ schematicBox, bodyGap: bodyGap2, maxRecommendedBodyGap }] : [];
    });
    if (distantComponents.length === 0) return;
    const names = distantComponents.map(
      ({ schematicBox }) => schematicBox.sourceComponentName ?? schematicBox.sourceComponentId
    ).join(", ");
    this.issues.push({
      lineItemType: "FeedbackNetworkNotCompact",
      amplifierSchematicBox: amplifier,
      feedbackComponents,
      distantComponents,
      outputSourcePortId: output.source_port_id,
      invertingInputSourcePortId: input.source_port_id,
      message: `consider grouping ${names} closer to ${amplifier.sourceComponentName ?? id}, with a compact feedback return path above or below the amplifier`
    });
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(
      attrs,
      "amplifierName",
      issue.amplifierSchematicBox.sourceComponentName
    );
    addAttr(
      attrs,
      "feedbackComponentNames",
      issue.feedbackComponents.map((box) => box.sourceComponentName ?? box.sourceComponentId).join(", ")
    );
    addAttr(
      attrs,
      "distantComponentNames",
      issue.distantComponents.map(
        ({ schematicBox }) => schematicBox.sourceComponentName ?? schematicBox.sourceComponentId
      ).join(", ")
    );
    addAttr(attrs, "message", issue.message);
    return `<FeedbackNetworkNotCompact ${attrs.join(" ")} />`;
  }
};
function distanceBetweenBoxes(a, b) {
  return Math.hypot(
    Math.max(0, Math.abs(a.schX - b.schX) - (a.width + b.width) / 2),
    Math.max(0, Math.abs(a.schY - b.schY) - (a.height + b.height) / 2)
  );
}

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/PullResistorPlacementSolver/PullResistorPlacementSolver.ts
import { BaseSolver as BaseSolver16 } from "@tscircuit/solver-utils";

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/utils/switch-pull-resistor-pairs.ts
function getSwitchPullResistorPairs(index) {
  const pairs = [];
  const isHorizontal = (id) => {
    const ports = index.portsByComponent.get(id);
    if (ports?.length !== 2) return false;
    const a = index.port(ports[0]);
    const b = index.port(ports[1]);
    return !!a && !!b && Math.abs(a.center.y - b.center.y) < 0.01 && Math.abs(a.center.x - b.center.x) > 0.01;
  };
  for (const component of index.components.values()) {
    if (component.ftype !== "simple_resistor" || component.resistance <= 0)
      continue;
    const id = component.source_component_id;
    const nets = index.twoTerminalNets(id);
    if (!nets || nets.filter((net) => index.isRail(net)).length !== 1) continue;
    const rail = nets.find((net) => index.isRail(net));
    if (index.powerNets.has(rail) && index.groundNets.has(rail)) continue;
    const signal = nets.find((net) => net !== rail);
    const peers = index.portsByNet.get(signal) ?? [];
    const switches = peers.filter((port) => {
      const type = index.components.get(port.source_component_id)?.ftype;
      return type === "simple_switch" || type === "simple_push_button";
    });
    if (switches.length !== 1 || peers.filter(
      (port) => index.components.get(port.source_component_id)?.ftype === "simple_resistor"
    ).length !== 1)
      continue;
    const signalPort = switches[0];
    const switchId = signalPort.source_component_id;
    const switchType = index.components.get(switchId)?.ftype;
    const switchNets = index.twoTerminalNets(switchId);
    const otherRail = switchNets?.find((net) => net !== signal);
    if (!otherRail) continue;
    const pullDirection = index.powerNets.has(rail) ? "up" : "down";
    if (pullDirection === "up" ? !index.groundNets.has(otherRail) || index.powerNets.has(otherRail) : !index.powerNets.has(otherRail) || index.groundNets.has(otherRail))
      continue;
    if ([id, switchId].some(
      (componentId) => index.portsByComponent.get(componentId)?.some((port) => port.do_not_connect)
    ))
      continue;
    const resistor = index.placement(id);
    const switchBox = index.placement(switchId);
    const pin = index.port(signalPort);
    if (!resistor || !switchBox || !pin || !index.sameLocalScope(resistor, switchBox))
      continue;
    pairs.push({
      resistor,
      switchBox,
      signalPort,
      signalSchY: pin.center.y,
      pullDirection,
      horizontalPushbutton: switchType === "simple_push_button" && isHorizontal(id) && isHorizontal(switchId)
    });
  }
  return pairs;
}
function getHorizontalPushbuttonComponentIds(index) {
  return new Set(
    getSwitchPullResistorPairs(index).flatMap(
      (pair) => pair.horizontalPushbutton ? [pair.resistor.sourceComponentId, pair.switchBox.sourceComponentId] : []
    )
  );
}

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/PullResistorPlacementSolver/PullResistorPlacementSolver.ts
var PullResistorPlacementSolver = class _PullResistorPlacementSolver extends BaseSolver16 {
  // Ignore small offsets and resistors straddling the signal's horizontal line.
  static MIN_WRONG_SIDE_GAP = 1.5;
  index;
  resistorIds;
  horizontalPushbuttonComponentIds;
  issues;
  currentIndex = 0;
  constructor({
    ctx,
    issues
  }) {
    super();
    this.issues = issues;
    this.index = new PlacementNetworkIndex(ctx);
    this.horizontalPushbuttonComponentIds = getHorizontalPushbuttonComponentIds(
      this.index
    );
    this.resistorIds = [...this.index.components.values()].filter(
      (component) => component.ftype === "simple_resistor" && component.resistance > 0
    ).map((component) => component.source_component_id);
    this.solved = this.resistorIds.length === 0;
  }
  _step() {
    const id = this.resistorIds[this.currentIndex++];
    this.solved = this.currentIndex >= this.resistorIds.length;
    if (!id) return;
    if (this.horizontalPushbuttonComponentIds.has(id)) return;
    const index = this.index;
    const resistor = index.placement(id);
    const nets = index.twoTerminalNets(id);
    if (!resistor || !nets) return;
    const rails = nets.filter((net) => index.isRail(net));
    if (rails.length !== 1) return;
    const rail = rails[0];
    if (index.powerNets.has(rail) && index.groundNets.has(rail)) return;
    const pullDirection = index.groundNets.has(rail) ? "down" : "up";
    const signal = nets.find((net) => net !== rail);
    const signalPorts = index.portsByNet.get(signal) ?? [];
    const requiringPorts = signalPorts.filter(
      (port) => port.needs_external_pullup || port.needs_external_pulldown
    );
    if (requiringPorts.length !== 1) return;
    const signalPort = requiringPorts[0];
    if (signalPort.needs_external_pullup && signalPort.needs_external_pulldown)
      return;
    if (pullDirection === "up" ? !signalPort.needs_external_pullup : !signalPort.needs_external_pulldown)
      return;
    const host = index.placement(signalPort.source_component_id);
    const schematicPin = index.port(signalPort);
    if (!host || !schematicPin || !index.sameLocalScope(host, resistor)) return;
    if (signalPorts.some((port) => {
      const otherId = port.source_component_id;
      if (otherId === id || otherId === signalPort.source_component_id)
        return false;
      const type = index.components.get(otherId)?.ftype;
      if (type !== "simple_capacitor") return true;
      const capacitorNets = index.twoTerminalNets(otherId);
      const returnNet = capacitorNets?.find((net) => net !== signal);
      if (!returnNet || !index.groundNets.has(returnNet) || index.powerNets.has(returnNet))
        return true;
      const capacitor = index.placement(otherId);
      return !capacitor || !index.sameLocalScope(host, capacitor);
    }))
      return;
    const signalSchY = schematicPin.center.y;
    const wrongSideGap = pullDirection === "up" ? signalSchY - (resistor.schY + resistor.height / 2) : resistor.schY - resistor.height / 2 - signalSchY;
    if (wrongSideGap <= _PullResistorPlacementSolver.MIN_WRONG_SIDE_GAP) return;
    const preferredSide = pullDirection === "up" ? "above" : "below";
    this.issues.push({
      lineItemType: "PullResistorOnWrongSide",
      resistorSchematicBox: resistor,
      hostSchematicBox: host,
      signalSourcePortId: signalPort.source_port_id,
      signalPinName: signalPort.name,
      signalSchY,
      pullDirection,
      preferredSide,
      wrongSideGap,
      maxRecommendedWrongSideGap: _PullResistorPlacementSolver.MIN_WRONG_SIDE_GAP,
      message: `consider placing ${resistor.sourceComponentName ?? id} ${preferredSide} ${host.sourceComponentName ?? signalPort.source_component_id}.${signalPort.name} so the pull-${pullDirection} branch reads toward ${pullDirection === "up" ? "power" : "ground"}`
    });
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(
      attrs,
      "resistorName",
      issue.resistorSchematicBox.sourceComponentName
    );
    addAttr(attrs, "hostName", issue.hostSchematicBox.sourceComponentName);
    addAttr(attrs, "signalPin", issue.signalPinName);
    addAttr(attrs, "pullDirection", issue.pullDirection);
    addAttr(attrs, "preferredSide", issue.preferredSide);
    addAttr(attrs, "signalSchY", issue.signalSchY);
    addAttr(attrs, "wrongSideGap", issue.wrongSideGap);
    addAttr(attrs, "message", issue.message);
    return `<PullResistorOnWrongSide ${attrs.join(" ")} />`;
  }
};

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/TwoPinComponentRailOrientationSolver/TwoPinComponentRailOrientationSolver.ts
import { BaseSolver as BaseSolver17 } from "@tscircuit/solver-utils";
var TwoPinComponentRailOrientationSolver = class _TwoPinComponentRailOrientationSolver extends BaseSolver17 {
  static EPSILON = 0.01;
  index;
  powerNets;
  groundNets;
  positiveVoltageNets = /* @__PURE__ */ new Set();
  componentIds;
  horizontalPushbuttonComponentIds;
  issues;
  currentIndex = 0;
  constructor({
    ctx,
    issues
  }) {
    super();
    this.issues = issues;
    this.index = new PlacementNetworkIndex(ctx);
    this.horizontalPushbuttonComponentIds = getHorizontalPushbuttonComponentIds(
      this.index
    );
    this.powerNets = new Set(this.index.powerNets);
    this.groundNets = new Set(this.index.groundNets);
    for (const element of ctx.circuitJson) {
      if (element.type === "source_net" && element.is_positive_voltage_source)
        this.positiveVoltageNets.add(
          this.index.connected(element.source_net_id)
        );
      if (element.type !== "source_port") continue;
      const net = this.index.connected(element.source_port_id);
      if (element.provides_power || element.requires_power)
        this.powerNets.add(net);
      if (element.provides_ground || element.requires_ground)
        this.groundNets.add(net);
    }
    this.componentIds = [...this.index.components.keys()].filter(
      (id) => this.index.portsByComponent.get(id)?.length === 2
    );
    this.solved = this.componentIds.length === 0;
  }
  _step() {
    const id = this.componentIds[this.currentIndex++];
    this.solved = this.currentIndex >= this.componentIds.length;
    if (!id) return;
    const index = this.index;
    const component = index.placement(id);
    const sourceComponent = index.components.get(id);
    const nets = index.twoTerminalNets(id);
    if (!component || !nets) return;
    if (sourceComponent?.ftype === "simple_inductor" && !nets.some((net) => this.groundNets.has(net)))
      return;
    if (sourceComponent?.ftype === "simple_diode" && nets.every((net) => this.powerNets.has(net)))
      return;
    if (nets.some((net) => this.powerNets.has(net) && this.groundNets.has(net)))
      return;
    const railTypes = nets.map(
      (net) => this.powerNets.has(net) ? "power" : this.groundNets.has(net) ? "ground" : void 0
    );
    if (railTypes.every((type) => type === void 0)) return;
    const railType = railTypes.includes("power") ? "power" : "ground";
    const candidates = nets.flatMap(
      (net, i) => railTypes[i] === railType ? [{ net, index: i }] : []
    );
    const railIndex = (candidates.find(
      ({ net }) => index.portsByNet.get(net)?.some(
        (port) => railType === "power" ? port.provides_power : port.provides_ground
      )
    ) ?? candidates.find(
      ({ net }) => (railType === "power" ? index.powerNets : index.groundNets).has(net)
    ) ?? candidates[0]).index;
    const rail = nets[railIndex];
    const sourcePorts = index.portsByComponent.get(id);
    const railSourcePort = sourcePorts.find(
      (port) => index.connected(port.source_port_id) === rail
    );
    const otherSourcePort = sourcePorts.find((port) => port !== railSourcePort);
    const railPort = index.port(railSourcePort);
    const otherPort = index.port(otherSourcePort);
    if (!railPort || !otherPort) return;
    const invertedRails = this.positiveVoltageNets.has(rail) && this.groundNets.has(index.connected(otherSourcePort.source_port_id)) && Math.abs(railPort.center.x - otherPort.center.x) <= _TwoPinComponentRailOrientationSolver.EPSILON && railPort.center.y < otherPort.center.y - _TwoPinComponentRailOrientationSolver.EPSILON && railPort.facing_direction === "down" && otherPort.facing_direction === "up";
    if (invertedRails) {
      this.issues.push({
        lineItemType: "TwoPinComponentHasInvertedRails",
        schematicBox: component,
        railSourcePortId: railSourcePort.source_port_id,
        railPinName: railSourcePort.name,
        railType: "power",
        deltaSchRotation: 180,
        suggestedRailFacingDirection: "up",
        message: `rotate ${component.sourceComponentName ?? id} by 180\xB0 so its positive-supply pin faces up and its ground pin faces down; preserve pin connections and reroute attached traces`
      });
      return;
    }
    const horizontal = Math.abs(railPort.center.y - otherPort.center.y) <= _TwoPinComponentRailOrientationSolver.EPSILON && Math.abs(railPort.center.x - otherPort.center.x) > _TwoPinComponentRailOrientationSolver.EPSILON && (railPort.facing_direction === "left" && otherPort.facing_direction === "right" || railPort.facing_direction === "right" && otherPort.facing_direction === "left");
    if (!horizontal) return;
    if (this.horizontalPushbuttonComponentIds.has(id)) return;
    const suggestedRailFacingDirection = railType === "power" ? "up" : "down";
    const deltaSchRotation = railPort.facing_direction === "left" === (railType === "power") ? -90 : 90;
    this.issues.push({
      lineItemType: "TwoPinComponentShouldBeVertical",
      schematicBox: component,
      railSourcePortId: railSourcePort.source_port_id,
      railPinName: railSourcePort.name,
      railType,
      deltaSchRotation,
      suggestedRailFacingDirection,
      message: `rotate ${component.sourceComponentName ?? id} by ${deltaSchRotation}\xB0 so its ${railType}-connected pin faces ${suggestedRailFacingDirection} and the component is vertical`
    });
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(attrs, "componentName", issue.schematicBox.sourceComponentName);
    addAttr(attrs, "railPin", issue.railPinName);
    addAttr(attrs, "railType", issue.railType);
    addAttr(attrs, "deltaSchRotation", issue.deltaSchRotation);
    addAttr(
      attrs,
      "suggestedRailFacingDirection",
      issue.suggestedRailFacingDirection
    );
    addAttr(attrs, "message", issue.message);
    return `<${issue.lineItemType} ${attrs.join(" ")} />`;
  }
};

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/utils/schematic-box-components.ts
function getSchematicBoxComponentIds(circuitJson) {
  return new Set(
    circuitJson.flatMap(
      (element) => element.type === "schematic_component" && element.is_box_with_pins !== false && !element.symbol_name && !element.schematic_symbol_id ? [element.schematic_component_id] : []
    )
  );
}

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/SchematicBoxInnerLabelCollisionSolver/SchematicBoxInnerLabelCollisionSolver.ts
import { BaseSolver as BaseSolver18 } from "@tscircuit/solver-utils";
var SchematicBoxInnerLabelCollisionSolver = class extends BaseSolver18 {
  constructor(params) {
    super();
    this.params = params;
    const { circuitJson, componentPlacements } = params.ctx;
    this.placementById = this.getPlacementBySchematicComponentId(componentPlacements);
    this.sourcePortById = this.getSourcePortById(circuitJson);
    const boxIds = getSchematicBoxComponentIds(circuitJson);
    this.entries = Array.from(
      this.getPortsBySchematicComponentId(circuitJson)
    ).filter(([id]) => boxIds.has(id));
    this.solved = this.entries.length === 0;
  }
  params;
  MESSAGE = "Inner labels are colliding. Increase the schWidth or schHeight.";
  PIN_LABEL_EDGE_PADDING = 0.1;
  PIN_LABEL_TEXT_HEIGHT = 0.15;
  PIN_NAME_CHARACTER_WIDTH = 0.095;
  FALLBACK_CHARACTER_WIDTH = 0.13;
  INNER_LABEL_COLLISION_PADDING = 0.02;
  COLLISION_COMPARISON_EPSILON = 1e-9;
  entries;
  placementById;
  sourcePortById;
  currentIndex = 0;
  _step() {
    const entry = this.entries[this.currentIndex++];
    if (!entry) {
      this.solved = true;
      return;
    }
    this.solved = this.currentIndex >= this.entries.length;
    const [schematicComponentId, ports] = entry;
    const schematicBox = this.placementById.get(schematicComponentId);
    if (!schematicBox) return;
    const bounds = this.getCenteredRectBounds(schematicBox);
    const labelRects = this.getLabelRects(bounds, ports, this.sourcePortById);
    if (labelRects.length === 0) return;
    const collisionSummary = this.getCollisionSummary(labelRects);
    if (collisionSummary.overlappingSides.length === 0) return;
    this.params.issues.push({
      lineItemType: "SchematicBoxInnerLabelCollision",
      schematicBox,
      overlappingSides: collisionSummary.overlappingSides,
      message: this.MESSAGE
    });
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(attrs, "message", issue.message);
    addAttr(attrs, "componentName", issue.schematicBox.sourceComponentName);
    addAttr(attrs, "currentSchWidth", issue.schematicBox.width);
    addAttr(attrs, "currentSchHeight", issue.schematicBox.height);
    addAttr(attrs, "overlappingSides", issue.overlappingSides.join(","));
    return `<SchematicBoxInnerLabelCollision ${attrs.join(" ")} />`;
  }
  isSchematicPort(el) {
    return el.type === "schematic_port";
  }
  isSourcePort(el) {
    return el.type === "source_port";
  }
  isSchematicSide(side) {
    return side === "left" || side === "right" || side === "top" || side === "bottom";
  }
  isPinNameLabel(label, sourcePort) {
    if (!sourcePort) return false;
    return label === sourcePort.name || label === String(sourcePort.pin_number) || (sourcePort.port_hints ?? []).includes(label);
  }
  estimateLabelLength(label, sourcePort) {
    return Array.from(label).length * (this.isPinNameLabel(label, sourcePort) ? this.PIN_NAME_CHARACTER_WIDTH : this.FALLBACK_CHARACTER_WIDTH);
  }
  hasCollision(requiredGrowth) {
    return requiredGrowth > this.COLLISION_COMPARISON_EPSILON;
  }
  getCenteredRectBounds(box) {
    return {
      left: box.schX - box.width / 2,
      right: box.schX + box.width / 2,
      top: box.schY + box.height / 2,
      bottom: box.schY - box.height / 2
    };
  }
  getSourcePortById(circuitJson) {
    return new Map(
      circuitJson.filter((el) => this.isSourcePort(el)).map((sp) => [sp.source_port_id, sp])
    );
  }
  getPlacementBySchematicComponentId(componentPlacements) {
    return new Map(
      componentPlacements.filter((p) => p.schematicComponentId).map((p) => [p.schematicComponentId, p])
    );
  }
  getPortsBySchematicComponentId(circuitJson) {
    const map = /* @__PURE__ */ new Map();
    for (const port of circuitJson.filter((el) => this.isSchematicPort(el))) {
      if (!port.schematic_component_id) continue;
      if (!this.isSchematicSide(port.side_of_component)) continue;
      const ports = map.get(port.schematic_component_id);
      if (ports) ports.push(port);
      else map.set(port.schematic_component_id, [port]);
    }
    return map;
  }
  getLabelRects(bounds, ports, sourcePortById) {
    const rects = [];
    for (const port of ports) {
      if (!this.isSchematicSide(port.side_of_component)) continue;
      if (!port.display_pin_label) continue;
      const labelLength = this.estimateLabelLength(
        port.display_pin_label,
        sourcePortById.get(port.source_port_id)
      );
      const halfTextHeight = this.PIN_LABEL_TEXT_HEIGHT / 2;
      switch (port.side_of_component) {
        case "left": {
          const xMin = bounds.left + this.PIN_LABEL_EDGE_PADDING;
          rects.push({
            side: port.side_of_component,
            xMin,
            xMax: xMin + labelLength,
            yMin: port.center.y - halfTextHeight,
            yMax: port.center.y + halfTextHeight
          });
          break;
        }
        case "right": {
          const xMax = bounds.right - this.PIN_LABEL_EDGE_PADDING;
          rects.push({
            side: port.side_of_component,
            xMin: xMax - labelLength,
            xMax,
            yMin: port.center.y - halfTextHeight,
            yMax: port.center.y + halfTextHeight
          });
          break;
        }
        case "top": {
          const yMax = bounds.top - this.PIN_LABEL_EDGE_PADDING;
          rects.push({
            side: port.side_of_component,
            xMin: port.center.x - halfTextHeight,
            xMax: port.center.x + halfTextHeight,
            yMin: yMax - labelLength,
            yMax
          });
          break;
        }
        case "bottom": {
          const yMin = bounds.bottom + this.PIN_LABEL_EDGE_PADDING;
          rects.push({
            side: port.side_of_component,
            xMin: port.center.x - halfTextHeight,
            xMax: port.center.x + halfTextHeight,
            yMin,
            yMax: yMin + labelLength
          });
          break;
        }
      }
    }
    return rects;
  }
  getCollisionSummary(rects) {
    const overlappingSides = /* @__PURE__ */ new Set();
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        if (a.side === b.side) continue;
        if (!this.rectsOverlap(a, b)) continue;
        overlappingSides.add(a.side);
        overlappingSides.add(b.side);
      }
    }
    return {
      overlappingSides: this.sortSides(Array.from(overlappingSides))
    };
  }
  rectsOverlap(a, b) {
    return this.hasCollision(
      Math.min(a.xMax, b.xMax) - Math.max(a.xMin, b.xMin) + this.INNER_LABEL_COLLISION_PADDING
    ) && this.hasCollision(
      Math.min(a.yMax, b.yMax) - Math.max(a.yMin, b.yMin) + this.INNER_LABEL_COLLISION_PADDING
    );
  }
  sortSides(sides) {
    const order = {
      left: 0,
      right: 1,
      top: 2,
      bottom: 3
    };
    return sides.sort((a, b) => order[a] - order[b]);
  }
};

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/SchematicBoxOverlapSolver/SchematicBoxOverlapSolver.ts
import { BaseSolver as BaseSolver19 } from "@tscircuit/solver-utils";
var SchematicBoxOverlapSolver = class _SchematicBoxOverlapSolver extends BaseSolver19 {
  constructor(params) {
    super();
    this.params = params;
    this.placements = params.ctx.componentPlacements;
    this.solved = this.placements.length < 2;
  }
  params;
  placements;
  firstIndex = 0;
  secondIndex = 1;
  _step() {
    if (this.firstIndex >= this.placements.length - 1) {
      this.solved = true;
      return;
    }
    const overlap = this.getComponentOverlap(
      this.placements[this.firstIndex],
      this.placements[this.secondIndex]
    );
    if (overlap) this.params.issues.push(overlap);
    this.secondIndex++;
    if (this.secondIndex >= this.placements.length) {
      this.firstIndex++;
      this.secondIndex = this.firstIndex + 1;
    }
    this.solved = this.firstIndex >= this.placements.length - 1;
  }
  getCenteredRectBounds(box) {
    return {
      left: box.schX - box.width / 2,
      right: box.schX + box.width / 2,
      top: box.schY - box.height / 2,
      bottom: box.schY + box.height / 2
    };
  }
  getOverlapCorrectionSuggestions({
    firstComponent,
    secondComponent,
    overlapWidth,
    overlapHeight
  }) {
    const firstArea = firstComponent.width * firstComponent.height;
    const secondArea = secondComponent.width * secondComponent.height;
    const target = firstArea <= secondArea ? firstComponent : secondComponent;
    const other = target === firstComponent ? secondComponent : firstComponent;
    const deltaSchX = target.schX <= other.schX ? -overlapWidth : overlapWidth;
    const deltaSchY = target.schY <= other.schY ? -overlapHeight : overlapHeight;
    return [
      {
        targetComponentName: target.sourceComponentName,
        deltaSchX,
        deltaSchY: 0,
        newSchX: target.schX + deltaSchX,
        newSchY: target.schY
      },
      {
        targetComponentName: target.sourceComponentName,
        deltaSchX: 0,
        deltaSchY,
        newSchX: target.schX,
        newSchY: target.schY + deltaSchY
      }
    ];
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(attrs, "component1Name", issue.firstComponent.sourceComponentName);
    addAttr(attrs, "component2Name", issue.secondComponent.sourceComponentName);
    addAttr(attrs, "component1SchX", issue.firstComponent.schX);
    addAttr(attrs, "component1SchY", issue.firstComponent.schY);
    addAttr(attrs, "component2SchX", issue.secondComponent.schX);
    addAttr(attrs, "component2SchY", issue.secondComponent.schY);
    addAttr(attrs, "overlapWidth", issue.overlapWidth);
    addAttr(attrs, "overlapHeight", issue.overlapHeight);
    return [
      `<ComponentOverlap ${attrs.join(" ")}>`,
      ...issue.correctionSuggestions.map(
        _SchematicBoxOverlapSolver.correctionSuggestionToString
      ),
      "</ComponentOverlap>"
    ].join("\n");
  }
  static correctionSuggestionToString(suggestion) {
    const attrs = [];
    addAttr(attrs, "target", suggestion.targetComponentName);
    if (suggestion.deltaSchX !== 0) {
      addAttr(attrs, "newSchX", suggestion.newSchX);
      addAttr(attrs, "deltaSchX", suggestion.deltaSchX, { formatDelta: true });
    }
    if (suggestion.deltaSchY !== 0) {
      addAttr(attrs, "newSchY", suggestion.newSchY);
      addAttr(attrs, "deltaSchY", suggestion.deltaSchY, { formatDelta: true });
    }
    return `<OverlapCorrectionSuggestion ${attrs.join(" ")} />`;
  }
  getComponentOverlap(firstComponent, secondComponent) {
    if (firstComponent.schematicSheetId !== secondComponent.schematicSheetId)
      return null;
    const a = this.getCenteredRectBounds(firstComponent);
    const b = this.getCenteredRectBounds(secondComponent);
    const overlapWidth = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const overlapHeight = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (overlapWidth <= 0 || overlapHeight <= 0) return null;
    return {
      lineItemType: "ComponentOverlap",
      firstComponent,
      secondComponent,
      overlapWidth,
      overlapHeight,
      correctionSuggestions: this.getOverlapCorrectionSuggestions({
        firstComponent,
        secondComponent,
        overlapWidth,
        overlapHeight
      })
    };
  }
};

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/SchematicBoxTooWideSolver/SchematicBoxTooWideSolver.ts
import { BaseSolver as BaseSolver20 } from "@tscircuit/solver-utils";
var SchematicBoxTooWideSolver = class extends BaseSolver20 {
  constructor(params) {
    super();
    this.params = params;
    const { circuitJson, componentPlacements } = params.ctx;
    this.placementById = this.getPlacementBySchematicComponentId(componentPlacements);
    this.sourcePortById = this.getSourcePortById(circuitJson);
    this.sourceComponentById = this.getSourceComponentById(circuitJson);
    const boxIds = getSchematicBoxComponentIds(circuitJson);
    this.entries = Array.from(
      this.getPortsBySchematicComponentId(circuitJson)
    ).filter(([id]) => boxIds.has(id));
    this.solved = this.entries.length === 0;
  }
  params;
  SCHEMATIC_BOX_TOO_WIDE_MESSAGE = "Shrink schematic box width";
  PIN_HEADER_MAX_ALLOWED_GAP = 0.1;
  GENERIC_MAX_ALLOWED_GAP = 1;
  PIN_LABEL_EDGE_PADDING = 0.1;
  PIN_NAME_CHARACTER_WIDTH = 0.095;
  FALLBACK_CHARACTER_WIDTH = 0.13;
  GAP_COMPARISON_EPSILON = 1e-9;
  entries;
  placementById;
  sourcePortById;
  sourceComponentById;
  currentIndex = 0;
  _step() {
    const entry = this.entries[this.currentIndex++];
    if (!entry) {
      this.solved = true;
      return;
    }
    this.solved = this.currentIndex >= this.entries.length;
    const [schematicComponentId, ports] = entry;
    const schematicBox = this.placementById.get(schematicComponentId);
    if (!schematicBox) return;
    const sourceComponent = schematicBox.sourceComponentId ? this.sourceComponentById.get(schematicBox.sourceComponentId) : void 0;
    if (sourceComponent?.ftype === "simple_connector" && sourceComponent.standard === "usb_c")
      return;
    const bounds = this.getCenteredRectBounds(schematicBox);
    const leftCol = this.getLabelColumn("left", ports, this.sourcePortById);
    const rightCol = this.getLabelColumn("right", ports, this.sourcePortById);
    const ftype = this.getSourceComponentFtype(
      schematicBox,
      this.sourceComponentById
    );
    let measuredSpace;
    if (leftCol && rightCol) {
      measuredSpace = this.getInnerLabelEdge(bounds, rightCol) - this.getInnerLabelEdge(bounds, leftCol);
    } else if (leftCol && leftCol.labelCount >= 4) {
      measuredSpace = bounds.right - this.getInnerLabelEdge(bounds, leftCol);
    } else if (rightCol && rightCol.labelCount >= 4) {
      measuredSpace = this.getInnerLabelEdge(bounds, rightCol) - bounds.left;
    }
    if (measuredSpace === void 0) return;
    const maxAllowed = ftype === "simple_pin_header" ? this.PIN_HEADER_MAX_ALLOWED_GAP : this.GENERIC_MAX_ALLOWED_GAP;
    if (!this.exceedsMaxAllowedGap(measuredSpace, maxAllowed)) return;
    const suggestedSchWidth = this.getSuggestedWidth({
      measuredInnerLabelHorizontalEmptySpace: measuredSpace,
      maxAllowedInnerLabelHorizontalEmptySpace: maxAllowed,
      currentWidth: schematicBox.width
    });
    if (ftype === "simple_pin_header") {
      this.params.issues.push({
        lineItemType: "PinHeaderSchematicBoxTooWide",
        schematicBox,
        measuredInnerLabelHorizontalEmptySpace: measuredSpace,
        maxAllowedInnerLabelHorizontalEmptySpace: maxAllowed,
        suggestedSchWidth,
        message: this.SCHEMATIC_BOX_TOO_WIDE_MESSAGE
      });
    } else {
      this.params.issues.push({
        lineItemType: "GenericSchematicBoxTooWide",
        schematicBox,
        measuredInnerLabelHorizontalEmptySpace: measuredSpace,
        maxAllowedInnerLabelHorizontalEmptySpace: maxAllowed,
        suggestedSchWidth,
        message: this.SCHEMATIC_BOX_TOO_WIDE_MESSAGE
      });
    }
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(attrs, "message", issue.message);
    addAttr(attrs, "componentName", issue.schematicBox.sourceComponentName);
    addAttr(attrs, "currentSchWidth", issue.schematicBox.width);
    addAttr(
      attrs,
      "measuredInnerLabelHorizontalEmptySpace",
      issue.measuredInnerLabelHorizontalEmptySpace
    );
    addAttr(
      attrs,
      "maxAllowedInnerLabelHorizontalEmptySpace",
      issue.maxAllowedInnerLabelHorizontalEmptySpace
    );
    addAttr(attrs, "suggestedSchWidth", issue.suggestedSchWidth);
    return `<${issue.lineItemType} ${attrs.join(" ")} />`;
  }
  isSchematicPort(el) {
    return el.type === "schematic_port";
  }
  isSourcePort(el) {
    return el.type === "source_port";
  }
  isHorizontalSide(side) {
    return side === "left" || side === "right";
  }
  getSourceComponentWithFtype(el) {
    if (el.type !== "source_component" || !("source_component_id" in el) || typeof el.source_component_id !== "string")
      return null;
    return {
      type: "source_component",
      source_component_id: el.source_component_id,
      standard: "standard" in el && typeof el.standard === "string" ? el.standard : void 0,
      ftype: "ftype" in el && typeof el.ftype === "string" ? el.ftype : void 0
    };
  }
  isPinNameLabel(label, sourcePort) {
    if (!sourcePort) return false;
    return label === sourcePort.name || label === String(sourcePort.pin_number) || (sourcePort.port_hints ?? []).includes(label);
  }
  estimateLabelWidth(label, sourcePort) {
    return Array.from(label).length * (this.isPinNameLabel(label, sourcePort) ? this.PIN_NAME_CHARACTER_WIDTH : this.FALLBACK_CHARACTER_WIDTH);
  }
  exceedsMaxAllowedGap(measured, maxAllowed) {
    return measured - maxAllowed > this.GAP_COMPARISON_EPSILON;
  }
  getCenteredRectBounds(box) {
    return {
      left: box.schX - box.width / 2,
      right: box.schX + box.width / 2,
      top: box.schY + box.height / 2,
      bottom: box.schY - box.height / 2
    };
  }
  getSourcePortById(circuitJson) {
    return new Map(
      circuitJson.filter((el) => this.isSourcePort(el)).map((sp) => [sp.source_port_id, sp])
    );
  }
  getSourceComponentById(circuitJson) {
    return new Map(
      circuitJson.flatMap((el) => {
        const sc = this.getSourceComponentWithFtype(el);
        return sc ? [sc] : [];
      }).map((sc) => [sc.source_component_id, sc])
    );
  }
  getPlacementBySchematicComponentId(componentPlacements) {
    return new Map(
      componentPlacements.filter((p) => p.schematicComponentId).map((p) => [p.schematicComponentId, p])
    );
  }
  getPortsBySchematicComponentId(circuitJson) {
    const map = /* @__PURE__ */ new Map();
    for (const port of circuitJson.filter((el) => this.isSchematicPort(el))) {
      if (!port.schematic_component_id) continue;
      if (!this.isHorizontalSide(port.side_of_component)) continue;
      const ports = map.get(port.schematic_component_id);
      if (ports) ports.push(port);
      else map.set(port.schematic_component_id, [port]);
    }
    return map;
  }
  getSourceComponentFtype(schematicBox, sourceComponentById) {
    return schematicBox.sourceComponentId ? sourceComponentById.get(schematicBox.sourceComponentId)?.ftype : void 0;
  }
  getLabelColumn(side, ports, sourcePortById) {
    const widths = ports.filter((p) => p.side_of_component === side).flatMap(
      (p) => p.display_pin_label ? [
        this.estimateLabelWidth(
          p.display_pin_label,
          sourcePortById.get(p.source_port_id)
        )
      ] : []
    );
    if (widths.length === 0) return null;
    return {
      side,
      labelCount: widths.length,
      maxLabelWidth: Math.max(...widths)
    };
  }
  getInnerLabelEdge(bounds, col) {
    return col.side === "left" ? bounds.left + this.PIN_LABEL_EDGE_PADDING + col.maxLabelWidth : bounds.right - this.PIN_LABEL_EDGE_PADDING - col.maxLabelWidth;
  }
  getSuggestedWidth(input) {
    return input.currentWidth - input.measuredInnerLabelHorizontalEmptySpace + input.maxAllowedInnerLabelHorizontalEmptySpace;
  }
};

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/SchematicPinPaddingToEdgeSolver/SchematicPinPaddingToEdgeSolver.ts
import { BaseSolver as BaseSolver21 } from "@tscircuit/solver-utils";
var SchematicPinPaddingToEdgeSolver = class extends BaseSolver21 {
  constructor(params) {
    super();
    this.params = params;
    const { circuitJson, componentPlacements } = params.ctx;
    this.placementById = this.getPlacementBySchematicComponentId(componentPlacements);
    this.schematicComponentById = this.getSchematicComponentById(circuitJson);
    this.sourcePortById = this.getSourcePortById(circuitJson);
    const boxIds = getSchematicBoxComponentIds(circuitJson);
    this.entries = Array.from(
      this.getPortsBySchematicComponentId(circuitJson)
    ).filter(([id]) => boxIds.has(id));
    this.solved = this.entries.length === 0;
  }
  params;
  MESSAGE = "Move schematic pins closer to the box edge or change the schematic box";
  PIN_NAME_CHARACTER_WIDTH = 0.095;
  FALLBACK_CHARACTER_WIDTH = 0.13;
  GAP_COMPARISON_EPSILON = 1e-9;
  entries;
  placementById;
  schematicComponentById;
  sourcePortById;
  currentIndex = 0;
  _step() {
    const entry = this.entries[this.currentIndex++];
    if (!entry) {
      this.solved = true;
      return;
    }
    this.solved = this.currentIndex >= this.entries.length;
    const [schematicComponentId, ports] = entry;
    const schematicBox = this.placementById.get(schematicComponentId);
    if (!schematicBox) return;
    const pinSpacing = this.getPinSpacing(
      schematicBox,
      this.schematicComponentById
    );
    if (pinSpacing === null) return;
    const maxLabelLengthBySide = this.getMaxLabelLengthBySide(
      ports,
      this.sourcePortById
    );
    const portsBySide = /* @__PURE__ */ new Map();
    for (const port of ports) {
      if (!this.isSchematicSide(port.side_of_component)) continue;
      const sidePorts = portsBySide.get(port.side_of_component) ?? [];
      sidePorts.push(port);
      portsBySide.set(port.side_of_component, sidePorts);
    }
    const useLabelAwareMaxPadding = this.hasPinsOnAllSides(portsBySide);
    const candidates = [];
    for (const [pinSide, sidePorts] of portsBySide) {
      if (sidePorts.length === 1) continue;
      for (const edgeSide of this.getBoxEdgeSidesForPinSide(pinSide)) {
        const outerPin = this.getOuterPinBySide(edgeSide, sidePorts);
        if (!outerPin) continue;
        const measuredPadding = this.getPinPaddingToEdge(
          schematicBox,
          outerPin,
          edgeSide
        );
        const maxAllowedPadding = useLabelAwareMaxPadding ? this.getMaxAllowedPinPadding(
          pinSpacing,
          edgeSide,
          maxLabelLengthBySide
        ) : pinSpacing;
        if (!this.exceedsMaxAllowedGap(
          measuredPadding,
          maxAllowedPadding + pinSpacing
        ))
          continue;
        candidates.push({
          schematicBox,
          pinSide,
          edgeSide,
          pinName: this.getPinName(outerPin, this.sourcePortById),
          measuredPadding,
          maxAllowedPadding
        });
      }
    }
    if (!candidates.length) return;
    const details = candidates.map((candidate) => this.createIssue(candidate));
    const representative = details.reduce(
      (a, b) => b.excessPadding > a.excessPadding ? b : a
    );
    const widths = details.flatMap(
      (detail) => detail.suggestedSchWidth === void 0 ? [] : [detail.suggestedSchWidth]
    );
    const heights = details.flatMap(
      (detail) => detail.suggestedSchHeight === void 0 ? [] : [detail.suggestedSchHeight]
    );
    const dimensions = [
      widths.length ? "width" : "",
      heights.length ? "height" : ""
    ].filter(Boolean).join(" and ");
    this.params.issues.push({
      ...representative,
      paddingDetails: details.map(
        ({
          pinSide,
          edgeSide,
          pinName,
          measuredPadding,
          maxAllowedPadding,
          excessPadding
        }) => ({
          pinSide,
          edgeSide,
          pinName,
          measuredPadding,
          maxAllowedPadding,
          excessPadding
        })
      ),
      suggestedSchWidth: widths.length ? Math.max(...widths) : void 0,
      suggestedSchHeight: heights.length ? Math.max(...heights) : void 0,
      message: `${this.MESSAGE} ${dimensions}`
    });
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(attrs, "message", issue.message);
    addAttr(attrs, "componentName", issue.schematicBox.sourceComponentName);
    if (issue.paddingDetails) {
      addAttr(
        attrs,
        "pinSides",
        [...new Set(issue.paddingDetails.map((detail) => detail.pinSide))].join(
          ","
        )
      );
      addAttr(
        attrs,
        "edgeSides",
        [
          ...new Set(issue.paddingDetails.map((detail) => detail.edgeSide))
        ].join(",")
      );
    } else {
      addAttr(attrs, "pinSide", issue.pinSide);
      addAttr(attrs, "edgeSide", issue.edgeSide);
      addAttr(attrs, "pinName", issue.pinName);
      addAttr(attrs, "measuredPadding", issue.measuredPadding);
      addAttr(attrs, "maxAllowedPadding", issue.maxAllowedPadding);
      addAttr(attrs, "excessPadding", issue.excessPadding);
    }
    addAttr(attrs, "suggestedSchWidth", issue.suggestedSchWidth);
    addAttr(attrs, "suggestedSchHeight", issue.suggestedSchHeight);
    return `<SchematicPinPaddingToEdgeTooLarge ${attrs.join(" ")} />`;
  }
  isSchematicPort(el) {
    return el.type === "schematic_port";
  }
  isSourcePort(el) {
    return el.type === "source_port";
  }
  isSchematicComponent(el) {
    return el.type === "schematic_component";
  }
  isHorizontalSide(side) {
    return side === "left" || side === "right";
  }
  isVerticalSide(side) {
    return side === "top" || side === "bottom";
  }
  isSchematicSide(side) {
    return this.isHorizontalSide(side) || this.isVerticalSide(side);
  }
  isPinNameLabel(label, sourcePort) {
    if (!sourcePort) return false;
    return label === sourcePort.name || label === String(sourcePort.pin_number) || (sourcePort.port_hints ?? []).includes(label);
  }
  estimateLabelWidth(label, sourcePort) {
    return Array.from(label).length * (this.isPinNameLabel(label, sourcePort) ? this.PIN_NAME_CHARACTER_WIDTH : this.FALLBACK_CHARACTER_WIDTH);
  }
  exceedsMaxAllowedGap(measured, maxAllowed) {
    return measured - maxAllowed > this.GAP_COMPARISON_EPSILON;
  }
  getCenteredRectBounds(box) {
    return {
      left: box.schX - box.width / 2,
      right: box.schX + box.width / 2,
      top: box.schY + box.height / 2,
      bottom: box.schY - box.height / 2
    };
  }
  getSourcePortById(circuitJson) {
    return new Map(
      circuitJson.filter((el) => this.isSourcePort(el)).map((sp) => [sp.source_port_id, sp])
    );
  }
  getSchematicComponentById(circuitJson) {
    return new Map(
      circuitJson.filter((el) => this.isSchematicComponent(el)).map((sc) => [sc.schematic_component_id, sc])
    );
  }
  getPlacementBySchematicComponentId(componentPlacements) {
    return new Map(
      componentPlacements.filter((p) => p.schematicComponentId).map((p) => [p.schematicComponentId, p])
    );
  }
  getPortsBySchematicComponentId(circuitJson) {
    const map = /* @__PURE__ */ new Map();
    for (const port of circuitJson.filter((el) => this.isSchematicPort(el))) {
      if (!port.schematic_component_id) continue;
      if (!this.isSchematicSide(port.side_of_component)) continue;
      const ports = map.get(port.schematic_component_id);
      if (ports) ports.push(port);
      else map.set(port.schematic_component_id, [port]);
    }
    return map;
  }
  getPinSpacing(schematicBox, schematicComponentById) {
    if (!schematicBox.schematicComponentId) return null;
    const sc = schematicComponentById.get(schematicBox.schematicComponentId);
    return typeof sc?.pin_spacing === "number" ? sc.pin_spacing : null;
  }
  getPinName(port, sourcePortById) {
    const sp = sourcePortById.get(port.source_port_id);
    if (sp?.name) return sp.name;
    if (port.display_pin_label) return port.display_pin_label;
    if (sp?.pin_number !== void 0) return String(sp.pin_number);
    return void 0;
  }
  getMaxLabelLengthBySide(ports, sourcePortById) {
    const result = {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0
    };
    for (const port of ports) {
      if (!this.isSchematicSide(port.side_of_component)) continue;
      if (!port.display_pin_label) continue;
      result[port.side_of_component] = Math.max(
        result[port.side_of_component],
        this.estimateLabelWidth(
          port.display_pin_label,
          sourcePortById.get(port.source_port_id)
        )
      );
    }
    return result;
  }
  getOuterPinBySide(edgeSide, ports) {
    if (ports.length === 0) return null;
    switch (edgeSide) {
      case "top":
        return ports.reduce((a, b) => b.center.y > a.center.y ? b : a);
      case "bottom":
        return ports.reduce((a, b) => b.center.y < a.center.y ? b : a);
      case "left":
        return ports.reduce((a, b) => b.center.x < a.center.x ? b : a);
      case "right":
        return ports.reduce((a, b) => b.center.x > a.center.x ? b : a);
    }
  }
  getPinPaddingToEdge(schematicBox, port, edgeSide) {
    const bounds = this.getCenteredRectBounds(schematicBox);
    switch (edgeSide) {
      case "top":
        return Math.max(0, bounds.top - port.center.y);
      case "bottom":
        return Math.max(0, port.center.y - bounds.bottom);
      case "left":
        return Math.max(0, port.center.x - bounds.left);
      case "right":
        return Math.max(0, bounds.right - port.center.x);
    }
  }
  getBoxEdgeSidesForPinSide(pinSide) {
    return this.isHorizontalSide(pinSide) ? ["top", "bottom"] : ["left", "right"];
  }
  hasPinsOnAllSides(portsBySide) {
    return portsBySide.has("left") && portsBySide.has("right") && portsBySide.has("top") && portsBySide.has("bottom");
  }
  getMaxAllowedPinPadding(spacing, edgeSide, maxLabelLengthBySide) {
    const sides = this.isHorizontalSide(
      edgeSide
    ) ? ["left", "right"] : ["top", "bottom"];
    return (maxLabelLengthBySide[sides[0]] + maxLabelLengthBySide[sides[1]] + spacing) / 2;
  }
  createIssue(candidate) {
    const excessPadding = Math.max(
      0,
      candidate.measuredPadding - candidate.maxAllowedPadding
    );
    const reduction = excessPadding * 2;
    return {
      lineItemType: "SchematicPinPaddingToEdgeTooLarge",
      pinSide: candidate.pinSide,
      edgeSide: candidate.edgeSide,
      pinName: candidate.pinName,
      schematicBox: candidate.schematicBox,
      measuredPadding: candidate.measuredPadding,
      maxAllowedPadding: candidate.maxAllowedPadding,
      excessPadding,
      suggestedSchWidth: this.isHorizontalSide(candidate.pinSide) ? void 0 : Math.max(0, candidate.schematicBox.width - reduction),
      suggestedSchHeight: this.isHorizontalSide(candidate.pinSide) ? Math.max(0, candidate.schematicBox.height - reduction) : void 0,
      message: this.isHorizontalSide(candidate.pinSide) ? `${this.MESSAGE} height` : `${this.MESSAGE} width`
    };
  }
};

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/SchematicPlacementPipeline/SchematicPlacementPipeline.ts
import {
  BasePipelineSolver,
  definePipelineStep
} from "@tscircuit/solver-utils";

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/utils/placements.ts
import { cju as cju11 } from "@tscircuit/circuit-json-util";

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/utils/schematic-sheets.ts
var getSchematicSheetNamesById = (circuitJson) => {
  const map = /* @__PURE__ */ new Map();
  for (const element of circuitJson) {
    if (element.type === "schematic_sheet" && element.name) {
      map.set(element.schematic_sheet_id, element.name);
    }
  }
  return map;
};

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/utils/placements.ts
var isSchematicBox = (el) => el.type === "schematic_box";
var isSchematicComponent = (el) => el.type === "schematic_component";
var getSchematicSheetId = (el) => el.schematic_sheet_id;
var getSourceComponentName = (circuitJson, sourceComponentId) => {
  if (!sourceComponentId) return void 0;
  return cju11(circuitJson).source_component.get(sourceComponentId)?.name;
};
var getSourceComponentMetadata = (schematicBox, circuitJson) => {
  if (!schematicBox.schematic_component_id) return {};
  const util = cju11(circuitJson);
  const sc = util.schematic_component.get(schematicBox.schematic_component_id);
  if (!sc?.source_component_id) return {};
  const sourceComponent = util.source_component.get(sc.source_component_id);
  return {
    sourceComponentId: sc.source_component_id,
    sourceComponentName: sourceComponent?.name
  };
};
var schematicComponentToPlacement = (schematicComponent, circuitJson, schematicSheetNameById, schematicBox) => {
  let schematicSheetId = getSchematicSheetId(schematicComponent);
  if (schematicSheetId === void 0 && schematicBox) {
    schematicSheetId = getSchematicSheetId(schematicBox);
  }
  let schematicSheetName;
  if (schematicSheetId) {
    schematicSheetName = schematicSheetNameById.get(schematicSheetId);
  }
  const placement = {
    lineItemType: "SchematicBoxPlacement",
    positionAnchor: "center",
    schX: schematicComponent.center.x,
    schY: schematicComponent.center.y,
    width: schematicBox?.width ?? schematicComponent.size.width,
    height: schematicBox?.height ?? schematicComponent.size.height,
    sourceComponentId: schematicComponent.source_component_id,
    sourceComponentName: getSourceComponentName(
      circuitJson,
      schematicComponent.source_component_id
    ),
    schematicComponentId: schematicComponent.schematic_component_id,
    schematicSymbolId: schematicBox?.schematic_symbol_id ?? schematicComponent.schematic_symbol_id,
    subcircuitId: schematicComponent.subcircuit_id ?? schematicBox?.subcircuit_id
  };
  if (schematicSheetId) {
    placement.schematicSheetId = schematicSheetId;
  }
  if (schematicSheetName) {
    placement.schematicSheetName = schematicSheetName;
  }
  return placement;
};
var schematicBoxToPlacement = (schematicBox, circuitJson, schematicSheetNameById) => {
  const schematicSheetId = getSchematicSheetId(schematicBox);
  let schematicSheetName;
  if (schematicSheetId) {
    schematicSheetName = schematicSheetNameById.get(schematicSheetId);
  }
  const placement = {
    lineItemType: "SchematicBoxPlacement",
    positionAnchor: "center",
    schX: schematicBox.x,
    schY: schematicBox.y,
    width: schematicBox.width,
    height: schematicBox.height,
    ...getSourceComponentMetadata(schematicBox, circuitJson),
    schematicComponentId: schematicBox.schematic_component_id,
    schematicSymbolId: schematicBox.schematic_symbol_id,
    subcircuitId: schematicBox.subcircuit_id
  };
  if (schematicSheetId) {
    placement.schematicSheetId = schematicSheetId;
  }
  if (schematicSheetName) {
    placement.schematicSheetName = schematicSheetName;
  }
  return placement;
};
var buildSolverContext = (circuitJson) => {
  const schematicBoxes = circuitJson.filter(isSchematicBox);
  const schematicSheetNameById = getSchematicSheetNamesById(circuitJson);
  const schematicComponentIds = new Set(
    circuitJson.filter(isSchematicComponent).map((sc) => sc.schematic_component_id)
  );
  const componentPlacements = [
    ...circuitJson.filter(isSchematicComponent).map(
      (sc) => schematicComponentToPlacement(
        sc,
        circuitJson,
        schematicSheetNameById,
        schematicBoxes.find(
          (sb) => sb.schematic_component_id === sc.schematic_component_id
        )
      )
    ),
    ...schematicBoxes.filter(
      (sb) => !sb.schematic_component_id || !schematicComponentIds.has(sb.schematic_component_id)
    ).map(
      (sb) => schematicBoxToPlacement(sb, circuitJson, schematicSheetNameById)
    )
  ];
  return { circuitJson, componentPlacements };
};

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/SwitchPullResistorPlacementSolver/SwitchPullResistorPlacementSolver.ts
import { BaseSolver as BaseSolver22 } from "@tscircuit/solver-utils";
var SwitchPullResistorPlacementSolver = class extends BaseSolver22 {
  constructor(params) {
    super();
    this.params = params;
  }
  params;
  _step() {
    const index = new PlacementNetworkIndex(this.params.ctx);
    for (const pair of getSwitchPullResistorPairs(index)) {
      const { resistor, switchBox, signalPort, signalSchY, pullDirection } = pair;
      if (pair.horizontalPushbutton) continue;
      const signal = index.connected(signalPort.source_port_id);
      if (index.portsByNet.get(signal)?.length !== 2) continue;
      if (signalPort.needs_external_pullup || signalPort.needs_external_pulldown)
        continue;
      const wrongSideGap = pullDirection === "up" ? signalSchY - (resistor.schY + resistor.height / 2) : resistor.schY - resistor.height / 2 - signalSchY;
      if (wrongSideGap <= 1.5) continue;
      const preferredSide = pullDirection === "up" ? "above" : "below";
      this.params.issues.push({
        lineItemType: "PullResistorOnWrongSide",
        resistorSchematicBox: resistor,
        hostSchematicBox: switchBox,
        signalSourcePortId: signalPort.source_port_id,
        signalPinName: signalPort.name,
        signalSchY,
        pullDirection,
        preferredSide,
        wrongSideGap,
        maxRecommendedWrongSideGap: 1.5,
        message: `place ${resistor.sourceComponentName} ${preferredSide} ${switchBox.sourceComponentName} so the pull-${pullDirection} branch reads toward ${pullDirection === "up" ? "power" : "ground"}`
      });
    }
    this.solved = true;
  }
};

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/utils/trace-name.ts
function getTraceName(circuitJson, trace) {
  const sourceTrace = circuitJson.find(
    (e) => e.type === "source_trace" && e.source_trace_id === trace.source_trace_id
  );
  if (sourceTrace?.type === "source_trace" && sourceTrace.name)
    return sourceTrace.name;
  const first = trace.edges[0];
  const last = trace.edges.at(-1);
  const endpointName = (point2, id) => {
    const ports = circuitJson.filter(
      (e) => e.type === "schematic_port" && e.schematic_sheet_id === trace.schematic_sheet_id && (id ? e.schematic_port_id === id : Math.hypot(e.center.x - point2.x, e.center.y - point2.y) <= 0.01)
    );
    if (ports.length !== 1 || ports[0]?.type !== "schematic_port") return;
    const port = ports[0];
    const sourcePort = circuitJson.find(
      (e) => e.type === "source_port" && e.source_port_id === port.source_port_id
    );
    const component = circuitJson.find(
      (e) => e.type === "schematic_component" && e.schematic_component_id === port.schematic_component_id
    );
    const sourceComponentId = sourcePort?.type === "source_port" ? sourcePort.source_component_id : component?.type === "schematic_component" ? component.source_component_id : void 0;
    const sourceComponent = circuitJson.find(
      (e) => e.type === "source_component" && e.source_component_id === sourceComponentId
    );
    if (sourceComponent?.type !== "source_component" || !sourceComponent.name)
      return;
    const pin = sourcePort?.type === "source_port" && sourcePort.name ? sourcePort.name : port.pin_number !== void 0 ? `pin${port.pin_number}` : port.display_pin_label;
    return pin ? `${sourceComponent.name}.${pin}` : sourceComponent.name;
  };
  const from = first && endpointName(first.from, first.from_schematic_port_id);
  const to = last && endpointName(last.to, last.to_schematic_port_id);
  if (from && to) return `${from} to ${to}`;
  return sourceTrace?.type === "source_trace" && sourceTrace.display_name || from || to || "trace";
}

// node_modules/calculate-elbow/lib/calculateElbowBends.ts
var calculateElbowBends = (p1, p2, overshootAmount) => {
  const result = [{ x: p1.x, y: p1.y }];
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const p2Target = { x: p2.x, y: p2.y };
  switch (p2.facingDirection) {
    case "x+":
      p2Target.x += overshootAmount;
      break;
    case "x-":
      p2Target.x -= overshootAmount;
      break;
    case "y+":
      p2Target.y += overshootAmount;
      break;
    case "y-":
      p2Target.y -= overshootAmount;
      break;
  }
  const startDir = p1.facingDirection ?? "none";
  const endDir = p2.facingDirection ?? "none";
  const push = (pt) => {
    const last = result[result.length - 1];
    if (last.x !== pt.x || last.y !== pt.y) result.push(pt);
  };
  const yAligned = Math.abs(p1.y - p2.y) <= Math.max(1e-6, overshootAmount * 0.1);
  const xAligned = Math.abs(p1.x - p2.x) <= Math.max(1e-6, overshootAmount * 0.1);
  if (startDir === "none" && endDir === "none") {
    globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 1;
    push({ x: midX, y: p1.y });
    push({ x: midX, y: p2.y });
  } else if (startDir === "x+" && endDir === "y+") {
    globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 2;
    if (p1.x > p2.x && p1.y < p2.y) {
      globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 2.1;
      push({ x: p1.x + overshootAmount, y: p1.y });
      push({ x: p1.x + overshootAmount, y: p2.y + overshootAmount });
      push({ x: p2.x, y: p2.y + overshootAmount });
    } else if (!xAligned && !yAligned && p1.x < p2.x && p1.y > p2.y) {
      globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 2.2;
      push({ x: p2.x, y: p1.y });
    } else if (xAligned) {
      globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 2.3;
      push({ x: p1.x + overshootAmount, y: p1.y });
      push({ x: p1.x + overshootAmount, y: p2.y + overshootAmount });
      push({ x: p2.x, y: p2.y + overshootAmount });
    } else {
      if (p1.x < p2.x) {
        globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 2.4;
        push({ x: midX, y: p1.y });
        push({ x: midX, y: p2Target.y });
        push({ x: p2.x, y: p2Target.y });
      } else if (p1.y <= p2.y + overshootAmount) {
        globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 2.5;
        push({ x: p1.x + overshootAmount, y: p1.y });
        push({ x: p1.x + overshootAmount, y: p1.y + overshootAmount });
        push({ x: p2.x, y: p1.y + overshootAmount });
        push({ x: p2.x, y: p2.y });
      } else {
        globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 2.6;
        push({ x: p1.x + overshootAmount, y: p1.y });
        push({ x: p1.x + overshootAmount, y: (p1.y + p2.y) / 2 });
        push({ x: p2.x, y: (p1.y + p2.y) / 2 });
      }
    }
  } else if (startDir === "x+" && endDir === "x+" && !yAligned) {
    globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 3;
    const commonX = Math.max(p1.x + overshootAmount, p2Target.x);
    push({ x: commonX, y: p1.y });
    push({ x: commonX, y: p2.y });
  } else if (startDir === "x+" && endDir === "x+" && yAligned) {
    globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 3.1;
    push({ x: p1.x + overshootAmount, y: p1.y });
    push({ x: p1.x + overshootAmount, y: p1.y + overshootAmount });
    push({ x: p2.x + overshootAmount, y: p1.y + overshootAmount });
    push({ x: p2.x + overshootAmount, y: p2.y });
  } else if (startDir === "x+" && endDir === "y-") {
    if (xAligned && p1.y <= p2.y) {
      globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 4.11;
      push({ x: p1.x + overshootAmount, y: p1.y });
      push({ x: p1.x + overshootAmount, y: midY });
      push({ x: p2.x, y: midY });
    } else if (xAligned && p1.y > p2.y) {
      globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 4.12;
      push({ x: p1.x + overshootAmount, y: p1.y });
      push({ x: p1.x + overshootAmount, y: p2.y - overshootAmount });
      push({ x: p2.x, y: p2.y - overshootAmount });
    } else if (p1.x < p2.x && p1.y < p2.y) {
      globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 4.2;
      push({ x: p2.x, y: p1.y });
    } else {
      if (p1.x > p2.x && p1.y < p2.y) {
        globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 4.3;
        const p1OvershootX = p1.x + overshootAmount;
        push({ x: p1OvershootX, y: p1.y });
        push({ x: p1OvershootX, y: midY });
        push({ x: p2.x, y: midY });
      } else if (p1.x > p2.x && p1.y > p2.y) {
        globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 4.4;
        const p1OvershootX = p1.x + overshootAmount;
        push({ x: p1OvershootX, y: p1.y });
        push({ x: p1OvershootX, y: p2Target.y });
        push({ x: p2.x, y: p2Target.y });
      } else if (p1.y === p2.y) {
        globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 4.5;
        push({ x: p1.x + overshootAmount, y: p1.y });
        push({ x: p1.x + overshootAmount, y: p1.y - overshootAmount });
        push({ x: p2.x, y: p1.y - overshootAmount });
      } else {
        globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 4.6;
        push({ x: midX, y: p1.y });
        push({ x: midX, y: p2Target.y });
        push({ x: p2.x, y: p2Target.y });
      }
    }
  } else if (startDir === "x+" && endDir === "x-" && p1.x + overshootAmount >= p2.x - overshootAmount && !yAligned) {
    globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 5;
    const p1OvershootX = p1.x + overshootAmount;
    push({ x: p1OvershootX, y: p1.y });
    push({ x: p1OvershootX, y: midY });
    push({ x: p2Target.x, y: midY });
    push({ x: p2Target.x, y: p2Target.y });
  } else if (startDir === "x+" && endDir === "x-" && yAligned && p2.x > p1.x) {
  } else if (startDir === "x+" && endDir === "x-" && yAligned) {
    globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 7;
    push({ x: p1.x + overshootAmount, y: p1.y });
    push({ x: p1.x + overshootAmount, y: p1.y + overshootAmount });
    push({ x: p2.x - overshootAmount, y: p1.y + overshootAmount });
    push({ x: p2.x - overshootAmount, y: p1.y });
  } else {
    globalThis.__DEBUG_CALCULATE_ELBOW_CASE = 8;
    if (startDir === "x+") {
      push({ x: p1.x + overshootAmount, y: p1.y });
    }
    push({ x: midX, y: result[result.length - 1].y });
    push({ x: midX, y: p2Target.y });
    push({ x: p2Target.x, y: p2Target.y });
  }
  push({ x: p2.x, y: p2.y });
  return result;
};

// node_modules/calculate-elbow/lib/index.ts
var calculateElbow = (point1, point2, options = {}) => {
  let p1 = point1;
  let p2 = point2;
  let orderFlipped = false;
  if (p1.x > p2.x || p1.x === p2.x && p1.y > p2.y) {
    orderFlipped = true;
    [p1, p2] = [p2, p1];
  }
  const mirrorX = p1.facingDirection === "x-";
  const mirrorY = p1.facingDirection === "y-";
  const mirrorPoint = (pt) => {
    const x = mirrorX ? p1.x - (pt.x - p1.x) : pt.x;
    const y = mirrorY ? p1.y - (pt.y - p1.y) : pt.y;
    let facing = pt.facingDirection;
    if (mirrorX) {
      if (facing === "x+") facing = "x-";
      else if (facing === "x-") facing = "x+";
    }
    if (mirrorY) {
      if (facing === "y+") facing = "y-";
      else if (facing === "y-") facing = "y+";
    }
    return { x, y, facingDirection: facing };
  };
  const rotateCW = (pt, centre) => {
    const dx = pt.x - centre.x;
    const dy = pt.y - centre.y;
    const x = centre.x + dy;
    const y = centre.y - dx;
    let facing = pt.facingDirection;
    switch (facing) {
      case "x+":
        facing = "y-";
        break;
      case "y-":
        facing = "x-";
        break;
      case "x-":
        facing = "y+";
        break;
      case "y+":
        facing = "x+";
        break;
    }
    return { x, y, facingDirection: facing };
  };
  const rotateCCW = (pt, centre) => {
    const dx = pt.x - centre.x;
    const dy = pt.y - centre.y;
    return { x: centre.x - dy, y: centre.y + dx };
  };
  const mp1 = mirrorX || mirrorY ? mirrorPoint(p1) : p1;
  const mp2 = mirrorX || mirrorY ? mirrorPoint(p2) : p2;
  let rp1 = mp1;
  let rp2 = mp2;
  let rotated = false;
  if (mp1.facingDirection === "y+") {
    rotated = true;
    rp1 = { ...mp1, facingDirection: "x+" };
    rp2 = rotateCW(mp2, mp1);
  }
  const overshootAmount = options?.overshoot ?? 0.1 * Math.max(Math.abs(rp1.x - rp2.x), Math.abs(rp1.y - rp2.y));
  let result = calculateElbowBends(
    rp1,
    rp2,
    overshootAmount
  );
  if (rotated) {
    result = result.map((pt) => rotateCCW(pt, rp1));
  }
  if (mirrorX || mirrorY) {
    result = result.map(({ x, y }) => ({
      x: mirrorX ? p1.x - (x - p1.x) : x,
      y: mirrorY ? p1.y - (y - p1.y) : y
    }));
  }
  return orderFlipped ? result.reverse() : result;
};

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/utils/schematic-text-geometry.ts
var rectPolygon = (bounds) => [
  { x: bounds.left, y: bounds.bottom },
  { x: bounds.right, y: bounds.bottom },
  { x: bounds.right, y: bounds.top },
  { x: bounds.left, y: bounds.top }
];
var advance = (character) => {
  if (/\s/.test(character)) return 0.28;
  if (/[ilI.,:;!'|]/.test(character)) return 0.25;
  if (/[MW@%]/.test(character)) return 0.9;
  if (/[mw]/.test(character)) return 0.8;
  if (/[A-Z]/.test(character)) return 0.67;
  return 0.56;
};
var widthInEm = (text) => Array.from(text).reduce((width, character) => width + advance(character), 0);
function getSchematicTextPolygons(text) {
  const size = text.font_size;
  if (!Number.isFinite(size) || size <= 0 || !Number.isFinite(text.rotation) || !Number.isFinite(text.position.x) || !Number.isFinite(text.position.y))
    return [];
  const anchor = text.anchor;
  const horizontal = anchor.includes("left") ? 0 : anchor.includes("right") ? 1 : 0.5;
  const top = anchor.includes("top") ? 0 : anchor.includes("bottom") ? size : size / 2;
  const radians = -text.rotation * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return text.text.split("\n").flatMap((line, index) => {
    const visible = line.trim();
    if (!visible) return [];
    const leading = line.length - line.trimStart().length;
    const left = (widthInEm(line.slice(0, leading)) - widthInEm(line) * horizontal) * size;
    const polygon = rectPolygon({
      left,
      right: left + widthInEm(visible) * size,
      // Leave the small whitespace at the top/bottom of an em outside the
      // collision region. Otherwise a readable caption just above a wire
      // (e.g. 100V at y=4.8, size=0.22 above a wire at y=4.7) is a false hit.
      top: top - index * size - size * 0.05,
      bottom: top - (index + 1) * size + size * 0.05
    });
    return [
      polygon.map(({ x, y }) => ({
        x: text.position.x + x * cos - y * sin,
        y: text.position.y + x * sin + y * cos
      }))
    ];
  });
}
function polygonsOverlap(a, b) {
  for (const polygon of [a, b]) {
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i];
      const q = polygon[(i + 1) % polygon.length];
      const length = Math.hypot(q.x - p.x, q.y - p.y);
      if (length < 1e-9) continue;
      const nx = -(q.y - p.y) / length;
      const ny = (q.x - p.x) / length;
      const project = (points) => points.map(({ x, y }) => x * nx + y * ny);
      const pa = project(a);
      const pb = project(b);
      if (Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)) <= 1e-6)
        return false;
    }
  }
  return true;
}
function traceSegmentPolygon(from, to) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length < 1e-9) return void 0;
  const dx = -(to.y - from.y) / length * 0.01;
  const dy = (to.x - from.x) / length * 0.01;
  return [
    { x: from.x + dx, y: from.y + dy },
    { x: to.x + dx, y: to.y + dy },
    { x: to.x - dx, y: to.y - dy },
    { x: from.x - dx, y: from.y - dy }
  ];
}
function segmentCrossesPolygon(from, to, polygon) {
  if (Math.hypot(to.x - from.x, to.y - from.y) < 1e-9) return false;
  let low = 0;
  let high = 1;
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i];
    const q = polygon[(i + 1) % polygon.length];
    const length = Math.hypot(q.x - p.x, q.y - p.y);
    if (length < 1e-9) continue;
    const nx = -(q.y - p.y) / length;
    const ny = (q.x - p.x) / length;
    const start = (from.x - p.x) * nx + (from.y - p.y) * ny - 1e-6;
    const end = (to.x - p.x) * nx + (to.y - p.y) * ny - 1e-6;
    if (start <= 0 && end <= 0) return false;
    if (start <= 0) low = Math.max(low, -start / (end - start));
    if (end <= 0) high = Math.min(high, -start / (end - start));
    if (high <= low) return false;
  }
  return high > low;
}
var polygonBounds = (polygons) => {
  const points = polygons.flat();
  return {
    left: Math.min(...points.map((p) => p.x)),
    right: Math.max(...points.map((p) => p.x)),
    top: Math.max(...points.map((p) => p.y)),
    bottom: Math.min(...points.map((p) => p.y))
  };
};

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/TraceSimplificationSolver/TraceSimplificationSolver.ts
import { BaseSolver as BaseSolver23 } from "@tscircuit/solver-utils";
var TraceSimplificationSolver = class _TraceSimplificationSolver extends BaseSolver23 {
  static EPSILON = 0.01;
  ctx;
  out;
  constructor({
    ctx,
    issues
  }) {
    super();
    this.ctx = ctx;
    this.out = issues;
  }
  _step() {
    const ports = this.ctx.circuitJson.filter(
      (element) => element.type === "schematic_port"
    );
    const portsById = new Map(
      ports.map((port) => [port.schematic_port_id, port])
    );
    const placementsByComponentId = new Map(
      this.ctx.componentPlacements.flatMap(
        (placement) => placement.schematicComponentId ? [[placement.schematicComponentId, placement]] : []
      )
    );
    const emittedMoves = /* @__PURE__ */ new Set();
    for (const trace of this.ctx.circuitJson.filter(
      (element) => element.type === "schematic_trace"
    )) {
      const points = this.getTracePoints(trace);
      const currentTurnCount = this.countTurns(points);
      if (currentTurnCount !== 3) continue;
      const candidates = [
        this.getCandidate({
          trace,
          points,
          atStart: true,
          currentTurnCount,
          ports,
          portsById,
          placementsByComponentId
        }),
        this.getCandidate({
          trace,
          points,
          atStart: false,
          currentTurnCount,
          ports,
          portsById,
          placementsByComponentId
        })
      ].filter((candidate) => Boolean(candidate));
      for (const candidate of [...candidates]) {
        if (!candidate.target.sourceComponentName?.startsWith("U")) continue;
        for (const point2 of [points[0], points.at(-1)]) {
          const port = this.findPortAtPoint(
            ports,
            point2,
            trace.schematic_sheet_id
          );
          const target = port?.schematic_component_id ? placementsByComponentId.get(port.schematic_component_id) : void 0;
          if (!target || !/^[CR]/.test(target.sourceComponentName ?? ""))
            continue;
          candidates.push({
            target,
            deltaSchX: -candidate.deltaSchX,
            deltaSchY: -candidate.deltaSchY,
            currentTurnCount,
            suggestedTurnCount: candidate.suggestedTurnCount
          });
        }
      }
      const priority = (candidate) => /^[CR]/.test(candidate.target.sourceComponentName ?? "") ? 0 : candidate.target.sourceComponentName?.startsWith("U") ? 2 : 1;
      candidates.sort((a, b) => priority(a) - priority(b));
      for (const candidate of candidates) {
        if (this.wouldOverlapAnotherComponent(candidate)) continue;
        if (!this.validateMove(trace, candidate, ports)) continue;
        const moveKey = [
          candidate.target.schematicComponentId,
          candidate.deltaSchX.toFixed(3),
          candidate.deltaSchY.toFixed(3)
        ].join("\0");
        if (emittedMoves.has(moveKey)) break;
        emittedMoves.add(moveKey);
        this.out.push(this.makeIssue(trace, candidate));
        break;
      }
    }
    this.solved = true;
  }
  getCandidate({
    trace,
    points,
    atStart,
    currentTurnCount,
    ports,
    portsById,
    placementsByComponentId
  }) {
    if (points.length < 4) return;
    const terminalIndex = atStart ? 0 : points.length - 1;
    const leadIndex = atStart ? 1 : points.length - 2;
    const acrossIndex = atStart ? 2 : points.length - 3;
    const retainedIndex = atStart ? 3 : points.length - 4;
    const terminalPoint = points[terminalIndex];
    const leadPoint = points[leadIndex];
    const acrossPoint = points[acrossIndex];
    const retainedPoint = points[retainedIndex];
    const terminalEdge = atStart ? trace.edges[0] : trace.edges.at(-1);
    if (!terminalEdge) return;
    const portId = atStart ? terminalEdge.from_schematic_port_id : terminalEdge.to_schematic_port_id;
    const port = portId ? portsById.get(portId) : this.findPortAtPoint(ports, terminalPoint, trace.schematic_sheet_id);
    if (!port?.schematic_component_id || !port.facing_direction) return;
    const leadAxis = this.getAxis(terminalPoint, leadPoint);
    const shiftAxis = this.getAxis(leadPoint, acrossPoint);
    const retainedAxis = this.getAxis(acrossPoint, retainedPoint);
    const portAxis = port.facing_direction === "left" || port.facing_direction === "right" ? "horizontal" : "vertical";
    if (!leadAxis || !shiftAxis || !retainedAxis) return;
    if (leadAxis !== portAxis || shiftAxis === portAxis || retainedAxis !== portAxis) {
      return;
    }
    if (!this.isPointInFacingDirection(
      terminalPoint,
      leadPoint,
      port.facing_direction
    ) || !this.isPointInFacingDirection(
      acrossPoint,
      retainedPoint,
      port.facing_direction
    )) {
      return;
    }
    const target = placementsByComponentId.get(port.schematic_component_id);
    if (!target) return;
    const deltaSchX = acrossPoint.x - leadPoint.x;
    const deltaSchY = acrossPoint.y - leadPoint.y;
    if (Math.abs(deltaSchX) <= _TraceSimplificationSolver.EPSILON && Math.abs(deltaSchY) <= _TraceSimplificationSolver.EPSILON) {
      return;
    }
    const movedTerminalPoint = {
      x: terminalPoint.x + deltaSchX,
      y: terminalPoint.y + deltaSchY
    };
    const suggestedPoints = atStart ? [movedTerminalPoint, ...points.slice(2)] : [...points.slice(0, -2), movedTerminalPoint];
    const suggestedTurnCount = this.countTurns(suggestedPoints);
    if (suggestedTurnCount === void 0 || suggestedTurnCount !== 1 || suggestedTurnCount >= currentTurnCount) {
      return;
    }
    return {
      target,
      deltaSchX,
      deltaSchY,
      currentTurnCount,
      suggestedTurnCount
    };
  }
  /** calculate-elbow proposes geometry, not obstacle avoidance. Only report a
   * move when every attached route can be preserved or improved and the exact
   * proposed geometry is clear. Unsupported junctions are deliberately skipped. */
  validateMove(targetTrace, candidate, ports) {
    const componentId = candidate.target.schematicComponentId;
    const sheetId = candidate.target.schematicSheetId;
    const sheetPorts = ports.filter((p) => p.schematic_sheet_id === sheetId);
    const movingPorts = sheetPorts.filter(
      (p) => p.schematic_component_id === componentId
    );
    const traces = this.ctx.circuitJson.filter(
      (e) => e.type === "schematic_trace" && e.schematic_sheet_id === sheetId
    );
    const touchesPort = (trace, port) => trace.edges.some(
      (edge) => edge.from_schematic_port_id === port.schematic_port_id || edge.to_schematic_port_id === port.schematic_port_id || this.pointsEqual(edge.from, port.center) || this.pointsEqual(edge.to, port.center)
    );
    const affected = traces.filter(
      (trace) => movingPorts.some((port) => touchesPort(trace, port))
    );
    if (!affected.includes(targetTrace)) return false;
    if (this.ctx.circuitJson.some(
      (e) => e.type === "schematic_net_label" && e.schematic_sheet_id === sheetId && movingPorts.some(
        (p) => this.pointsEqual(e.anchor_position ?? e.center, p.center)
      )
    ))
      return false;
    const shift = (point2) => ({
      x: point2.x + candidate.deltaSchX,
      y: point2.y + candidate.deltaSchY
    });
    const directions2 = {
      left: "x-",
      right: "x+",
      up: "y+",
      down: "y-"
    };
    const endpoint = (port, moved) => ({
      ...moved && port.schematic_component_id === componentId ? shift(port.center) : port.center,
      facingDirection: directions2[port.facing_direction]
    });
    const length = (points) => points.slice(1).reduce(
      (sum, p, i) => sum + Math.abs(p.x - points[i].x) + Math.abs(p.y - points[i].y),
      0
    );
    const segments = (points) => points.slice(1).map((to, i) => ({ from: points[i], to }));
    const movedBounds = centeredRect(
      candidate.target.schX + candidate.deltaSchX,
      candidate.target.schY + candidate.deltaSchY,
      candidate.target.width,
      candidate.target.height
    );
    const unaffected = traces.filter((trace) => !affected.includes(trace));
    if (unaffected.some(
      (trace) => trace.edges.some(
        (edge) => segmentCrossesPolygon(edge.from, edge.to, rectPolygon(movedBounds))
      )
    ))
      return false;
    const textPolygons = this.ctx.circuitJson.flatMap((e) => {
      if (e.type === "schematic_net_label" && e.schematic_sheet_id === sheetId)
        return [rectPolygon(getNetLabelBounds(e))];
      if (e.type !== "schematic_text" || e.schematic_sheet_id !== sheetId)
        return [];
      return getSchematicTextPolygons(
        e.schematic_component_id === componentId ? { ...e, position: shift(e.position) } : e
      );
    });
    if (textPolygons.some(
      (polygon) => polygonsOverlap(polygon, rectPolygon(movedBounds))
    ))
      return false;
    const proposed = [];
    for (const trace of affected) {
      const oldPoints = this.getTracePoints(trace);
      if (oldPoints.length < 2 || trace.junctions?.length) return false;
      const resolve = (point2, id) => {
        const matches = sheetPorts.filter(
          (p) => id ? p.schematic_port_id === id : this.pointsEqual(p.center, point2)
        );
        return matches.length === 1 && this.pointsEqual(matches[0].center, point2) ? matches[0] : void 0;
      };
      const start = resolve(
        oldPoints[0],
        trace.edges[0].from_schematic_port_id
      );
      const end = resolve(
        oldPoints.at(-1),
        trace.edges.at(-1).to_schematic_port_id
      );
      if (!start?.facing_direction || !end?.facing_direction) return false;
      if (movingPorts.some(
        (p) => touchesPort(trace, p) && p !== start && p !== end
      ))
        return false;
      const isInteriorConnection = (point2) => !this.pointsEqual(point2, start.center) && !this.pointsEqual(point2, end.center) && segments(oldPoints).some(
        ({ from, to }) => Math.abs(
          Math.hypot(point2.x - from.x, point2.y - from.y) + Math.hypot(point2.x - to.x, point2.y - to.y) - Math.hypot(to.x - from.x, to.y - from.y)
        ) < 1e-6
      );
      if (traces.some(
        (other) => other !== trace && other.edges.some(
          (edge) => isInteriorConnection(edge.from) || isInteriorConnection(edge.to)
        )
      ))
        return false;
      if (this.ctx.circuitJson.some(
        (e) => e.type === "schematic_net_label" && e.schematic_sheet_id === sheetId && isInteriorConnection(e.anchor_position ?? e.center)
      ))
        return false;
      const points = calculateElbow(
        endpoint(start, true),
        endpoint(end, true)
      ).filter(
        (point2, i, all) => i === 0 || !this.pointsEqual(point2, all[i - 1])
      );
      const turns = this.countTurns(points);
      const oldTurns = this.countTurns(oldPoints);
      if (points.length < 2 || turns === void 0 || oldTurns === void 0 || turns > oldTurns || length(points) > length(oldPoints) + 1e-6)
        return false;
      if (!this.isPointInFacingDirection(
        points[0],
        points[1],
        start.facing_direction
      ) || !this.isPointInFacingDirection(
        points.at(-1),
        points.at(-2),
        end.facing_direction
      ))
        return false;
      if (trace === targetTrace) {
        const baselineTurns = this.countTurns(
          calculateElbow(endpoint(start, false), endpoint(end, false))
        );
        if (turns >= oldTurns || baselineTurns === void 0 || turns >= baselineTurns)
          return false;
        candidate.suggestedTurnCount = turns;
      }
      for (const segment of segments(points)) {
        if (textPolygons.some(
          (polygon2) => segmentCrossesPolygon(segment.from, segment.to, polygon2)
        ))
          return false;
        if (this.ctx.componentPlacements.some((p) => {
          if (p.schematicSheetId !== sheetId) return false;
          const bounds = p.schematicComponentId === componentId ? movedBounds : centeredRect(p.schX, p.schY, p.width, p.height);
          return segmentCrossesPolygon(
            segment.from,
            segment.to,
            rectPolygon(bounds)
          );
        }))
          return false;
        const polygon = traceSegmentPolygon(segment.from, segment.to);
        if (!polygon) continue;
        const otherSegments = [
          ...unaffected.flatMap((t) => t.edges),
          ...proposed.flatMap((t) => segments(t.points))
        ];
        if (otherSegments.some((edge) => {
          if ([start, end].some(
            (port) => port.schematic_component_id !== componentId && [segment.from, segment.to].some(
              (p) => this.pointsEqual(p, port.center)
            ) && [edge.from, edge.to].some(
              (p) => this.pointsEqual(p, port.center)
            )
          ) && this.getAxis(segment.from, segment.to) !== this.getAxis(edge.from, edge.to))
            return false;
          const other = traceSegmentPolygon(edge.from, edge.to);
          return other && polygonsOverlap(polygon, other);
        }))
          return false;
      }
      proposed.push({ schematicTraceId: trace.schematic_trace_id, points });
    }
    candidate.suggestedTraces = proposed;
    return true;
  }
  getTracePoints(trace) {
    const firstEdge = trace.edges[0];
    if (!firstEdge) return [];
    const points = [firstEdge.from];
    for (const edge of trace.edges) {
      const previousPoint = points.at(-1);
      if (!this.pointsEqual(previousPoint, edge.from)) return [];
      points.push(edge.to);
    }
    return points;
  }
  countTurns(points) {
    const axes = [];
    for (const [index, point2] of points.slice(1).entries()) {
      const previousPoint = points[index];
      if (this.pointsEqual(previousPoint, point2)) continue;
      const axis = this.getAxis(previousPoint, point2);
      if (!axis) return;
      axes.push(axis);
    }
    return axes.slice(1).filter((axis, index) => axis !== axes[index]).length;
  }
  pointsEqual(a, b) {
    const { EPSILON: EPSILON5 } = _TraceSimplificationSolver;
    return Math.abs(a.x - b.x) <= EPSILON5 && Math.abs(a.y - b.y) <= EPSILON5;
  }
  getAxis(a, b) {
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    const { EPSILON: EPSILON5 } = _TraceSimplificationSolver;
    if (dx <= EPSILON5 && dy > EPSILON5) return "vertical";
    if (dy <= EPSILON5 && dx > EPSILON5) return "horizontal";
    return void 0;
  }
  isPointInFacingDirection(origin, point2, facingDirection) {
    const { EPSILON: EPSILON5 } = _TraceSimplificationSolver;
    switch (facingDirection) {
      case "left":
        return point2.x < origin.x - EPSILON5;
      case "right":
        return point2.x > origin.x + EPSILON5;
      case "up":
        return point2.y > origin.y + EPSILON5;
      case "down":
        return point2.y < origin.y - EPSILON5;
    }
  }
  findPortAtPoint(ports, point2, schematicSheetId) {
    const { EPSILON: EPSILON5 } = _TraceSimplificationSolver;
    return ports.find(
      (port) => port.schematic_sheet_id === schematicSheetId && Math.abs(port.center.x - point2.x) <= EPSILON5 && Math.abs(port.center.y - point2.y) <= EPSILON5
    );
  }
  wouldOverlapAnotherComponent(candidate) {
    const movedBounds = centeredRect(
      candidate.target.schX + candidate.deltaSchX,
      candidate.target.schY + candidate.deltaSchY,
      candidate.target.width,
      candidate.target.height
    );
    return this.ctx.componentPlacements.some((placement) => {
      if (placement === candidate.target) return false;
      if (placement.schematicSheetId !== candidate.target.schematicSheetId) {
        return false;
      }
      return Boolean(
        rectOverlap(
          movedBounds,
          centeredRect(
            placement.schX,
            placement.schY,
            placement.width,
            placement.height
          )
        )
      );
    });
  }
  makeIssue(trace, candidate) {
    const targetName = candidate.target.sourceComponentName ?? candidate.target.schematicComponentId ?? "component";
    const direction = this.getMoveDirection(
      candidate.deltaSchX,
      candidate.deltaSchY
    );
    const distance5 = Math.abs(candidate.deltaSchX || candidate.deltaSchY);
    const newSchX = candidate.target.schX + candidate.deltaSchX;
    const newSchY = candidate.target.schY + candidate.deltaSchY;
    return {
      lineItemType: "TraceCanBeSimplifiedByMovingComponent",
      schematicTraceId: trace.schematic_trace_id,
      traceName: getTraceName(this.ctx.circuitJson, trace),
      targetComponent: candidate.target,
      deltaSchX: candidate.deltaSchX,
      deltaSchY: candidate.deltaSchY,
      newSchX,
      newSchY,
      currentTurnCount: candidate.currentTurnCount,
      suggestedTurnCount: candidate.suggestedTurnCount,
      suggestedTraces: candidate.suggestedTraces,
      message: `move ${targetName} ${direction} by ${fmtNumber(distance5)} (to schX=${fmtNumber(newSchX)}, schY=${fmtNumber(newSchY)}) to reduce this trace from ${candidate.currentTurnCount} turns to ${candidate.suggestedTurnCount}`
    };
  }
  getMoveDirection(deltaSchX, deltaSchY) {
    if (Math.abs(deltaSchX) > _TraceSimplificationSolver.EPSILON) {
      return deltaSchX > 0 ? "right" : "left";
    }
    return deltaSchY > 0 ? "up" : "down";
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(attrs, "traceName", issue.traceName);
    addAttr(
      attrs,
      "targetComponentName",
      issue.targetComponent.sourceComponentName
    );
    addAttr(attrs, "deltaSchX", issue.deltaSchX, { formatDelta: true });
    addAttr(attrs, "deltaSchY", issue.deltaSchY, { formatDelta: true });
    addAttr(attrs, "newSchX", issue.newSchX);
    addAttr(attrs, "newSchY", issue.newSchY);
    addAttr(attrs, "currentTurnCount", issue.currentTurnCount);
    addAttr(attrs, "suggestedTurnCount", issue.suggestedTurnCount);
    addAttr(attrs, "message", issue.message);
    return `<TraceCanBeSimplifiedByMovingComponent ${attrs.join(" ")} />`;
  }
};

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/TwoPinComponentOrientationSolver/TwoPinComponentOrientationSolver.ts
import { BaseSolver as BaseSolver24 } from "@tscircuit/solver-utils";

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/TwoPinComponentOrientationSolver/getPowerOrGroundConnectionIds.ts
import {
  findConnectedNetworks as findConnectedNetworks2,
  getSourcePortConnectivityMapFromCircuitJson as getSourcePortConnectivityMapFromCircuitJson2
} from "circuit-json-to-connectivity-map";
function getPowerOrGroundConnectionIds(circuitJson) {
  const powerOrGroundIds = /* @__PURE__ */ new Set();
  const idsByConnectivityKey = /* @__PURE__ */ new Map();
  for (const element of circuitJson) {
    if (element.type !== "source_net" && element.type !== "source_port")
      continue;
    const id = element.type === "source_net" ? element.source_net_id : element.source_port_id;
    const isPowerOrGround = element.type === "source_net" ? element.is_power || element.is_ground || element.is_positive_voltage_source : element.provides_power || element.requires_power || element.provides_ground || element.requires_ground;
    if (isPowerOrGround) powerOrGroundIds.add(id);
    const key = element.subcircuit_connectivity_map_key;
    if (key !== void 0) {
      const ids = idsByConnectivityKey.get(key) ?? [];
      ids.push(id);
      idsByConnectivityKey.set(key, ids);
    }
  }
  const sourceConnectivity = getSourcePortConnectivityMapFromCircuitJson2(circuitJson);
  const networks = findConnectedNetworks2([
    ...Object.values(sourceConnectivity.netMap),
    ...idsByConnectivityKey.values()
  ]);
  for (const ids of Object.values(networks)) {
    if (ids.some((id) => powerOrGroundIds.has(id))) {
      for (const id of ids) powerOrGroundIds.add(id);
    }
  }
  return powerOrGroundIds;
}

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/TwoPinComponentOrientationSolver/TwoPinComponentOrientationSolver.ts
var TwoPinComponentOrientationSolver = class _TwoPinComponentOrientationSolver extends BaseSolver24 {
  static EPSILON = 0.01;
  ctx;
  out;
  powerOrGroundConnectionIds;
  constructor({
    ctx,
    issues
  }) {
    super();
    this.ctx = ctx;
    this.out = issues;
    this.powerOrGroundConnectionIds = getPowerOrGroundConnectionIds(
      ctx.circuitJson
    );
  }
  _step() {
    const ports = this.ctx.circuitJson.filter(
      (element) => element.type === "schematic_port"
    );
    const portsById = new Map(
      ports.map((port) => [port.schematic_port_id, port])
    );
    const portsByComponentId = /* @__PURE__ */ new Map();
    for (const port of ports) {
      if (!port.schematic_component_id) continue;
      const componentPorts = portsByComponentId.get(port.schematic_component_id) ?? [];
      componentPorts.push(port);
      portsByComponentId.set(port.schematic_component_id, componentPorts);
    }
    const placementsByComponentId = new Map(
      this.ctx.componentPlacements.flatMap(
        (placement) => placement.schematicComponentId ? [[placement.schematicComponentId, placement]] : []
      )
    );
    const bestCandidateByComponentId = /* @__PURE__ */ new Map();
    for (const trace of this.ctx.circuitJson.filter(
      (element) => element.type === "schematic_trace"
    )) {
      const points = this.getTracePoints(trace);
      const currentTurnCount = this.countTurns(points);
      if (currentTurnCount === void 0 || currentTurnCount < 2) continue;
      const endpoints = this.getTraceEndpoints(trace, points, ports, portsById);
      if (!endpoints) continue;
      for (const [targetEndpoint, connectedEndpoint] of [
        endpoints,
        [endpoints[1], endpoints[0]]
      ]) {
        const candidate = this.getFlipCandidate({
          trace,
          targetEndpoint,
          connectedEndpoint,
          currentTurnCount,
          portsByComponentId,
          placementsByComponentId
        });
        if (!candidate) continue;
        const componentId = candidate.targetPort.schematic_component_id;
        const existing = bestCandidateByComponentId.get(componentId);
        if (!existing || this.isBetterCandidate(candidate, existing)) {
          bestCandidateByComponentId.set(componentId, candidate);
        }
      }
    }
    for (const candidate of bestCandidateByComponentId.values()) {
      this.out.push(this.makeIssue(candidate));
    }
    this.solved = true;
  }
  getFlipCandidate({
    trace,
    targetEndpoint,
    connectedEndpoint,
    currentTurnCount,
    portsByComponentId,
    placementsByComponentId
  }) {
    const targetPort = targetEndpoint.port;
    const connectedPort = connectedEndpoint.port;
    const targetComponentId = targetPort.schematic_component_id;
    const connectedComponentId = connectedPort.schematic_component_id;
    if (!targetComponentId || !connectedComponentId || targetComponentId === connectedComponentId || targetPort.schematic_sheet_id !== connectedPort.schematic_sheet_id) {
      return;
    }
    const componentPorts = portsByComponentId.get(targetComponentId);
    if (componentPorts?.length !== 2) return;
    if (componentPorts.some(
      (port) => port.source_port_id && this.powerOrGroundConnectionIds.has(port.source_port_id)
    )) {
      return;
    }
    const connectedComponentPorts = portsByComponentId.get(connectedComponentId) ?? [];
    if (connectedComponentPorts.length <= 2) return;
    const otherPort = componentPorts.find(
      (port) => port.schematic_port_id !== targetPort.schematic_port_id
    );
    if (!otherPort || !this.areOppositePorts(targetPort, otherPort)) return;
    const currentFacingDirection = targetPort.facing_direction;
    const suggestedFacingDirection = otherPort.facing_direction;
    if (!currentFacingDirection || !suggestedFacingDirection) return;
    if (!this.traceLeavesPortInFacingDirection(targetEndpoint)) return;
    const connectedPoint = connectedPort.center;
    if (this.isPointInFacingDirection(
      targetPort.center,
      connectedPoint,
      currentFacingDirection
    ) || !this.isPointInFacingDirection(
      otherPort.center,
      connectedPoint,
      suggestedFacingDirection
    ) || !connectedPort.facing_direction || !this.isPointInFacingDirection(
      connectedPoint,
      otherPort.center,
      connectedPort.facing_direction
    )) {
      return;
    }
    const suggestedTurnCount = this.getMinimumTurnCount(
      otherPort.center,
      connectedPoint,
      suggestedFacingDirection
    );
    if (suggestedTurnCount >= currentTurnCount) return;
    const targetPlacement = placementsByComponentId.get(targetComponentId);
    const connectedPlacement = placementsByComponentId.get(connectedComponentId);
    if (!targetPlacement || !connectedPlacement) return;
    return {
      trace,
      targetPort,
      targetPlacement,
      connectedPlacement,
      suggestedFacingDirection,
      currentTurnCount,
      suggestedTurnCount,
      traceLength: this.getTraceLength(targetEndpoint.pointsFromEndpoint)
    };
  }
  getTraceEndpoints(trace, points, ports, portsById) {
    const firstEdge = trace.edges[0];
    const lastEdge = trace.edges.at(-1);
    if (!firstEdge || !lastEdge || points.length < 2) return;
    const startPort = firstEdge.from_schematic_port_id ? portsById.get(firstEdge.from_schematic_port_id) : this.findPortAtPoint(ports, points[0], trace.schematic_sheet_id);
    const endPort = lastEdge.to_schematic_port_id ? portsById.get(lastEdge.to_schematic_port_id) : this.findPortAtPoint(ports, points.at(-1), trace.schematic_sheet_id);
    if (!startPort || !endPort) return;
    return [
      { port: startPort, pointsFromEndpoint: points },
      { port: endPort, pointsFromEndpoint: [...points].reverse() }
    ];
  }
  getTracePoints(trace) {
    const firstEdge = trace.edges[0];
    if (!firstEdge) return [];
    const points = [firstEdge.from];
    for (const edge of trace.edges) {
      if (!this.pointsEqual(points.at(-1), edge.from)) return [];
      points.push(edge.to);
    }
    return points;
  }
  countTurns(points) {
    const axes = [];
    for (const [index, point2] of points.slice(1).entries()) {
      const previousPoint = points[index];
      if (this.pointsEqual(previousPoint, point2)) continue;
      const axis = this.getAxis(previousPoint, point2);
      if (!axis) return;
      if (axes.at(-1) !== axis) axes.push(axis);
    }
    return Math.max(0, axes.length - 1);
  }
  traceLeavesPortInFacingDirection(endpoint) {
    const nextPoint = endpoint.pointsFromEndpoint.find(
      (point2) => !this.pointsEqual(point2, endpoint.port.center)
    );
    return Boolean(
      nextPoint && endpoint.port.facing_direction && this.isPointInFacingDirection(
        endpoint.port.center,
        nextPoint,
        endpoint.port.facing_direction
      )
    );
  }
  areOppositePorts(a, b) {
    const horizontal = (a.facing_direction === "left" && b.facing_direction === "right" || a.facing_direction === "right" && b.facing_direction === "left") && Math.abs(a.center.y - b.center.y) <= _TwoPinComponentOrientationSolver.EPSILON;
    const vertical = (a.facing_direction === "up" && b.facing_direction === "down" || a.facing_direction === "down" && b.facing_direction === "up") && Math.abs(a.center.x - b.center.x) <= _TwoPinComponentOrientationSolver.EPSILON;
    return horizontal || vertical;
  }
  getMinimumTurnCount(from, to, facingDirection) {
    const alignedWithFacingAxis = facingDirection === "left" || facingDirection === "right" ? Math.abs(from.y - to.y) <= _TwoPinComponentOrientationSolver.EPSILON : Math.abs(from.x - to.x) <= _TwoPinComponentOrientationSolver.EPSILON;
    return alignedWithFacingAxis ? 0 : 1;
  }
  isPointInFacingDirection(origin, point2, facingDirection) {
    const { EPSILON: EPSILON5 } = _TwoPinComponentOrientationSolver;
    switch (facingDirection) {
      case "left":
        return point2.x < origin.x - EPSILON5;
      case "right":
        return point2.x > origin.x + EPSILON5;
      case "up":
        return point2.y > origin.y + EPSILON5;
      case "down":
        return point2.y < origin.y - EPSILON5;
    }
  }
  getAxis(a, b) {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    const { EPSILON: EPSILON5 } = _TwoPinComponentOrientationSolver;
    if (dx <= EPSILON5 && dy > EPSILON5) return "vertical";
    if (dy <= EPSILON5 && dx > EPSILON5) return "horizontal";
    return void 0;
  }
  pointsEqual(a, b) {
    const { EPSILON: EPSILON5 } = _TwoPinComponentOrientationSolver;
    return Math.abs(a.x - b.x) <= EPSILON5 && Math.abs(a.y - b.y) <= EPSILON5;
  }
  findPortAtPoint(ports, point2, schematicSheetId) {
    return ports.find(
      (port) => port.schematic_sheet_id === schematicSheetId && this.pointsEqual(port.center, point2)
    );
  }
  getTraceLength(points) {
    return points.slice(1).reduce((length, point2, index) => {
      const previousPoint = points[index];
      return length + Math.abs(point2.x - previousPoint.x) + Math.abs(point2.y - previousPoint.y);
    }, 0);
  }
  isBetterCandidate(candidate, existing) {
    const improvement = candidate.currentTurnCount - candidate.suggestedTurnCount;
    const existingImprovement = existing.currentTurnCount - existing.suggestedTurnCount;
    return improvement > existingImprovement || improvement === existingImprovement && candidate.traceLength > existing.traceLength;
  }
  makeIssue(candidate) {
    const targetName = candidate.targetPlacement.sourceComponentName ?? candidate.targetPlacement.schematicComponentId ?? "component";
    const connectedName = candidate.connectedPlacement.sourceComponentName ?? candidate.connectedPlacement.schematicComponentId ?? "connected component";
    const targetPin = candidate.targetPort.pin_number ? `pin${candidate.targetPort.pin_number}` : candidate.targetPort.display_pin_label;
    return {
      lineItemType: "TwoPinComponentCouldBeFlipped",
      schematicTraceId: candidate.trace.schematic_trace_id,
      traceName: getTraceName(this.ctx.circuitJson, candidate.trace),
      targetComponent: candidate.targetPlacement,
      connectedComponent: candidate.connectedPlacement,
      targetPin,
      currentFacingDirection: candidate.targetPort.facing_direction,
      suggestedFacingDirection: candidate.suggestedFacingDirection,
      deltaSchRotation: 180,
      currentTurnCount: candidate.currentTurnCount,
      suggestedTurnCount: candidate.suggestedTurnCount,
      message: `rotate ${targetName} by 180\xB0 so ${targetPin ?? "its connected pin"} faces ${connectedName} and reduce this trace from ${candidate.currentTurnCount} turns to ${candidate.suggestedTurnCount}`
    };
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(attrs, "traceName", issue.traceName);
    addAttr(
      attrs,
      "targetComponentName",
      issue.targetComponent.sourceComponentName
    );
    addAttr(
      attrs,
      "connectedComponentName",
      issue.connectedComponent.sourceComponentName
    );
    addAttr(attrs, "targetPin", issue.targetPin);
    addAttr(attrs, "currentFacingDirection", issue.currentFacingDirection);
    addAttr(attrs, "suggestedFacingDirection", issue.suggestedFacingDirection);
    addAttr(attrs, "deltaSchRotation", issue.deltaSchRotation);
    addAttr(attrs, "currentTurnCount", issue.currentTurnCount);
    addAttr(attrs, "suggestedTurnCount", issue.suggestedTurnCount);
    addAttr(attrs, "message", issue.message);
    return `<TwoPinComponentCouldBeFlipped ${attrs.join(" ")} />`;
  }
};

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/VerboseNetLabelSolver/VerboseNetLabelSolver.ts
import { BaseSolver as BaseSolver25 } from "@tscircuit/solver-utils";
var VerboseNetLabelSolver = class extends BaseSolver25 {
  constructor(params) {
    super();
    this.params = params;
    const { circuitJson } = params.ctx;
    this.netLabels = circuitJson.filter((el) => this.isSchematicNetLabel(el));
    this.tokenToInvolvedPin = this.buildTokenToInvolvedPinMap(circuitJson);
    this.schematicSheetNameById = getSchematicSheetNamesById(circuitJson);
    this.solved = this.netLabels.length === 0;
  }
  params;
  VERBOSE_NET_LABEL_MESSAGE = "Create trace with schDisplayLabel";
  netLabels;
  tokenToInvolvedPin;
  schematicSheetNameById;
  currentIndex = 0;
  seen = /* @__PURE__ */ new Set();
  _step() {
    const label = this.netLabels[this.currentIndex++];
    if (!label) {
      this.solved = true;
      return;
    }
    this.solved = this.currentIndex >= this.netLabels.length;
    const seenKey = `${label.schematic_sheet_id ?? ""}:${label.text}`;
    if (!label.text.includes("/") || this.seen.has(seenKey)) return;
    this.seen.add(seenKey);
    let schematicSheetName;
    if (label.schematic_sheet_id) {
      schematicSheetName = this.schematicSheetNameById.get(
        label.schematic_sheet_id
      );
    }
    const issue = {
      lineItemType: "VerboseSchematicNetLabel",
      schematicNetLabelId: label.schematic_net_label_id,
      sourceNetId: label.source_net_id,
      schematicSheetId: label.schematic_sheet_id,
      schematicSheetName,
      text: label.text,
      involvedPins: this.getInvolvedPins(label.text, this.tokenToInvolvedPin),
      schX: label.center.x,
      schY: label.center.y,
      message: this.VERBOSE_NET_LABEL_MESSAGE
    };
    this.params.issues.push(issue);
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(attrs, "message", issue.message);
    addAttr(attrs, "text", issue.text);
    addAttr(attrs, "involvedPins", issue.involvedPins.join(","));
    addAttr(attrs, "schSheetName", issue.schematicSheetName);
    addAttr(attrs, "schX", issue.schX);
    addAttr(attrs, "schY", issue.schY);
    return `<VerboseSchematicNetLabel ${attrs.join(" ")} />`;
  }
  isSchematicNetLabel(el) {
    return el.type === "schematic_net_label";
  }
  isSourcePort(el) {
    return el.type === "source_port";
  }
  getSourceComponentWithName(el) {
    if (el.type !== "source_component" || !("source_component_id" in el) || !("name" in el) || typeof el.source_component_id !== "string" || typeof el.name !== "string")
      return null;
    return { source_component_id: el.source_component_id, name: el.name };
  }
  getSourcePortNameCandidates(port) {
    return [
      port.most_frequently_referenced_by_name,
      port.name,
      ...port.port_hints ?? [],
      port.pin_number === void 0 ? void 0 : String(port.pin_number)
    ].filter((n) => Boolean(n));
  }
  getBestSourcePortName(port) {
    return port.most_frequently_referenced_by_name ?? port.name ?? (port.pin_number === void 0 ? "" : `pin${port.pin_number}`);
  }
  buildTokenToInvolvedPinMap(circuitJson) {
    const sourceComponentById = new Map(
      circuitJson.flatMap((el) => {
        const sc = this.getSourceComponentWithName(el);
        return sc ? [sc] : [];
      }).map((sc) => [sc.source_component_id, sc])
    );
    const map = /* @__PURE__ */ new Map();
    for (const port of circuitJson.filter((el) => this.isSourcePort(el))) {
      if (!port.source_component_id) continue;
      const sc = sourceComponentById.get(port.source_component_id);
      if (!sc?.name) continue;
      const involvedPin = `${sc.name}.${this.getBestSourcePortName(port)}`;
      for (const name of this.getSourcePortNameCandidates(port)) {
        map.set(`${sc.name}_${name}`, involvedPin);
      }
    }
    return map;
  }
  getInvolvedPins(text, tokenToInvolvedPin) {
    const pins = /* @__PURE__ */ new Set();
    for (const token of text.split("/")) {
      const pin = tokenToInvolvedPin.get(token);
      if (pin) pins.add(pin);
    }
    return Array.from(pins);
  }
};

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/SchematicTextClearanceSolver/SchematicTextClearanceSolver.ts
import { BaseSolver as BaseSolver26 } from "@tscircuit/solver-utils";
var SchematicTextClearanceSolver = class extends BaseSolver26 {
  constructor(params) {
    super();
    this.params = params;
    const { ctx } = params;
    this.sheetNames = getSchematicSheetNamesById(ctx.circuitJson);
    const customSymbolIds = new Set(
      ctx.circuitJson.flatMap(
        (element) => element.type === "schematic_component" && element.is_box_with_pins === false && !element.symbol_name ? [element.schematic_component_id] : []
      )
    );
    const seenText = /* @__PURE__ */ new Set();
    this.texts = ctx.circuitJson.flatMap((element) => {
      if (element.type !== "schematic_text") return [];
      if (element.schematic_component_id || element.schematic_symbol_id || "source_trace_id" in element && element.source_trace_id)
        return [];
      const polygons = getSchematicTextPolygons(element);
      if (!polygons.length) return [];
      const sheetId = element.schematic_sheet_id;
      const fingerprint = JSON.stringify([
        sheetId,
        element.text,
        element.position.x,
        element.position.y,
        element.font_size,
        element.anchor,
        element.rotation,
        element.color
      ]);
      if (seenText.has(fingerprint)) return [];
      seenText.add(fingerprint);
      return [
        {
          text: element,
          polygons,
          sheetId,
          object: {
            type: "text",
            id: element.schematic_text_id,
            text: element.text
          }
        }
      ];
    });
    this.obstacles = [
      ...ctx.componentPlacements.flatMap(
        (p) => (
          // Custom path/circle symbols can have empty corners in their bounds.
          // Their ink geometry must be known before treating that area as a body.
          p.schematicComponentId && !customSymbolIds.has(p.schematicComponentId) ? [
            {
              object: {
                type: "component",
                id: p.schematicComponentId,
                componentName: p.sourceComponentName,
                schematicComponentId: p.schematicComponentId
              },
              polygons: [
                rectPolygon(centeredRect(p.schX, p.schY, p.width, p.height))
              ],
              sheetId: p.schematicSheetId
            }
          ] : []
        )
      ),
      ...ctx.circuitJson.flatMap(
        (element) => element.type === "schematic_trace" ? [
          {
            object: {
              type: "trace",
              id: element.schematic_trace_id
            },
            sheetId: element.schematic_sheet_id,
            segments: element.edges,
            polygons: element.edges.flatMap((edge) => {
              const polygon = traceSegmentPolygon(edge.from, edge.to);
              return polygon ? [polygon] : [];
            })
          }
        ] : []
      )
    ];
    this.solved = this.texts.length === 0;
  }
  params;
  texts;
  obstacles;
  sheetNames;
  index = 0;
  _step() {
    const text = this.texts[this.index];
    const targets = [...this.obstacles, ...this.texts.slice(this.index + 1)];
    const collisions = targets.filter((target) => this.collides(text, target));
    if (collisions.length) {
      const suggestedMove = this.findClearPosition(text);
      for (const target of collisions) {
        this.params.issues.push({
          lineItemType: "SchematicTextCollision",
          schematicSheetId: text.sheetId,
          schematicSheetName: text.sheetId ? this.sheetNames.get(text.sheetId) : void 0,
          schematicTextId: text.text.schematic_text_id,
          text: text.text.text,
          collidingObject: target.object,
          textBounds: polygonBounds(text.polygons),
          collidingObjectBounds: polygonBounds(target.polygons),
          suggestedMove,
          message: `Text "${text.text.text}" overlaps ${target.object.type} ${target.object.componentName ?? target.object.id}; reposition the text to leave its visible area clear.`
        });
      }
    }
    this.index++;
    this.solved = this.index >= this.texts.length;
  }
  collides(text, obstacle) {
    if (text.sheetId !== obstacle.sheetId) return false;
    return text.polygons.some(
      (a) => obstacle.segments ? obstacle.segments.some(
        (edge) => segmentCrossesPolygon(edge.from, edge.to, a)
      ) : obstacle.polygons.some((b) => polygonsOverlap(a, b))
    );
  }
  findClearPosition(text) {
    const obstacles = [
      ...this.obstacles,
      ...this.texts.filter((t) => t !== text)
    ];
    const step = Math.max(0.1, text.text.font_size / 2);
    for (let distance5 = step; distance5 <= Math.max(4, text.text.font_size * 8); distance5 += step) {
      for (const [dx, dy] of [
        [0, distance5],
        [0, -distance5],
        [-distance5, 0],
        [distance5, 0]
      ]) {
        const newSchX = Math.round((text.text.position.x + dx) * 1e3) / 1e3;
        const newSchY = Math.round((text.text.position.y + dy) * 1e3) / 1e3;
        const moved = {
          ...text,
          polygons: getSchematicTextPolygons({
            ...text.text,
            position: { x: newSchX, y: newSchY }
          })
        };
        if (obstacles.every((obstacle) => !this.collides(moved, obstacle)))
          return { newSchX, newSchY };
      }
    }
    return void 0;
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(attrs, "schematicTextId", issue.schematicTextId);
    addAttr(attrs, "text", issue.text);
    addAttr(attrs, "collidingObjectType", issue.collidingObject.type);
    addAttr(attrs, "collidingObjectId", issue.collidingObject.id);
    addAttr(attrs, "newSchX", issue.suggestedMove?.newSchX);
    addAttr(attrs, "newSchY", issue.suggestedMove?.newSchY);
    addAttr(attrs, "message", issue.message);
    return `<SchematicTextCollision ${attrs.join(" ")} />`;
  }
};

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/ResetNetworkGroupingSolver/ResetNetworkGroupingSolver.ts
import { BaseSolver as BaseSolver27 } from "@tscircuit/solver-utils";
var ResetNetworkGroupingSolver = class _ResetNetworkGroupingSolver extends BaseSolver27 {
  constructor(params) {
    super();
    this.params = params;
    this.networks = this.findNetworks(params.ctx);
    this.solved = this.networks.length === 0;
  }
  params;
  // Readability heuristic in schematic units, not an electrical/PCB constraint.
  // Measure from the reset pin, so a large host symbol does not cause a warning.
  static MIN_DISTANCE = 6;
  networks;
  index = 0;
  _step() {
    const network = this.networks[this.index];
    const rcMembers = network.members.slice(0, 2);
    const threshold = Math.max(
      _ResetNetworkGroupingSolver.MIN_DISTANCE,
      ...rcMembers.map((p) => 3 * Math.max(p.width, p.height))
    );
    const distances = rcMembers.map(
      (p) => Math.hypot(
        Math.max(0, Math.abs(p.schX - network.pinPosition.x) - p.width / 2),
        Math.max(0, Math.abs(p.schY - network.pinPosition.y) - p.height / 2)
      )
    );
    if (distances.some((distance5) => distance5 > threshold)) {
      const hostName = network.host.sourceComponentName ?? network.host.schematicComponentId;
      const resetPin = resetPinName(network.pin);
      const memberNames = rcMembers.map((p) => p.sourceComponentName ?? p.schematicComponentId).join(", ");
      this.params.issues.push({
        lineItemType: "ResetNetworkNotGrouped",
        hostSchematicBox: network.host,
        resetSourcePortId: network.pin.source_port_id,
        resetPinName: resetPin,
        supportNetworkComponents: network.members,
        maxDistanceFromResetPin: Math.round(Math.max(...distances) * 100) / 100,
        maxRecommendedDistance: threshold,
        message: `Group ${memberNames} near ${hostName}.${resetPin} so the reset pull-up and capacitor can be read together. Preserve all net connections; associated test points may remain in a debug area.`
      });
    }
    this.index++;
    this.solved = this.index >= this.networks.length;
  }
  findNetworks(ctx) {
    const root = getSourceConnectivity(ctx.circuitJson);
    const sources = ctx.circuitJson.filter((e) => e.type === "source_component");
    const sourceById = new Map(sources.map((e) => [e.source_component_id, e]));
    const ports = ctx.circuitJson.filter((e) => e.type === "source_port");
    const portsByComponent = /* @__PURE__ */ new Map();
    const portsByNet = /* @__PURE__ */ new Map();
    const power = /* @__PURE__ */ new Set();
    const ground = /* @__PURE__ */ new Set();
    for (const port of ports) {
      if (!port.source_component_id) continue;
      const componentPorts = portsByComponent.get(port.source_component_id) ?? [];
      componentPorts.push(port);
      portsByComponent.set(port.source_component_id, componentPorts);
      const net = root(port.source_port_id);
      const netPorts = portsByNet.get(net) ?? [];
      netPorts.push(port);
      portsByNet.set(net, netPorts);
      if (port.provides_power || port.requires_power) power.add(net);
      if (port.provides_ground || port.requires_ground) ground.add(net);
    }
    for (const element of ctx.circuitJson) {
      if (element.type !== "source_net") continue;
      if (element.is_power || element.is_positive_voltage_source)
        power.add(root(element.source_net_id));
      if (element.is_ground) ground.add(root(element.source_net_id));
    }
    const placementBySource = new Map(
      ctx.componentPlacements.flatMap(
        (p) => p.sourceComponentId ? [[p.sourceComponentId, p]] : []
      )
    );
    const schematicPorts = ctx.circuitJson.filter(
      (e) => e.type === "schematic_port"
    );
    const schematicComponents = new Map(
      ctx.circuitJson.filter((e) => e.type === "schematic_component").map((e) => [e.schematic_component_id, e])
    );
    const networks = [];
    const seen = /* @__PURE__ */ new Set();
    for (const pin of ports) {
      if (!pin.source_component_id || !resetPinName(pin) || pin.do_not_connect)
        continue;
      if (sourceById.get(pin.source_component_id)?.ftype !== "simple_chip")
        continue;
      const net = root(pin.source_port_id);
      if (seen.has(net) || power.has(net) || ground.has(net)) continue;
      seen.add(net);
      const peers = portsByNet.get(net) ?? [];
      const chips = new Set(
        peers.filter(
          (p) => p.source_component_id && sourceById.get(p.source_component_id)?.ftype === "simple_chip"
        ).map((p) => p.source_component_id)
      );
      if (chips.size !== 1) continue;
      const host = placementBySource.get(pin.source_component_id);
      const schematicPin = schematicPorts.find(
        (p) => p.source_port_id === pin.source_port_id && p.schematic_component_id === host?.schematicComponentId
      );
      if (!host || !schematicPin || schematicPin.schematic_sheet_id !== host.schematicSheetId)
        continue;
      const pullups = [];
      const capacitors = [];
      const testpoints = [];
      let unsupported = false;
      for (const id of new Set(peers.map((p) => p.source_component_id))) {
        if (!id || id === pin.source_component_id) continue;
        const type = sourceById.get(id)?.ftype;
        const componentPorts = portsByComponent.get(id) ?? [];
        const placement = placementBySource.get(id);
        if (type === "simple_connector" || type === "simple_pin_header")
          continue;
        if (!placement) {
          unsupported = true;
          break;
        }
        if (type === "simple_test_point" && componentPorts.length === 1) {
          testpoints.push(placement);
          continue;
        }
        if (componentPorts.length !== 2) {
          unsupported = true;
          break;
        }
        const other = componentPorts.find((p) => root(p.source_port_id) !== net);
        if (!other) {
          unsupported = true;
          break;
        }
        const otherNet = root(other.source_port_id);
        if (type === "simple_resistor" && power.has(otherNet) && !ground.has(otherNet))
          pullups.push(placement);
        else if (type === "simple_capacitor" && ground.has(otherNet) && !power.has(otherNet))
          capacitors.push(placement);
        else {
          unsupported = true;
          break;
        }
      }
      if (unsupported || pullups.length !== 1 || capacitors.length !== 1)
        continue;
      const members = [...pullups, ...capacitors, ...testpoints];
      const hostGroup = host.schematicComponentId ? schematicComponents.get(host.schematicComponentId)?.schematic_group_id : void 0;
      if (members.some((member) => {
        const group = member.schematicComponentId ? schematicComponents.get(member.schematicComponentId)?.schematic_group_id : void 0;
        return member.schematicSheetId !== host.schematicSheetId || member.subcircuitId !== host.subcircuitId || group !== hostGroup;
      }))
        continue;
      networks.push({ host, pin, pinPosition: schematicPin.center, members });
    }
    return networks;
  }
  static issueToString(issue) {
    const attrs = [];
    addAttr(
      attrs,
      "hostComponentName",
      issue.hostSchematicBox.sourceComponentName
    );
    addAttr(attrs, "resetPin", issue.resetPinName);
    addAttr(
      attrs,
      "supportNetworkComponents",
      issue.supportNetworkComponents.map((p) => p.sourceComponentName ?? p.schematicComponentId).join(",")
    );
    addAttr(attrs, "maxDistanceFromResetPin", issue.maxDistanceFromResetPin);
    addAttr(attrs, "maxRecommendedDistance", issue.maxRecommendedDistance);
    addAttr(attrs, "message", issue.message);
    return `<ResetNetworkNotGrouped ${attrs.join(" ")} />`;
  }
};
var resetPinName = (port) => [port.name, ...port.port_hints ?? []].find(
  (name) => /^N?(RESET|RST)(N|B)?$/.test(name.toUpperCase().replace(/[_\-!~#/]/g, ""))
);

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/solvers/SchematicPlacementPipeline/SchematicPlacementPipeline.ts
var solversByIssueType = {
  MosfetGateNetworkNotGrouped: [MosfetGateNetworkPlacementSolver],
  FlybackDiodeSeparatedFromRelayCoil: [RelayFlybackDiodePlacementSolver],
  ComponentOverlap: [SchematicBoxOverlapSolver],
  // Retained in the issue union, but no solver currently emits this type.
  SchematicBoxHasALotOfSurroundingWhitespace: [],
  CapacitorSymbolHorizontal: [
    CapacitorOrientationSolver,
    TwoPinComponentRailOrientationSolver
  ],
  VerboseSchematicNetLabel: [VerboseNetLabelSolver],
  PinHeaderSchematicBoxTooWide: [SchematicBoxTooWideSolver],
  GenericSchematicBoxTooWide: [SchematicBoxTooWideSolver],
  SchematicBoxInnerLabelCollision: [SchematicBoxInnerLabelCollisionSolver],
  SchematicPinPaddingToEdgeTooLarge: [SchematicPinPaddingToEdgeSolver],
  DiodeResistorNotAligned: [DiodeResistorAlignmentSolver],
  ComponentPinsWouldAlignWithVerticalShift: [ComponentPinAlignmentSolver],
  TraceCanBeSimplifiedByMovingComponent: [TraceSimplificationSolver],
  CrystalNotCenteredOverLoadCapacitors: [CrystalLoadCapacitorPlacementSolver],
  ComponentNetLabelCollision: [ComponentNetLabelCollisionSolver],
  ComponentBoxNetLabelCollision: [ComponentNetLabelCollisionSolver],
  NetLabelCollision: [ComponentNetLabelCollisionSolver],
  FeedbackNetworkNotCompact: [FeedbackNetworkPlacementSolver],
  PullResistorOnWrongSide: [
    PullResistorPlacementSolver,
    SwitchPullResistorPlacementSolver
  ],
  SchematicTextCollision: [SchematicTextClearanceSolver],
  ResetNetworkNotGrouped: [ResetNetworkGroupingSolver],
  TwoPinComponentCouldBeFlipped: [TwoPinComponentOrientationSolver],
  TwoPinComponentShouldBeVertical: [TwoPinComponentRailOrientationSolver],
  TwoPinComponentHasInvertedRails: [TwoPinComponentRailOrientationSolver],
  DecouplingCapacitorsNotCloseTogether: [DecouplingCapacitorGroupingSolver],
  ConnectorPositionCausesTraceDetours: [ConnectorPlacementSolver],
  LowSideTransistorNotAlignedWithLoad: [LowSideTransistorPlacementSolver],
  UsbSeriesResistorsNotAligned: [UsbSeriesResistorPlacementSolver],
  CurrentSenseShuntSeparatedFromInputs: [CurrentSenseShuntPlacementSolver],
  VoltageDividerSupplyResistorBelowGroundResistor: [
    VoltageDividerPlacementSolver
  ],
  RegulatorCapacitorsOnWrongSides: [
    RegulatorInputOutputCapacitorPlacementSolver
  ]
};
var SchematicPlacementPipeline = class extends BasePipelineSolver {
  ctx;
  issues = [];
  pipelineDef = [
    definePipelineStep(
      "SchematicTextClearanceSolver",
      SchematicTextClearanceSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "ResetNetworkGroupingSolver",
      ResetNetworkGroupingSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "SchematicBoxOverlapSolver",
      SchematicBoxOverlapSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "CapacitorOrientationSolver",
      CapacitorOrientationSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "VerboseNetLabelSolver",
      VerboseNetLabelSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "SchematicBoxTooWideSolver",
      SchematicBoxTooWideSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "SchematicPinPaddingToEdgeSolver",
      SchematicPinPaddingToEdgeSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "SchematicBoxInnerLabelCollisionSolver",
      SchematicBoxInnerLabelCollisionSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "DiodeResistorAlignmentSolver",
      DiodeResistorAlignmentSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "ComponentPinAlignmentSolver",
      ComponentPinAlignmentSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "TraceSimplificationSolver",
      TraceSimplificationSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "CrystalLoadCapacitorPlacementSolver",
      CrystalLoadCapacitorPlacementSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "TwoPinComponentOrientationSolver",
      TwoPinComponentOrientationSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "FeedbackNetworkPlacementSolver",
      FeedbackNetworkPlacementSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "TwoPinComponentRailOrientationSolver",
      TwoPinComponentRailOrientationSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "PullResistorPlacementSolver",
      PullResistorPlacementSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "SwitchPullResistorPlacementSolver",
      SwitchPullResistorPlacementSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "ComponentNetLabelCollisionSolver",
      ComponentNetLabelCollisionSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "DecouplingCapacitorGroupingSolver",
      DecouplingCapacitorGroupingSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "ConnectorPlacementSolver",
      ConnectorPlacementSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "LowSideTransistorPlacementSolver",
      LowSideTransistorPlacementSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "UsbSeriesResistorPlacementSolver",
      UsbSeriesResistorPlacementSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "RegulatorInputOutputCapacitorPlacementSolver",
      RegulatorInputOutputCapacitorPlacementSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "VoltageDividerPlacementSolver",
      VoltageDividerPlacementSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "CurrentSenseShuntPlacementSolver",
      CurrentSenseShuntPlacementSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "RelayFlybackDiodePlacementSolver",
      RelayFlybackDiodePlacementSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    ),
    definePipelineStep(
      "MosfetGateNetworkPlacementSolver",
      MosfetGateNetworkPlacementSolver,
      (p) => [
        { ctx: p.ctx, issues: p.issues }
      ]
    )
  ];
  selectedIssueTypes;
  constructor(circuitJson, options = {}) {
    super(circuitJson);
    if (options.issueTypes !== void 0) {
      this.selectedIssueTypes = new Set(options.issueTypes);
      const selectedSolvers = new Set(
        options.issueTypes.flatMap(
          (type) => solversByIssueType[type]
        )
      );
      this.pipelineDef = this.pipelineDef.filter(
        (step) => selectedSolvers.has(step.solverClass)
      );
    }
  }
  _setup() {
    this.ctx = buildSolverContext(this.inputProblem);
  }
  getOutput() {
    const railOrientationComponentIds = new Set(
      this.issues.flatMap(
        (issue) => issue.lineItemType === "TwoPinComponentShouldBeVertical" && issue.schematicBox.schematicComponentId ? [issue.schematicBox.schematicComponentId] : []
      )
    );
    return {
      issues: this.issues.filter(
        (issue) => issue.lineItemType !== "CapacitorSymbolHorizontal" || !railOrientationComponentIds.has(
          issue.schematicBox.schematicComponentId ?? ""
        )
      ).filter(
        (issue) => this.selectedIssueTypes === void 0 || this.selectedIssueTypes.has(issue.lineItemType)
      ),
      componentPlacements: this.ctx.componentPlacements
    };
  }
};

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/utils/issue-context.ts
var POSITION_EPSILON = 0.01;
var getRelevantPlacementsForIssues = ({
  issues,
  componentPlacements,
  circuitJson
}) => {
  const relevantPlacements = /* @__PURE__ */ new Set();
  const placementByComponentId = new Map(
    componentPlacements.flatMap(
      (placement) => placement.schematicComponentId ? [[placement.schematicComponentId, placement]] : []
    )
  );
  const placementsByName = /* @__PURE__ */ new Map();
  for (const placement of componentPlacements) {
    if (!placement.sourceComponentName) continue;
    const namedPlacements = placementsByName.get(placement.sourceComponentName);
    if (namedPlacements) namedPlacements.push(placement);
    else placementsByName.set(placement.sourceComponentName, [placement]);
  }
  const addPlacement = (placement) => {
    if (!placement) return;
    const canonicalPlacement = placement.schematicComponentId ? placementByComponentId.get(placement.schematicComponentId) : componentPlacements.find(
      (candidate) => candidate.sourceComponentId === placement.sourceComponentId && candidate.schX === placement.schX && candidate.schY === placement.schY
    );
    if (canonicalPlacement) relevantPlacements.add(canonicalPlacement);
  };
  const addComponentName = (componentName, schematicSheetId) => {
    if (!componentName) return;
    for (const placement of placementsByName.get(componentName) ?? []) {
      if (schematicSheetId === void 0 || placement.schematicSheetId === schematicSheetId) {
        relevantPlacements.add(placement);
      }
    }
  };
  for (const issue of issues) {
    switch (issue.lineItemType) {
      case "MosfetGateNetworkNotGrouped":
        addPlacement(issue.mosfetSchematicBox);
        addPlacement(issue.seriesGateResistorSchematicBox);
        addPlacement(issue.gateSourceResistorSchematicBox);
        break;
      case "FlybackDiodeSeparatedFromRelayCoil":
        addPlacement(issue.relaySchematicBox);
        addPlacement(issue.diodeSchematicBox);
        break;
      case "CurrentSenseShuntSeparatedFromInputs":
        addPlacement(issue.amplifierSchematicBox);
        addPlacement(issue.shuntSchematicBox);
        break;
      case "VoltageDividerSupplyResistorBelowGroundResistor":
        addPlacement(issue.supplyResistorSchematicBox);
        addPlacement(issue.groundResistorSchematicBox);
        break;
      case "RegulatorCapacitorsOnWrongSides":
        addPlacement(issue.regulatorSchematicBox);
        addPlacement(issue.inputCapacitorSchematicBox);
        addPlacement(issue.outputCapacitorSchematicBox);
        break;
      case "UsbSeriesResistorsNotAligned":
        addPlacement(issue.positiveResistorSchematicBox);
        addPlacement(issue.negativeResistorSchematicBox);
        break;
      case "LowSideTransistorNotAlignedWithLoad":
        addPlacement(issue.transistorSchematicBox);
        addPlacement(issue.loadSchematicBox);
        addPlacement(issue.baseResistorSchematicBox);
        addPlacement(issue.clampDiodeSchematicBox);
        break;
      case "DecouplingCapacitorsNotCloseTogether":
        for (const placement of issue.capacitorSchematicBoxes)
          addPlacement(placement);
        break;
      case "ConnectorPositionCausesTraceDetours":
        addPlacement(issue.connectorSchematicBox);
        for (const placement of issue.connectedComponents)
          addPlacement(placement);
        break;
      case "ResetNetworkNotGrouped":
        addPlacement(issue.hostSchematicBox);
        for (const placement of issue.supportNetworkComponents)
          addPlacement(placement);
        break;
      case "SchematicTextCollision":
        if (issue.collidingObject.schematicComponentId)
          addPlacement(
            placementByComponentId.get(
              issue.collidingObject.schematicComponentId
            )
          );
        if (issue.collidingObject.type === "trace") {
          for (const placement of getTraceEndpointPlacements({
            schematicTraceId: issue.collidingObject.id,
            circuitJson,
            placementByComponentId
          }))
            addPlacement(placement);
        }
        break;
      case "ComponentOverlap":
        addPlacement(issue.firstComponent);
        addPlacement(issue.secondComponent);
        break;
      case "SchematicBoxHasALotOfSurroundingWhitespace":
      case "CapacitorSymbolHorizontal":
      case "PinHeaderSchematicBoxTooWide":
      case "GenericSchematicBoxTooWide":
      case "SchematicBoxInnerLabelCollision":
      case "SchematicPinPaddingToEdgeTooLarge":
        addPlacement(issue.schematicBox);
        break;
      case "VerboseSchematicNetLabel":
        for (const pin of issue.involvedPins) {
          addComponentName(getComponentNameFromPin(pin), issue.schematicSheetId);
        }
        break;
      case "DiodeResistorNotAligned":
        addPlacement(issue.diodeSchematicBox);
        addPlacement(issue.resistorSchematicBox);
        break;
      case "ComponentPinsWouldAlignWithVerticalShift":
        addPlacement(issue.firstComponent);
        addPlacement(issue.secondComponent);
        addPlacement(issue.targetComponent);
        break;
      case "TraceCanBeSimplifiedByMovingComponent":
        addPlacement(issue.targetComponent);
        for (const placement of getTraceEndpointPlacements({
          schematicTraceId: issue.schematicTraceId,
          circuitJson,
          placementByComponentId
        })) {
          relevantPlacements.add(placement);
        }
        break;
      case "CrystalNotCenteredOverLoadCapacitors":
        addPlacement(issue.crystalSchematicBox);
        addPlacement(issue.firstLoadCapacitorSchematicBox);
        addPlacement(issue.secondLoadCapacitorSchematicBox);
        break;
      case "TwoPinComponentCouldBeFlipped":
        addPlacement(issue.targetComponent);
        addPlacement(issue.connectedComponent);
        break;
      case "FeedbackNetworkNotCompact":
        addPlacement(issue.amplifierSchematicBox);
        for (const component of issue.feedbackComponents)
          addPlacement(component);
        break;
      case "TwoPinComponentShouldBeVertical":
      case "TwoPinComponentHasInvertedRails":
        addPlacement(issue.schematicBox);
        break;
      case "PullResistorOnWrongSide":
        addPlacement(issue.resistorSchematicBox);
        addPlacement(issue.hostSchematicBox);
        break;
      case "ComponentNetLabelCollision":
        addPlacement(issue.firstComponent);
        addPlacement(issue.secondComponent);
        break;
      case "ComponentBoxNetLabelCollision":
        addPlacement(issue.boxComponent);
        addPlacement(issue.labelComponent);
        break;
      case "NetLabelCollision":
        for (const pair of issue.pairs) {
          addComponentName(pair.comp1Name, issue.schematicSheetId);
          addComponentName(pair.comp2Name, issue.schematicSheetId);
        }
        for (const move of issue.moves) {
          addComponentName(move.componentName, issue.schematicSheetId);
        }
        break;
    }
  }
  return componentPlacements.filter(
    (placement) => relevantPlacements.has(placement)
  );
};
var getIssueSchematicSheetContext = (issue) => {
  if ("schematicSheetId" in issue || "schematicSheetName" in issue) {
    const schematicSheetId = "schematicSheetId" in issue && typeof issue.schematicSheetId === "string" ? issue.schematicSheetId : void 0;
    const schematicSheetName = "schematicSheetName" in issue && typeof issue.schematicSheetName === "string" ? issue.schematicSheetName : void 0;
    if (schematicSheetId || schematicSheetName) {
      return { schematicSheetId, schematicSheetName };
    }
  }
  for (const value of Object.values(issue).flat()) {
    if (isSchematicBoxPlacement(value)) {
      return {
        schematicSheetId: value.schematicSheetId,
        schematicSheetName: value.schematicSheetName
      };
    }
  }
  return {};
};
var getComponentNameFromPin = (pin) => {
  const separatorIndex = pin.lastIndexOf(".");
  return separatorIndex === -1 ? pin : pin.slice(0, separatorIndex);
};
var isSchematicBoxPlacement = (value) => Boolean(
  value && typeof value === "object" && "positionAnchor" in value && value.positionAnchor === "center" && "schX" in value && "schY" in value && "width" in value && "height" in value
);
var getTraceEndpointPlacements = ({
  schematicTraceId,
  circuitJson,
  placementByComponentId
}) => {
  const trace = circuitJson.find(
    (element) => element.type === "schematic_trace" && element.schematic_trace_id === schematicTraceId
  );
  const firstEdge = trace?.edges[0];
  const lastEdge = trace?.edges.at(-1);
  if (!trace || !firstEdge || !lastEdge) return [];
  const ports = circuitJson.filter(
    (element) => element.type === "schematic_port"
  );
  const portsById = new Map(ports.map((port) => [port.schematic_port_id, port]));
  const endpointPorts = [
    firstEdge.from_schematic_port_id ? portsById.get(firstEdge.from_schematic_port_id) : findPortAtPoint(ports, firstEdge.from, trace.schematic_sheet_id),
    lastEdge.to_schematic_port_id ? portsById.get(lastEdge.to_schematic_port_id) : findPortAtPoint(ports, lastEdge.to, trace.schematic_sheet_id)
  ];
  return endpointPorts.flatMap((port) => {
    const placement = port?.schematic_component_id ? placementByComponentId.get(port.schematic_component_id) : void 0;
    return placement ? [placement] : [];
  });
};
var findPortAtPoint = (ports, point2, schematicSheetId) => ports.find(
  (port) => port.schematic_sheet_id === schematicSheetId && Math.abs(port.center.x - point2.x) <= POSITION_EPSILON && Math.abs(port.center.y - point2.y) <= POSITION_EPSILON
);

// node_modules/@tscircuit/circuit-json-schematic-placement-analysis/lib/analyze-schematic-placement.ts
var SchematicPlacementAnalysis = class {
  constructor(lineItems, groupBySchematicSheet = false) {
    this.lineItems = lineItems;
    this.groupBySchematicSheet = groupBySchematicSheet;
  }
  lineItems;
  groupBySchematicSheet;
  getLineItems() {
    return this.lineItems;
  }
  /** Filter emitted issues without rerunning or changing the solvers. */
  getIssues(filter = {}) {
    return this.lineItems.flatMap(
      (item) => item.lineItemType === "SchematicPlacementIssues" ? item.issues : []
    ).filter(
      (issue) => (filter.issueTypes === void 0 || filter.issueTypes.includes(issue.lineItemType)) && (filter.schematicSheetId === void 0 || (getIssueSchematicSheetContext(issue).schematicSheetId ?? "") === filter.schematicSheetId)
    );
  }
  /** Counts emitted issue objects, including zero counts for known types. */
  getIssueCounts(filter = {}) {
    const counts = {
      FlybackDiodeSeparatedFromRelayCoil: 0,
      ComponentOverlap: 0,
      SchematicBoxHasALotOfSurroundingWhitespace: 0,
      CapacitorSymbolHorizontal: 0,
      VerboseSchematicNetLabel: 0,
      PinHeaderSchematicBoxTooWide: 0,
      GenericSchematicBoxTooWide: 0,
      SchematicBoxInnerLabelCollision: 0,
      SchematicPinPaddingToEdgeTooLarge: 0,
      DiodeResistorNotAligned: 0,
      ComponentPinsWouldAlignWithVerticalShift: 0,
      TraceCanBeSimplifiedByMovingComponent: 0,
      CrystalNotCenteredOverLoadCapacitors: 0,
      ComponentNetLabelCollision: 0,
      ComponentBoxNetLabelCollision: 0,
      NetLabelCollision: 0,
      FeedbackNetworkNotCompact: 0,
      PullResistorOnWrongSide: 0,
      SchematicTextCollision: 0,
      ResetNetworkNotGrouped: 0,
      TwoPinComponentCouldBeFlipped: 0,
      TwoPinComponentShouldBeVertical: 0,
      TwoPinComponentHasInvertedRails: 0,
      DecouplingCapacitorsNotCloseTogether: 0,
      ConnectorPositionCausesTraceDetours: 0,
      LowSideTransistorNotAlignedWithLoad: 0,
      UsbSeriesResistorsNotAligned: 0,
      RegulatorCapacitorsOnWrongSides: 0,
      VoltageDividerSupplyResistorBelowGroundResistor: 0,
      CurrentSenseShuntSeparatedFromInputs: 0,
      MosfetGateNetworkNotGrouped: 0
    };
    for (const issue of this.getIssues(filter)) counts[issue.lineItemType]++;
    return counts;
  }
  getString() {
    return this.toString();
  }
  schematicBoxPlacementsToString(lineItem) {
    const attrs = [];
    addAttr(attrs, "componentName", lineItem.sourceComponentName);
    addAttr(attrs, "positionAnchor", lineItem.positionAnchor);
    addAttr(attrs, "schX", lineItem.schX);
    addAttr(attrs, "schY", lineItem.schY);
    addAttr(attrs, "width", lineItem.width);
    addAttr(attrs, "height", lineItem.height);
    return `<SchematicBoxPlacement ${attrs.join(" ")} />`;
  }
  schematicIssuesToString(issue) {
    switch (issue.lineItemType) {
      case "MosfetGateNetworkNotGrouped":
        return MosfetGateNetworkPlacementSolver.issueToString(issue);
      case "CurrentSenseShuntSeparatedFromInputs":
        return CurrentSenseShuntPlacementSolver.issueToString(issue);
      case "ComponentOverlap":
        return SchematicBoxOverlapSolver.issueToString(issue);
      case "CapacitorSymbolHorizontal":
        return CapacitorOrientationSolver.issueToString(issue);
      case "DecouplingCapacitorsNotCloseTogether":
        return DecouplingCapacitorGroupingSolver.issueToString(issue);
      case "VerboseSchematicNetLabel":
        return VerboseNetLabelSolver.issueToString(issue);
      case "PinHeaderSchematicBoxTooWide":
      case "GenericSchematicBoxTooWide":
        return SchematicBoxTooWideSolver.issueToString(issue);
      case "SchematicBoxInnerLabelCollision":
        return SchematicBoxInnerLabelCollisionSolver.issueToString(issue);
      case "SchematicPinPaddingToEdgeTooLarge":
        return SchematicPinPaddingToEdgeSolver.issueToString(issue);
      case "DiodeResistorNotAligned":
        return DiodeResistorAlignmentSolver.issueToString(issue);
      case "ComponentPinsWouldAlignWithVerticalShift":
        return ComponentPinAlignmentSolver.issueToString(issue);
      case "TraceCanBeSimplifiedByMovingComponent":
        return TraceSimplificationSolver.issueToString(issue);
      case "CrystalNotCenteredOverLoadCapacitors":
        return CrystalLoadCapacitorPlacementSolver.issueToString(issue);
      case "TwoPinComponentCouldBeFlipped":
        return TwoPinComponentOrientationSolver.issueToString(issue);
      case "FeedbackNetworkNotCompact":
        return FeedbackNetworkPlacementSolver.issueToString(issue);
      case "TwoPinComponentShouldBeVertical":
      case "TwoPinComponentHasInvertedRails":
        return TwoPinComponentRailOrientationSolver.issueToString(issue);
      case "PullResistorOnWrongSide":
        return PullResistorPlacementSolver.issueToString(issue);
      case "NetLabelCollision":
        return ComponentNetLabelCollisionSolver.netLabelCollisionToString(issue);
      case "SchematicTextCollision":
        return SchematicTextClearanceSolver.issueToString(issue);
      case "ResetNetworkNotGrouped":
        return ResetNetworkGroupingSolver.issueToString(issue);
      case "ConnectorPositionCausesTraceDetours":
        return ConnectorPlacementSolver.issueToString(issue);
      case "LowSideTransistorNotAlignedWithLoad":
        return LowSideTransistorPlacementSolver.issueToString(issue);
      case "FlybackDiodeSeparatedFromRelayCoil":
        return RelayFlybackDiodePlacementSolver.issueToString(issue);
      case "VoltageDividerSupplyResistorBelowGroundResistor":
        return VoltageDividerPlacementSolver.issueToString(issue);
      case "RegulatorCapacitorsOnWrongSides":
        return RegulatorInputOutputCapacitorPlacementSolver.issueToString(issue);
      case "UsbSeriesResistorsNotAligned":
        return UsbSeriesResistorPlacementSolver.issueToString(issue);
      default:
        return "";
    }
  }
  toString() {
    const schematicBoxPlacements = this.lineItems.filter(
      (lineItem) => lineItem.lineItemType === "SchematicBoxPlacement"
    );
    const issues = this.lineItems.flatMap(
      (lineItem) => lineItem.lineItemType === "SchematicPlacementIssues" ? lineItem.issues : []
    );
    if (issues.length === 0) return "";
    if (!this.groupBySchematicSheet) {
      return this.issueContextToLines(schematicBoxPlacements, issues).join("\n");
    }
    const groups = /* @__PURE__ */ new Map();
    const getOrCreateGroup = (context) => {
      const key = context.schematicSheetId ?? context.schematicSheetName ?? "__default__";
      const existingGroup = groups.get(key);
      if (existingGroup) return existingGroup;
      const group = { ...context, placements: [], issues: [] };
      groups.set(key, group);
      return group;
    };
    for (const issue of issues) {
      getOrCreateGroup(getIssueSchematicSheetContext(issue)).issues.push(issue);
    }
    for (const placement of schematicBoxPlacements) {
      getOrCreateGroup({
        schematicSheetId: placement.schematicSheetId,
        schematicSheetName: placement.schematicSheetName
      }).placements.push(placement);
    }
    return [...groups.values()].flatMap((group) => {
      const sheetAttrs = [];
      addAttr(sheetAttrs, "name", group.schematicSheetName);
      addAttr(sheetAttrs, "id", group.schematicSheetId);
      return [
        `<SchematicSheet${sheetAttrs.length > 0 ? ` ${sheetAttrs.join(" ")}` : ""}>`,
        ...this.issueContextToLines(group.placements, group.issues),
        "</SchematicSheet>"
      ];
    }).join("\n");
  }
  issueContextToLines(placements, issues) {
    return [
      ...placements.length > 0 ? [
        "<SchematicBoxPositions>",
        ...placements.map(this.schematicBoxPlacementsToString),
        "</SchematicBoxPositions>"
      ] : [],
      "<SchematicPlacementIssues>",
      ...issues.map(this.schematicIssuesToString),
      "</SchematicPlacementIssues>"
    ];
  }
};
var analyzeSchematicPlacement = (circuitJson, options = {}) => {
  const pipeline = new SchematicPlacementPipeline(circuitJson, options);
  pipeline.solve();
  const { issues, componentPlacements } = pipeline.getOutput();
  const relevantPlacements = getRelevantPlacementsForIssues({
    issues,
    componentPlacements,
    circuitJson
  });
  const lineItems = [
    ...relevantPlacements,
    ...issues.length > 0 ? [{ lineItemType: "SchematicPlacementIssues", issues }] : []
  ];
  const schematicSheetIds = new Set(
    circuitJson.flatMap(
      (element) => "schematic_sheet_id" in element && typeof element.schematic_sheet_id === "string" ? [element.schematic_sheet_id] : []
    )
  );
  return new SchematicPlacementAnalysis(lineItems, schematicSheetIds.size > 1);
};

// lib/check-schematic-placement.ts
import { cju as cju12 } from "@tscircuit/circuit-json-util";
var enabledIssueTypes = [
  "TwoPinComponentHasInvertedRails",
  "RegulatorCapacitorsOnWrongSides",
  "PullResistorOnWrongSide"
];
function checkSchematicPlacement(circuitJson) {
  const analysis = analyzeSchematicPlacement(circuitJson, {
    issueTypes: enabledIssueTypes
  });
  const db = cju12(circuitJson);
  return analysis.getIssues().flatMap((issue) => {
    let schematicComponentId;
    let stylingIssueType;
    let message;
    switch (issue.lineItemType) {
      case "TwoPinComponentHasInvertedRails": {
        schematicComponentId = issue.schematicBox.schematicComponentId;
        const componentName = getReadableNameForElementId(
          circuitJson,
          schematicComponentId ?? ""
        );
        stylingIssueType = "inverted_rails";
        message = `${componentName} has its positive-supply connection below its ground connection. Rotate ${componentName} by 180\xB0, preserving pin connections, and reroute attached traces.`;
        break;
      }
      case "RegulatorCapacitorsOnWrongSides": {
        schematicComponentId = issue.regulatorSchematicBox.schematicComponentId;
        const regulatorName = getReadableNameForElementId(
          circuitJson,
          schematicComponentId ?? ""
        );
        const inputCapacitorName = issue.inputCapacitorSchematicBox.sourceComponentName ?? "the input capacitor";
        const outputCapacitorName = issue.outputCapacitorSchematicBox.sourceComponentName ?? "the output capacitor";
        stylingIssueType = "regulator_capacitors_on_wrong_sides";
        message = `${inputCapacitorName} and ${outputCapacitorName} are on the wrong sides of ${regulatorName}. Move them beside their connected regulator pins, preserving connections and rerouting traces.`;
        break;
      }
      case "PullResistorOnWrongSide":
        schematicComponentId = issue.resistorSchematicBox.schematicComponentId;
        stylingIssueType = "pull_resistor_on_wrong_side";
        message = issue.message;
        break;
      default:
        return [];
    }
    if (!schematicComponentId) return [];
    const component = db.schematic_component.get(schematicComponentId);
    if (!component) return [];
    const group = component.schematic_group_id ? db.schematic_group.get(component.schematic_group_id) : void 0;
    return [
      {
        type: "schematic_component_styling_warning",
        schematic_component_styling_warning_id: `schematic_component_styling_warning_${schematicComponentId}_${stylingIssueType}`,
        warning_type: "schematic_component_styling_warning",
        styling_issue_type: stylingIssueType,
        message,
        schematic_component_id: schematicComponentId,
        source_component_id: component.source_component_id,
        schematic_sheet_id: component.schematic_sheet_id,
        subcircuit_id: component.subcircuit_id ?? group?.subcircuit_id,
        schematic_port_ids: db.schematic_port.list().filter(
          (port) => port.schematic_component_id === schematicComponentId
        ).map((port) => port.schematic_port_id)
      }
    ];
  });
}

// lib/run-all-checks.ts
import { getFullConnectivityMapFromCircuitJson as getFullConnectivityMapFromCircuitJson15 } from "circuit-json-to-connectivity-map";

// lib/check-pcb-bus-length-skew.ts
var checkPcbBusLengthSkew = (circuitJson) => {
  const buses = circuitJson.filter(
    (e) => e.type === "source_bus"
  );
  const tracesBySource = getPcbTracesBySourceTraceId(circuitJson);
  const errors = [];
  for (const bus of buses) {
    if (bus.max_length_skew === void 0) continue;
    const members = [...new Set(bus.source_trace_ids)].flatMap((id) => {
      const traces = tracesBySource.get(id)?.filter((t) => t.trace_length !== void 0 || t.route.length > 1);
      if (!traces?.length) return [];
      return [
        {
          id,
          traces,
          length: traces.reduce((sum, t) => sum + getPcbTraceLength(t), 0)
        }
      ];
    });
    if (members.length < 2) continue;
    const skew = Math.max(...members.map((m) => m.length)) - Math.min(...members.map((m) => m.length));
    if (skew <= bus.max_length_skew + 1e-9) continue;
    errors.push({
      type: "pcb_bus_length_skew_error",
      pcb_bus_length_skew_error_id: `pcb_bus_length_skew_error_${bus.source_bus_id}`,
      error_type: "pcb_bus_length_skew_error",
      message: `PCB bus ${getReadableNameForElementId(circuitJson, bus.source_bus_id)} has ${skew.toFixed(2)}mm length skew, exceeding the ${bus.max_length_skew}mm maximum`,
      source_bus_id: bus.source_bus_id,
      source_trace_ids: members.map((m) => m.id),
      pcb_trace_ids: members.flatMap(
        (m) => m.traces.map((t) => t.pcb_trace_id)
      ),
      actual_length_skew: skew,
      maximum_length_skew: bus.max_length_skew,
      subcircuit_id: bus.subcircuit_id
    });
  }
  return errors;
};

// lib/consolidate-pcb-overlap-errors.ts
import { getPrimaryId as getPrimaryId13 } from "@tscircuit/circuit-json-util";
function consolidatePcbOverlapErrors(circuitJson, errors) {
  const ownerByElementId = /* @__PURE__ */ new Map();
  const elementById = /* @__PURE__ */ new Map();
  for (const element of circuitJson) {
    const id = getPrimaryId13(element);
    elementById.set(id, element);
    if ("pcb_component_id" in element && element.pcb_component_id) {
      ownerByElementId.set(id, element.pcb_component_id);
    }
  }
  const rawErrors = errors.flatMap(
    (error) => error.type === "pcb_footprint_overlap_error" ? error.related_errors ?? [error] : [error]
  );
  const groups = /* @__PURE__ */ new Map();
  const keyByError = /* @__PURE__ */ new Map();
  for (const error of rawErrors) {
    let componentIds;
    if (error.type === "pcb_footprint_overlap_error") {
      if (error.pcb_keepout_ids?.length) continue;
      const overlap = error;
      const elementIds = [
        ...error.pcb_smtpad_ids ?? [],
        ...error.pcb_plated_hole_ids ?? [],
        ...error.pcb_hole_ids ?? []
      ];
      if (elementIds.some((id) => !ownerByElementId.has(id))) continue;
      componentIds = overlap.pcb_component_ids ?? elementIds.map((id) => ownerByElementId.get(id));
    } else if (error.type === "pcb_pad_pad_clearance_error") {
      if (error.pcb_pad_ids.some((id) => !ownerByElementId.has(id))) continue;
      componentIds = error.pcb_pad_ids.map((id) => ownerByElementId.get(id));
    } else if (error.type === "pcb_courtyard_overlap_error") {
      componentIds = error.pcb_component_ids;
    } else {
      continue;
    }
    componentIds = [...new Set(componentIds)].sort();
    if (componentIds.length !== 2) continue;
    const key = JSON.stringify(componentIds);
    keyByError.set(error, key);
    const group = groups.get(key) ?? [];
    group.push(error);
    groups.set(key, group);
  }
  const summaries = /* @__PURE__ */ new Map();
  for (const [key, group] of groups) {
    const overlaps = group.filter(
      (e) => e.type === "pcb_footprint_overlap_error"
    );
    if (group.length < 2 || overlaps.length === 0) continue;
    const componentIds = JSON.parse(key);
    const names = componentIds.map((id) => {
      const component = elementById.get(id);
      const source = component?.type === "pcb_component" ? elementById.get(component.source_component_id) : void 0;
      return source?.type === "source_component" ? source.name : id;
    });
    const counts = [
      [overlaps.length, "footprint overlap"],
      [
        group.filter((e) => e.type === "pcb_pad_pad_clearance_error").length,
        "pad clearance violation"
      ],
      [
        group.filter((e) => e.type === "pcb_courtyard_overlap_error").length,
        "courtyard conflict"
      ]
    ];
    const details = counts.filter(([count]) => count > 0).map(([count, label]) => `${count} ${label}${count === 1 ? "" : "s"}`);
    const summary = {
      type: "pcb_footprint_overlap_error",
      error_type: "pcb_footprint_overlap_error",
      pcb_error_id: `pcb_component_overlap_${componentIds.join("_")}`,
      pcb_component_ids: componentIds,
      message: `${names.join(" overlaps ")}: ${details.join(", ")}. Move the components apart.`,
      related_errors: group
    };
    if (group.some((error) => error.is_fatal)) summary.is_fatal = true;
    const affectedIds = /* @__PURE__ */ new Set();
    for (const error of group) {
      if (error.type === "pcb_footprint_overlap_error") {
        for (const id of [
          ...error.pcb_smtpad_ids ?? [],
          ...error.pcb_plated_hole_ids ?? [],
          ...error.pcb_hole_ids ?? []
        ])
          affectedIds.add(id);
      } else if (error.type === "pcb_pad_pad_clearance_error") {
        for (const id of error.pcb_pad_ids) affectedIds.add(id);
      }
    }
    for (const [field, type] of [
      ["pcb_smtpad_ids", "pcb_smtpad"],
      ["pcb_plated_hole_ids", "pcb_plated_hole"],
      ["pcb_hole_ids", "pcb_hole"]
    ]) {
      const ids = [...affectedIds].filter((id) => elementById.get(id)?.type === type).sort();
      if (ids.length) summary[field] = ids;
    }
    summaries.set(key, summary);
  }
  const emitted = /* @__PURE__ */ new Set();
  return rawErrors.flatMap((error) => {
    const key = keyByError.get(error);
    const summary = key === void 0 ? void 0 : summaries.get(key);
    if (!summary || key === void 0) return [error];
    if (emitted.has(key)) return [];
    emitted.add(key);
    return [summary];
  });
}

// lib/check-same-name-nets-are-connected.ts
function checkSameNameNetsAreConnected(circuitJson) {
  const parents = /* @__PURE__ */ new Map();
  const find = (id) => {
    let root = id;
    while (parents.has(root) && parents.get(root) !== root) {
      root = parents.get(root);
    }
    while (parents.has(id) && parents.get(id) !== root) {
      const next = parents.get(id);
      parents.set(id, root);
      id = next;
    }
    return root;
  };
  const connect = (ids) => {
    if (ids.length < 2) return;
    const root = find(ids[0]);
    for (const id of ids.slice(1)) parents.set(find(id), root);
  };
  const netsByName = /* @__PURE__ */ new Map();
  for (const element of circuitJson) {
    if (element.type === "source_net" && element.name.trim()) {
      const nets = netsByName.get(element.name) ?? [];
      nets.push(element);
      netsByName.set(element.name, nets);
    }
    if (element.type === "source_trace") {
      connect([
        ...element.connected_source_net_ids.map((id) => `net:${id}`),
        ...element.connected_source_port_ids.map((id) => `port:${id}`)
      ]);
    }
    if (element.type === "source_component_internal_connection") {
      connect(element.source_port_ids.map((id) => `port:${id}`));
    }
    if (element.type === "source_component") {
      for (const ids of element.internally_connected_source_port_ids ?? []) {
        connect(ids.map((id) => `port:${id}`));
      }
    }
  }
  const warnings = [];
  for (const [name, nets] of netsByName) {
    const islands = new Set(nets.map((net) => find(`net:${net.source_net_id}`)));
    if (islands.size < 2) continue;
    const ids = nets.map((net) => net.source_net_id).sort();
    warnings.push({
      type: "source_confusing_net_name_warning",
      source_confusing_net_name_warning_id: `source_confusing_net_name_warning_${ids[0]}`,
      warning_type: "source_confusing_net_name_warning",
      message: `Nets named "${name}" are not all connected (${islands.size} separate electrical networks). Connect them or use distinct names to avoid confusion.`,
      source_net_ids: ids,
      net_name: name,
      ...nets.every((net) => net.subcircuit_id === nets[0].subcircuit_id) ? { subcircuit_id: nets[0].subcircuit_id } : {}
    });
  }
  return warnings;
}

// lib/check-connector-accessible-orientation.ts
import { getBoardBounds } from "@tscircuit/circuit-json-util";
function getFacingDirectionFromInsertionDirection(component) {
  switch (component.insertion_direction) {
    case "from_left":
      return "x-";
    case "from_right":
      return "x+";
    case "from_top":
      return "y+";
    case "from_bottom":
      return "y-";
    case "from_above":
    case "from_below":
      return null;
    default:
      return null;
  }
}
function getFacingDirection(component) {
  if (component.insertion_direction) {
    return getFacingDirectionFromInsertionDirection(component);
  }
  if (!component.center || !component.cable_insertion_center) return null;
  const dx = component.cable_insertion_center.x - component.center.x;
  const dy = component.cable_insertion_center.y - component.center.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return null;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "x+" : "x-";
  }
  return dy >= 0 ? "y+" : "y-";
}
function getRecommendedFacingDirection(component, bounds) {
  if (!component.center) return null;
  const distances = [
    { direction: "x-", distance: component.center.x - bounds.minX },
    { direction: "x+", distance: bounds.maxX - component.center.x },
    { direction: "y-", distance: component.center.y - bounds.minY },
    { direction: "y+", distance: bounds.maxY - component.center.y }
  ];
  distances.sort((a, b) => a.distance - b.distance);
  return distances[0]?.direction ?? null;
}
function checkConnectorAccessibleOrientation(circuitJson) {
  const board = circuitJson.find(
    (el) => el.type === "pcb_board"
  );
  if (!board) return [];
  const bounds = (() => {
    try {
      return getBoardBounds(board);
    } catch {
      return null;
    }
  })();
  if (!bounds) return [];
  const warnings = [];
  const components = circuitJson.filter(
    (el) => el.type === "pcb_component"
  );
  const pinHeaderSourceIds = new Set(
    circuitJson.filter(
      (el) => el.type === "source_component" && el.ftype === "simple_pin_header"
    ).map((el) => el.source_component_id)
  );
  for (const component of components) {
    if (!component.insertion_direction && pinHeaderSourceIds.has(component.source_component_id))
      continue;
    const facingDirection = getFacingDirection(component);
    const recommendedFacingDirection = getRecommendedFacingDirection(
      component,
      bounds
    );
    if (!facingDirection || !recommendedFacingDirection) continue;
    if (facingDirection === recommendedFacingDirection) continue;
    const componentName = getReadableNameForComponent(
      circuitJson,
      component.pcb_component_id
    );
    const message = component.insertion_direction ? `${componentName} is facing ${facingDirection} but should face ${recommendedFacingDirection} so the connector is accessible from the board edge` : `${componentName} is inferred to face ${facingDirection} from its cable insertion center because no explicit footprint insertionDirection is defined, but should face ${recommendedFacingDirection} so the connector is accessible from the board edge. Set insertionDirection on the <footprint> to specify the actual direction in the footprint's unrotated orientation; for example, <footprint insertionDirection="from_above"> for a connector accessed from above the PCB (+Z).`;
    warnings.push({
      type: "pcb_connector_not_in_accessible_orientation_warning",
      warning_type: "pcb_connector_not_in_accessible_orientation_warning",
      pcb_connector_not_in_accessible_orientation_warning_id: `pcb_connector_not_in_accessible_orientation_warning_${component.pcb_component_id}`,
      message,
      pcb_component_id: component.pcb_component_id,
      source_component_id: component.source_component_id,
      pcb_board_id: board.pcb_board_id,
      facing_direction: facingDirection,
      recommended_facing_direction: recommendedFacingDirection,
      subcircuit_id: component.subcircuit_id
    });
  }
  return warnings;
}

// lib/check-courtyard-overlap/checkCourtyardOverlap.ts
import {
  doSegmentsIntersect,
  isPointInsidePolygon as isPointInsidePolygon2
} from "@tscircuit/math-utils";
function getCourtyardPolygon(el) {
  if (el.type === "pcb_courtyard_rect") {
    const hw = el.width / 2;
    const hh = el.height / 2;
    const corners = [
      { x: -hw, y: -hh },
      { x: +hw, y: -hh },
      { x: +hw, y: +hh },
      { x: -hw, y: +hh }
    ];
    const angle = (el.ccw_rotation ?? 0) * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return corners.map(({ x, y }) => ({
      x: el.center.x + x * cos - y * sin,
      y: el.center.y + x * sin + y * cos
    }));
  }
  if (el.type === "pcb_courtyard_circle") {
    const N = 32;
    return Array.from({ length: N }, (_, i) => {
      const a = 2 * Math.PI * i / N;
      return {
        x: el.center.x + el.radius * Math.cos(a),
        y: el.center.y + el.radius * Math.sin(a)
      };
    });
  }
  return el.outline;
}
function getComponentName2(circuitJson, pcbComponentId) {
  return getReadableNameForComponent(circuitJson, pcbComponentId);
}
function polygonsOverlap2(polyA, polyB) {
  if (polyA.some((p) => isPointInsidePolygon2(p, polyB))) return true;
  if (polyB.some((p) => isPointInsidePolygon2(p, polyA))) return true;
  for (let i = 0; i < polyA.length; i++) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % polyA.length];
    for (let j = 0; j < polyB.length; j++) {
      const b1 = polyB[j];
      const b2 = polyB[(j + 1) % polyB.length];
      if (doSegmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}
function checkCourtyardOverlap(circuitJson) {
  const doNotPlaceComponentIds = new Set(
    circuitJson.flatMap(
      (el) => el.type === "pcb_component" && el.do_not_place ? [el.pcb_component_id] : []
    )
  );
  const courtyards = circuitJson.filter(
    (el) => el.type === "pcb_courtyard_rect" || el.type === "pcb_courtyard_circle" || el.type === "pcb_courtyard_outline"
  ).filter((el) => !doNotPlaceComponentIds.has(el.pcb_component_id));
  const byComponent = /* @__PURE__ */ new Map();
  for (const el of courtyards) {
    const id = el.pcb_component_id;
    if (!byComponent.has(id)) byComponent.set(id, []);
    byComponent.get(id).push(el);
  }
  const componentIds = Array.from(byComponent.keys());
  const errors = [];
  for (let i = 0; i < componentIds.length; i++) {
    for (let j = i + 1; j < componentIds.length; j++) {
      const idA = componentIds[i];
      const idB = componentIds[j];
      let overlapping = false;
      outer: for (const a of byComponent.get(idA)) {
        for (const b of byComponent.get(idB)) {
          if ("layer" in a && "layer" in b && a.layer !== b.layer) {
            continue;
          }
          const polyA = getCourtyardPolygon(a);
          const polyB = getCourtyardPolygon(b);
          if (polygonsOverlap2(polyA, polyB)) {
            overlapping = true;
            break outer;
          }
        }
      }
      if (overlapping) {
        errors.push({
          type: "pcb_courtyard_overlap_error",
          pcb_error_id: `pcb_courtyard_overlap_${idA}_${idB}`,
          error_type: "pcb_courtyard_overlap_error",
          message: `Courtyard of ${getComponentName2(circuitJson, idA)} overlaps with courtyard of ${getComponentName2(circuitJson, idB)}`,
          pcb_component_ids: [idA, idB]
        });
      }
    }
  }
  return errors;
}

// lib/check-hole-trace-clearance.ts
function checkHoleTraceClearance(circuitJson, { minClearance } = {}) {
  const required = minClearance ?? getBoardDrcValue(
    getPcbBoard(circuitJson),
    "min_trace_to_hole_edge_clearance"
  ) ?? jlcMinTolerances.min_trace_to_hole_edge_clearance;
  if (!Number.isFinite(required) || required < 0) {
    throw new Error("Trace-to-hole clearance must be finite and non-negative");
  }
  const holes = getHoleGeometries(circuitJson);
  if (holes.length === 0) return [];
  const index = new SpatialObjectIndex({
    objects: holes,
    getId: (hole) => hole.elementId,
    getBounds: (hole) => ({
      minX: hole.bounds.xmin,
      minY: hole.bounds.ymin,
      maxX: hole.bounds.xmax,
      maxY: hole.bounds.ymax
    })
  });
  const errors = /* @__PURE__ */ new Map();
  const overlappingPairIds = /* @__PURE__ */ new Set();
  for (const trace of circuitJson) {
    if (trace.type !== "pcb_trace") continue;
    for (let i = 1; i < trace.route.length; i++) {
      const a = trace.route[i - 1];
      const b = trace.route[i];
      if (a.route_type !== "wire" && a.route_type !== "via" || b.route_type !== "wire" && b.route_type !== "via")
        continue;
      if (a.route_type !== "wire" && b.route_type !== "wire") continue;
      if (a.route_type === "wire" && b.route_type === "wire" && a.layer !== b.layer)
        continue;
      const halfWidth = Math.max(
        a.route_type === "wire" ? a.width : 0,
        b.route_type === "wire" ? b.width : 0
      ) / 2;
      const candidates = index.getObjectsInBounds(
        {
          minX: Math.min(a.x, b.x),
          minY: Math.min(a.y, b.y),
          maxX: Math.max(a.x, b.x),
          maxY: Math.max(a.y, b.y)
        },
        required + halfWidth
      );
      for (const geometry of candidates) {
        const hole = geometry.sourceElement;
        if (hole.type !== "pcb_hole") continue;
        const { gap, center } = getTraceHoleClearance(
          { x1: a.x, y1: a.y, x2: b.x, y2: b.y, thickness: halfWidth * 2 },
          geometry
        );
        const pairId = `${trace.pcb_trace_id}_${hole.pcb_hole_id}`;
        if (isTraceObstacleOverlap(gap)) {
          errors.delete(pairId);
          overlappingPairIds.add(pairId);
          continue;
        }
        if (overlappingPairIds.has(pairId)) continue;
        if (gap + 1e-6 >= required) continue;
        if ((errors.get(pairId)?.gap ?? Infinity) <= gap) continue;
        errors.set(pairId, {
          gap,
          error: {
            type: "pcb_trace_error",
            error_type: "pcb_trace_error",
            pcb_trace_error_id: `overlap_${pairId}`,
            pcb_trace_id: trace.pcb_trace_id,
            source_trace_id: trace.source_trace_id ?? "",
            pcb_component_ids: hole.pcb_component_id ? [hole.pcb_component_id] : [],
            pcb_port_ids: [],
            center,
            message: `Trace ${getReadableNameForTrace(circuitJson, trace.pcb_trace_id)} is too close to non-plated hole ${getReadableNameForElementId(circuitJson, hole.pcb_hole_id)} (gap: ${gap.toFixed(6)}mm, required: ${required}mm)`
          }
        });
      }
    }
  }
  return Array.from(errors.values(), ({ error }) => error);
}

// lib/check-testpoint-accessibility.ts
import { isPointInsidePolygon as isPointInsidePolygon3 } from "@tscircuit/math-utils";
var isCourtyardElement3 = (element) => element.type === "pcb_courtyard_circle" || element.type === "pcb_courtyard_outline" || element.type === "pcb_courtyard_polygon" || element.type === "pcb_courtyard_rect";
var isPointInsideCourtyard = (point2, courtyard) => {
  if (courtyard.type === "pcb_courtyard_circle") {
    const dx = point2.x - courtyard.center.x;
    const dy = point2.y - courtyard.center.y;
    return dx * dx + dy * dy <= courtyard.radius * courtyard.radius;
  }
  if (courtyard.type === "pcb_courtyard_rect") {
    const angle = -1 * (courtyard.ccw_rotation ?? 0) * Math.PI / 180;
    const dx = point2.x - courtyard.center.x;
    const dy = point2.y - courtyard.center.y;
    const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
    const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
    return Math.abs(localX) <= courtyard.width / 2 && Math.abs(localY) <= courtyard.height / 2;
  }
  const polygon = courtyard.type === "pcb_courtyard_polygon" ? courtyard.points : courtyard.outline;
  return isPointInsidePolygon3(point2, polygon);
};
var getPcbComponentName = (circuitJson, pcbComponentId) => {
  const pcbComponent = circuitJson.find(
    (element) => element.type === "pcb_component" && element.pcb_component_id === pcbComponentId
  );
  const sourceComponent = circuitJson.find(
    (element) => element.type === "source_component" && element.source_component_id === pcbComponent?.source_component_id
  );
  return (sourceComponent && "name" in sourceComponent ? sourceComponent.name : void 0) ?? getReadableNameForComponent(circuitJson, pcbComponentId);
};
function checkTestPointAccessibility(circuitJson) {
  const sourceTestPoints = circuitJson.filter(
    (element) => element.type === "source_component" && element.ftype === "simple_test_point"
  );
  const sourceTestPointIds = new Set(
    sourceTestPoints.map((testPoint) => testPoint.source_component_id)
  );
  const testPointNames = new Map(
    sourceTestPoints.map((testPoint) => [
      testPoint.source_component_id,
      testPoint.name
    ])
  );
  const testPointComponents = circuitJson.filter(
    (element) => element.type === "pcb_component" && sourceTestPointIds.has(element.source_component_id)
  );
  const courtyards = circuitJson.filter(isCourtyardElement3);
  const errors = [];
  const reportedComponentPairs = /* @__PURE__ */ new Set();
  for (const testPoint of testPointComponents) {
    for (const courtyard of courtyards) {
      if (courtyard.pcb_component_id === testPoint.pcb_component_id) continue;
      if (courtyard.layer !== testPoint.layer) continue;
      if (!isPointInsideCourtyard(testPoint.center, courtyard)) continue;
      const componentPair = `${testPoint.pcb_component_id}:${courtyard.pcb_component_id}`;
      if (reportedComponentPairs.has(componentPair)) continue;
      reportedComponentPairs.add(componentPair);
      const testPointName = testPointNames.get(testPoint.source_component_id) ?? "Test point";
      const obstructingComponentName = getPcbComponentName(
        circuitJson,
        courtyard.pcb_component_id
      );
      errors.push({
        type: "pcb_placement_error",
        pcb_placement_error_id: `testpoint_in_courtyard_${testPoint.pcb_component_id}_${courtyard.pcb_component_id}`,
        error_type: "pcb_placement_error",
        message: `Test point ${testPointName} is not accessible because it is inside the courtyard of ${obstructingComponentName}`,
        subcircuit_id: testPoint.subcircuit_id
      });
    }
  }
  return errors;
}

// lib/run-all-checks.ts
async function runAllPlacementChecks(circuitJson, { consolidateOverlaps = true } = {}) {
  const errors = [
    ...checkCopperToBoardEdgeClearance(circuitJson),
    ...checkViasInPads(circuitJson),
    ...checkPcbComponentsOutOfBoard(circuitJson),
    ...checkPcbComponentOverCutout(circuitJson),
    ...checkPcbCopperOverKeepout(circuitJson),
    ...checkPcbBendZonePlacement(circuitJson),
    ...checkPcbCourtyardOverKeepout(circuitJson),
    ...checkPcbComponentOverlap(circuitJson),
    ...checkPcbComponentsMissingCourtyard(circuitJson),
    ...checkPadPadClearance(circuitJson),
    ...checkCourtyardOverlap(circuitJson),
    ...checkConnectorAccessibleOrientation(circuitJson),
    ...checkTestPointAccessibility(circuitJson)
  ];
  return consolidateOverlaps ? consolidatePcbOverlapErrors(circuitJson, errors) : errors;
}
async function runAllNetlistChecks(circuitJson) {
  return [
    ...checkPinMustBeConnected(circuitJson),
    ...checkSameNameNetsAreConnected(circuitJson),
    ...checkTwoTerminalSwitchContactsOnDifferentNets(circuitJson)
  ];
}
async function runAllSchematicChecks(circuitJson) {
  return [
    ...checkSchematicComponentExcessiveVerticalPadding(circuitJson),
    ...checkSchematicComponentMissingReferenceDesignatorText(circuitJson),
    ...checkSchematicComponentPortsOutsideBody(circuitJson),
    ...checkSchematicPlacement(circuitJson)
  ];
}
async function runAllPinSpecificationChecks(circuitJson) {
  return [
    ...checkAllPinsInComponentAreUnderspecified(circuitJson),
    ...checkNoPowerPinDefined(circuitJson),
    ...checkNoGroundPinDefined(circuitJson)
  ];
}
async function runAllRoutingChecks(circuitJson) {
  addStartAndEndPortIdsIfMissing(circuitJson);
  const connectivity = {
    connMap: getFullConnectivityMapFromCircuitJson15(circuitJson),
    pcbConnectivityMap: createIndexedPcbConnectivityMap(circuitJson)
  };
  return [
    ...checkEachPcbPortConnectedToPcbTraces(circuitJson, connectivity),
    ...checkSourceTracesHavePcbTraces(circuitJson, connectivity),
    ...checkSourceTracesMatchPcbTraceThickness(circuitJson),
    ...checkPcbBendZoneTraces(circuitJson),
    ...checkPcbTraceLengths(circuitJson),
    ...checkPcbBusLengthSkew(circuitJson),
    ...checkPcbTraceViaCounts(circuitJson),
    ...checkEachPcbTraceNonOverlapping(circuitJson, connectivity),
    ...checkCopperPourShorts(circuitJson, connectivity),
    ...checkPadTraceClearance(circuitJson, connectivity),
    ...checkHoleTraceClearance(circuitJson),
    ...checkViaTraceClearance(circuitJson, connectivity),
    ...checkViaPadClearance(circuitJson, connectivity),
    ...checkSameNetViaSpacing(circuitJson, connectivity),
    ...checkDifferentNetViaSpacing(circuitJson, connectivity),
    ...checkTracesAreContiguous(circuitJson, connectivity),
    ...checkDanglingTraces(circuitJson, connectivity),
    ...checkPcbTracesOutOfBoard(circuitJson)
  ];
}
async function runAllChecks(circuitJson) {
  return [
    ...await runAllPlacementChecks(circuitJson),
    ...await runAllSchematicChecks(circuitJson),
    ...await runAllNetlistChecks(circuitJson),
    ...await runAllPinSpecificationChecks(circuitJson),
    ...await runAllRoutingChecks(circuitJson)
  ];
}
export {
  NetManager,
  checkAllPinsInComponentAreUnderspecified,
  checkConnectorAccessibleOrientation,
  checkCopperPourShorts,
  checkCopperToBoardEdgeClearance,
  checkDanglingTraces,
  checkDifferentNetViaSpacing,
  checkEachPcbPortConnectedToPcbTraces,
  checkEachPcbTraceNonOverlapping,
  checkHoleTraceClearance,
  checkNoGroundPinDefined,
  checkNoPowerPinDefined,
  checkPadPadClearance,
  checkPadTraceClearance,
  checkPcbBendZonePlacement,
  checkPcbBendZoneTraces,
  checkPcbBusLengthSkew,
  checkPcbComponentOverCutout,
  checkPcbComponentOverlap,
  checkPcbComponentsMissingCourtyard,
  checkPcbComponentsOutOfBoard,
  checkPcbCopperOverKeepout,
  checkPcbCourtyardOverKeepout,
  checkPcbTraceLengths,
  checkPcbTraceSelfShorts,
  checkPcbTraceViaCounts,
  checkPcbTracesOutOfBoard,
  checkPinMustBeConnected,
  checkSameNameNetsAreConnected,
  checkSameNetViaSpacing,
  checkSchematicComponentExcessiveVerticalPadding,
  checkSchematicComponentMissingReferenceDesignatorText,
  checkSchematicComponentPortsOutsideBody,
  checkSchematicPlacement,
  checkSourceTracesHavePcbTraces,
  checkSourceTracesMatchPcbTraceThickness,
  checkTestPointAccessibility,
  checkTracesAreContiguous,
  checkTwoTerminalSwitchContactsOnDifferentNets,
  checkViaPadClearance,
  checkViaTraceClearance,
  checkViasInPads,
  checkViasOffBoard,
  consolidatePcbOverlapErrors,
  dedupePcbDrcErrors,
  runAllChecks,
  runAllNetlistChecks,
  runAllPinSpecificationChecks,
  runAllPlacementChecks,
  runAllRoutingChecks,
  runAllSchematicChecks
};
//# sourceMappingURL=index.js.map