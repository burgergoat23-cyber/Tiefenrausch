package com.burgergoat.vantage.tracker;

import java.util.List;
import net.minecraft.world.item.ItemStack;

/** Was in einer Struktur noch da ist. Wird von {@link LootScanner} erstellt und in der Tracker-Karte gezeigt. */
public final class LootStatus {
	/** Zustand einer Zeile: entscheidet ueber Farbe und Zeichen. */
	public enum State {
		GOOD("✔", 0xFF6BE07A),
		MIXED("◐", 0xFFFFC94A),
		BAD("✘", 0xFFFF5D5D),
		INFO("•", 0xFFB8C4D6),
		UNKNOWN("?", 0xFF8A8F99);

		public final String symbol;
		public final int color;

		State(String symbol, int color) {
			this.symbol = symbol;
			this.color = color;
		}
	}

	public enum Verdict {
		UNTOUCHED("UNBERÜHRT", 0xFF6BE07A),
		PARTLY("TEILWEISE GEPLÜNDERT", 0xFFFFC94A),
		LOOTED("GEPLÜNDERT", 0xFFFF5D5D),
		NO_LOOT("KEINE BEUTE", 0xFFB8C4D6),
		UNKNOWN("NOCH NICHT GEPRÜFT", 0xFF8A8F99),
		CHECKING("WIRD GEPRÜFT …", 0xFF8A8F99);

		public final String label;
		public final int color;

		Verdict(String label, int color) {
			this.label = label;
			this.color = color;
		}
	}

	public record Row(ItemStack icon, String label, String value, State state) {
	}

	public static final LootStatus CHECKING = new LootStatus(List.of(), Verdict.CHECKING, "", false);

	public final List<Row> rows;
	public final Verdict verdict;
	/** Kleiner Hinweis unter der Karte (oder leer). */
	public final String note;
	/** true = Inhalt der Kisten bekannt (Einzelspieler), false = nur sichtbare Dinge (Server). */
	public final boolean exact;
	public final long time = System.currentTimeMillis();

	public LootStatus(List<Row> rows, Verdict verdict, String note, boolean exact) {
		this.rows = rows;
		this.verdict = verdict;
		this.note = note;
		this.exact = exact;
	}

	public long age() {
		return System.currentTimeMillis() - time;
	}

	/** Gesamturteil aus den Zeilen. INFO-Zeilen zaehlen nicht mit. */
	public static Verdict judge(List<Row> rows) {
		int good = 0;
		int bad = 0;
		int counted = 0;
		for (Row r : rows) {
			switch (r.state()) {
				case GOOD -> {
					good++;
					counted++;
				}
				case BAD -> {
					bad++;
					counted++;
				}
				case MIXED -> counted++;
				default -> {
				}
			}
		}
		if (counted == 0) return rows.isEmpty() ? Verdict.NO_LOOT : Verdict.UNKNOWN;
		if (good == counted) return Verdict.UNTOUCHED;
		if (bad == counted) return Verdict.LOOTED;
		return Verdict.PARTLY;
	}
}
