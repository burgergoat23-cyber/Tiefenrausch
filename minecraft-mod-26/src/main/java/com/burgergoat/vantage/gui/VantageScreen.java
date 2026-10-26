package com.burgergoat.vantage.gui;

import com.burgergoat.vantage.VantageClient;
import com.burgergoat.vantage.config.VantageConfig;
import com.burgergoat.vantage.feature.Crosshair;
import com.burgergoat.vantage.feature.Filters;
import com.burgergoat.vantage.feature.Viewmodel;
import com.burgergoat.vantage.skin.SkinCatalog;
import com.burgergoat.vantage.skin.SkinManager;
import com.burgergoat.vantage.skin.SkinPacks;
import com.burgergoat.vantage.feature.TrackerCard;
import com.burgergoat.vantage.tracker.SeedStore;
import com.burgergoat.vantage.tracker.Site;
import com.burgergoat.vantage.tracker.StructureTracker;
import com.burgergoat.vantage.tracker.TrackType;
import com.mojang.blaze3d.platform.InputConstants;
import org.jetbrains.annotations.Nullable;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.function.Consumer;
import java.util.function.DoubleConsumer;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.client.resources.sounds.SimpleSoundInstance;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceKey;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.util.FormattedCharSequence;
import net.minecraft.util.Mth;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.Level;

/** Das Vantage-Client-Menue (Taste K). */
public class VantageScreen extends Screen {
	private static final int BG = 0xF0121820;
	private static final int PANEL = 0xFF19212B;
	private static final int LINE = 0xFF34404E;
	private static final int ACCENT = 0xFFE8A33D;
	private static final int TEXT = 0xFFE3E7EC;
	private static final int GRAY = 0xFF98A2AE;

	public static final String[] TABS = {"Skins", "Pakete", "Fadenkreuz", "Viewmodel", "Shader", "Tracker", "Makros", "Tasten & HUD"};
	private static final Item[] TAB_ICONS = {Items.NETHERITE_SWORD, Items.BUNDLE, Items.TARGET, Items.ARMOR_STAND, Items.ENDER_EYE, Items.COMPASS, Items.REDSTONE, Items.CLOCK};

	private static int tab;
	private static String skinCat = "knife";
	private static String skinTarget = "*";
	private static String skinShape;

	private record Hit(int x, int y, int w, int h, boolean content, @Nullable Runnable click, @Nullable DoubleConsumer drag) {
	}

	private final List<Hit> hits = new ArrayList<>();
	private Hit dragging;
	private double mx;
	private double my;
	private int scroll;
	private int contentHeight;
	private int px, py, pw, ph;
	private int cx, cy, cw, ch;
	private boolean dirty;
	private List<Component> tooltip;
	private final Random random = new Random();
	/** Tastenbelegung, die gerade auf einen Tastendruck wartet. */
	private KeyMapping listening;

	public VantageScreen() {
		super(Component.literal("Vantage Client"));
	}

	public static void setTab(int t) {
		tab = Mth.clamp(t, 0, TABS.length - 1);
	}

	@Override
	public boolean isPauseScreen() {
		return false;
	}

	@Override
	public void extractBackground(GuiGraphicsExtractor ctx, int mouseX, int mouseY, float deltaTicks) {
		// Im Viewmodel-Reiter frei lassen, damit man die Hand live sieht
		if (tab != 3) ctx.fill(0, 0, width, height, 0x60000000);
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
		if (click.button() == 0) {
			for (int i = hits.size() - 1; i >= 0; i--) {
				Hit h = hits.get(i);
				if (mx < h.x || my < h.y || mx >= h.x + h.w || my >= h.y + h.h) continue;
				if (h.content && (my < cy || my >= cy + ch)) continue;
				if (h.drag != null) {
					dragging = h;
					h.drag.accept(mx);
				} else if (h.click != null) {
					playClick(1f);
					h.click.run();
				}
				return true;
			}
		}
		return super.mouseClicked(click, doubled);
	}

	@Override
	public boolean mouseDragged(MouseButtonEvent click, double offsetX, double offsetY) {
		if (dragging != null) {
			updateMouse();
			dragging.drag.accept(mx);
			return true;
		}
		return super.mouseDragged(click, offsetX, offsetY);
	}

	@Override
	public boolean mouseReleased(MouseButtonEvent click) {
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
	}

	// ------------------------------------------------------------------ Zeichnen

	@Override
	public void extractRenderState(GuiGraphicsExtractor ctx, int mouseX, int mouseY, float deltaTicks) {
		super.extractRenderState(ctx, mouseX, mouseY, deltaTicks);
		mx = mouseX;
		my = mouseY;
		hits.clear();
		tooltip = null;

		pw = Math.min(width - 12, 480);
		ph = Math.min(height - 12, 330);
		px = (width - pw) / 2;
		py = (height - ph) / 2;
		if (tab == 3) {
			// Viewmodel: Menue nach links, rechts bleibt die Hand sichtbar
			pw = Math.min(pw, Math.max(280, width * 11 / 20));
			px = 6;
		}
		cx = px + 102;
		cy = py + 30;
		cw = pw - 110;
		ch = ph - 36;

		ctx.fill(px - 1, py - 1, px + pw + 1, py + ph + 1, 0xFF0A0D11);
		ctx.fill(px, py, px + pw, py + ph, BG);
		ctx.fillGradient(px, py, px + pw, py + 24, 0xFF26303C, 0xFF1A222C);
		ctx.fill(px, py + 24, px + pw, py + 25, ACCENT);
		ctx.pose().pushMatrix();
		ctx.pose().translate(px + 8, py + 6);
		ctx.pose().scale(1.5f, 1.5f);
		ctx.text(font, "VANTAGE", 0, 0, ACCENT);
		ctx.pose().popMatrix();
		ctx.text(font, "CLIENT  •  Skins • Makros • Tracker", px + 76, py + 9, GRAY);

		// Schliessen
		int bx = px + pw - 20;
		boolean hovClose = hovered(bx, py + 4, 16, 16, false);
		ctx.fill(bx, py + 4, bx + 16, py + 20, hovClose ? 0xFFB03030 : 0xFF2A333E);
		ctx.centeredText(font, "✕", bx + 8, py + 8, 0xFFFFFFFF);
		hit(bx, py + 4, 16, 16, false, this::onClose);

		// Reiter
		for (int i = 0; i < TABS.length; i++) {
			int ty = py + 30 + i * 23;
			int tx = px + 5;
			boolean sel = i == tab;
			boolean hov = hovered(tx, ty, 92, 21, false);
			ctx.fill(tx, ty, tx + 92, ty + 21, sel ? 0xFF2E3A48 : hov ? 0xFF222B36 : 0xFF181F27);
			if (sel) ctx.fill(tx, ty, tx + 2, ty + 21, ACCENT);
			ctx.item(new ItemStack(TAB_ICONS[i]), tx + 4, ty + 2);
			ctx.text(font, TABS[i], tx + 23, ty + 7, sel ? 0xFFFFFFFF : TEXT);
			int idx = i;
			hit(tx, ty, 92, 21, false, () -> {
				tab = idx;
				scroll = 0;
			});
		}

		// Inhalt
		ctx.fill(cx - 4, cy - 2, cx + cw + 2, cy + ch, PANEL);
		ctx.enableScissor(cx - 4, cy - 2, cx + cw + 2, cy + ch);
		int top = cy + 2 - scroll;
		int end = switch (tab) {
			case 0 -> drawSkins(ctx, cx, top, cw - 6);
			case 1 -> drawPacks(ctx, cx, top, cw - 6);
			case 2 -> drawCrosshair(ctx, cx, top, cw - 6);
			case 3 -> drawViewmodel(ctx, cx, top, cw - 6);
			case 4 -> drawFilters(ctx, cx, top, cw - 6);
			case 5 -> drawTracker(ctx, cx, top, cw - 6);
			case 6 -> drawMacros(ctx, cx, top, cw - 6);
			default -> drawHud(ctx, cx, top, cw - 6);
		};
		ctx.disableScissor();
		contentHeight = end - top + 6;
		int max = Math.max(0, contentHeight - ch);
		if (scroll > max) scroll = max;
		if (max > 0) {
			int barH = Math.max(16, ch * ch / contentHeight);
			int barY = cy + (int) ((ch - barH) * (scroll / (double) max));
			ctx.fill(cx + cw - 2, cy, cx + cw, cy + ch, 0x40FFFFFF);
			ctx.fill(cx + cw - 2, barY, cx + cw, barY + barH, ACCENT);
		}
		if (tooltip != null) ctx.setComponentTooltipForNextFrame(font, tooltip, mouseX, mouseY);
	}

	// ------------------------------------------------------------------ Bausteine

	private boolean hovered(int x, int y, int w, int h, boolean content) {
		if (mx < x || my < y || mx >= x + w || my >= y + h) return false;
		return !content || (my >= cy && my < cy + ch);
	}

	private void hit(int x, int y, int w, int h, boolean content, Runnable click) {
		hits.add(new Hit(x, y, w, h, content, click, null));
	}

	private void border(GuiGraphicsExtractor ctx, int x, int y, int w, int h, int color) {
		ctx.fill(x, y, x + w, y + 1, color);
		ctx.fill(x, y + h - 1, x + w, y + h, color);
		ctx.fill(x, y, x + 1, y + h, color);
		ctx.fill(x + w - 1, y, x + w, y + h, color);
	}

	private void button(GuiGraphicsExtractor ctx, int x, int y, int w, int h, String label, boolean active, Runnable click) {
		boolean hov = hovered(x, y, w, h, true);
		ctx.fill(x, y, x + w, y + h, active ? 0xFF5A4220 : hov ? 0xFF2C3744 : 0xFF222B35);
		border(ctx, x, y, w, h, active ? ACCENT : hov ? 0xFF56677A : LINE);
		String s = font.plainSubstrByWidth(label, w - 6);
		ctx.centeredText(font, s, x + w / 2, y + (h - 8) / 2, active ? 0xFFFFFFFF : TEXT);
		hit(x, y, w, h, true, click);
	}

	private int header(GuiGraphicsExtractor ctx, int x, int y, int w, String text) {
		ctx.text(font, text, x, y + 3, ACCENT);
		ctx.fill(x, y + 13, x + w, y + 14, LINE);
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
		if (hov) ctx.fill(x, y, x + w, y + 15, 0x18FFFFFF);
		ctx.text(font, font.plainSubstrByWidth(label, w - 32), x + 3, y + 4, TEXT);
		int sx = x + w - 26;
		ctx.fill(sx, y + 4, sx + 22, y + 11, value ? 0xFF3FAF5A : 0xFF4A525C);
		int kx = value ? sx + 13 : sx + 1;
		ctx.fill(kx, y + 2, kx + 8, y + 13, 0xFFF2F2F2);
		hit(x, y, w, 15, true, () -> {
			set.accept(!value);
			changed();
		});
		return y + 17;
	}

	private int slider(GuiGraphicsExtractor ctx, int x, int y, int w, String label, double min, double max, double value, double step,
			String text, DoubleConsumer set) {
		ctx.text(font, label, x + 3, y + 1, TEXT);
		ctx.text(font, text, x + w - font.width(text) - 3, y + 1, ACCENT);
		int bx = x + 4;
		int bw = w - 8;
		int by = y + 13;
		double f = Mth.clamp((value - min) / (max - min), 0, 1);
		ctx.fill(bx, by + 2, bx + bw, by + 5, LINE);
		ctx.fill(bx, by + 2, bx + (int) (bw * f), by + 5, ACCENT);
		int kx = bx + (int) (bw * f);
		boolean hov = hovered(bx - 3, by - 2, bw + 6, 11, true);
		ctx.fill(kx - 2, by, kx + 3, by + 7, hov ? 0xFFFFFFFF : 0xFFDADADA);
		hits.add(new Hit(bx - 3, by - 2, bw + 6, 11, true, null, mouse -> {
			double ff = Mth.clamp((mouse - bx) / bw, 0, 1);
			double v = min + ff * (max - min);
			v = Math.round(v / step) * step;
			set.accept(Mth.clamp(v, min, max));
			changed();
		}));
		return y + 25;
	}

	private void itemCell(GuiGraphicsExtractor ctx, int x, int y, int size, ItemStack stack, int rarityColor, boolean selected, @Nullable List<Component> tip, Runnable click) {
		boolean hov = hovered(x, y, size, size, true);
		ctx.fill(x, y, x + size, y + size, hov ? 0xFF2D3846 : 0xFF1E262F);
		ctx.fill(x, y + size - 2, x + size, y + size, rarityColor);
		if (selected) border(ctx, x, y, size, size, ACCENT);
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
			ctx.fill(bx, by, bx + chipW, by + 19, sel ? 0xFF5A4220 : hov ? 0xFF2C3744 : 0xFF222B35);
			border(ctx, bx, by, chipW, 19, sel ? ACCENT : LINE);
			ItemStack icon = SkinManager.preview(null, baseItem(cat, "*"));
			ctx.item(icon, bx + 2, by + 1);
			ctx.text(font, font.plainSubstrByWidth(cat.name, chipW - 22), bx + 20, by + 6, sel ? 0xFFFFFFFF : TEXT);
			String id = cat.id;
			hit(bx, by, chipW, 19, true, () -> select.accept(id));
			i++;
		}
		return y + ((i + perRow - 1) / perRow) * 21 + 3;
	}

	// ------------------------------------------------------------------ Reiter: Skins

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
				ctx.fill(bx, y, bx + 19, y + 19, sel ? 0xFF5A4220 : hov ? 0xFF2C3744 : 0xFF222B35);
				border(ctx, bx, y, 19, 19, sel ? ACCENT : LINE);
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
						List.of(Component.literal(s.name()).withColor(ACCENT)), () -> {
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
		ctx.fillGradient(x, y, x + 74, y + boxH, 0xFF2A3442, 0xFF141A21);
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

	// ------------------------------------------------------------------ Reiter: Pakete

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
			ctx.fillGradient(bx, by, bx + colW, by + cardH, active ? 0xFF4A3A1C : hov ? 0xFF2C3744 : 0xFF222B35, 0xFF161C23);
			border(ctx, bx, by, colW, cardH, active ? ACCENT : hov ? 0xFF56677A : LINE);
			ctx.text(font, pack.name() + (active ? "  ✔" : ""), bx + 5, by + 4, active ? ACCENT : 0xFFFFFFFF);
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

	// ------------------------------------------------------------------ Reiter: Fadenkreuz

	private int drawCrosshair(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
		int boxW = 96;
		int lw = w - boxW - 8;
		int bx = x + w - boxW;
		ctx.fillGradient(bx, y, bx + boxW, y + boxW, 0xFF7DB3E6, 0xFF4E7A3C);
		ctx.fill(bx, y + boxW * 2 / 3, bx + boxW, y + boxW, 0xFF5A7F3A);
		border(ctx, bx, y, boxW, boxW, LINE);
		Crosshair.draw(ctx, bx + boxW / 2, y + boxW / 2, 0);
		ctx.centeredText(font, "Vorschau", bx + boxW / 2, y + boxW + 3, GRAY);

		int yy = y;
		yy = toggle(ctx, x, yy, lw, "Eigenes Fadenkreuz benutzen", c.chEnabled, v -> c.chEnabled = v);
		int sw = (lw - 2) / 2;
		for (int i = 0; i < Crosshair.STYLES.length; i++) {
			int idx = i;
			button(ctx, x + (i % 2) * (sw + 2), yy + (i / 2) * 18, sw, 16, Crosshair.STYLES[i], c.chStyle == i, () -> {
				c.chStyle = idx;
				changed();
			});
		}
		yy += 38;
		ctx.text(font, "Farbe", x + 3, yy + 4, GRAY);
		int swatch = Math.max(10, Math.min(15, (lw - 40) / Crosshair.COLORS.length - 2));
		for (int i = 0; i < Crosshair.COLORS.length; i++) {
			int col = Crosshair.COLORS[i];
			int sx = x + 38 + i * (swatch + 2);
			ctx.fill(sx, yy, sx + swatch, yy + swatch, 0xFF000000 | col);
			if ((c.chColor & 0xFFFFFF) == col) border(ctx, sx - 1, yy - 1, swatch + 2, swatch + 2, 0xFFFFFFFF);
			hit(sx, yy, swatch, swatch, true, () -> {
				c.chColor = col;
				changed();
			});
		}
		yy += 20;
		y = Math.max(yy, y + boxW + 14);
		y = slider(ctx, x, y, w, "Rot", 0, 255, (c.chColor >> 16) & 255, 1, String.valueOf((c.chColor >> 16) & 255),
				v -> c.chColor = (c.chColor & 0x00FFFF) | ((int) v << 16));
		y = slider(ctx, x, y, w, "Grün", 0, 255, (c.chColor >> 8) & 255, 1, String.valueOf((c.chColor >> 8) & 255),
				v -> c.chColor = (c.chColor & 0xFF00FF) | ((int) v << 8));
		y = slider(ctx, x, y, w, "Blau", 0, 255, c.chColor & 255, 1, String.valueOf(c.chColor & 255),
				v -> c.chColor = (c.chColor & 0xFFFF00) | (int) v);
		y = slider(ctx, x, y, w, "Länge", 0, 15, c.chLength, 0.5, fmt(c.chLength), v -> c.chLength = (float) v);
		y = slider(ctx, x, y, w, "Dicke", 0.5, 5, c.chThickness, 0.5, fmt(c.chThickness), v -> c.chThickness = (float) v);
		y = slider(ctx, x, y, w, "Lücke", -3, 10, c.chGap, 0.5, fmt(c.chGap), v -> c.chGap = (float) v);
		y = slider(ctx, x, y, w, "Deckkraft", 30, 255, c.chAlpha, 5, Math.round(c.chAlpha / 2.55) + " %", v -> c.chAlpha = (int) v);
		y = toggle(ctx, x, y, w, "Punkt in der Mitte", c.chDot, v -> c.chDot = v);
		y = toggle(ctx, x, y, w, "Schwarze Umrandung", c.chOutline, v -> c.chOutline = v);
		y = toggle(ctx, x, y, w, "Dynamisch (geht beim Laufen/Angreifen auf)", c.chDynamic, v -> c.chDynamic = v);
		y = toggle(ctx, x, y, w, "Angriffs-Abklingzeit unter dem Fadenkreuz", c.chCooldown, v -> c.chCooldown = v);
		button(ctx, x, y + 2, 110, 18, "Zurücksetzen", false, () -> {
			VantageConfig d = new VantageConfig();
			c.chStyle = d.chStyle;
			c.chColor = d.chColor;
			c.chAlpha = d.chAlpha;
			c.chLength = d.chLength;
			c.chThickness = d.chThickness;
			c.chGap = d.chGap;
			c.chDot = d.chDot;
			c.chOutline = d.chOutline;
			c.chDynamic = d.chDynamic;
			changed();
		});
		return y + 24;
	}

	private static String fmt(double v) {
		return String.format("%.1f", v).replace('.', ',');
	}

	// ------------------------------------------------------------------ Reiter: Viewmodel

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

	// ------------------------------------------------------------------ Reiter: Shader

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
			ctx.fill(bx, by, bx + colW, by + 29, sel ? 0xFF5A4220 : hov ? 0xFF2C3744 : 0xFF222B35);
			border(ctx, bx, by, colW, 29, sel ? ACCENT : LINE);
			ctx.text(font, f[1], bx + 5, by + 5, sel ? 0xFFFFFFFF : TEXT);
			ctx.text(font, font.plainSubstrByWidth(f[2], colW - 10), bx + 5, by + 17, GRAY);
			if (hov) tooltip = List.of(Component.literal(f[1]).withColor(ACCENT), Component.literal(f[2]));
			hit(bx, by, colW, 29, true, () -> {
				c.filter = f[0];
				VantageConfig.save();
			});
		}
		y += ((Filters.LIST.length + 1) / 2) * 32 + 4;
		return paragraph(ctx, x, y, w, "Für Schatten, Wasser und Licht wie in großen Shader-Paketen zusätzlich Iris + Sodium installieren. "
				+ "Vantage Client läuft zusammen mit ihnen; die Shader hier dann am besten auf „Aus“.", GRAY);
	}

	// ------------------------------------------------------------------ Reiter: Tracker

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
			ctx.fill(bx, by, bx + colW, by + 20, sel ? 0xFF2E2A22 : hov ? 0xFF2C3744 : 0xFF1E262F);
			border(ctx, bx, by, colW, 20, sel ? (t.color | 0xFF000000) : hov ? 0xFF56677A : LINE);
			ctx.fill(bx, by, bx + 2, by + 20, t.color | 0xFF000000);
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

	// ------------------------------------------------------------------ Reiter: Makros

	private int drawMacros(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
		ctx.fill(x, y, x + w, y + 34, 0x40E0A030);
		border(ctx, x, y, w, 34, 0xFFE0A030);
		paragraph(ctx, x + 5, y + 4, w - 10, "Makros sind auf vielen Servern verboten. Nur dort benutzen, wo es erlaubt ist (Einzelspieler immer ok).", 0xFFFFD27A);
		y += 40;

		y = header(ctx, x, y, w, "Lunge-Swap (Speer)");
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
		y = slider(ctx, x, y, w, "… Wartezeit nach dem Wurf", 0, 20, c.lungeAfterWindDelay, 1,
				c.lungeAfterWindDelay == 0 ? "sofort" : ticks(c.lungeAfterWindDelay), v -> c.lungeAfterWindDelay = (int) v);

		y = header(ctx, x, y + 2, w, "Attribut-Swap (Streitkolben)");
		y = paragraph(ctx, x, y, w, "Schlägst du mit Schwert oder Axt zu, wechselt die Mod genau für diesen Schlag auf den Streitkolben (Mace) und danach zurück.", GRAY);
		y = toggle(ctx, x, y, w, "Attribut-Swap an", c.maceSwap, v -> c.maceSwap = v);
		y = keyRow(ctx, x, y, w, "Taste: an/aus schalten", VantageClient.maceToggleKey);
		y = toggle(ctx, x, y, w, "Nur beim Fallen (für den Smash-Angriff)", c.maceOnlyFalling, v -> c.maceOnlyFalling = v);
		y = slider(ctx, x, y, w, "Mindest-Fallhöhe", 0, 10, c.maceMinFall, 0.5, fmt(c.maceMinFall) + " Blöcke", v -> c.maceMinFall = (float) v);
		y = toggle(ctx, x, y, w, "Vom Schwert aus", c.maceFromSword, v -> c.maceFromSword = v);
		y = toggle(ctx, x, y, w, "Von der Axt aus", c.maceFromAxe, v -> c.maceFromAxe = v);
		y = slider(ctx, x, y, w, "Zurückwechseln nach", 1, 10, c.maceReturnDelay, 1, ticks(c.maceReturnDelay), v -> c.maceReturnDelay = (int) v);

		y = header(ctx, x, y + 2, w, "Schild-Brecher (Axt)");
		y = toggle(ctx, x, y, w, "Blockt der Gegner mit Schild: für den Schlag auf die Axt wechseln", c.shieldBreaker, v -> c.shieldBreaker = v);
		y = keyRow(ctx, x, y, w, "Taste: an/aus schalten", VantageClient.shieldToggleKey);

		y = header(ctx, x, y + 2, w, "Schnell-Wurf");
		y = keyRow(ctx, x, y, w, "Enderperle werfen", VantageClient.pearlKey);
		y = keyRow(ctx, x, y, w, "Windladung werfen", VantageClient.windKey);
		y = toggle(ctx, x, y, w, "Nach dem Wurf zurückwechseln", c.quickReturn, v -> c.quickReturn = v);
		return paragraph(ctx, x, y + 2, w, "Taste ändern: auf den Knopf klicken und dann die gewünschte Taste (oder Maus-Seitentaste) drücken. "
				+ "Esc = Taste entfernen.", GRAY);
	}

	private static String ticks(int t) {
		return t + " Ticks (" + String.format("%.2f", t / 20.0).replace('.', ',') + " s)";
	}

	// ------------------------------------------------------------------ Reiter: Tasten & HUD

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

	private int drawHud(GuiGraphicsExtractor ctx, int x, int y, int w) {
		VantageConfig c = VantageConfig.get();
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
		y = paragraph(ctx, x, y + 2, w, "Esc während „Taste drücken“ = Taste entfernen. Maus-Seitentasten gehen auch.", GRAY);

		y = header(ctx, x, y + 2, w, "Zoom");
		y = slider(ctx, x, y, w, "Zoom-Stärke", 1.5, 10, c.zoom, 0.5, fmt(c.zoom) + "×", v -> c.zoom = (float) v);

		y = header(ctx, x, y + 2, w, "Info-Anzeige (oben links)");
		y = toggle(ctx, x, y, w, "Info-Anzeige an", c.hudInfo, v -> c.hudInfo = v);
		y = toggle(ctx, x, y, w, "FPS", c.hudFps, v -> c.hudFps = v);
		y = toggle(ctx, x, y, w, "CPS (Klicks pro Sekunde, links | rechts)", c.hudCps, v -> c.hudCps = v);
		y = toggle(ctx, x, y, w, "Koordinaten", c.hudCoords, v -> c.hudCoords = v);
		y = toggle(ctx, x, y, w, "Himmelsrichtung", c.hudDirection, v -> c.hudDirection = v);
		return toggle(ctx, x, y, w, "Ping (auf Servern)", c.hudPing, v -> c.hudPing = v);
	}
}
