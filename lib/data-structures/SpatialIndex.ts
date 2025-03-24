export type BucketCoordinate = `${number}x${number}`

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type GetBoundsFn<T> = (obj: T) => Bounds
export type GetIdFn<T> = (obj: T) => string

export class SpatialObjectIndex<T> {
  buckets: Map<BucketCoordinate, Array<T & { spatialIndexId: string }>>
  objectsById: Map<string, T & { spatialIndexId: string }>
  getBounds: GetBoundsFn<T>
  getId: GetIdFn<T>
  CELL_SIZE = 0.4

  constructor({
    objects,
    getBounds,
    getId,
    CELL_SIZE,
  }: {
    objects: T[]
    getBounds: GetBoundsFn<T>
    getId?: GetIdFn<T>
    CELL_SIZE?: number
  }) {
    this.buckets = new Map()
    this.objectsById = new Map()
    this.getBounds = getBounds
    this.getId = getId ?? (() => this._getNextId())
    this.CELL_SIZE = CELL_SIZE ?? this.CELL_SIZE

    for (const obj of objects) {
      this.addObject(obj)
    }
  }

  _idCounter = 0
  _getNextId(): string {
    return `${this._idCounter++}`
  }

  addObject(obj: T): void {
    const bounds = this.getBounds(obj)
    const spatialIndexId = this.getId(obj)
    const objWithId = { ...obj, spatialIndexId } as T & {
      spatialIndexId: string
    }

    // Store in objectsById for quick lookup
    this.objectsById.set(spatialIndexId, objWithId)

    const bucketMinX = Math.floor(bounds.minX / this.CELL_SIZE) * this.CELL_SIZE
    const bucketMinY = Math.floor(bounds.minY / this.CELL_SIZE) * this.CELL_SIZE

    for (let x = bucketMinX; x < bounds.maxX; x += this.CELL_SIZE) {
      for (let y = bucketMinY; y < bounds.maxY; y += this.CELL_SIZE) {
        const bucketKey = this.getBucketKey(x, y)
        const bucket = this.buckets.get(bucketKey)
        if (!bucket) {
          this.buckets.set(bucketKey, [objWithId])
        } else {
          bucket.push(objWithId)
        }
      }
    }
  }

  removeObject(id: string): boolean {
    const obj = this.objectsById.get(id)
    if (!obj) return false

    // Remove from objectsById
    this.objectsById.delete(id)

    // Remove from all buckets
    const bounds = this.getBounds(obj)
    const bucketMinX = Math.floor(bounds.minX / this.CELL_SIZE) * this.CELL_SIZE
    const bucketMinY = Math.floor(bounds.minY / this.CELL_SIZE) * this.CELL_SIZE

    for (let x = bucketMinX; x < bounds.maxX; x += this.CELL_SIZE) {
      for (let y = bucketMinY; y < bounds.maxY; y += this.CELL_SIZE) {
        const bucketKey = this.getBucketKey(x, y)
        const bucket = this.buckets.get(bucketKey)
        if (bucket) {
          const index = bucket.findIndex((item) => item.spatialIndexId === id)
          if (index !== -1) {
            bucket.splice(index, 1)
            if (bucket.length === 0) {
              this.buckets.delete(bucketKey)
            }
          }
        }
      }
    }

    return true
  }

  getBucketKey(x: number, y: number): BucketCoordinate {
    return `${Math.floor(x / this.CELL_SIZE)}x${Math.floor(y / this.CELL_SIZE)}`
  }

  getObjectsInBounds(bounds: Bounds, margin = 0): T[] {
    const objects: T[] = []
    const addedIds = new Set<string>()

    const bucketMinX =
      Math.floor((bounds.minX - margin) / this.CELL_SIZE) * this.CELL_SIZE
    const bucketMinY =
      Math.floor((bounds.minY - margin) / this.CELL_SIZE) * this.CELL_SIZE

    for (let x = bucketMinX; x < bounds.maxX + margin; x += this.CELL_SIZE) {
      for (let y = bucketMinY; y < bounds.maxY + margin; y += this.CELL_SIZE) {
        const bucketKey = this.getBucketKey(x, y)
        const bucket = this.buckets.get(bucketKey) || []

        for (const obj of bucket) {
          const id = obj.spatialIndexId
          if (addedIds.has(id)) continue

          addedIds.add(id)
          objects.push(obj)
        }
      }
    }

    return objects
  }
}
