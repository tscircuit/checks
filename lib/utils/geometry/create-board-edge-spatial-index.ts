import * as Flatten from "@flatten-js/core"
import { isPointInsidePolygon } from "@tscircuit/math-utils"
import Flatbush from "flatbush"

export interface BoardOutlinePoint {
  x: number
  y: number
}

export interface BoardEdgeSpatialIndex {
  boardOutline: BoardOutlinePoint[]
  boardPolygon: Flatten.Polygon
  boardEdges: Flatten.Segment[]
  boardEdgeBoundsIndex: Flatbush
}

export const createBoardEdgeSpatialIndex = (
  boardOutline: BoardOutlinePoint[],
): BoardEdgeSpatialIndex => {
  const boardVertices = boardOutline.map(({ x, y }) => new Flatten.Point(x, y))
  const boardPolygon = new Flatten.Polygon(boardVertices)
  const boardEdges = boardVertices.map(
    (start, index) =>
      new Flatten.Segment(
        start,
        boardVertices[(index + 1) % boardVertices.length],
      ),
  )
  const boardEdgeBoundsIndex = new Flatbush(boardEdges.length)
  for (const boardEdge of boardEdges) {
    const { xmin, ymin, xmax, ymax } = boardEdge.box
    boardEdgeBoundsIndex.add(xmin, ymin, xmax, ymax)
  }
  boardEdgeBoundsIndex.finish()

  return {
    boardOutline,
    boardPolygon,
    boardEdges,
    boardEdgeBoundsIndex,
  }
}

export const getBoardEdgesNearBox = ({
  box,
  margin,
  boardEdgeSpatialIndex,
}: {
  box: Flatten.Box
  margin: number
  boardEdgeSpatialIndex: BoardEdgeSpatialIndex
}): Flatten.Segment[] => {
  const boardEdgeIndices = boardEdgeSpatialIndex.boardEdgeBoundsIndex.search(
    box.xmin - margin,
    box.ymin - margin,
    box.xmax + margin,
    box.ymax + margin,
  )
  return boardEdgeIndices.map(
    (boardEdgeIndex) => boardEdgeSpatialIndex.boardEdges[boardEdgeIndex],
  )
}

export const arePointsInsideBoard = ({
  points,
  boardEdgeSpatialIndex,
}: {
  points: BoardOutlinePoint[]
  boardEdgeSpatialIndex: BoardEdgeSpatialIndex
}): boolean =>
  points.every((point) =>
    isPointInsidePolygon(point, boardEdgeSpatialIndex.boardOutline),
  )
