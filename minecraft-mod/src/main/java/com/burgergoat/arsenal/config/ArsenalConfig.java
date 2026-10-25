package com.burgergoat.arsenal.config;

import com.burgergoat.arsenal.ArsenalClient;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.Reader;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Alle Einstellungen der Mod. Wird als config/arsenal.json gespeichert. */
public class ArsenalConfig {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static ArsenalConfig instance = new ArsenalConfig();
	private static int version;

	// ---- Skins
	public boolean skinsEnabled = true;
	public boolean skinsOnlyOwn = false;
	/** Item-ID (z. B. "netherite_sword") -> Skin-ID (z. B. "knife_karambit_fade"). */
	public Map<String, String> skins = new HashMap<>();
	public boolean statTrak = true;
	public Map<String, Integer> statTrakKills = new HashMap<>();

	// ---- Viewmodel
	public float vmX = 0f;
	public float vmY = 0f;
	public float vmZ = 0f;
	public float vmScale = 1f;
	public float vmRotX = 0f;
	public float vmRotY = 0f;
	public float vmRotZ = 0f;
	/** Linke (zweite) Hand eigene Werte statt gespiegelt */
	public boolean vmOffSeparate = false;
	public float vmOffX = 0f;
	public float vmOffY = 0f;
	public float vmOffZ = 0f;
	public float vmOffScale = 1f;
	public float vmOffRotX = 0f;
	public float vmOffRotY = 0f;
	public float vmOffRotZ = 0f;
	public boolean inspect = true;
	public boolean drawAnim = true;
	public boolean knifeSounds = true;
	public float animSpeed = 1f;

	// ---- Fadenkreuz
	public boolean chEnabled = false;
	/** 0 = Klassisch, 1 = Punkt, 2 = T-Form, 3 = Kreis */
	public int chStyle = 0;
	public int chColor = 0x00FF40;
	public int chAlpha = 255;
	public float chLength = 4f;
	public float chThickness = 1f;
	public float chGap = 2f;
	public boolean chDot = false;
	public boolean chOutline = true;
	public boolean chDynamic = true;
	public boolean chCooldown = true;

	// ---- Filter
	public String filter = "none";

	// ---- Zoom
	public float zoom = 4f;

	// ---- HUD
	public boolean hudInfo = true;
	public boolean hudFps = true;
	public boolean hudCps = true;
	public boolean hudCoords = true;
	public boolean hudDirection = true;
	public boolean hudPing = false;

	// ---- Tracker
	public Set<String> trackTypes = new LinkedHashSet<>(List.of("bastion", "end_city", "end_ship", "fortress"));
	public boolean trackerHud = true;
	public boolean trackerBeam = true;
	public boolean trackerServers = false;
	public boolean trackerAuto = true;
	public int trackerRadius = 3000;

	// ---- Makros
	public boolean lungeEnabled = true;
	public boolean lungeOnlyEnchanted = false;
	public boolean lungeReturn = true;
	/** 0 = Stoss im selben Tick wie der Wechsel (noetig, damit der Speer voll aufgeladen ist). */
	public int lungeDelay = 0;
	public int lungeReturnDelay = 1;
	public boolean lungeAfterWind = false;
	public int lungeAfterWindDelay = 6;

	public boolean maceSwap = false;
	public boolean maceOnlyFalling = true;
	public float maceMinFall = 1.5f;
	public boolean maceFromSword = true;
	public boolean maceFromAxe = true;
	public int maceReturnDelay = 2;

	public boolean shieldBreaker = false;
	public boolean quickReturn = true;

	/** Version der gespeicherten Einstellungen (fuer Umstellungen zwischen Mod-Versionen). */
	public int configVersion = 0;

	public static ArsenalConfig get() {
		return instance;
	}

	/** Erhöht sich bei jeder Änderung, damit Zwischenspeicher neu gebaut werden. */
	public static int version() {
		return version;
	}

	private static Path file() {
		return FabricLoader.getInstance().getConfigDir().resolve("arsenal.json");
	}

	public static void load() {
		Path f = file();
		if (Files.exists(f)) {
			try (Reader r = Files.newBufferedReader(f, StandardCharsets.UTF_8)) {
				ArsenalConfig c = GSON.fromJson(r, ArsenalConfig.class);
				if (c != null) {
					instance = c;
				}
			} catch (Exception e) {
				ArsenalClient.LOG.warn("Einstellungen konnten nicht gelesen werden", e);
			}
		}
		if (instance.skins == null) instance.skins = new HashMap<>();
		if (instance.statTrakKills == null) instance.statTrakKills = new HashMap<>();
		if (instance.trackTypes == null) instance.trackTypes = new LinkedHashSet<>();
		if (instance.filter == null) instance.filter = "none";
		if (instance.configVersion < 2) {
			// Ab 1.2: Lunge-Swap sticht sofort (sonst setzt Minecraft die Aufladung zurueck und es passiert nichts)
			instance.lungeDelay = 0;
			instance.lungeReturnDelay = 1;
			instance.configVersion = 2;
			save();
		}
		version++;
	}

	public static void save() {
		version++;
		try {
			Files.createDirectories(file().getParent());
			try (Writer w = Files.newBufferedWriter(file(), StandardCharsets.UTF_8)) {
				GSON.toJson(instance, w);
			}
		} catch (Exception e) {
			ArsenalClient.LOG.warn("Einstellungen konnten nicht gespeichert werden", e);
		}
	}
}
