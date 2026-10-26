package com.burgergoat.vantage.feature;

import com.burgergoat.vantage.config.VantageConfig;
import net.minecraft.text.Text;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

/** Chat: Uhrzeit vor jeder Nachricht und gleiche Nachrichten zusammenfassen ("(x3)"). */
public final class ChatTweaks {
	private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("HH:mm");
	private static String lastRaw = "";
	private static int repeat = 1;

	private ChatTweaks() {
	}

	/** removeLast entfernt die letzte Chat-Zeile (fuer das Zusammenfassen). */
	public static Text process(Text message, Runnable removeLast) {
		VantageConfig c = VantageConfig.get();
		String raw = message.getString();
		Text out = message;
		if (c.chatStack && !raw.isBlank() && raw.equals(lastRaw)) {
			repeat++;
			removeLast.run();
			out = message.copy().append(Text.literal(" (x" + repeat + ")").withColor(0xFF98A2AE));
		} else {
			repeat = 1;
		}
		lastRaw = raw;
		if (c.chatTimestamps) out = Text.literal("[" + LocalTime.now().format(FMT) + "] ").withColor(0xFF7A8594).append(out);
		return out;
	}

	public static int history(int max) {
		return VantageConfig.get().chatLongHistory ? Math.max(max, 1000) : max;
	}
}
