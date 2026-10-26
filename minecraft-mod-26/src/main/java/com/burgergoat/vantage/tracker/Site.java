package com.burgergoat.vantage.tracker;

import net.minecraft.core.BlockPos;
import net.minecraft.world.level.levelgen.structure.BoundingBox;
import org.jetbrains.annotations.Nullable;

/**
 * Ein Fundort.
 *
 * @param pos  wohin der Pfeil zeigt
 * @param box  Umriss der ganzen Struktur (null = unbekannt, z. B. auf Servern)
 * @param part wichtiger Teil: Schiff einer Endsiedlung, Portalraum einer Festung (oder null)
 */
public record Site(TrackType type, BlockPos pos, @Nullable BoundingBox box, @Nullable BoundingBox part) {
	public static Site at(TrackType type, BlockPos pos) {
		return new Site(type, pos, null, null);
	}

	/** Bereich, der nach Beute abgesucht wird. Ohne bekannten Umriss: geschaetzt um den Fundpunkt. */
	public BoundingBox scanBox() {
		if (box != null) return box;
		int r = type.scanRadius;
		int ry = type.scanHeight;
		return new BoundingBox(pos.getX() - r, pos.getY() - ry, pos.getZ() - r, pos.getX() + r, pos.getY() + ry, pos.getZ() + r);
	}
}
