package com.burgergoat.vantage.tracker;

import net.minecraft.util.math.BlockBox;
import net.minecraft.util.math.BlockPos;
import org.jetbrains.annotations.Nullable;

/**
 * Ein Fundort.
 *
 * @param pos  wohin der Pfeil zeigt
 * @param box  Umriss der ganzen Struktur (null = unbekannt, z. B. auf Servern)
 * @param part wichtiger Teil: Schiff einer Endsiedlung, Portalraum einer Festung (oder null)
 */
public record Site(TrackType type, BlockPos pos, @Nullable BlockBox box, @Nullable BlockBox part) {
	public static Site at(TrackType type, BlockPos pos) {
		return new Site(type, pos, null, null);
	}

	/** Bereich, der nach Beute abgesucht wird. Ohne bekannten Umriss: geschaetzt um den Fundpunkt. */
	public BlockBox scanBox() {
		if (box != null) return box;
		int r = type.scanRadius;
		int ry = type.scanHeight;
		return new BlockBox(pos.getX() - r, pos.getY() - ry, pos.getZ() - r, pos.getX() + r, pos.getY() + ry, pos.getZ() + r);
	}
}
