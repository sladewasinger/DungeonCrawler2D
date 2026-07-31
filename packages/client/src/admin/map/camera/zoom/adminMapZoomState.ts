import {
  ADMIN_MAP_DEFAULT_TILE_SIZE,
  adminMapZoomPercent,
  nextAdminMapTileSize,
  type AdminMapZoomDirection,
} from "../adminMapZoom.js";

export class AdminMapZoomState {
  private tileSize = ADMIN_MAP_DEFAULT_TILE_SIZE;

  get value(): number {
    return this.tileSize;
  }

  get percent(): number {
    return adminMapZoomPercent(this.tileSize);
  }

  zoom(direction: AdminMapZoomDirection): number {
    this.tileSize = nextAdminMapTileSize(this.tileSize, direction);
    return this.percent;
  }

  reset(): number {
    this.tileSize = ADMIN_MAP_DEFAULT_TILE_SIZE;
    return this.percent;
  }
}
