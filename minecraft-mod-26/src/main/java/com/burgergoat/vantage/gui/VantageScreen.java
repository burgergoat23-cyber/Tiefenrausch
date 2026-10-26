package com.burgergoat.vantage.gui;

import com.burgergoat.vantage.VantageClient;
import com.burgergoat.vantage.config.VantageConfig;
import com.burgergoat.vantage.feature.Crosshair;
import com.burgergoat.vantage.feature.Filters;
import com.burgergoat.vantage.feature.GuiThemes;
import com.burgergoat.vantage.feature.Hotbar;
import com.burgergoat.vantage.feature.Extras;
import com.burgergoat.vantage.feature.HudModules;
import com.burgergoat.vantage.feature.KillEffects;
import com.burgergoat.vantage.feature.Waypoints;
import com.burgergoat.vantage.feature.Viewmodel;
import com.burgergoat.vantage.skin.SkinCatalog;
import com.burgergoat.vantage.skin.SkinManager;
import com.burgergoat.vantage.skin.SkinPacks;
import com.burgergoat.vantage.feature.TrackerCard;
import com.burgergoat.vantage.tracker.SeedStore;
import com.burgergoat.vantage.tracker.Site;
import com.burgergoat.vantage.tracker.StructureTracker;
import com.burgergoat.vantage.tracker.TrackType;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.inventory.InventoryScreen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.KeyMapping;
import com.mojang.blaze3d.platform.InputConstants;
import net.minecraft.client.resources.sounds.SimpleSoundInstance;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.resources.ResourceKey;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.util.FormattedCharSequence;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Mth;
import net.minecraft.world.level.Level;
import org.jetbrains.annotations.Nullable;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.function.DoubleConsumer;
import java.util.function.IntConsumer;

/**
 * Das Vantage-Client-Menue (Taste K). Startseite mit einer Kachel pro Modul (an/aus mit einem Klick),
 * ein Klick auf die Kachel oeffnet die Einstellungen des Moduls.
 */
public class VantageScreen extends Screen {
	private static final int PANEL = 0xEE151B23;
	private static final int LINE = 0xFF34404E;
	private static final int TEXT = 0xFFE3E7EC;
	private static final int GRAY = 0xFF98A2AE;
	/** Menue-Farben zum Aussuchen (Einstellung menuTheme). */
	public static final int[] THEMES = {0xFFE8A33D, 0xFF3FC3E8, 0xFFA97CFF, 0xFF4CD07D, 0xFFFF5D5D, 0xFFFF74B8};
	public static final String[] THEME_NAMES = {"Orange", "Eisblau", "Lila", "Grün", "Rot", "Pink"};
	private static final String VERSION = FabricLoader.getInstance().getModContainer(VantageClient.MOD_ID)
			.map(m -> m.getMetadata().getVersion().getFriendlyString().split("\\+")[0]).orElse("");
	private static int accent = THEMES[0];
	private static int accentDim = 0xFF5A4220;

	/** Kein Einstellungs-Fenster offen. */
	public static final int HOME = -1;
	public static final String[] PAGES = {"Skins", "Pakete", "Fadenkreuz", "Viewmodel", "Shader", "Tracker", "Lunge-Swap",
			"Attribut-Swap", "Schild-Brecher", "Schnell-Wurf", "Combo-Zähler", "Freecam & Freelook", "Zoom", "Info-Anzeige",
			"GUI-Design", "Brau-Helfer", "Tasten", "Tasten-Anzeige", "Rüstung", "Trank-Timer", "Wegpunkte", "Blockrahmen & Treffer",
			"Kill-Effekte", "Chat"};
	public static final int P_SKINS = 0, P_PACKS = 1, P_CROSSHAIR = 2, P_VIEWMODEL = 3, P_SHADER = 4, P_TRACKER = 5, P_LUNGE = 6,
			P_MACE = 7, P_SHIELD = 8, P_QUICK = 9, P_COMBO = 10, P_CAMERA = 11, P_ZOOM = 12, P_INFO = 13, P_GUI = 14, P_BREW = 15,
			P_KEYS = 16, P_KEYSTROKES = 17, P_ARMOR = 18, P_POTIONS = 19, P_WAYPOINTS = 20, P_OUTLINE = 21, P_KILL = 22, P_CHAT = 23;
	/** Ein Fenster pro Kategorie. */
	private static final String[] CATEGORIES = {"Kampf", "Optik", "Welt", "HUD"};
	private static final Item[] CATEGORY_ICONS = {Items.DIAMOND_SWORD, Items.ENDER_EYE, Items.FILLED_MAP, Items.CLOCK};

	/** Zeile in einem Kategorie-Fenster: Seite, kurze Beschreibung, Symbol, Kategorie und (falls vorhanden) An/Aus. */
	private record Module(int page, String desc, Item icon, int cat, @Nullable BooleanSupplier on, @Nullable Consumer<Boolean> set) {
	}

	private static List<Module> modules() {
		VantageConfig c = VantageConfig.get();
		return List.of(
				new Module(P_LUNGE, "Speer-Stoß mit Wechsel", Items.NETHERITE_SPEAR, 0, () -> c.lungeEnabled, v -> c.lungeEnabled = v),
				new Module(P_MACE, "Streitkolben-Schlag", Items.MACE, 0, () -> c.maceSwap, v -> c.maceSwap = v),
				new Module(P_SHIELD, "Axt gegen Schilde", Items.NETHERITE_AXE, 0, () -> c.shieldBreaker, v -> c.shieldBreaker = v),
				new Module(P_QUICK, "Perle und Windladung", Items.ENDER_PEARL, 0, null, null),
				new Module(P_COMBO, "Treffer am Stück", Items.BLAZE_POWDER, 0, () -> c.comboCounter, v -> c.comboCounter = v),
				new Module(P_KILL, "Blitz, Blut, Feuerwerk", Items.LIGHTNING_ROD, 0, () -> c.killEffects, v -> c.killEffects = v),
				new Module(P_SKINS, "CS-Messer, Äxte, Schilde", Items.NETHERITE_SWORD, 1, () -> c.skinsEnabled, v -> c.skinsEnabled = v),
				new Module(P_PACKS, "Alles mit einem Klick", Items.BUNDLE, 1, null, null),
				new Module(P_VIEWMODEL, "Hand & Schlag-Animationen", Items.ARMOR_STAND, 1, () -> c.swingAnim, v -> c.swingAnim = v),
				new Module(P_CROSSHAIR, "Eigenes CS-Fadenkreuz", Items.TARGET, 1, () -> c.chEnabled, v -> c.chEnabled = v),
				new Module(P_SHADER, "Bloom und Kino-Farben", Items.ENDER_EYE, 1, () -> !"none".equals(c.filter), v -> c.filter = v ? "clear" : "none"),
				new Module(P_GUI, "Kisten, Öfen, Inventar, Hotbar", Items.CHEST, 1, () -> c.guiTheme != 0 || c.hotbarStyle != 0, v -> {
					c.guiTheme = v ? 1 : 0;
					c.hotbarStyle = v ? 1 : 0;
				}),
				new Module(P_OUTLINE, "Farbe für Blockrahmen und Treffer", Items.GLASS, 1, () -> c.outlineCustom || c.hitColorCustom, v -> {
					c.outlineCustom = v;
					c.hitColorCustom = v;
				}),
				new Module(P_TRACKER, "Strukturen und Beute", Items.COMPASS, 2, () -> c.trackerHud, v -> c.trackerHud = v),
				new Module(P_WAYPOINTS, "Orte merken, Todespunkt", Items.RECOVERY_COMPASS, 2, () -> c.waypoints, v -> c.waypoints = v),
				new Module(P_BREW, "Rezepte am Braustand", Items.BREWING_STAND, 2, () -> c.brewHelper, v -> c.brewHelper = v),
				new Module(P_CHAT, "Uhrzeit, Nachrichten stapeln", Items.WRITABLE_BOOK, 2, () -> c.chatTimestamps || c.chatStack, v -> {
					c.chatTimestamps = v;
					c.chatStack = v;
				}),
				new Module(P_CAMERA, "Frei umschauen und fliegen", Items.FEATHER, 2, null, null),
				new Module(P_ZOOM, "Heranzoomen", Items.SPYGLASS, 2, null, null),
				new Module(P_INFO, "FPS, CPS, Koordinaten", Items.CLOCK, 3, () -> c.hudInfo, v -> c.hudInfo = v),
				new Module(P_KEYSTROKES, "W A S D und Maus mit CPS", Items.OAK_BUTTON, 3, () -> c.keystrokes, v -> c.keystrokes = v),
				new Module(P_ARMOR, "Haltbarkeit und Vorräte", Items.DIAMOND_CHESTPLATE, 3, () -> c.armorHud, v -> c.armorHud = v),
				new Module(P_POTIONS, "Effekte mit Restzeit", Items.POTION, 3, () -> c.potionHud, v -> c.potionHud = v),
				new Module(P_KEYS, "Alle Tasten ändern", Items.LEVER, 3, null, null));
	}

	@Nullable
	private static Module module(int page) {
		for (Module m : modules()) if (m.page == page) return m;
		return null;
	}

	private static int page = HOME;
	/** Lage der Einstellungs-Fenster (-1 = neben das Kategorie-Fenster legen). */
	private static float setX = -1, setY = -1;
	/** Lage und Zustand der Kategorie-Fenster. */
	private static final int[] winX = new int[CATEGORIES.length];
	private static final int[] winY = new int[CATEGORIES.length];
	private static final boolean[] winOpen = new boolean[CATEGORIES.length];
	private static boolean winLoaded;
	/** Reihenfolge beim Zeichnen (das zuletzt angeklickte Fenster liegt oben). */
	private static final List<Integer> order = new ArrayList<>(List.of(0, 1, 2, 3));
	private static String skinCat = "knife";
	private static String skinTarget = "*";
	private static String skinShape;

	private record Hit(int x, int y, int w, int h, boolean content, @Nullable Runnable click, @Nullable DoubleConsumer drag,
					   @Nullable Runnable right) {
	}

	/** Kopfzeile eines Fensters, an der man es mit der Maus verschieben kann (id 0-3 Kategorie, 4 Einstellungen). */
	private record Grab(int id, int x, int y, int w, int h) {
	}

	private final List<Grab> grabs = new ArrayList<>();
	private int moving = -1;
	private double grabDx, grabDy;

	private final List<Hit> hits = new ArrayList<>();
	private Hit dragging;
	private double mx;
	private double my;
	private int scroll;
	private int contentHeight;
	private int cx, cy, cw, ch;
	private boolean dirty;
	/** Der Schalter "Eigenes Fadenkreuz" selbst wurde gerade umgelegt (dann nicht automatisch einschalten). */
	private boolean skipAutoEnable;
	// Animationen
	private final long openedAt = System.nanoTime();
	private long pageAt = System.nanoTime();
	private long lastFrame;
	private float frameDt;
	private float time;
	private float scrollAnim;
	private final Map<String, Float> anims = new HashMap<>();
	private List<Component> tooltip;
	private final Random random = new Random();
	/** Tastenbelegung, die gerade auf einen Tastendruck wartet. */
	private KeyMapping listening;

	public VantageScreen() {
		super(Component.literal("Vantage Client"));
	}

	/** Menue auf der Startseite oeffnen. */
	public static VantageScreen home() {
		page = HOME;
		return new VantageScreen();
	}

	/** Seite setzen (HOME = Startseite), z. B. fuer die Testbilder. */
	public static void setPage(int p) {
		page = p < 0 ? HOME : Math.min(p, PAGES.length - 1);
	}

	private void openPage(int p) {
		if (p != page) {
			setX = -1;
			setY = -1;
		}
		page = p;
		scroll = 0;
		scrollAnim = 0;
		pageAt = System.nanoTime();
	}

	// ------------------------------------------------------------------ Fenster-Lage

	private int winW() {
		return Math.max(96, Math.min(118, (width - 16 - 3 * 6) / 4));
	}

	private void loadWindows() {
		if (winLoaded) return;
		winLoaded = true;
		int w = winW();
		int total = CATEGORIES.length * w + (CATEGORIES.length - 1) * 6;
		for (int i = 0; i < CATEGORIES.length; i++) {
			winX[i] = (width - total) / 2 + i * (w + 6);
			winY[i] = 34;
			winOpen[i] = true;
			String s = VantageConfig.get().menuWindows.get(CATEGORIES[i]);
			if (s == null) continue;
			String[] p = s.split(",");
			try {
				winX[i] = Integer.parseInt(p[0]);
				winY[i] = Integer.parseInt(p[1]);
				winOpen[i] = p.length < 3 || !"0".equals(p[2]);
			} catch (RuntimeException ignored) {
				// kaputter Eintrag: Standard-Lage behalten
			}
		}
	}

	private void saveWindows() {
		for (int i = 0; i < CATEGORIES.length; i++) {
			VantageConfig.get().menuWindows.put(CATEGORIES[i], winX[i] + "," + winY[i] + "," + (winOpen[i] ? 1 : 0));
		}
		VantageConfig.save();
	}

	/** Alle Fenster wieder an ihren Standard-Platz. */
	private void resetWindows() {
		VantageConfig.get().menuWindows.clear();
		winLoaded = false;
		loadWindows();
		saveWindows();
	}

	private void back() {
		openPage(HOME);
	}

	@Override
	public boolean isPauseScreen() {
		return false;
	}

	@Override
	public void extractBackground(GuiGraphicsExtractor ctx, int mouseX, int mouseY, float deltaTicks) {
		// Im Viewmodel frei lassen, damit man die Hand live sieht
		if (page == P_VIEWMODEL) return;
		float o = openProgress();
		ctx.fillGradient(0, 0, width, height, alpha(0x05070A, Math.round(0x70 * o)), alpha(0x05070A, Math.round(0xB8 * o)));
		ctx.fillGradient(0, 0, width, 70, alpha(accent, Math.round(0x2C * o)), alpha(accent, 0));
	}

	@Override
	public void removed() {
		if (dirty) VantageConfig.save();
	}

	@Override
	public boolean keyPressed(KeyEvent input) {
		if (listening != null) {
			bind(listening, input.isEscape() ? InputConstants.UNKNOWN : InputConstants.getKey(input));
			return true;
		}
		if (input.isEscape() && page != HOME) {
			back();
			return true;
		}
		if (VantageClient.menuKey.matches(input)) {
			onClose();
			return true;
		}
		return super.keyPressed(input);
	}

	// ------------------------------------------------------------------ Maus

	private void updateMouse() {
		if (minecraft == null) return;
		mx = minecraft.mouseHandler.getScaledXPos(minecraft.getWindow());
		my = minecraft.mouseHandler.getScaledYPos(minecraft.getWindow());
	}

	@Override
	public void mouseMoved(double mouseX, double mouseY) {
		mx = mouseX;
		my = mouseY;
	}

	@Override
	public boolean mouseClicked(MouseButtonEvent click, boolean doubled) {
		updateMouse();
		if (listening != null && click.button() >= 2) {
			// Maustasten 3, 4, 5 … (Mausrad-Klick, Seitentasten) koennen auch belegt werden
			bind(listening, InputConstants.Type.MOUSE.getOrCreate(click.button()));
			return true;
		}
		if (click.button() == 0 || click.button() == 1) {
			boolean left = click.button() == 0;
			for (int i = hits.size() - 1; i >= 0; i--) {
				Hit h = hits.get(i);
				if (mx < h.x || my < h.y || mx >= h.x + h.w || my >= h.y + h.h) continue;
				if (h.content && (my < cy || my >= cy + ch)) continue;
				if (!left) {
					if (h.right == null) continue;
					playClick(1.2f);
					h.right.run();
				} else if (h.drag != null) {
					dragging = h;
					h.drag.accept(mx);
				} else if (h.click != null) {
					playClick(1f);
					h.click.run();
				}
				return true;
			}
			// Fenster an der Kopfzeile anfassen und verschieben
			if (left) {
				for (int i = grabs.size() - 1; i >= 0; i--) {
					Grab g = grabs.get(i);
					if (mx < g.x || my < g.y || mx >= g.x + g.w || my >= g.y + g.h) continue;
					moving = g.id;
					grabDx = mx - g.x;
					grabDy = my - g.y;
					if (g.id < CATEGORIES.length) {
						order.remove((Integer) g.id);
						order.add(g.id);
					}
					return true;
				}
			}
		}
		return super.mouseClicked(click, doubled);
	}

	@Override
	public boolean mouseDragged(MouseButtonEvent click, double offsetX, double offsetY) {
		if (moving >= 0) {
			updateMouse();
			int nx = (int) Math.round(mx - grabDx);
			int ny = (int) Math.round(my - grabDy);
			if (moving < CATEGORIES.length) {
				winX[moving] = Mth.clamp(nx, 0, Math.max(0, width - winW()));
				winY[moving] = Mth.clamp(ny, 0, Math.max(0, height - 18));
			} else {
				setX = Mth.clamp(nx, 0, Math.max(0, width - 40));
				setY = Mth.clamp(ny, 0, Math.max(0, height - 20));
			}
			return true;
		}
		if (dragging != null) {
			updateMouse();
			dragging.drag.accept(mx);
			return true;
		}
		return super.mouseDragged(click, offsetX, offsetY);
	}

	@Override
	public boolean mouseReleased(MouseButtonEvent click) {
		if (moving >= 0) {
			if (moving < CATEGORIES.length) saveWindows();
			moving = -1;
			return true;
		}
		if (dragging != null) {
			dragging = null;
			if (dirty) {
				VantageConfig.save();
				dirty = false;
			}
			return true;
		}
		return super.mouseReleased(click);
	}

	@Override
	public boolean mouseScrolled(double mouseX, double mouseY, double horizontalAmount, double verticalAmount) {
		if (mouseX >= cx && mouseX < cx + cw && mouseY >= cy && mouseY < cy + ch) {
			scroll = Mth.clamp(scroll - (int) Math.round(verticalAmount * 24), 0, Math.max(0, contentHeight - ch));
			return true;
		}
		return super.mouseScrolled(mouseX, mouseY, horizontalAmount, verticalAmount);
	}

	private void bind(KeyMapping key, InputConstants.Key code) {
		key.setKey(code);
		KeyMapping.resetMapping();
		if (minecraft != null) minecraft.options.save();
		listening = null;
		playClick(1.4f);
	}

	private void playClick(float pitch) {
		if (minecraft != null) minecraft.getSoundManager().play(SimpleSoundInstance.forUI(SoundEvents.UI_BUTTON_CLICK, pitch));
	}

	private void changed() {
		dirty = true;
		// Im Reiter Fadenkreuz schaltet jede Aenderung das eigene Fadenkreuz ein - sonst sieht man im Spiel nichts davon
		if (page == P_CROSSHAIR && !skipAutoEnable) VantageConfig.get().chEnabled = true;
		skipAutoEnable = false;
	}

	/** Aktuelle Menue-Farbe (auch fuer das HUD). */
	public static int accent() {
		int i = Math.floorMod(VantageConfig.get().menuTheme, THEMES.length);
		return THEMES[i];
	}

	private static void applyTheme() {
		accent = accent();
		accentDim = mix(0xFF1E262F, accent, 0.33f);
	}

	// ------------------------------------------------------------------ Animation

	/** 0 -> 1 in den ersten Sekundenbruchteilen nach dem Oeffnen (schnell, dann sanft auslaufend). */
	private float openProgress() {
		float t = Math.min(1f, (System.nanoTime() - openedAt) / 1.8e8f);
		float u = 1f - t;
		return 1f - u * u * u;
	}

	private float approach(float v, float target, float speed) {
		return v + (target - v) * (1f - (float) Math.exp(-frameDt * speed));
	}

	/** Weicher Uebergang fuer Schalter, Reiter usw. (pro Name gemerkt). */
	private float anim(String key, float target, float speed) {
		Float v = anims.get(key);
		float r = v == null ? target : approach(v, target, speed);
		anims.put(key, r);
		return r;
	}

	private static int mix(int a, int b, float t) {
		return Draw.mix(a, b, t);
	}

	private static int alpha(int color, int a) {
		return Draw.alpha(color, a);
	}

	// ------------------------------------------------------------------ Zeichnen

	@Override
	public void extractRenderState(GuiGraphicsExtractor ctx, int mouseX, int mouseY, float deltaTicks) {
		super.extractRenderState(ctx, mouseX, mouseY, deltaTicks);
		mx = mouseX;
		my = mouseY;
		hits.clear();
		tooltip = null;
		long now = System.nanoTime();
		frameDt = lastFrame == 0 ? 0f : Math.min(0.1f, (now - lastFrame) / 1e9f);
		lastFrame = now;
		time = (now - openedAt) / 1e9f;
		applyTheme();

		int slide = Math.round((1f - openProgress()) * 12);
		grabs.clear();
		loadWindows();
		drawWindows(ctx, slide);
		if (page != HOME) drawSettings(ctx, slide);
		if (tooltip != null) ctx.setComponentTooltipForNextFrame(font, tooltip, mouseX, mouseY);
	}

	/** Grosser Schriftzug; jeder Buchstabe schimmert nacheinander auf. */
	private void logo(GuiGraphicsExtractor ctx, int centerX, int y, float scale) {
		String logo = "VANTAGE";
		int lw = Math.round(font.width(logo) * scale);
		ctx.pose().pushMatrix();
		ctx.pose().translate(centerX - lw / 2f, y);
		ctx.pose().scale(scale, scale);
		int lx = 0;
		for (int i = 0; i < logo.length(); i++) {
			String letter = String.valueOf(logo.charAt(i));
			float wave = 0.5f + 0.5f * (float) Math.sin(time * 2.6f - i * 0.55f);
			ctx.text(font, letter, lx, 0, mix(accent, 0xFFFFFFFF, 0.08f + 0.55f * wave * wave * wave));
			lx += font.width(letter);
		}
		ctx.pose().popMatrix();
	}

	// ------------------------------------------------------------------ Kategorie-Fenster

	private void drawWindows(GuiGraphicsExtractor ctx, int slide) {
		logo(ctx, width / 2, 8 + slide, 1.6f);
		for (int id : new ArrayList<>(order)) drawCategory(ctx, id, slide);
		ctx.text(font, font.plainSubstrByWidth("Linksklick = an/aus  •  Rechtsklick = Einstellungen  •  Fenster oben anfassen = verschieben",
				width - 130), 8, height - 13, GRAY);
		// Fenster zurueck an den Standard-Platz
		int rx = width - 8 - THEMES.length * 14 - 24;
		boolean hr = hovered(rx, height - 17, 18, 14, false);
		roundRect(ctx, rx, height - 17, 18, 14, hr ? 0x40FFFFFF : 0x20FFFFFF);
		ctx.centeredText(font, "↺", rx + 9, height - 14, 0xFFFFFFFF);
		if (hr) tooltip = List.of(Component.literal("Fenster zurück an ihren Platz"));
		hit(rx, height - 17, 18, 14, false, this::resetWindows);
		themeDots(ctx, width - 8 - THEMES.length * 14, height - 15);
	}

	private void drawCategory(GuiGraphicsExtractor ctx, int id, int slide) {
		int w = winW();
		winX[id] = Mth.clamp(winX[id], 0, Math.max(0, width - w));
		winY[id] = Mth.clamp(winY[id], 0, Math.max(0, height - 18));
		int x = winX[id];
		int y = winY[id] + slide;
		List<Module> mods = new ArrayList<>();
		for (Module m : modules()) if (m.cat == id) mods.add(m);
		float open = anim("win" + id, winOpen[id] ? 1f : 0f, 18f);
		int bodyH = Math.round((mods.size() * 15 + 4) * open);
		int h = 18 + bodyH;

		Draw.glow(ctx, x, y, w, h, accent, moving == id ? 0x90 : 0x50, 3);
		roundGradient(ctx, x, y, w, h, 0xF2171D26, 0xF20E1217);
		border(ctx, x, y, w, h, alpha(accent, 0x90));
		// Kopfzeile: Symbol, Name, auf/zu
		roundGradient(ctx, x, y, w, 18, mix(accent, 0xFF000000, 0.12f), mix(accent, 0xFF000000, 0.5f));
		ctx.pose().pushMatrix();
		ctx.pose().translate(x + 3, y + 2);
		ctx.pose().scale(0.85f, 0.85f);
		ctx.item(new ItemStack(CATEGORY_ICONS[id]), 0, 0);
		ctx.pose().popMatrix();
		ctx.text(font, CATEGORIES[id].toUpperCase(java.util.Locale.ROOT), x + 20, y + 5, 0xFFFFFFFF);
		boolean ha = hovered(x + w - 16, y, 16, 18, false);
		ctx.centeredText(font, winOpen[id] ? "▾" : "▸", x + w - 8, y + 5, ha ? 0xFFFFFFFF : 0xD0FFFFFF);
		hit(x + w - 16, y, 16, 18, false, () -> {
			winOpen[id] = !winOpen[id];
			saveWindows();
		});
		grabs.add(new Grab(id, x, y, w - 16, 18));
		if (bodyH <= 0) return;

		ctx.enableScissor(x, y + 18, x + w, y + h);
		int ry = y + 20;
		for (Module m : mods) {
			boolean has = m.on != null;
			boolean on = has && m.on.getAsBoolean();
			boolean hov = hovered(x + 2, ry, w - 4, 14, false) && my < y + h;
			boolean sel = page == m.page;
			float k = anim("row" + m.page, hov ? 1f : 0f, 20f);
			if (sel) roundRect(ctx, x + 2, ry, w - 4, 14, alpha(accent, 0x45));
			else if (k > 0.02f) roundRect(ctx, x + 2, ry, w - 4, 14, alpha(0xFFFFFF, Math.round(0x1C * k)));
			if (on) roundRect(ctx, x + 3, ry + 2, 2, 10, accent);
			int off = Math.round(k * 2);
			ctx.text(font, font.plainSubstrByWidth(PAGES[m.page], w - 24), x + 8 + off, ry + 3,
					on ? 0xFFFFFFFF : has ? GRAY : TEXT);
			if (has) {
				// kleiner Punkt: gefuellt = an
				if (on) roundRect(ctx, x + w - 11, ry + 4, 6, 6, accent);
				else border(ctx, x + w - 11, ry + 4, 6, 6, 0x80FFFFFF);
			} else {
				ctx.text(font, "›", x + w - 10, ry + 3, GRAY);
			}
			if (hov) {
				// Hinweis erst nach kurzem Zeigen
				if (anim("tip" + m.page, 1f, 2.5f) > 0.7f) {
					tooltip = List.of(Component.literal(PAGES[m.page]).withColor(accent), Component.literal(m.desc),
							Component.literal(has ? "Linksklick: an/aus · Rechtsklick: Einstellungen" : "Klick: Einstellungen").withColor(0xFF98A2AE));
				}
			} else {
				anims.remove("tip" + m.page);
			}
			Runnable settings = () -> openPage(m.page);
			Runnable toggle = has ? () -> {
				m.set.accept(!on);
				VantageConfig.save();
				if (m.page == P_GUI && minecraft != null) GuiThemes.ensure(minecraft);
			} : settings;
			hits.add(new Hit(x + 2, ry, w - 4, Math.min(14, y + h - ry), false, toggle, null, settings));
			ry += 15;
		}
		ctx.disableScissor();
	}

	/** Bunte Punkte zum Wechseln der Menue-Farbe. */
	private void themeDots(GuiGraphicsExtractor ctx, int x, int y) {
		for (int i = 0; i < THEMES.length; i++) {
			int dx = x + i * 14;
			boolean sel = Math.floorMod(VantageConfig.get().menuTheme, THEMES.length) == i;
			boolean hov = hovered(dx - 1, y - 1, 12, 12, false);
			roundRect(ctx, dx, y, 10, 10, hov || sel ? THEMES[i] : mix(THEMES[i], 0xFF000000, 0.3f));
			if (sel) border(ctx, dx - 2, y - 2, 14, 14, 0xFFFFFFFF);
			if (hov) tooltip = List.of(Component.literal("Menü-Farbe: " + THEME_NAMES[i]));
			int ti = i;
			hit(dx - 1, y - 1, 12, 12, false, () -> {
				VantageConfig.get().menuTheme = ti;
				VantageConfig.save();
			});
		}
	}

	// ------------------------------------------------------------------ Einstellungs-Fenster

	private void drawSettings(GuiGraphicsExtractor ctx, int slide) {
		Module m = module(page);
		boolean vm = page == P_VIEWMODEL;
		int w = vm ? Math.min(320, Math.max(240, width * 11 / 20 - 12)) : Math.min(340, width - 16);
		int h = Math.min(height - 16, 320);
		if (setX < 0) {
			// Neben das Fenster der Kategorie legen (Viewmodel: ganz links, damit die Hand frei bleibt)
			if (vm) {
				setX = 6;
				setY = 6;
			} else {
				int cat = m == null ? 0 : m.cat;
				int ww = winW();
				float nx = winX[cat] + ww + 6;
				if (nx + w > width - 4) nx = winX[cat] - w - 6;
				if (nx < 4) nx = (width - w) / 2f;
				setX = nx;
				setY = Math.max(4, Math.min(winY[cat], height - h - 4));
			}
		}
		setX = Mth.clamp(setX, 0, Math.max(0, width - w));
		setY = Mth.clamp(setY, 0, Math.max(0, height - h));
		int x = Math.round(setX);
		int y = Math.round(setY) + slide;

		Draw.glow(ctx, x, y, w, h, accent, 0x80, 4);
		roundGradient(ctx, x, y, w, h, 0xF6171D26, 0xF60D1116);
		border(ctx, x, y, w, h, alpha(accent, 0xB0));
		// Kopfzeile
		roundGradient(ctx, x, y, w, 20, mix(accent, 0xFF000000, 0.12f), mix(accent, 0xFF000000, 0.5f));
		int tx = x + 5;
		if (m != null) {
			ctx.item(new ItemStack(m.icon), tx, y + 2);
			tx += 19;
		}
		ctx.text(font, PAGES[page], tx, y + 6, 0xFFFFFFFF);
		int bx = x + w - 18;
		boolean hc = hovered(bx, y + 2, 16, 16, false);
		roundRect(ctx, bx, y + 2, 16, 16, hc ? 0xFFC0392B : 0x30000000);
		ctx.centeredText(font, "✕", bx + 8, y + 6, 0xFFFFFFFF);
		hit(bx, y + 2, 16, 16, false, this::back);
		int grabW = w - 20;
		if (m != null && m.on != null) {
			boolean on = m.on.getAsBoolean();
			int sx = bx - 30;
			switchKnob(ctx, sx, y + 5, anim("page_on", on ? 1f : 0f, 18f));
			hit(sx - 2, y + 2, 26, 16, false, () -> {
				m.set.accept(!on);
				if (page == P_CROSSHAIR) skipAutoEnable = true;
				changed();
				if (page == P_GUI && minecraft != null) GuiThemes.ensure(minecraft);
			});
			grabW = sx - 4 - x;
		}
		grabs.add(new Grab(4, x, y, grabW, 20));

		// Inhalt (blendet beim Wechsel kurz von unten ein)
		float since = Math.min(1f, (System.nanoTime() - pageAt) / 1.6e8f);
		int rise = Math.round((1f - since) * (1f - since) * 10);
		cx = x + 6;
		cy = y + 24;
		cw = w - 12;
		ch = h - 28;
		ctx.enableScissor(x + 1, cy - 2, x + w - 1, cy + ch + 2);
		scrollAnim = approach(scrollAnim, scroll, 22f);
		int y0 = cy + 2 - Math.round(scrollAnim) + rise;
		int cw2 = cw - 6;
		int end = switch (page) {
			case P_SKINS -> drawSkins(ctx, cx, y0, cw2);
			case P_PACKS -> drawPacks(ctx, cx, y0, cw2);
			case P_CROSSHAIR -> drawCrosshair(ctx, cx, y0, cw2);
			case P_VIEWMODEL -> drawViewmodel(ctx, cx, y0, cw2);
			case P_SHADER -> drawFilters(ctx, cx, y0, cw2);
			case P_TRACKER -> drawTracker(ctx, cx, y0, cw2);
			case P_LUNGE -> drawLunge(ctx, cx, y0, cw2);
			case P_MACE -> drawMace(ctx, cx, y0, cw2);
			case P_SHIELD -> drawShield(ctx, cx, y0, cw2);
			case P_QUICK -> drawQuick(ctx, cx, y0, cw2);
			case P_COMBO -> drawCombo(ctx, cx, y0, cw2);
			case P_CAMERA -> drawCamera(ctx, cx, y0, cw2);
			case P_ZOOM -> drawZoom(ctx, cx, y0, cw2);
			case P_INFO -> drawInfo(ctx, cx, y0, cw2);
			case P_GUI -> drawGui(ctx, cx, y0, cw2);
			case P_BREW -> drawBrew(ctx, cx, y0, cw2);
			case P_KEYSTROKES -> drawKeystrokes(ctx, cx, y0, cw2);
			case P_ARMOR -> drawArmor(ctx, cx, y0, cw2);
			case P_POTIONS -> drawPotions(ctx, cx, y0, cw2);
			case P_WAYPOINTS -> drawWaypoints(ctx, cx, y0, cw2);
			case P_OUTLINE -> drawOutline(ctx, cx, y0, cw2);
			case P_KILL -> drawKill(ctx, cx, y0, cw2);
			case P_CHAT -> drawChat(ctx, cx, y0, cw2);
			default -> drawKeys(ctx, cx, y0, cw2);
		};
		ctx.disableScissor();
		contentHeight = end - y0 + 6;
		int max = Math.max(0, contentHeight - ch);
		if (scroll > max) scroll = max;
		if (max > 0) {
			if (scroll < max) ctx.fillGradient(x + 1, cy + ch - 12, x + w - 1, cy + ch + 2, 0x000D1116, 0xF60D1116);
			int barH = Math.max(16, ch * ch / contentHeight);
			int barY = cy + (int) ((ch - barH) * Math.min(1.0, scrollAnim / (double) max));
			roundRect(ctx, x + w - 5, cy, 3, ch, 0x26FFFFFF);
			roundRect(ctx, x + w - 5, barY, 3, barH, accent);
		}
	}

	// ------------------------------------------------------------------ Bausteine

	private boolean hovered(int x, int y, int w, int h, boolean content) {
		if (mx < x || my < y || mx >= x + w || my >= y + h) return false;
		return !content || (my >= cy && my < cy + ch);
	}

	private void hit(int x, int y, int w, int h, boolean content, Runnable click) {
		hits.add(new Hit(x, y, w, h, content, click, null, null));
	}

	private static void border(GuiGraphicsExtractor ctx, int x, int y, int w, int h, int color) {
		Draw.border(ctx, x, y, w, h, color);
	}

	private static void roundRect(GuiGraphicsExtractor ctx, int x, int y, int w, int h, int color) {
		Draw.roundRect(ctx, x, y, w, h, color);
	}

	private static void roundGradient(GuiGraphicsExtractor ctx, int x, int y, int w, int h, int top, int bottom) {
		Draw.roundGradient(ctx, x, y, w, h, top, bottom);
	}

	private void button(GuiGraphicsExtractor ctx, int x, int y, int w, int h, String label, boolean active, Runnable click) {
		boolean hov = hovered(x, y, w, h, true);
		int top = active ? mix(accentDim, accent, 0.3f) : hov ? 0xFF33404E : 0xFF27313C;
		int bottom = active ? accentDim : hov ? 0xFF253039 : 0xFF1C242D;
		roundGradient(ctx, x, y, w, h, top, bottom);
		border(ctx, x, y, w, h, active ? accent : hov ? mix(LINE, accent, 0.6f) : LINE);
		String s = font.plainSubstrByWidth(label, w - 6);
		ctx.centeredText(font, s, x + w / 2, y + (h - 8) / 2, active || hov ? 0xFFFFFFFF : TEXT);
		hit(x, y, w, h, true, click);
	}

	private int header(GuiGraphicsExtractor ctx, int x, int y, int w, String text) {
		roundRect(ctx, x, y + 2, 3, 10, accent);
		ctx.text(font, text, x + 7, y + 3, mix(accent, 0xFFFFFFFF, 0.3f));
		// Linie, die nach rechts ausblendet
		int lx = x + 7 + font.width(text) + 6;
		int lw = x + w - lx;
		for (int i = 0; i < lw; i += 6) {
			int a = Math.round(0x80 * (1f - i / (float) lw));
			ctx.fill(lx + i, y + 7, Math.min(lx + i + 6, x + w), y + 8, alpha(accent, a));
		}
		return y + 18;
	}

	private int paragraph(GuiGraphicsExtractor ctx, int x, int y, int w, String text, int color) {
		for (FormattedCharSequence line : font.split(Component.literal(text), w)) {
			ctx.text(font, line, x, y, color);
			y += 10;
		}
		return y + 3;
	}

	private int toggle(GuiGraphicsExtractor ctx, int x, int y, int w, String label, boolean value, Consumer<Boolean> set) {
		boolean hov = hovered(x, y, w, 15, true);
		if (hov) roundRect(ctx, x, y, w, 15, 0x14FFFFFF);
		ctx.text(font, font.plainSubstrByWidth(label, w - 34), x + 4, y + 4, hov ? 0xFFFFFFFF : TEXT);
		switchKnob(ctx, x + w - 27, y + 3, anim("t:" + label, value ? 1f : 0f, 18f));
		hit(x, y, w, 15, true, () -> {
			set.accept(!value);
			changed();
		});
		return y + 17;
	}

	/** Schiebeschalter (k = 0 aus ... 1 an, weich animiert). */
	private void switchKnob(GuiGraphicsExtractor ctx, int sx, int sy, float k) {
		roundRect(ctx, sx, sy, 22, 10, mix(0xFF3A434F, accent, k));
		roundRect(ctx, sx + 1 + Math.round(k * 12), sy + 1, 8, 8, 0xFFF4F6F8);
	}

	private int slider(GuiGraphicsExtractor ctx, int x, int y, int w, String label, double min, double max, double value, double step,
			String text, DoubleConsumer set) {
		ctx.text(font, label, x + 4, y + 1, TEXT);
		int tw = font.width(text);
		roundRect(ctx, x + w - tw - 9, y - 1, tw + 7, 11, alpha(accent, 0x30));
		ctx.text(font, text, x + w - tw - 5, y + 1, mix(accent, 0xFFFFFFFF, 0.35f));
		int bx = x + 4;
		int bw = w - 8;
		int by = y + 13;
		double f = Mth.clamp((value - min) / (max - min), 0, 1);
		int fw = (int) (bw * f);
		roundRect(ctx, bx, by + 2, bw, 4, 0xFF2B3440);
		if (fw > 0) roundRect(ctx, bx, by + 2, fw, 4, accent);
		int kx = bx + fw;
		boolean hov = hovered(bx - 3, by - 2, bw + 6, 11, true);
		boolean held = dragging != null && dragging.x == bx - 3 && dragging.y == by - 2;
		if (hov || held) roundRect(ctx, kx - 5, by - 2, 11, 11, alpha(accent, 0x60));
		roundRect(ctx, kx - 3, by, 7, 7, held ? 0xFFFFFFFF : hov ? 0xFFF4F6F8 : 0xFFDADFE5);
		hits.add(new Hit(bx - 3, by - 2, bw + 6, 11, true, null, mouse -> {
			double ff = Mth.clamp((mouse - bx) / bw, 0, 1);
			double v = min + ff * (max - min);
			v = Math.round(v / step) * step;
			set.accept(Mth.clamp(v, min, max));
			changed();
		}, null));
		return y + 25;
	}

	private void itemCell(GuiGraphicsExtractor ctx, int x, int y, int size, ItemStack stack, int rarityColor, boolean selected, @Nullable List<Component> tip, Runnable click) {
		boolean hov = hovered(x, y, size, size, true);
		roundRect(ctx, x, y, size, size, hov ? 0xFF2D3846 : 0xFF1E262F);
		ctx.fill(x + 2, y + size - 3, x + size - 2, y + size - 1, rarityColor);
		if (selected) border(ctx, x, y, size, size, accent);
		else if (hov) border(ctx, x, y, size, size, 0xFF6A7A8C);
		float s = (size - 6) / 16f;
		ctx.pose().pushMatrix();
		ctx.pose().translate(x + 3, y + 2);
		ctx.pose().scale(s, s);
		ctx.item(stack, 0, 0);
		ctx.pose().popMatrix();
		if (hov && tip != null) tooltip = tip;
		hit(x, y, size, size, true, click);
	}

	private String keyName(KeyMapping key) {
		return key.getTranslatedKeyMessage().getString();
	}

	// ------------------------------------------------------------------ Kategorien

	private static String baseItem(SkinCatalog.Category cat, String target) {
		if (!"*".equals(target)) return target;
		for (int i = cat.items.size() - 1; i >= 0; i--) {
			if (SkinManager.item(cat.items.get(i)) != null) return cat.items.get(i);
		}
		return cat.items.get(0);
	}

	private int categoryChips(GuiGraphicsExtractor ctx, int x, int y, int w, String selected, Consumer<String> select) {
		int perRow = 4;
		int chipW = (w - (perRow - 1) * 3) / perRow;
		int i = 0;
		for (SkinCatalog.Category cat : SkinCatalog.categories()) {
			int bx = x + (i % perRow) * (chipW + 3);
			int by = y + (i / perRow) * 21;
			boolean sel = cat.id.equals(selected);
			boolean hov = hovered(bx, by, chipW, 19, true);
			roundRect(ctx, bx, by, chipW, 19, sel ? accentDim : hov ? 0xFF2C3744 : 0xFF222B35);
			border(ctx, bx, by, chipW, 19, sel ? accent : LINE);
			ItemStack icon = SkinManager.preview(null, baseItem(cat, "*"));
			ctx.item(icon, bx + 2, by + 1);
			ctx.text(font, font.plainSubstrByWidth(cat.name, chipW - 22), bx + 20, by + 6, sel ? 0xFFFFFFFF : TEXT);
			String id = cat.id;
			hit(bx, by, chipW, 19, true, () -> select.accept(id));
			i++;
		}
		return y + ((i + perRow - 1) / perRow) * 21 + 3;
	}

	// ------------------------------------------------------------------ Seite: Skins

	private int drawSkins(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
		SkinCatalog.Category cat = SkinCatalog.category(skinCat);
		if (cat == null) {
			if (SkinCatalog.categories().isEmpty()) return paragraph(ctx, x, y, w, "Keine Skins geladen.", 0xFFFF6060);
			cat = SkinCatalog.categories().iterator().next();
			skinCat = cat.id;
		}
		y = categoryChips(ctx, x, y, w, skinCat, id -> {
			skinCat = id;
			skinTarget = "*";
			skinShape = null;
		});

		SkinCatalog.Category k = cat;
		if (cat.items.size() > 1) {
			ctx.text(font, "Für:", x + 1, y + 6, GRAY);
			int bx = x + 26;
			button(ctx, bx, y, 34, 19, "Alle", "*".equals(skinTarget), () -> skinTarget = "*");
			bx += 37;
			for (String path : cat.items) {
				Item item = SkinManager.item(path);
				if (item == null) continue;
				boolean sel = path.equals(skinTarget);
				boolean hov = hovered(bx, y, 19, 19, true);
				roundRect(ctx, bx, y, 19, 19, sel ? accentDim : hov ? 0xFF2C3744 : 0xFF222B35);
				border(ctx, bx, y, 19, 19, sel ? accent : LINE);
				ctx.item(SkinManager.preview(null, path), bx + 2, y + 2);
				if (hov) tooltip = List.of(new ItemStack(item).getHoverName());
				hit(bx, y, 19, 19, true, () -> skinTarget = path);
				bx += 21;
			}
			y += 23;
		}
		String base = baseItem(cat, skinTarget);
		SkinCatalog.Skin current = SkinCatalog.skin(c.skins.get(base));
		if (current != null && current.category() != cat) current = null;

		SkinCatalog.ShapeDef shape = null;
		if (cat.hasShapes()) {
			if (skinShape == null) skinShape = current != null ? current.shape().id() : cat.shapes.get(0).id();
			for (SkinCatalog.ShapeDef s : cat.shapes) if (s.id().equals(skinShape)) shape = s;
			if (shape == null) shape = cat.shapes.get(0);
			y = header(ctx, x, y, w, "Form: " + shape.name());
			int size = 24;
			int perRow = Math.max(1, (w + 2) / (size + 2));
			SkinCatalog.Finish showFinish = current != null ? current.finish() : cat.finishes.get(0);
			for (int i = 0; i < cat.shapes.size(); i++) {
				SkinCatalog.ShapeDef s = cat.shapes.get(i);
				SkinCatalog.Skin sk = SkinCatalog.skin(cat.skinId(s, showFinish));
				int bx = x + (i % perRow) * (size + 2);
				int by = y + (i / perRow) * (size + 2);
				SkinCatalog.Skin finalCur = current;
				itemCell(ctx, bx, by, size, SkinManager.preview(sk, base), 0xFF3A4654, s == shape,
						List.of(Component.literal(s.name()).withColor(accent)), () -> {
							skinShape = s.id();
							if (finalCur != null) equip(k, SkinCatalog.skin(k.skinId(s, finalCur.finish())));
						});
			}
			y += ((cat.shapes.size() + perRow - 1) / perRow) * (size + 2) + 4;
		}

		y = header(ctx, x, y, w, cat.hasShapes() ? "Muster (anklicken = ausrüsten)" : "Design (anklicken = ausrüsten)");
		int size = 28;
		int perRow = Math.max(1, (w + 2) / (size + 2));
		int n = cat.finishes.size() + 1;
		for (int i = 0; i < n; i++) {
			int bx = x + (i % perRow) * (size + 2);
			int by = y + (i / perRow) * (size + 2);
			if (i == 0) {
				itemCell(ctx, bx, by, size, SkinManager.preview(null, base), 0xFF555555, current == null,
						List.of(Component.literal("Standard (kein Skin)")), () -> equip(k, null));
				continue;
			}
			SkinCatalog.Finish f = cat.finishes.get(i - 1);
			SkinCatalog.Skin sk = SkinCatalog.skin(cat.skinId(shape, f));
			if (sk == null) continue;
			int col = SkinCatalog.rarityColor(f.rarity());
			List<Component> tip = List.of(Component.literal(sk.displayName()).withColor(col),
					Component.literal(SkinCatalog.RARITY_NAMES[Math.min(6, Math.max(0, f.rarity()))]).withColor(0xFF9AA4B0));
			itemCell(ctx, bx, by, size, SkinManager.preview(sk, base), col, current != null && current.id().equals(sk.id()), tip, () -> equip(k, sk));
		}
		y += ((n + perRow - 1) / perRow) * (size + 2) + 6;

		// Grosse Vorschau + Infos
		int boxH = 70;
		roundGradient(ctx, x, y, 74, boxH, 0xFF2A3442, 0xFF141A21);
		border(ctx, x, y, 74, boxH, current == null ? LINE : SkinCatalog.rarityColor(current.rarity()));
		ctx.pose().pushMatrix();
		ctx.pose().translate(x + 5, y + 3);
		ctx.pose().scale(4f, 4f);
		ctx.item(SkinManager.preview(current, base), 0, 0);
		ctx.pose().popMatrix();
		int tx = x + 82;
		ctx.text(font, "Ausgerüstet:", tx, y + 2, GRAY);
		String name = current == null ? "Kein Skin" : current.displayName();
		ctx.text(font, font.plainSubstrByWidth(name, w - 84), tx, y + 13,
				current == null ? TEXT : SkinCatalog.rarityColor(current.rarity()));
		if (current != null) {
			ctx.text(font, SkinCatalog.RARITY_NAMES[Math.min(6, current.rarity())], tx, y + 24, GRAY);
			if (cat.hasShapes() && c.statTrak) {
				ctx.text(font, "StatTrak™ Kills: " + c.statTrakKills.getOrDefault(current.id(), 0), tx, y + 35, 0xFFCF6A32);
			}
		}
		button(ctx, tx, y + 50, 90, 18, "🎲 Zufällig", false, () -> {
			SkinCatalog.Skin r = k.skins.get(random.nextInt(k.skins.size()));
			if (r.shape() != null) skinShape = r.shape().id();
			equip(k, r);
		});
		button(ctx, tx + 94, y + 50, Math.min(110, w - 176), 18, "Alle entfernen", false, () -> {
			for (String it : k.items) VantageConfig.get().skins.remove(it);
			VantageConfig.save();
		});
		y += boxH + 6;

		y = header(ctx, x, y, w, "Optionen");
		y = toggle(ctx, x, y, w, "Skins anzeigen", c.skinsEnabled, v -> {
			c.skinsEnabled = v;
			VantageConfig.save();
		});
		y = toggle(ctx, x, y, w, "Nur meine Items (andere Spieler sehen normal aus)", c.skinsOnlyOwn, v -> {
			c.skinsOnlyOwn = v;
			VantageConfig.save();
		});
		y = toggle(ctx, x, y, w, "StatTrak™-Zähler (zählt deine Kills pro Skin)", c.statTrak, v -> c.statTrak = v);
		y = paragraph(ctx, x, y + 2, w, "Skins sind nur auf deinem Bildschirm zu sehen und funktionieren auf jedem Server. "
				+ "Halte ein Messer und drücke " + keyName(VantageClient.inspectKey) + " zum Ansehen (Inspect).", GRAY);
		return y;
	}

	private void equip(SkinCatalog.Category cat, @Nullable SkinCatalog.Skin skin) {
		if ("*".equals(skinTarget)) {
			for (String it : cat.items) {
				if (skin == null) VantageConfig.get().skins.remove(it);
				else VantageConfig.get().skins.put(it, skin.id());
			}
			VantageConfig.save();
		} else {
			SkinManager.equip(skinTarget, skin);
		}
	}

	// ------------------------------------------------------------------ Seite: Pakete

	private int drawPacks(GuiGraphicsExtractor ctx, int x, int y, int w) {
		y = paragraph(ctx, x, y, w, "Wie ein Resourcepack: Ein Klick, und jede Schwert-Stufe bekommt ein anderes CS-Messer "
				+ "(Netherite = Karambit, Diamant = Butterfly, Eisen = M9, Gold = Talon, Kupfer = Flip, Stein = Gut, Holz = Bajonett) "
				+ "im selben Muster – dazu passende Axt, Kolben, Speer, Schild, Granaten und Totem.", GRAY);
		int colW = (w - 4) / 2;
		int cardH = 46;
		List<SkinPacks.Pack> packs = SkinPacks.all();
		String[] showItems = {"netherite_sword", "diamond_sword", "iron_sword", "golden_sword", "netherite_axe", "shield"};
		for (int i = 0; i < packs.size(); i++) {
			SkinPacks.Pack pack = packs.get(i);
			int bx = x + (i % 2) * (colW + 4);
			int by = y + (i / 2) * (cardH + 4);
			boolean active = pack.active();
			boolean hov = hovered(bx, by, colW, cardH, true);
			roundGradient(ctx, bx, by, colW, cardH, active ? accentDim : hov ? 0xFF2C3744 : 0xFF222B35, 0xFF161C23);
			border(ctx, bx, by, colW, cardH, active ? accent : hov ? 0xFF56677A : LINE);
			ctx.text(font, pack.name() + (active ? "  ✔" : ""), bx + 5, by + 4, active ? accent : 0xFFFFFFFF);
			ctx.text(font, font.plainSubstrByWidth(pack.desc(), colW - 10), bx + 5, by + 15, GRAY);
			int ix = bx + 4;
			for (String it : showItems) {
				SkinCatalog.Skin sk = SkinCatalog.skin(pack.skins().get(it));
				if (ix + 16 > bx + colW - 2) break;
				ctx.item(SkinManager.preview(sk, it), ix, by + 27);
				ix += 18;
			}
			hit(bx, by, colW, cardH, true, () -> SkinPacks.apply(pack));
		}
		y += ((packs.size() + 1) / 2) * (cardH + 4) + 4;
		button(ctx, x, y, 150, 18, "Alle Skins entfernen", false, SkinPacks::clear);
		y += 24;
		return paragraph(ctx, x, y, w, "Einzelne Teile kannst du danach im Reiter „Skins“ noch ändern.", GRAY);
	}

	// ------------------------------------------------------------------ Seite: Fadenkreuz

	private int drawCrosshair(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
		// Ganz oben: ist das eigene Fadenkreuz im Spiel an? (ein Klick schaltet um)
		boolean on = c.chEnabled;
		int sc = on ? 0xFF3FAF5A : 0xFFE0A030;
		boolean hovBanner = hovered(x, y, w, 22, true);
		roundRect(ctx, x, y, w, 22, alpha(sc, hovBanner ? 0x48 : 0x30));
		border(ctx, x, y, w, 22, alpha(sc, 0xC0));
		ctx.text(font, font.plainSubstrByWidth(on ? "✔ Dein Fadenkreuz ist im Spiel an"
				: "Aus: im Spiel ist das normale Minecraft-Fadenkreuz", w - 40), x + 6, y + 7, on ? 0xFFB8F0C4 : 0xFFFFD98A);
		switchKnob(ctx, x + w - 28, y + 6, anim("t:chEnabled", on ? 1f : 0f, 18f));
		hit(x, y, w, 22, true, () -> {
			c.chEnabled = !c.chEnabled;
			skipAutoEnable = true;
			changed();
		});
		y += 28;

		// Rechts: Vorschau in echter Groesse vor einem kleinen Block
		int boxW = 96;
		int lw = w - boxW - 8;
		int bx = x + w - boxW;
		int mid = bx + boxW / 2;
		int horizon = y + boxW * 2 / 3;
		roundGradient(ctx, bx, y, boxW, boxW, 0xFF6FA8DC, 0xFFBFDDF2);
		roundRect(ctx, bx, horizon, boxW, boxW - boxW * 2 / 3, 0xFF5E8A3C);
		ctx.fill(bx, horizon, bx + boxW, horizon + 2, 0xFF7DB04B);
		ctx.fill(mid - 12, y + 34, mid + 12, horizon, 0xFF8C9198);
		ctx.fill(mid - 12, y + 34, mid + 12, y + 37, 0xFFA9AEB5);
		ctx.fill(mid + 9, y + 37, mid + 12, horizon, 0xFF6E737A);
		border(ctx, bx, y, boxW, boxW, LINE);
		float dyn = c.chDynamic ? (0.5f + 0.5f * (float) Math.sin(time * 2.4f)) * 3f : 0f;
		Crosshair.draw(ctx, mid, y + boxW / 2, dyn);
		ctx.centeredText(font, "Vorschau", mid, y + boxW + 3, GRAY);

		// Links: fertige Vorlagen zum Anklicken
		int yy = header(ctx, x, y, lw, "Vorlagen");
		int cols = 3;
		int cellW = (lw - (cols - 1) * 4) / cols;
		int cellH = 34;
		for (int i = 0; i < Crosshair.PRESETS.length; i++) {
			VantageConfig p = Crosshair.preset(i);
			int px0 = x + (i % cols) * (cellW + 4);
			int py0 = yy + (i / cols) * (cellH + 4);
			boolean sel = on && Crosshair.matches(c, p);
			boolean hov = hovered(px0, py0, cellW, cellH, true);
			roundGradient(ctx, px0, py0, cellW, cellH, sel ? mix(accentDim, accent, 0.2f) : hov ? 0xFF2E3A48 : 0xFF222B35, sel ? accentDim : 0xFF1A2129);
			border(ctx, px0, py0, cellW, cellH, sel ? accent : hov ? mix(LINE, accent, 0.6f) : LINE);
			ctx.enableScissor(px0 + 1, py0 + 1, px0 + cellW - 1, py0 + cellH - 11);
			Crosshair.draw(ctx, p, px0 + cellW / 2, py0 + 12, 0);
			ctx.disableScissor();
			ctx.centeredText(font, font.plainSubstrByWidth(Crosshair.PRESETS[i], cellW - 4), px0 + cellW / 2,
					py0 + cellH - 10, sel || hov ? 0xFFFFFFFF : TEXT);
			hit(px0, py0, cellW, cellH, true, () -> {
				Crosshair.apply(p, c);
				changed();
			});
		}
		yy += 2 * (cellH + 4);
		y = Math.max(yy, y + boxW + 14);

		y = header(ctx, x, y, w, "Form");
		int sw = (w - 6) / 4;
		for (int i = 0; i < Crosshair.STYLES.length; i++) {
			int idx = i;
			button(ctx, x + i * (sw + 2), y, sw, 18, Crosshair.STYLES[i], c.chStyle == i, () -> {
				c.chStyle = idx;
				changed();
			});
		}
		y += 24;

		y = header(ctx, x, y, w, "Farbe");
		for (int i = 0; i < Crosshair.COLORS.length; i++) {
			int col = Crosshair.COLORS[i];
			int sx = x + 2 + i * 21;
			boolean sel = (c.chColor & 0xFFFFFF) == col;
			boolean hov = hovered(sx, y, 16, 16, true);
			roundRect(ctx, sx, y, 16, 16, 0xFF000000 | col);
			if (sel) border(ctx, sx - 2, y - 2, 20, 20, 0xFFFFFFFF);
			else if (hov) border(ctx, sx - 1, y - 1, 18, 18, 0xA0FFFFFF);
			hit(sx, y, 16, 16, true, () -> {
				c.chColor = col;
				changed();
			});
		}
		y += 22;
		y = slider(ctx, x, y, w, "Rot", 0, 255, (c.chColor >> 16) & 255, 1, String.valueOf((c.chColor >> 16) & 255),
				v -> c.chColor = (c.chColor & 0x00FFFF) | ((int) v << 16));
		y = slider(ctx, x, y, w, "Grün", 0, 255, (c.chColor >> 8) & 255, 1, String.valueOf((c.chColor >> 8) & 255),
				v -> c.chColor = (c.chColor & 0xFF00FF) | ((int) v << 8));
		y = slider(ctx, x, y, w, "Blau", 0, 255, c.chColor & 255, 1, String.valueOf(c.chColor & 255),
				v -> c.chColor = (c.chColor & 0xFFFF00) | (int) v);

		y = header(ctx, x, y + 2, w, "Größe");
		y = slider(ctx, x, y, w, "Länge", 0, 15, c.chLength, 0.5, fmt(c.chLength), v -> c.chLength = (float) v);
		y = slider(ctx, x, y, w, "Dicke", 0.5, 5, c.chThickness, 0.5, fmt(c.chThickness), v -> c.chThickness = (float) v);
		y = slider(ctx, x, y, w, "Lücke", -3, 10, c.chGap, 0.5, fmt(c.chGap), v -> c.chGap = (float) v);
		y = slider(ctx, x, y, w, "Deckkraft", 30, 255, c.chAlpha, 5, Math.round(c.chAlpha / 2.55) + " %", v -> c.chAlpha = (int) v);

		y = header(ctx, x, y + 2, w, "Extras");
		y = toggle(ctx, x, y, w, "Punkt in der Mitte", c.chDot, v -> c.chDot = v);
		y = toggle(ctx, x, y, w, "Schwarze Umrandung", c.chOutline, v -> c.chOutline = v);
		y = toggle(ctx, x, y, w, "Dynamisch (geht beim Laufen/Angreifen auf)", c.chDynamic, v -> c.chDynamic = v);
		y = toggle(ctx, x, y, w, "Angriffs-Abklingzeit unter dem Fadenkreuz", c.chCooldown, v -> c.chCooldown = v);
		y = paragraph(ctx, x, y + 2, w, "Jede Änderung hier schaltet dein Fadenkreuz automatisch an. Menü schließen, dann siehst du es im Spiel. "
				+ "(Nur in der Ich-Ansicht, wie in Minecraft.)", GRAY);
		button(ctx, x, y + 2, 110, 18, "Zurücksetzen", false, () -> {
			Crosshair.apply(new VantageConfig(), c);
			changed();
		});
		return y + 24;
	}

	private static String fmt(double v) {
		return String.format("%.1f", v).replace('.', ',');
	}

	// ------------------------------------------------------------------ Seite: Viewmodel

	private int drawViewmodel(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
		y = paragraph(ctx, x, y, w, "Live-Vorschau: rechts siehst du deine Hand. Halte dein Messer in der Hand und stell alles ein.", 0xFF8FD18F);
		int half = (w - 2) / 2;
		button(ctx, x, y, half, 18, "▶ Inspect", false, () -> {
			if (minecraft != null) Viewmodel.startInspect(minecraft);
		});
		button(ctx, x + half + 2, y, half, 18, "▶ Ziehen", false, () -> {
			if (minecraft != null) Viewmodel.playDraw(minecraft);
		});
		y += 20;
		button(ctx, x, y, w, 18, "Alles zurücksetzen", false, () -> {
			VantageConfig d = new VantageConfig();
			c.vmX = d.vmX;
			c.vmY = d.vmY;
			c.vmZ = d.vmZ;
			c.vmScale = d.vmScale;
			c.vmRotX = d.vmRotX;
			c.vmRotY = d.vmRotY;
			c.vmRotZ = d.vmRotZ;
			c.vmOffX = d.vmOffX;
			c.vmOffY = d.vmOffY;
			c.vmOffZ = d.vmOffZ;
			c.vmOffScale = d.vmOffScale;
			c.vmOffRotX = d.vmOffRotX;
			c.vmOffRotY = d.vmOffRotY;
			c.vmOffRotZ = d.vmOffRotZ;
			changed();
		});
		y += 24;
		y = header(ctx, x, y, w, "Rechte Hand (Haupthand)");
		y = slider(ctx, x, y, w, "Links ↔ Rechts", -1.5, 1.5, c.vmX, 0.05, fmt(c.vmX), v -> c.vmX = (float) v);
		y = slider(ctx, x, y, w, "Unten ↕ Oben", -1.5, 1.5, c.vmY, 0.05, fmt(c.vmY), v -> c.vmY = (float) v);
		y = slider(ctx, x, y, w, "Nah ↔ Fern", -1.5, 1.5, -c.vmZ, 0.05, fmt(-c.vmZ), v -> c.vmZ = (float) -v);
		y = slider(ctx, x, y, w, "Kippen (vor/zurück)", -180, 180, c.vmRotX, 5, Math.round(c.vmRotX) + "°", v -> c.vmRotX = (float) v);
		y = slider(ctx, x, y, w, "Drehen (links/rechts)", -180, 180, c.vmRotY, 5, Math.round(c.vmRotY) + "°", v -> c.vmRotY = (float) v);
		y = slider(ctx, x, y, w, "Neigen (seitlich)", -180, 180, c.vmRotZ, 5, Math.round(c.vmRotZ) + "°", v -> c.vmRotZ = (float) v);
		y = slider(ctx, x, y, w, "Größe", 0.3, 1.6, c.vmScale, 0.05, Math.round(c.vmScale * 100) + " %", v -> c.vmScale = (float) v);

		y = header(ctx, x, y + 2, w, "Linke Hand (zweite Hand)");
		y = toggle(ctx, x, y, w, "Eigene Werte (sonst gespiegelt wie rechts)", c.vmOffSeparate, v -> c.vmOffSeparate = v);
		if (c.vmOffSeparate) {
			y = slider(ctx, x, y, w, "Links ↔ Rechts", -1.5, 1.5, c.vmOffX, 0.05, fmt(c.vmOffX), v -> c.vmOffX = (float) v);
			y = slider(ctx, x, y, w, "Unten ↕ Oben", -1.5, 1.5, c.vmOffY, 0.05, fmt(c.vmOffY), v -> c.vmOffY = (float) v);
			y = slider(ctx, x, y, w, "Nah ↔ Fern", -1.5, 1.5, -c.vmOffZ, 0.05, fmt(-c.vmOffZ), v -> c.vmOffZ = (float) -v);
			y = slider(ctx, x, y, w, "Kippen (vor/zurück)", -180, 180, c.vmOffRotX, 5, Math.round(c.vmOffRotX) + "°", v -> c.vmOffRotX = (float) v);
			y = slider(ctx, x, y, w, "Drehen (links/rechts)", -180, 180, c.vmOffRotY, 5, Math.round(c.vmOffRotY) + "°", v -> c.vmOffRotY = (float) v);
			y = slider(ctx, x, y, w, "Neigen (seitlich)", -180, 180, c.vmOffRotZ, 5, Math.round(c.vmOffRotZ) + "°", v -> c.vmOffRotZ = (float) v);
			y = slider(ctx, x, y, w, "Größe", 0.3, 1.6, c.vmOffScale, 0.05, Math.round(c.vmOffScale * 100) + " %", v -> c.vmOffScale = (float) v);
		}

		y = header(ctx, x, y + 2, w, "Messer-Animationen");
		y = toggle(ctx, x, y, w, "Zieh-Animation beim Wechseln aufs Messer", c.drawAnim, v -> c.drawAnim = v);
		y = toggle(ctx, x, y, w, "Inspect-Animation", c.inspect, v -> c.inspect = v);
		y = toggle(ctx, x, y, w, "Schlag-Animationen wie in CS (Schwert, Axt, Streitkolben)", c.swingAnim, v -> c.swingAnim = v);
		y = toggle(ctx, x, y, w, "Geräusche (Klicken, Schwung)", c.knifeSounds, v -> c.knifeSounds = v);
		y = slider(ctx, x, y, w, "Tempo", 0.5, 2.0, c.animSpeed, 0.1, Math.round(c.animSpeed * 100) + " %", v -> c.animSpeed = (float) v);
		y = keyRow(ctx, x, y, w, "Inspect-Taste", VantageClient.inspectKey);
		return paragraph(ctx, x, y + 2, w, "Jedes Messer hat eigene Bewegungen: Karambit und Talon wirbeln um den Finger, das Butterfly "
				+ "klappt auf und wird hochgeworfen, die Schattendolche drehen sich, M9 und Bajonett werden geworfen und gefangen, "
				+ "Flip, Falchion, Navaja und Stiletto klappen auf. Schläge wie in CS: abwechselnd Vorhand und Rückhand, im Fallen "
				+ "(kritischer Treffer) ein schwerer Stich. Karambit hakt, Schattendolche stoßen nach vorne, Axt und Streitkolben hauen von oben.", GRAY);
	}

	// ------------------------------------------------------------------ Seite: Shader

	private int drawFilters(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
		y = paragraph(ctx, x, y, w, "Eingebaute Shader mit Leuchten (Bloom), Kino-Farben und Filmkorn. Wählen und das Menü schließen, um sie zu sehen.", GRAY);
		int colW = (w - 4) / 2;
		for (int i = 0; i < Filters.LIST.length; i++) {
			String[] f = Filters.LIST[i];
			int bx = x + (i % 2) * (colW + 4);
			int by = y + (i / 2) * 32;
			boolean sel = f[0].equals(c.filter);
			boolean hov = hovered(bx, by, colW, 29, true);
			roundGradient(ctx, bx, by, colW, 29, sel ? accentDim : hov ? 0xFF2C3744 : 0xFF222B35, sel ? mix(accentDim, 0xFF161C23, 0.5f) : 0xFF1A2129);
			border(ctx, bx, by, colW, 29, sel ? accent : LINE);
			ctx.text(font, f[1], bx + 5, by + 5, sel ? 0xFFFFFFFF : TEXT);
			ctx.text(font, font.plainSubstrByWidth(f[2], colW - 10), bx + 5, by + 17, GRAY);
			if (hov) tooltip = List.of(Component.literal(f[1]).withColor(accent), Component.literal(f[2]));
			hit(bx, by, colW, 29, true, () -> {
				c.filter = f[0];
				VantageConfig.save();
			});
		}
		y += ((Filters.LIST.length + 1) / 2) * 32 + 4;
		return paragraph(ctx, x, y, w, "Für Schatten, Wasser und Licht wie in großen Shader-Paketen zusätzlich Iris + Sodium installieren. "
				+ "Vantage Client läuft zusammen mit ihnen; die Shader hier dann am besten auf „Aus“.", GRAY);
	}

	// ------------------------------------------------------------------ Seite: Tracker

	private int drawTracker(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
		boolean single = minecraft != null && minecraft.getSingleplayerServer() != null;
		if (minecraft != null && minecraft.level != null && minecraft.player != null) {
			ResourceKey<Level> dim = minecraft.level.dimension();
			TrackType type = StructureTracker.targetType(dim);
			if (type != null) {
				Site site = StructureTracker.target(minecraft);
				// Vorschau in der eingestellten Groesse (notfalls kleiner, damit die Knoepfe daneben passen)
				int full = TrackerCard.width(minecraft, type, site);
				float sc = Math.min(TrackerCard.scale(), (w - 112) / (float) full);
				ctx.pose().pushMatrix();
				ctx.pose().translate(x, y);
				ctx.pose().scale(sc, sc);
				int h = Math.round(TrackerCard.render(ctx, minecraft, 0, 0, full, type, site) * sc);
				ctx.pose().popMatrix();
				int cw = Math.round(full * sc);
				int bx = x + cw + 8;
				int bw = w - cw - 8;
				button(ctx, bx, y, bw, 20, StructureTracker.searching() ? "Sucht …" : "Neu suchen", false, () -> StructureTracker.search(minecraft));
				button(ctx, bx, y + 24, bw, 20, "Beute neu prüfen", false, StructureTracker::recheck);
				button(ctx, bx, y + 48, bw, 20, "Ziel überspringen", false, () -> StructureTracker.skip(minecraft));
				button(ctx, bx, y + 72, bw, 20, "Liste leeren", false, StructureTracker::clear);
				y += Math.max(h, 92) + 6;
			}
		}
		ctx.text(font, font.plainSubstrByWidth("Status: " + StructureTracker.status(), w - 4), x + 2, y, GRAY);
		y += 13;
		y = paragraph(ctx, x, y, w, single
				? "Einzelspieler: Die Suche kennt die ganze Welt – auch weit außerhalb der Sichtweite. Die Beute wird echt geprüft: Elytra im Rahmen, Drachenkopf, ob Kisten noch nie geöffnet, offen, leer oder abgebaut sind."
				: "Server: Ohne Seed kennt die Mod nur die geladenen Chunks (Sichtweite). Mit Seed (unten) findet sie Endsiedlungen und Schiffe auch weit weg. Geprüft wird, was man sieht (Elytra im Rahmen, Drachenkopf, Kisten vorhanden) – was in Kisten liegt, verrät der Server nicht.",
				single ? 0xFF8FD18F : 0xFFE0C070);

		if (!single && minecraft != null && SeedStore.serverKey(minecraft) != null) {
			y = header(ctx, x, y, w, "Seed (eigener Server, z. B. Aternos)");
			Long seed = SeedStore.seed(minecraft);
			y = paragraph(ctx, x, y, w, "Mit dem Seed findet der Tracker Endsiedlungen und Endschiffe auch weit außerhalb der Sichtweite – "
					+ "wie Chunkbase. Nur für Server, deren Seed ihr kennt (z. B. euer eigener). Den Seed zeigt das Aternos-Panel, "
					+ "oder hol ihn mit /seed (braucht Op).", GRAY);
			ctx.text(font, seed == null ? "Kein Seed gespeichert" : "Seed: " + seed, x + 2, y + 2,
					seed == null ? 0xFFE0C070 : 0xFF8FD18F);
			y += 14;
			int bw = (w - 8) / 3;
			button(ctx, x, y, bw, 20, "Seed eingeben …", false, () -> minecraft.gui.setScreen(new SeedScreen(this)));
			button(ctx, x + bw + 4, y, bw, 20, "Seed holen (/seed)", false, () -> SeedStore.request(minecraft));
			button(ctx, x + 2 * (bw + 4), y, bw, 20, "Seed löschen", false, () -> SeedStore.set(minecraft, null));
			y += 24;
			String msg = SeedStore.message();
			if (!msg.isEmpty()) y = paragraph(ctx, x, y, w, msg, 0xFF8FD18F);
		}

		y = header(ctx, x, y, w, "Ziel pro Dimension");
		y = paragraph(ctx, x, y, w, "Die Karte zeigt immer nur das nächste Ziel des gewählten Typs. Taste „Tracker: Ziel wechseln“ wechselt im Spiel.", GRAY);
		y = targetGroup(ctx, x, y, w, "Oberwelt", Level.OVERWORLD);
		y = targetGroup(ctx, x, y, w, "Nether", Level.NETHER);
		y = targetGroup(ctx, x, y, w, "Das Ende", Level.END);

		y = header(ctx, x, y, w, "Einstellungen");
		y = toggle(ctx, x, y, w, "Tracker-Karte rechts oben im HUD", c.trackerHud, v -> c.trackerHud = v);
		y = slider(ctx, x, y, w, "Größe der Tracker-Karte", 0.5, 1.5, c.trackerScale, 0.05, Math.round(c.trackerScale * 100) + " %", v -> c.trackerScale = (float) v);
		y = toggle(ctx, x, y, w, "Geplünderte überspringen (nächstes volles Ziel zeigen)", c.trackerSkipLooted, v -> c.trackerSkipLooted = v);
		y = toggle(ctx, x, y, w, "Lichtsäule über dem Ziel (in der Nähe)", c.trackerBeam, v -> c.trackerBeam = v);
		y = toggle(ctx, x, y, w, "Immer automatisch suchen (beim Laufen, neue Dimension, neues Ziel)", c.trackerAuto, v -> c.trackerAuto = v);
		y = slider(ctx, x, y, w, "Suchradius (Einzelspieler)", 500, 10000, c.trackerRadius, 250, c.trackerRadius + " Blöcke", v -> c.trackerRadius = (int) v);
		y = toggle(ctx, x, y, w, "Auf Servern erlauben (nur geladene Chunks)", c.trackerServers, v -> c.trackerServers = v);
		y = paragraph(ctx, x, y, w, "Achtung: Manche Server verbieten solche Hilfen. Vorher die Regeln lesen.", 0xFFE0C070);

		return y;
	}

	/** Auswahl wie Radio-Knoepfe: genau ein Typ pro Dimension. */
	private int targetGroup(GuiGraphicsExtractor ctx, int x, int y, int w, String title, ResourceKey<Level> dim) {
		TrackType[] types = TrackType.forDimension(dim);
		TrackType current = StructureTracker.targetType(dim);
		ctx.text(font, title, x + 2, y + 2, TEXT);
		y += 13;
		int cols = w >= 360 ? 3 : 2;
		int colW = (w - (cols - 1) * 4) / cols;
		for (int i = 0; i < types.length; i++) {
			TrackType t = types[i];
			int bx = x + (i % cols) * (colW + 4);
			int by = y + (i / cols) * 22;
			boolean sel = t == current;
			boolean hov = hovered(bx, by, colW, 20, true);
			roundRect(ctx, bx, by, colW, 20, sel ? 0xFF2E2A22 : hov ? 0xFF2C3744 : 0xFF1E262F);
			border(ctx, bx, by, colW, 20, sel ? (t.color | 0xFF000000) : hov ? 0xFF56677A : LINE);
			ctx.fill(bx + 1, by + 4, bx + 3, by + 16, t.color | 0xFF000000);
			ctx.pose().pushMatrix();
			ctx.pose().translate(bx + 5, by + 3);
			ctx.pose().scale(0.85f, 0.85f);
			ctx.item(t.icon(), 0, 0);
			ctx.pose().popMatrix();
			ctx.text(font, font.plainSubstrByWidth(t.label, colW - 32), bx + 22, by + 6, sel ? 0xFFFFFFFF : TEXT);
			if (sel) ctx.text(font, "●", bx + colW - 10, by + 6, t.color | 0xFF000000);
			hit(bx, by, colW, 20, true, () -> {
				StructureTracker.setTarget(dim, t);
				changed();
			});
		}
		return y + ((types.length + cols - 1) / cols) * 22 + 4;
	}

	// ------------------------------------------------------------------ Seiten: Makros

	/** Gelber Hinweis oben auf den Makro-Seiten. */
	private int warn(GuiGraphicsExtractor ctx, int x, int y, int w) {
		roundRect(ctx, x, y, w, 34, 0x40E0A030);
		border(ctx, x, y, w, 34, 0xFFE0A030);
		paragraph(ctx, x + 5, y + 4, w - 10, "Makros sind auf vielen Servern verboten. Nur dort benutzen, wo es erlaubt ist (Einzelspieler immer ok).", 0xFFFFD27A);
		return y + 40;
	}

	private int drawLunge(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
		y = warn(ctx, x, y, w);
		y = keyRow(ctx, x, y, w, "Taste für Lunge-Swap", VantageClient.lungeKey);
		y = paragraph(ctx, x, y, w, "Drückst du die Taste, wechselt die Mod im selben Moment auf den Speer, sticht mit Sprungangriff (Lunge) zu "
				+ "und wechselt sofort zurück. Halte vorher kurz ein anderes Item (z. B. Windladung) – dessen volle Aufladung wird für den Stoß benutzt.", GRAY);
		y = toggle(ctx, x, y, w, "Lunge-Swap an", c.lungeEnabled, v -> c.lungeEnabled = v);
		y = toggle(ctx, x, y, w, "Nur Speere mit Sprungangriff (Lunge) benutzen", c.lungeOnlyEnchanted, v -> c.lungeOnlyEnchanted = v);
		y = toggle(ctx, x, y, w, "Danach zurück zum alten Item", c.lungeReturn, v -> c.lungeReturn = v);
		y = slider(ctx, x, y, w, "Wartezeit vor dem Stoß", 0, 10, c.lungeDelay, 1,
				c.lungeDelay == 0 ? "sofort (empfohlen)" : ticks(c.lungeDelay), v -> c.lungeDelay = (int) v);
		if (c.lungeDelay > 0) {
			y = paragraph(ctx, x, y, w, "⚠ Mit Wartezeit setzt Minecraft die Aufladung zurück – der Stoß klappt dann meist nicht.", 0xFFFF7060);
		}
		y = slider(ctx, x, y, w, "Zurückwechseln nach", 0, 20, c.lungeReturnDelay, 1,
				c.lungeReturnDelay == 0 ? "sofort" : ticks(c.lungeReturnDelay), v -> c.lungeReturnDelay = (int) v);
		y = toggle(ctx, x, y, w, "Auch beim Werfen einer Windladung (Rechtsklick)", c.lungeAfterWind, v -> c.lungeAfterWind = v);
		return slider(ctx, x, y, w, "… Wartezeit nach dem Wurf", 0, 20, c.lungeAfterWindDelay, 1,
				c.lungeAfterWindDelay == 0 ? "sofort" : ticks(c.lungeAfterWindDelay), v -> c.lungeAfterWindDelay = (int) v);
	}

	private int drawMace(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
		y = warn(ctx, x, y, w);
		y = paragraph(ctx, x, y, w, "Schlägst du mit Schwert oder Axt zu, wechselt die Mod genau für diesen Schlag auf den Streitkolben (Mace) und danach zurück.", GRAY);
		y = toggle(ctx, x, y, w, "Attribut-Swap an", c.maceSwap, v -> c.maceSwap = v);
		y = keyRow(ctx, x, y, w, "Taste: an/aus schalten", VantageClient.maceToggleKey);
		y = toggle(ctx, x, y, w, "Nur beim Fallen (für den Smash-Angriff)", c.maceOnlyFalling, v -> c.maceOnlyFalling = v);
		y = slider(ctx, x, y, w, "Mindest-Fallhöhe", 0, 10, c.maceMinFall, 0.5, fmt(c.maceMinFall) + " Blöcke", v -> c.maceMinFall = (float) v);
		y = toggle(ctx, x, y, w, "Vom Schwert aus", c.maceFromSword, v -> c.maceFromSword = v);
		y = toggle(ctx, x, y, w, "Von der Axt aus", c.maceFromAxe, v -> c.maceFromAxe = v);
		return slider(ctx, x, y, w, "Zurückwechseln nach", 1, 10, c.maceReturnDelay, 1, ticks(c.maceReturnDelay), v -> c.maceReturnDelay = (int) v);
	}

	private int drawShield(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
		y = warn(ctx, x, y, w);
		y = toggle(ctx, x, y, w, "Blockt der Gegner mit Schild: für den Schlag auf die Axt wechseln", c.shieldBreaker, v -> c.shieldBreaker = v);
		y = keyRow(ctx, x, y, w, "Taste: an/aus schalten", VantageClient.shieldToggleKey);
		return paragraph(ctx, x, y + 2, w, "Eine Axt deaktiviert den Schild des Gegners für 5 Sekunden. Die Mod nimmt dafür kurz die Axt aus der Hotbar.", GRAY);
	}

	private int drawQuick(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
		y = warn(ctx, x, y, w);
		y = keyRow(ctx, x, y, w, "Enderperle werfen", VantageClient.pearlKey);
		y = keyRow(ctx, x, y, w, "Windladung werfen", VantageClient.windKey);
		y = toggle(ctx, x, y, w, "Nach dem Wurf zurückwechseln", c.quickReturn, v -> c.quickReturn = v);
		return paragraph(ctx, x, y + 2, w, "Taste ändern: auf den Knopf klicken und dann die gewünschte Taste (oder Maus-Seitentaste) drücken. "
				+ "Esc = Taste entfernen.", GRAY);
	}

	private static String ticks(int t) {
		return t + " Ticks (" + String.format("%.2f", t / 20.0).replace('.', ',') + " s)";
	}

	// ------------------------------------------------------------------ Seiten: Tasten, Kamera, HUD

	private int keyRow(GuiGraphicsExtractor ctx, int x, int y, int w, String label, KeyMapping key) {
		boolean wait = listening == key;
		int bw = Math.min(110, w / 2);
		ctx.text(font, font.plainSubstrByWidth(label, w - bw - 8), x + 3, y + 5, TEXT);
		button(ctx, x + w - bw, y, bw, 17, wait ? "> Taste drücken <" : keyName(key), wait, () -> listening = wait ? null : key);
		y += 19;
		if (!key.isUnbound() && minecraft != null) {
			for (KeyMapping other : minecraft.options.keyMappings) {
				// F3-Debug-Kombinationen (F3+B usw.) sind keine echten Konflikte
				if (other != key && other.same(key) && !other.getName().contains("debug")) {
					ctx.text(font, font.plainSubstrByWidth("⚠ Auch belegt: " + Component.translatable(other.getName()).getString(), w - 6),
							x + 3, y, 0xFFFF7060);
					y += 11;
					break;
				}
			}
		}
		return y + 1;
	}

	private int drawKeys(GuiGraphicsExtractor ctx, int x, int y, int w) {
		y = header(ctx, x, y, w, "Tasten (anklicken, dann Taste drücken)");
		y = keyRow(ctx, x, y, w, "Menü öffnen", VantageClient.menuKey);
		y = keyRow(ctx, x, y, w, "Inspect (Messer ansehen)", VantageClient.inspectKey);
		y = keyRow(ctx, x, y, w, "Lunge-Swap", VantageClient.lungeKey);
		y = keyRow(ctx, x, y, w, "Schnell-Enderperle", VantageClient.pearlKey);
		y = keyRow(ctx, x, y, w, "Schnell-Windladung", VantageClient.windKey);
		y = keyRow(ctx, x, y, w, "Attribut-Swap an/aus", VantageClient.maceToggleKey);
		y = keyRow(ctx, x, y, w, "Schild-Brecher an/aus", VantageClient.shieldToggleKey);
		y = keyRow(ctx, x, y, w, "Zoom (halten)", VantageClient.zoomKey);
		y = keyRow(ctx, x, y, w, "Tracker: jetzt suchen", VantageClient.trackerKey);
		y = keyRow(ctx, x, y, w, "Tracker: Ziel wechseln", VantageClient.trackerCycleKey);
		y = keyRow(ctx, x, y, w, "Freelook (umschauen)", VantageClient.freelookKey);
		y = keyRow(ctx, x, y, w, "Freecam an/aus", VantageClient.freecamKey);
		return paragraph(ctx, x, y + 2, w, "Esc während „Taste drücken“ = Taste entfernen. Maus-Seitentasten gehen auch.", GRAY);
	}

	private int drawCamera(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
		y = header(ctx, x, y, w, "Freelook");
		y = keyRow(ctx, x, y, w, "Taste", VantageClient.freelookKey);
		y = toggle(ctx, x, y, w, "Umschalten statt halten", c.freelookToggle, v -> c.freelookToggle = v);
		y = toggle(ctx, x, y, w, "In der dritten Person", c.freelookThirdPerson, v -> c.freelookThirdPerson = v);
		y = paragraph(ctx, x, y + 2, w, "Freelook dreht nur die Kamera um dich herum – du läufst weiter geradeaus.", GRAY);
		y = header(ctx, x, y + 2, w, "Freecam");
		y = keyRow(ctx, x, y, w, "Taste", VantageClient.freecamKey);
		y = slider(ctx, x, y, w, "Tempo", 0.2, 2.0, c.freecamSpeed, 0.1, fmt(c.freecamSpeed), v -> c.freecamSpeed = (float) v);
		return paragraph(ctx, x, y, w, "Fliegen mit W/A/S/D, Leertaste hoch, Schleichen runter, Sprinten schneller. "
				+ "Im Einzelspieler fliegt sie durch Blöcke (wie im Zuschauermodus), auf Servern nicht – dort wäre das wie X-Ray. "
				+ "Manche Server verbieten Freelook/Freecam – vorher die Regeln lesen.", GRAY);
	}

	private int drawCombo(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
		y = toggle(ctx, x, y, w, "Combo-Zähler (Treffer am Stück)", c.comboCounter, v -> c.comboCounter = v);
		y = toggle(ctx, x, y, w, "Reichweite des letzten Treffers", c.reachDisplay, v -> c.reachDisplay = v);
		return paragraph(ctx, x, y + 2, w, "Unter dem Fadenkreuz steht, wie viele Treffer du am Stück gelandet hast (ab 3 gelb, ab 5 orange, ab 10 rot). "
				+ "Wirst du selbst getroffen oder triffst 3 Sekunden nichts, geht er auf 0.", GRAY);
	}

	private int drawZoom(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
		y = keyRow(ctx, x, y, w, "Zoom (halten)", VantageClient.zoomKey);
		y = slider(ctx, x, y, w, "Zoom-Stärke", 1.5, 10, c.zoom, 0.5, fmt(c.zoom) + "×", v -> c.zoom = (float) v);
		return paragraph(ctx, x, y + 2, w, "Taste halten zum Heranzoomen, loslassen = normal.", GRAY);
	}

	private int drawInfo(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
		y = toggle(ctx, x, y, w, "Info-Anzeige oben links", c.hudInfo, v -> c.hudInfo = v);
		y = toggle(ctx, x, y, w, "FPS", c.hudFps, v -> c.hudFps = v);
		y = toggle(ctx, x, y, w, "CPS (Klicks pro Sekunde, links | rechts)", c.hudCps, v -> c.hudCps = v);
		y = toggle(ctx, x, y, w, "Koordinaten", c.hudCoords, v -> c.hudCoords = v);
		y = toggle(ctx, x, y, w, "Himmelsrichtung", c.hudDirection, v -> c.hudDirection = v);
		return toggle(ctx, x, y, w, "Ping (auf Servern)", c.hudPing, v -> c.hudPing = v);
	}

	// ------------------------------------------------------------------ Seite: GUI-Design

	/** Kleines Fenster mit Plaetzen in den Farben eines Designs. */
	private static void guiPreview(GuiGraphicsExtractor ctx, int x, int y, int w, int h, int[] pal, int label) {
		ctx.fill(x, y, x + w, y + h, pal[0]);
		ctx.fill(x + 1, y + 1, x + w - 1, y + h - 1, pal[4]);
		ctx.fill(x + 1, y + 1, x + w - 1, y + 2, pal[5]);
		ctx.fill(x + 1, y + 1, x + 2, y + h - 1, pal[5]);
		ctx.fill(x + 1, y + h - 2, x + w - 1, y + h - 1, pal[2]);
		ctx.fill(x + w - 2, y + 1, x + w - 1, y + h - 1, pal[2]);
		ctx.fill(x + 4, y + 4, x + 4 + Math.min(22, w / 3), y + 6, label);
		int n = Math.max(1, (w - 6) / 11);
		int sx0 = x + (w - n * 11 + 1) / 2;
		int sy = y + h - 14;
		for (int i = 0; i < n; i++) {
			int sx = sx0 + i * 11;
			ctx.fill(sx, sy, sx + 10, sy + 10, pal[5]);
			ctx.fill(sx, sy, sx + 9, sy + 9, pal[1]);
			ctx.fill(sx + 1, sy + 1, sx + 9, sy + 9, pal[3]);
		}
	}

	private int drawGui(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
		y = header(ctx, x, y, w, "Kisten, Öfen, Crafter, Braustand & Inventar");
		y = paragraph(ctx, x, y, w, "Färbt alle Fenster mit Plätzen um: Kisten, Fässer, Shulker, Öfen, Crafter, Braustand, Trichter, "
				+ "Werkbank, Amboss, Verzauberungstisch, Inventar und Kreativ-Inventar. Funktioniert auch auf Servern.", GRAY);
		int cols = w >= 330 ? 5 : 3;
		int cellW = (w - (cols - 1) * 4) / cols;
		int cellH = 48;
		for (int i = 0; i < GuiThemes.NAMES.length; i++) {
			int bx = x + (i % cols) * (cellW + 4);
			int by = y + (i / cols) * (cellH + 4);
			boolean sel = c.guiTheme == i;
			boolean hov = hovered(bx, by, cellW, cellH, true);
			roundRect(ctx, bx, by, cellW, cellH, sel ? accentDim : hov ? 0xFF2C3744 : 0xFF1E262F);
			border(ctx, bx, by, cellW, cellH, sel ? accent : hov ? mix(LINE, accent, 0.6f) : LINE);
			guiPreview(ctx, bx + 4, by + 4, cellW - 8, 27, GuiThemes.palette(i), i == 0 ? 0xFF404040 : 0xFFDDE3EB);
			ctx.centeredText(font, font.plainSubstrByWidth(GuiThemes.NAMES[i], cellW - 4), bx + cellW / 2, by + cellH - 12,
					sel || hov ? 0xFFFFFFFF : TEXT);
			int idx = i;
			hit(bx, by, cellW, cellH, true, () -> {
				c.guiTheme = idx;
				changed();
				if (minecraft != null) GuiThemes.ensure(minecraft);
			});
		}
		y += ((GuiThemes.NAMES.length + cols - 1) / cols) * (cellH + 4) + 2;
		button(ctx, x, y, Math.min(180, w), 18, "▶ Im Inventar ansehen", false, () -> {
			if (minecraft != null && minecraft.player != null) {
				VantageConfig.save();
				dirty = false;
				minecraft.gui.setScreen(new InventoryScreen(minecraft.player));
			}
		});
		y += 26;

		y = header(ctx, x, y, w, "Hotbar");
		int hc = w >= 330 ? 3 : 2;
		int hw = (w - (hc - 1) * 4) / hc;
		int hh = 40;
		float demo = (float) ((Math.sin(time * 1.2) * 0.5 + 0.5) * 8);
		for (int i = 0; i < Hotbar.STYLES.length; i++) {
			int bx = x + (i % hc) * (hw + 4);
			int by = y + (i / hc) * (hh + 4);
			boolean sel = c.hotbarStyle == i;
			boolean hov = hovered(bx, by, hw, hh, true);
			roundGradient(ctx, bx, by, hw, hh, 0xFF6FA8DC, 0xFF5E8A3C);
			if (sel) Draw.glow(ctx, bx, by, hw, hh, accent, 0x70, 2);
			border(ctx, bx, by, hw, hh, sel ? accent : hov ? mix(LINE, accent, 0.6f) : LINE);
			float s = (hw - 10) / 182f;
			ctx.pose().pushMatrix();
			ctx.pose().translate(bx + 5, by + 5);
			ctx.pose().scale(s, s);
			Hotbar.drawFrame(ctx, 0, 0, i, c.hotbarSmooth ? demo : Math.round(demo), c.hotbarNumbers, Integer.MIN_VALUE);
			Item[] sample = {Items.NETHERITE_SWORD, Items.BOW, Items.ENDER_PEARL, Items.GOLDEN_APPLE, Items.COBBLESTONE};
			for (int k = 0; k < sample.length; k++) ctx.item(new ItemStack(sample[k]), 3 + k * 20, 3);
			ctx.pose().popMatrix();
			ctx.centeredText(font, Hotbar.STYLES[i], bx + hw / 2, by + hh - 11, 0xFFFFFFFF);
			int idx = i;
			hit(bx, by, hw, hh, true, () -> {
				c.hotbarStyle = idx;
				changed();
			});
		}
		y += ((Hotbar.STYLES.length + hc - 1) / hc) * (hh + 4) + 2;
		y = toggle(ctx, x, y, w, "Zahlen 1–9 auf den Plätzen", c.hotbarNumbers, v -> c.hotbarNumbers = v);
		y = toggle(ctx, x, y, w, "Auswahl gleitet weich zum neuen Platz", c.hotbarSmooth, v -> c.hotbarSmooth = v);

		y = header(ctx, x, y + 2, w, "Menü-Farbe");
		int tw = (w - 10) / 3;
		for (int i = 0; i < THEMES.length; i++) {
			int ti = i;
			int bx = x + (i % 3) * (tw + 5);
			int by = y + (i / 3) * 22;
			boolean sel = Math.floorMod(c.menuTheme, THEMES.length) == i;
			button(ctx, bx, by, tw, 19, "    " + THEME_NAMES[i], sel, () -> {
				c.menuTheme = ti;
				changed();
				if (minecraft != null) GuiThemes.ensure(minecraft);
			});
			roundRect(ctx, bx + 5, by + 5, 9, 9, THEMES[i]);
		}
		y += 46;
		return paragraph(ctx, x, y, w, "Die Menü-Farbe gilt auch für die Hotbar und das Design „Menü-Farbe“.", GRAY);
	}

	// ------------------------------------------------------------------ Seite: Brau-Helfer

	private int drawBrew(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
		y = toggle(ctx, x, y, w, "Rezepte neben dem Braustand zeigen", c.brewHelper, v -> c.brewHelper = v);
		y = paragraph(ctx, x, y + 2, w, "Öffnest du einen Braustand, steht links daneben eine Liste mit allen Tränken: welche Zutat in welchen Trank kommt. "
				+ "Mausrad = scrollen, Maus drauf = genaue Infos.", GRAY);
		int[][] dots = {{0xFF4CD07D}, {0xFFE0402A}, {0xFFFFD84A}};
		String[] what = {"Grüner Punkt: diese Zutat hast du dabei", "Roter Punkt: mit Redstone hält der Trank länger",
				"Gelber Punkt: mit Glowstonestaub wird er stärker"};
		for (int i = 0; i < what.length; i++) {
			roundRect(ctx, x + 4, y + 2, 5, 5, dots[i][0]);
			ctx.text(font, font.plainSubstrByWidth(what[i], w - 16), x + 14, y, TEXT);
			y += 12;
		}
		return paragraph(ctx, x, y + 4, w, "Die Rezepte kommen direkt aus dem Spiel – sie stimmen also immer, auch auf Servern.", 0xFF8FD18F);
	}

	// ------------------------------------------------------------------ Seiten: neue HUD-Module

	/** Wo auf dem Bildschirm (6 Plaetze als Knoepfe). */
	private int positionPicker(GuiGraphicsExtractor ctx, int x, int y, int w, int current, IntConsumer set) {
		ctx.text(font, "Platz auf dem Bildschirm", x + 3, y + 1, TEXT);
		y += 12;
		int bw = (w - 4) / 3;
		for (int i = 0; i < HudModules.POSITIONS.length; i++) {
			int idx = i;
			button(ctx, x + (i % 3) * (bw + 2), y + (i / 3) * 18, bw, 16, HudModules.POSITIONS[i], current == i, () -> {
				set.accept(idx);
				changed();
			});
		}
		return y + 38;
	}

	/** Farbfelder zum Anklicken. */
	private int swatches(GuiGraphicsExtractor ctx, int x, int y, int[] colors, int current, IntConsumer set) {
		for (int i = 0; i < colors.length; i++) {
			int col = colors[i];
			int sx = x + 2 + i * 21;
			boolean sel = (current & 0xFFFFFF) == (col & 0xFFFFFF);
			boolean hov = hovered(sx, y, 16, 16, true);
			roundRect(ctx, sx, y, 16, 16, 0xFF000000 | col);
			if (col == 0xFF000000) border(ctx, sx, y, 16, 16, 0x60FFFFFF);
			if (sel) border(ctx, sx - 2, y - 2, 20, 20, 0xFFFFFFFF);
			else if (hov) border(ctx, sx - 1, y - 1, 18, 18, 0xA0FFFFFF);
			hit(sx, y, 16, 16, true, () -> {
				set.accept(col);
				changed();
			});
		}
		return y + 22;
	}

	private int drawKeystrokes(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
		y = toggle(ctx, x, y, w, "Tasten-Anzeige an", c.keystrokes, v -> c.keystrokes = v);
		y = positionPicker(ctx, x, y, w, c.keystrokesPos, v -> c.keystrokesPos = v);
		y = slider(ctx, x, y, w, "Größe", 0.5, 2.0, c.keystrokesScale, 0.1, Math.round(c.keystrokesScale * 100) + " %", v -> c.keystrokesScale = (float) v);
		return paragraph(ctx, x, y + 2, w, "Zeigt W, A, S, D, die Leertaste und die Maustasten mit Klicks pro Sekunde (CPS). "
				+ "Gedrückte Tasten leuchten in deiner Menü-Farbe – praktisch für Videos.", GRAY);
	}

	private int drawArmor(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
		y = toggle(ctx, x, y, w, "Rüstung & Haltbarkeit an", c.armorHud, v -> c.armorHud = v);
		y = positionPicker(ctx, x, y, w, c.armorPos, v -> c.armorPos = v);
		y = toggle(ctx, x, y, w, "Pfeile, Perlen, Totems und goldene Äpfel zählen", c.armorCounts, v -> c.armorCounts = v);
		return paragraph(ctx, x, y + 2, w, "Zeigt deine Rüstung und die Items in den Händen mit der Haltbarkeit: grün = gut, gelb = halb, "
				+ "rot = fast kaputt. Unter 10 % blinkt die Zahl.", GRAY);
	}

	private int drawPotions(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
		y = toggle(ctx, x, y, w, "Trank-Timer an", c.potionHud, v -> c.potionHud = v);
		y = positionPicker(ctx, x, y, w, c.potionPos, v -> c.potionPos = v);
		y = toggle(ctx, x, y, w, "Symbole oben rechts vom Spiel ausblenden", c.potionHideVanilla, v -> c.potionHideVanilla = v);
		return paragraph(ctx, x, y + 2, w, "Zeigt alle aktiven Effekte mit Stufe und Restzeit. In den letzten 10 Sekunden blinkt die Zeit rot.", GRAY);
	}

	private int drawWaypoints(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
		y = toggle(ctx, x, y, w, "Ziel oben in der Mitte anzeigen (Pfeil + Entfernung)", c.waypoints, v -> c.waypoints = v);
		y = toggle(ctx, x, y, w, "Todespunkt automatisch merken", c.deathPoint, v -> c.deathPoint = v);
		y = toggle(ctx, x, y, w, "Lichtsäule über dem Ziel", c.waypointBeam, v -> c.waypointBeam = v);
		y = keyRow(ctx, x, y, w, "Taste: Wegpunkt hier setzen", VantageClient.waypointKey);
		if (minecraft == null || minecraft.level == null || minecraft.player == null || Waypoints.worldKey(minecraft) == null) {
			return paragraph(ctx, x, y + 2, w, "Wegpunkte gibt es, sobald du in einer Welt oder auf einem Server bist.", 0xFFE0C070);
		}
		button(ctx, x, y, Math.min(160, w), 18, "+ Hier setzen", false, () -> Waypoints.addHere(minecraft));
		y += 24;
		y = header(ctx, x, y, w, "Gespeicherte Orte");
		List<Waypoints.Point> points = Waypoints.list(minecraft);
		if (points.isEmpty()) return paragraph(ctx, x, y, w, "Noch keine Wegpunkte.", GRAY);
		Waypoints.Point active = Waypoints.active(minecraft);
		for (Waypoints.Point p : points) {
			boolean isActive = active != null && active.name().equals(p.name());
			boolean hov = hovered(x, y, w, 20, true);
			roundRect(ctx, x, y, w, 20, isActive ? alpha(p.color(), 0x30) : hov ? 0x18FFFFFF : 0x0CFFFFFF);
			roundRect(ctx, x + 4, y + 6, 8, 8, p.color());
			String where = p.x() + " " + p.y() + " " + p.z() + "  " + Waypoints.dimName(p.dim());
			ctx.text(font, font.plainSubstrByWidth(p.name(), 80), x + 16, y + 6, 0xFFFFFFFF);
			ctx.text(font, font.plainSubstrByWidth(where, w - 180), x + 100, y + 6, GRAY);
			button(ctx, x + w - 78, y + 2, 54, 16, isActive ? "Ziel ✔" : "Zeigen", isActive, () -> Waypoints.setActive(minecraft, isActive ? null : p));
			button(ctx, x + w - 22, y + 2, 20, 16, "✕", false, () -> Waypoints.remove(minecraft, p));
			y += 22;
		}
		return y;
	}

	// ------------------------------------------------------------------ Seiten: Extras

	private int drawOutline(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
		y = header(ctx, x, y, w, "Blockrahmen");
		y = toggle(ctx, x, y, w, "Eigene Farbe für den Rahmen um den angeschauten Block", c.outlineCustom, v -> c.outlineCustom = v);
		y = swatches(ctx, x, y + 2, Extras.COLORS, c.outlineColor, v -> {
			c.outlineColor = v;
			c.outlineCustom = true;
		});
		y = slider(ctx, x, y, w, "Dicke", 1, 6, c.outlineWidth, 0.5, fmt(c.outlineWidth), v -> c.outlineWidth = (float) v);
		y = header(ctx, x, y + 2, w, "Treffer-Farbe");
		y = toggle(ctx, x, y, w, "Getroffene Gegner leuchten in dieser Farbe statt rot", c.hitColorCustom, v -> c.hitColorCustom = v);
		y = swatches(ctx, x, y + 2, Extras.COLORS, c.hitColor, v -> {
			c.hitColor = 0x99000000 | (v & 0xFFFFFF);
			c.hitColorCustom = true;
		});
		return paragraph(ctx, x, y + 2, w, "Nur auf deinem Bildschirm – andere Spieler sehen nichts davon.", GRAY);
	}

	private int drawKill(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
		y = toggle(ctx, x, y, w, "Kill-Effekte an", c.killEffects, v -> c.killEffects = v);
		int bw = (w - 6) / 4;
		for (int i = 0; i < KillEffects.NAMES.length; i++) {
			int idx = i;
			button(ctx, x + i * (bw + 2), y, bw, 18, KillEffects.NAMES[i], c.killEffect == i, () -> {
				c.killEffect = idx;
				c.killEffects = true;
				changed();
			});
		}
		y += 24;
		y = toggle(ctx, x, y, w, "Mit Geräusch", c.killSound, v -> c.killSound = v);
		if (minecraft != null && minecraft.player != null && minecraft.level != null) {
			button(ctx, x, y + 2, Math.min(160, w), 18, "▶ Vorschau", false, () -> {
				var look = minecraft.player.getLookAngle();
				KillEffects.play(minecraft, minecraft.player.getEyePosition().add(look.x * 4, look.y * 4 - 0.5, look.z * 4), c.killEffect);
			});
			y += 26;
		}
		return paragraph(ctx, x, y + 2, w, "Besiegst du einen Gegner, den du kurz vorher getroffen hast, gibt es den Effekt an seiner Stelle. "
				+ "Nur auf deinem Bildschirm – andere sehen nichts.", GRAY);
	}

	private int drawChat(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
		y = toggle(ctx, x, y, w, "Uhrzeit vor jeder Nachricht", c.chatTimestamps, v -> c.chatTimestamps = v);
		y = toggle(ctx, x, y, w, "Gleiche Nachrichten zusammenfassen (x2, x3 …)", c.chatStack, v -> c.chatStack = v);
		y = toggle(ctx, x, y, w, "Längerer Verlauf (1000 statt 100 Nachrichten)", c.chatLongHistory, v -> c.chatLongHistory = v);
		return paragraph(ctx, x, y + 2, w, "Gilt für neue Nachrichten. Spam von Servern wird so zu einer Zeile mit Zähler.", GRAY);
	}
}
