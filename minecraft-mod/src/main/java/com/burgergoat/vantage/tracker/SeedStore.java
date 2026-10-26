package com.burgergoat.vantage.tracker;

import com.burgergoat.vantage.config.VantageConfig;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ServerInfo;
import net.minecraft.text.Text;
import net.minecraft.text.TranslatableTextContent;
import org.jetbrains.annotations.Nullable;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Seeds pro Server (nur fuer Server, deren Seed man wirklich kennt, z. B. den eigenen Aternos-Server).
 * Der Seed kann eingetippt oder mit /seed vom Server geholt werden (braucht dort Op-Rechte).
 */
public final class SeedStore {
	private static final Pattern NUMBER = Pattern.compile("\\[?(-?\\d{1,20})\\]?");
	private static long waitingSince;
	private static String message = "";

	private SeedStore() {
	}

	/** Name des aktuellen Servers (Adresse), oder null im Einzelspieler. */
	@Nullable
	public static String serverKey(MinecraftClient client) {
		if (client.getServer() != null) return null;
		ServerInfo info = client.getCurrentServerEntry();
		if (info == null) return null;
		return info.address.toLowerCase(java.util.Locale.ROOT).trim();
	}

	@Nullable
	public static Long seed(MinecraftClient client) {
		String key = serverKey(client);
		if (key == null) return null;
		String s = VantageConfig.get().serverSeeds.get(key);
		if (s == null) return null;
		try {
			return Long.parseLong(s);
		} catch (NumberFormatException e) {
			return null;
		}
	}

	/** Seed aus Text: Zahl wie im Spiel; Text wird wie beim Welt-Erstellen umgerechnet. */
	@Nullable
	public static Long parse(String text) {
		String t = text.trim();
		if (t.isEmpty()) return null;
		try {
			return Long.parseLong(t);
		} catch (NumberFormatException e) {
			return (long) t.hashCode();
		}
	}

	public static void set(MinecraftClient client, @Nullable Long seed) {
		String key = serverKey(client);
		if (key == null) return;
		if (seed == null) VantageConfig.get().serverSeeds.remove(key);
		else VantageConfig.get().serverSeeds.put(key, Long.toString(seed));
		VantageConfig.save();
		StructureTracker.clear();
	}

	/** Schickt /seed an den Server; die Antwort wird abgefangen. */
	public static void request(MinecraftClient client) {
		if (client.getNetworkHandler() == null || serverKey(client) == null) return;
		waitingSince = System.currentTimeMillis();
		message = "Frage den Server …";
		client.getNetworkHandler().sendChatCommand("seed");
	}

	public static String message() {
		if (waitingSince > 0 && System.currentTimeMillis() - waitingSince > 5000) {
			waitingSince = 0;
			message = "Keine Antwort – fehlen Op-Rechte? Seed dann im Aternos-Panel nachsehen und eintippen.";
		}
		return message;
	}

	@Nullable
	private static Long number(String s) {
		try {
			return Long.parseLong(s);
		} catch (NumberFormatException e) {
			return null;
		}
	}

	/** Jede Systemnachricht im Chat (ClientReceiveMessageEvents.GAME). */
	public static void onGameMessage(Text text) {
		if (waitingSince == 0 || System.currentTimeMillis() - waitingSince > 5000) return;
		MinecraftClient client = MinecraftClient.getInstance();
		if (text.getContent() instanceof TranslatableTextContent tr) {
			if (tr.getKey().equals("commands.seed.success")) {
				Long seed = null;
				for (Object arg : tr.getArgs()) {
					String s = arg instanceof Text t ? t.getString() : String.valueOf(arg);
					Matcher m = NUMBER.matcher(s);
					if (m.find()) seed = number(m.group(1));
				}
				if (seed != null) {
					waitingSince = 0;
					set(client, seed);
					message = "Seed gespeichert: " + seed;
				}
				return;
			}
			if (tr.getKey().startsWith("command.unknown") || tr.getKey().startsWith("commands.help.failed")) {
				waitingSince = 0;
				message = "Keine Rechte für /seed – Seed im Aternos-Panel nachsehen und eintippen.";
				return;
			}
		}
		// Ersatz, falls der Server die Nachricht als fertigen Text schickt ("Seed: [123]")
		String s = text.getString();
		if (s.startsWith("Seed: [")) {
			Matcher m = NUMBER.matcher(s.substring(5));
			Long seed = m.find() ? number(m.group(1)) : null;
			if (seed != null) {
				waitingSince = 0;
				set(client, seed);
				message = "Seed gespeichert: " + seed;
			}
		}
	}
}
