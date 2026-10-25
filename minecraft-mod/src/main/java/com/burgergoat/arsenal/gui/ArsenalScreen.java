package com.burgergoat.arsenal.gui;

import com.burgergoat.arsenal.ArsenalClient;
import com.burgergoat.arsenal.config.ArsenalConfig;
import com.burgergoat.arsenal.feature.Crosshair;
import com.burgergoat.arsenal.feature.Filters;
import com.burgergoat.arsenal.feature.Viewmodel;
import com.burgergoat.arsenal.skin.SkinCatalog;
import com.burgergoat.arsenal.skin.SkinManager;
import com.burgergoat.arsenal.skin.SkinPacks;
import com.burgergoat.arsenal.tracker.StructureTracker;
import com.burgergoat.arsenal.tracker.TrackType;
import net.minecraft.client.gui.Click;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.input.KeyInput;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.client.sound.PositionedSoundInstance;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.OrderedText;
import net.minecraft.text.Text;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.MathHelper;
import org.jetbrains.annotations.Nullable;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.function.Consumer;
import java.util.function.DoubleConsumer;

/** Das Arsenal-Menue (Taste K). */
public class ArsenalScreen extends Screen {
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
	private List<Text> tooltip;
	private final Random random = new Random();
	/** Tastenbelegung, die gerade auf einen Tastendruck wartet. */
	private KeyBinding listening;

	public ArsenalScreen() {
		super(Text.literal("Arsenal"));
	}

	public static void setTab(int t) {
		tab = MathHelper.clamp(t, 0, TABS.length - 1);
	}

	@Override
	public boolean shouldPause() {
		return false;
	}

	@Override
	public void renderBackground(DrawContext ctx, int mouseX, int mouseY, float deltaTicks) {
		// Im Viewmodel-Reiter frei lassen, damit man die Hand live sieht
		if (tab != 3) ctx.fill(0, 0, width, height, 0x60000000);
	}

	@Override
	public void removed() {
		if (dirty) ArsenalConfig.save();
	}

	@Override
	public boolean keyPressed(KeyInput input) {
		if (listening != null) {
			bind(listening, input.isEscape() ? InputUtil.UNKNOWN_KEY : InputUtil.fromKeyCode(input));
			return true;
		}
		if (ArsenalClient.menuKey.matchesKey(input)) {
			close();
			return true;
		}
		return super.keyPressed(input);
	}

	// ------------------------------------------------------------------ Maus

	private void updateMouse() {
		if (client == null) return;
		mx = client.mouse.getScaledX(client.getWindow());
		my = client.mouse.getScaledY(client.getWindow());
	}

	@Override
	public void mouseMoved(double mouseX, double mouseY) {
		mx = mouseX;
		my = mouseY;
	}

	@Override
	public boolean mouseClicked(Click click, boolean doubled) {
		updateMouse();
		if (listening != null && click.button() >= 2) {
			// Maustasten 3, 4, 5 … (Mausrad-Klick, Seitentasten) koennen auch belegt werden
			bind(listening, InputUtil.Type.MOUSE.createFromCode(click.button()));
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
	public boolean mouseDragged(Click click, double offsetX, double offsetY) {
		if (dragging != null) {
			updateMouse();
			dragging.drag.accept(mx);
			return true;
		}
		return super.mouseDragged(click, offsetX, offsetY);
	}

	@Override
	public boolean mouseReleased(Click click) {
		if (dragging != null) {
			dragging = null;
			if (dirty) {
				ArsenalConfig.save();
				dirty = false;
			}
			return true;
		}
		return super.mouseReleased(click);
	}

	@Override
	public boolean mouseScrolled(double mouseX, double mouseY, double horizontalAmount, double verticalAmount) {
		if (mouseX >= cx && mouseX < cx + cw && mouseY >= cy && mouseY < cy + ch) {
			scroll = MathHelper.clamp(scroll - (int) Math.round(verticalAmount * 24), 0, Math.max(0, contentHeight - ch));
			return true;
		}
		return super.mouseScrolled(mouseX, mouseY, horizontalAmount, verticalAmount);
	}

	private void bind(KeyBinding key, InputUtil.Key code) {
		key.setBoundKey(code);
		KeyBinding.updateKeysByCode();
		if (client != null) client.options.write();
		listening = null;
		playClick(1.4f);
	}

	private void playClick(float pitch) {
		if (client != null) client.getSoundManager().play(PositionedSoundInstance.ui(SoundEvents.UI_BUTTON_CLICK, pitch));
	}

	private void changed() {
		dirty = true;
	}

	// ------------------------------------------------------------------ Zeichnen

	@Override
	public void render(DrawContext ctx, int mouseX, int mouseY, float deltaTicks) {
		super.render(ctx, mouseX, mouseY, deltaTicks);
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
		ctx.getMatrices().pushMatrix();
		ctx.getMatrices().translate(px + 8, py + 6);
		ctx.getMatrices().scale(1.5f, 1.5f);
		ctx.drawTextWithShadow(textRenderer, "ARSENAL", 0, 0, ACCENT);
		ctx.getMatrices().popMatrix();
		ctx.drawTextWithShadow(textRenderer, "CS-Skins • PvP-Makros • Tracker", px + 76, py + 9, GRAY);

		// Schliessen
		int bx = px + pw - 20;
		boolean hovClose = hovered(bx, py + 4, 16, 16, false);
		ctx.fill(bx, py + 4, bx + 16, py + 20, hovClose ? 0xFFB03030 : 0xFF2A333E);
		ctx.drawCenteredTextWithShadow(textRenderer, "✕", bx + 8, py + 8, 0xFFFFFFFF);
		hit(bx, py + 4, 16, 16, false, this::close);

		// Reiter
		for (int i = 0; i < TABS.length; i++) {
			int ty = py + 30 + i * 23;
			int tx = px + 5;
			boolean sel = i == tab;
			boolean hov = hovered(tx, ty, 92, 21, false);
			ctx.fill(tx, ty, tx + 92, ty + 21, sel ? 0xFF2E3A48 : hov ? 0xFF222B36 : 0xFF181F27);
			if (sel) ctx.fill(tx, ty, tx + 2, ty + 21, ACCENT);
			ctx.drawItem(new ItemStack(TAB_ICONS[i]), tx + 4, ty + 2);
			ctx.drawTextWithShadow(textRenderer, TABS[i], tx + 23, ty + 7, sel ? 0xFFFFFFFF : TEXT);
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
		if (tooltip != null) ctx.drawTooltip(textRenderer, tooltip, mouseX, mouseY);
	}

	// ------------------------------------------------------------------ Bausteine

	private boolean hovered(int x, int y, int w, int h, boolean content) {
		if (mx < x || my < y || mx >= x + w || my >= y + h) return false;
		return !content || (my >= cy && my < cy + ch);
	}

	private void hit(int x, int y, int w, int h, boolean content, Runnable click) {
		hits.add(new Hit(x, y, w, h, content, click, null));
	}

	private void border(DrawContext ctx, int x, int y, int w, int h, int color) {
		ctx.fill(x, y, x + w, y + 1, color);
		ctx.fill(x, y + h - 1, x + w, y + h, color);
		ctx.fill(x, y, x + 1, y + h, color);
		ctx.fill(x + w - 1, y, x + w, y + h, color);
	}

	private void button(DrawContext ctx, int x, int y, int w, int h, String label, boolean active, Runnable click) {
		boolean hov = hovered(x, y, w, h, true);
		ctx.fill(x, y, x + w, y + h, active ? 0xFF5A4220 : hov ? 0xFF2C3744 : 0xFF222B35);
		border(ctx, x, y, w, h, active ? ACCENT : hov ? 0xFF56677A : LINE);
		String s = textRenderer.trimToWidth(label, w - 6);
		ctx.drawCenteredTextWithShadow(textRenderer, s, x + w / 2, y + (h - 8) / 2, active ? 0xFFFFFFFF : TEXT);
		hit(x, y, w, h, true, click);
	}

	private int header(DrawContext ctx, int x, int y, int w, String text) {
		ctx.drawTextWithShadow(textRenderer, text, x, y + 3, ACCENT);
		ctx.fill(x, y + 13, x + w, y + 14, LINE);
		return y + 18;
	}

	private int paragraph(DrawContext ctx, int x, int y, int w, String text, int color) {
		for (OrderedText line : textRenderer.wrapLines(Text.literal(text), w)) {
			ctx.drawTextWithShadow(textRenderer, line, x, y, color);
			y += 10;
		}
		return y + 3;
	}

	private int toggle(DrawContext ctx, int x, int y, int w, String label, boolean value, Consumer<Boolean> set) {
		boolean hov = hovered(x, y, w, 15, true);
		if (hov) ctx.fill(x, y, x + w, y + 15, 0x18FFFFFF);
		ctx.drawTextWithShadow(textRenderer, textRenderer.trimToWidth(label, w - 32), x + 3, y + 4, TEXT);
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

	private int slider(DrawContext ctx, int x, int y, int w, String label, double min, double max, double value, double step,
			String text, DoubleConsumer set) {
		ctx.drawTextWithShadow(textRenderer, label, x + 3, y + 1, TEXT);
		ctx.drawTextWithShadow(textRenderer, text, x + w - textRenderer.getWidth(text) - 3, y + 1, ACCENT);
		int bx = x + 4;
		int bw = w - 8;
		int by = y + 13;
		double f = MathHelper.clamp((value - min) / (max - min), 0, 1);
		ctx.fill(bx, by + 2, bx + bw, by + 5, LINE);
		ctx.fill(bx, by + 2, bx + (int) (bw * f), by + 5, ACCENT);
		int kx = bx + (int) (bw * f);
		boolean hov = hovered(bx - 3, by - 2, bw + 6, 11, true);
		ctx.fill(kx - 2, by, kx + 3, by + 7, hov ? 0xFFFFFFFF : 0xFFDADADA);
		hits.add(new Hit(bx - 3, by - 2, bw + 6, 11, true, null, mouse -> {
			double ff = MathHelper.clamp((mouse - bx) / bw, 0, 1);
			double v = min + ff * (max - min);
			v = Math.round(v / step) * step;
			set.accept(MathHelper.clamp(v, min, max));
			changed();
		}));
		return y + 25;
	}

	private void itemCell(DrawContext ctx, int x, int y, int size, ItemStack stack, int rarityColor, boolean selected, @Nullable List<Text> tip, Runnable click) {
		boolean hov = hovered(x, y, size, size, true);
		ctx.fill(x, y, x + size, y + size, hov ? 0xFF2D3846 : 0xFF1E262F);
		ctx.fill(x, y + size - 2, x + size, y + size, rarityColor);
		if (selected) border(ctx, x, y, size, size, ACCENT);
		else if (hov) border(ctx, x, y, size, size, 0xFF6A7A8C);
		float s = (size - 6) / 16f;
		ctx.getMatrices().pushMatrix();
		ctx.getMatrices().translate(x + 3, y + 2);
		ctx.getMatrices().scale(s, s);
		ctx.drawItem(stack, 0, 0);
		ctx.getMatrices().popMatrix();
		if (hov && tip != null) tooltip = tip;
		hit(x, y, size, size, true, click);
	}

	private String keyName(KeyBinding key) {
		return key.getBoundKeyLocalizedText().getString();
	}

	// ------------------------------------------------------------------ Kategorien

	private static String baseItem(SkinCatalog.Category cat, String target) {
		if (!"*".equals(target)) return target;
		for (int i = cat.items.size() - 1; i >= 0; i--) {
			if (SkinManager.item(cat.items.get(i)) != null) return cat.items.get(i);
		}
		return cat.items.get(0);
	}

	private int categoryChips(DrawContext ctx, int x, int y, int w, String selected, Consumer<String> select) {
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
			ctx.drawItem(icon, bx + 2, by + 1);
			ctx.drawTextWithShadow(textRenderer, textRenderer.trimToWidth(cat.name, chipW - 22), bx + 20, by + 6, sel ? 0xFFFFFFFF : TEXT);
			String id = cat.id;
			hit(bx, by, chipW, 19, true, () -> select.accept(id));
			i++;
		}
		return y + ((i + perRow - 1) / perRow) * 21 + 3;
	}

	// ------------------------------------------------------------------ Reiter: Skins

	private int drawSkins(DrawContext ctx, int x, int y, int w) {
		ArsenalConfig c = ArsenalConfig.get();
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
			ctx.drawTextWithShadow(textRenderer, "Für:", x + 1, y + 6, GRAY);
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
				ctx.drawItem(SkinManager.preview(null, path), bx + 2, y + 2);
				if (hov) tooltip = List.of(item.getName());
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
						List.of(Text.literal(s.name()).withColor(ACCENT)), () -> {
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
						List.of(Text.literal("Standard (kein Skin)")), () -> equip(k, null));
				continue;
			}
			SkinCatalog.Finish f = cat.finishes.get(i - 1);
			SkinCatalog.Skin sk = SkinCatalog.skin(cat.skinId(shape, f));
			if (sk == null) continue;
			int col = SkinCatalog.rarityColor(f.rarity());
			List<Text> tip = List.of(Text.literal(sk.displayName()).withColor(col),
					Text.literal(SkinCatalog.RARITY_NAMES[Math.min(6, Math.max(0, f.rarity()))]).withColor(0xFF9AA4B0));
			itemCell(ctx, bx, by, size, SkinManager.preview(sk, base), col, current != null && current.id().equals(sk.id()), tip, () -> equip(k, sk));
		}
		y += ((n + perRow - 1) / perRow) * (size + 2) + 6;

		// Grosse Vorschau + Infos
		int boxH = 70;
		ctx.fillGradient(x, y, x + 74, y + boxH, 0xFF2A3442, 0xFF141A21);
		border(ctx, x, y, 74, boxH, current == null ? LINE : SkinCatalog.rarityColor(current.rarity()));
		ctx.getMatrices().pushMatrix();
		ctx.getMatrices().translate(x + 5, y + 3);
		ctx.getMatrices().scale(4f, 4f);
		ctx.drawItem(SkinManager.preview(current, base), 0, 0);
		ctx.getMatrices().popMatrix();
		int tx = x + 82;
		ctx.drawTextWithShadow(textRenderer, "Ausgerüstet:", tx, y + 2, GRAY);
		String name = current == null ? "Kein Skin" : current.displayName();
		ctx.drawTextWithShadow(textRenderer, textRenderer.trimToWidth(name, w - 84), tx, y + 13,
				current == null ? TEXT : SkinCatalog.rarityColor(current.rarity()));
		if (current != null) {
			ctx.drawTextWithShadow(textRenderer, SkinCatalog.RARITY_NAMES[Math.min(6, current.rarity())], tx, y + 24, GRAY);
			if (cat.hasShapes() && c.statTrak) {
				ctx.drawTextWithShadow(textRenderer, "StatTrak™ Kills: " + c.statTrakKills.getOrDefault(current.id(), 0), tx, y + 35, 0xFFCF6A32);
			}
		}
		button(ctx, tx, y + 50, 90, 18, "🎲 Zufällig", false, () -> {
			SkinCatalog.Skin r = k.skins.get(random.nextInt(k.skins.size()));
			if (r.shape() != null) skinShape = r.shape().id();
			equip(k, r);
		});
		button(ctx, tx + 94, y + 50, Math.min(110, w - 176), 18, "Alle entfernen", false, () -> {
			for (String it : k.items) ArsenalConfig.get().skins.remove(it);
			ArsenalConfig.save();
		});
		y += boxH + 6;

		y = header(ctx, x, y, w, "Optionen");
		y = toggle(ctx, x, y, w, "Skins anzeigen", c.skinsEnabled, v -> {
			c.skinsEnabled = v;
			ArsenalConfig.save();
		});
		y = toggle(ctx, x, y, w, "Nur meine Items (andere Spieler sehen normal aus)", c.skinsOnlyOwn, v -> {
			c.skinsOnlyOwn = v;
			ArsenalConfig.save();
		});
		y = toggle(ctx, x, y, w, "StatTrak™-Zähler (zählt deine Kills pro Skin)", c.statTrak, v -> c.statTrak = v);
		y = paragraph(ctx, x, y + 2, w, "Skins sind nur auf deinem Bildschirm zu sehen und funktionieren auf jedem Server. "
				+ "Halte ein Messer und drücke " + keyName(ArsenalClient.inspectKey) + " zum Ansehen (Inspect).", GRAY);
		return y;
	}

	private void equip(SkinCatalog.Category cat, @Nullable SkinCatalog.Skin skin) {
		if ("*".equals(skinTarget)) {
			for (String it : cat.items) {
				if (skin == null) ArsenalConfig.get().skins.remove(it);
				else ArsenalConfig.get().skins.put(it, skin.id());
			}
			ArsenalConfig.save();
		} else {
			SkinManager.equip(skinTarget, skin);
		}
	}

	// ------------------------------------------------------------------ Reiter: Pakete

	private int drawPacks(DrawContext ctx, int x, int y, int w) {
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
			ctx.drawTextWithShadow(textRenderer, pack.name() + (active ? "  ✔" : ""), bx + 5, by + 4, active ? ACCENT : 0xFFFFFFFF);
			ctx.drawTextWithShadow(textRenderer, textRenderer.trimToWidth(pack.desc(), colW - 10), bx + 5, by + 15, GRAY);
			int ix = bx + 4;
			for (String it : showItems) {
				SkinCatalog.Skin sk = SkinCatalog.skin(pack.skins().get(it));
				if (ix + 16 > bx + colW - 2) break;
				ctx.drawItem(SkinManager.preview(sk, it), ix, by + 27);
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

	private int drawCrosshair(DrawContext ctx, int x, int y, int w) {
		ArsenalConfig c = ArsenalConfig.get();
		int boxW = 96;
		int lw = w - boxW - 8;
		int bx = x + w - boxW;
		ctx.fillGradient(bx, y, bx + boxW, y + boxW, 0xFF7DB3E6, 0xFF4E7A3C);
		ctx.fill(bx, y + boxW * 2 / 3, bx + boxW, y + boxW, 0xFF5A7F3A);
		border(ctx, bx, y, boxW, boxW, LINE);
		Crosshair.draw(ctx, bx + boxW / 2, y + boxW / 2, 0);
		ctx.drawCenteredTextWithShadow(textRenderer, "Vorschau", bx + boxW / 2, y + boxW + 3, GRAY);

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
		ctx.drawTextWithShadow(textRenderer, "Farbe", x + 3, yy + 4, GRAY);
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
			ArsenalConfig d = new ArsenalConfig();
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

	private int drawViewmodel(DrawContext ctx, int x, int y, int w) {
		ArsenalConfig c = ArsenalConfig.get();
		y = paragraph(ctx, x, y, w, "Live-Vorschau: rechts siehst du deine Hand. Halte dein Messer in der Hand und stell alles ein.", 0xFF8FD18F);
		int half = (w - 2) / 2;
		button(ctx, x, y, half, 18, "▶ Inspect", false, () -> {
			if (client != null) Viewmodel.startInspect(client);
		});
		button(ctx, x + half + 2, y, half, 18, "▶ Ziehen", false, () -> {
			if (client != null) Viewmodel.playDraw(client);
		});
		y += 20;
		button(ctx, x, y, w, 18, "Alles zurücksetzen", false, () -> {
			ArsenalConfig d = new ArsenalConfig();
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
		y = toggle(ctx, x, y, w, "Geräusche (Klicken, Schwung)", c.knifeSounds, v -> c.knifeSounds = v);
		y = slider(ctx, x, y, w, "Tempo", 0.5, 2.0, c.animSpeed, 0.1, Math.round(c.animSpeed * 100) + " %", v -> c.animSpeed = (float) v);
		y = keyRow(ctx, x, y, w, "Inspect-Taste", ArsenalClient.inspectKey);
		return paragraph(ctx, x, y + 2, w, "Jedes Messer hat eigene Bewegungen: Karambit und Talon wirbeln um den Finger, das Butterfly "
				+ "klappt auf und wird hochgeworfen, die Schattendolche drehen sich, M9 und Bajonett werden geworfen und gefangen, "
				+ "Flip, Falchion, Navaja und Stiletto klappen auf.", GRAY);
	}

	// ------------------------------------------------------------------ Reiter: Shader

	private int drawFilters(DrawContext ctx, int x, int y, int w) {
		ArsenalConfig c = ArsenalConfig.get();
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
			ctx.drawTextWithShadow(textRenderer, f[1], bx + 5, by + 5, sel ? 0xFFFFFFFF : TEXT);
			ctx.drawTextWithShadow(textRenderer, textRenderer.trimToWidth(f[2], colW - 10), bx + 5, by + 17, GRAY);
			if (hov) tooltip = List.of(Text.literal(f[1]).withColor(ACCENT), Text.literal(f[2]));
			hit(bx, by, colW, 29, true, () -> {
				c.filter = f[0];
				ArsenalConfig.save();
			});
		}
		y += ((Filters.LIST.length + 1) / 2) * 32 + 4;
		return paragraph(ctx, x, y, w, "Für Schatten, Wasser und Licht wie in großen Shader-Paketen zusätzlich Iris + Sodium installieren. "
				+ "Arsenal läuft zusammen mit ihnen; die Shader hier dann am besten auf „Aus“.", GRAY);
	}

	// ------------------------------------------------------------------ Reiter: Tracker

	private int drawTracker(DrawContext ctx, int x, int y, int w) {
		ArsenalConfig c = ArsenalConfig.get();
		boolean single = client != null && client.getServer() != null;
		y = paragraph(ctx, x, y, w, single
				? "Einzelspieler: Die Suche kennt die ganze Welt – auch weit außerhalb der Sichtweite (bis zum Suchradius). Endschiffe werden einzeln erkannt."
				: "Server: Die Mod kennt nur die geladenen Chunks (Sichtweite). Weiter ginge nur mit dem Seed der Welt – das wäre Cheaten und ist deshalb nicht eingebaut.",
				single ? 0xFF8FD18F : 0xFFE0C070);
		button(ctx, x, y, 110, 20, StructureTracker.searching() ? "Sucht …" : "Jetzt suchen", false, () -> {
			if (client != null) StructureTracker.search(client);
		});
		button(ctx, x + 114, y, 100, 20, "Liste leeren", false, StructureTracker::clear);
		y += 24;
		ctx.drawTextWithShadow(textRenderer, "Status: " + StructureTracker.status(), x + 2, y, GRAY);
		y += 13;

		y = header(ctx, x, y, w, "Gefunden");
		List<StructureTracker.Found> found = client == null || client.player == null ? List.of() : StructureTracker.results(client);
		if (found.isEmpty()) {
			y = paragraph(ctx, x, y, w, "Noch nichts gefunden.", GRAY);
		} else {
			int shown = 0;
			for (StructureTracker.Found f : found) {
				if (shown++ >= 10) break;
				BlockPos p = f.pos();
				ctx.drawTextWithShadow(textRenderer, StructureTracker.arrow(client, p) + " " + f.type().label, x + 2, y + 3, f.type().color);
				String info = "X " + p.getX() + "  Z " + p.getZ() + "   " + StructureTracker.distance(client, p);
				ctx.drawTextWithShadow(textRenderer, info, x + w - 26 - textRenderer.getWidth(info), y + 3, TEXT);
				button(ctx, x + w - 20, y, 18, 14, "✕", false, () -> StructureTracker.ignore(p));
				y += 16;
			}
			y += 4;
		}

		y = typeGroup(ctx, x, y, w, "Nether", new TrackType[]{TrackType.BASTION, TrackType.FORTRESS, TrackType.RUINED_PORTAL});
		y = typeGroup(ctx, x, y, w, "Das Ende", new TrackType[]{TrackType.END_CITY, TrackType.END_SHIP});
		y = typeGroup(ctx, x, y, w, "Oberwelt", new TrackType[]{TrackType.STRONGHOLD, TrackType.ANCIENT_CITY, TrackType.TRIAL_CHAMBERS,
				TrackType.MONUMENT, TrackType.MANSION, TrackType.OUTPOST, TrackType.VILLAGE, TrackType.DESERT_PYRAMID,
				TrackType.JUNGLE_PYRAMID, TrackType.SWAMP_HUT, TrackType.SHIPWRECK, TrackType.TRAIL_RUINS, TrackType.BURIED_TREASURE});

		y = header(ctx, x, y, w, "Einstellungen");
		y = slider(ctx, x, y, w, "Suchradius (Einzelspieler)", 500, 10000, c.trackerRadius, 250, c.trackerRadius + " Blöcke", v -> c.trackerRadius = (int) v);
		y = toggle(ctx, x, y, w, "Liste rechts oben im HUD anzeigen", c.trackerHud, v -> c.trackerHud = v);
		y = toggle(ctx, x, y, w, "Lichtsäule über Fundorten (in der Nähe)", c.trackerBeam, v -> c.trackerBeam = v);
		y = toggle(ctx, x, y, w, "Automatisch suchen (beim Laufen / neue Dimension)", c.trackerAuto, v -> c.trackerAuto = v);
		y = toggle(ctx, x, y, w, "Auf Servern erlauben (nur geladene Chunks)", c.trackerServers, v -> c.trackerServers = v);
		y = paragraph(ctx, x, y, w, "Achtung: Manche Server verbieten solche Hilfen. Vorher die Regeln lesen.", 0xFFE0C070);

		return y;
	}

	private int typeGroup(DrawContext ctx, int x, int y, int w, String title, TrackType[] types) {
		ArsenalConfig c = ArsenalConfig.get();
		y = header(ctx, x, y, w, title);
		int colW = (w - 4) / 2;
		for (int i = 0; i < types.length; i++) {
			TrackType t = types[i];
			int bx = x + (i % 2) * (colW + 4);
			int by = y + (i / 2) * 17;
			toggle(ctx, bx, by, colW, t.label, c.trackTypes.contains(t.id), v -> {
				if (v) c.trackTypes.add(t.id);
				else c.trackTypes.remove(t.id);
			});
			ctx.fill(bx, by + 3, bx + 1, by + 12, t.color);
		}
		return y + ((types.length + 1) / 2) * 17 + 3;
	}

	// ------------------------------------------------------------------ Reiter: Makros

	private int drawMacros(DrawContext ctx, int x, int y, int w) {
		ArsenalConfig c = ArsenalConfig.get();
		ctx.fill(x, y, x + w, y + 34, 0x40E0A030);
		border(ctx, x, y, w, 34, 0xFFE0A030);
		paragraph(ctx, x + 5, y + 4, w - 10, "Makros sind auf vielen Servern verboten. Nur dort benutzen, wo es erlaubt ist (Einzelspieler immer ok).", 0xFFFFD27A);
		y += 40;

		y = header(ctx, x, y, w, "Lunge-Swap (Speer)");
		y = keyRow(ctx, x, y, w, "Taste für Lunge-Swap", ArsenalClient.lungeKey);
		y = paragraph(ctx, x, y, w, "Drückst du die Taste, wechselt die Mod blitzschnell auf den Speer, sticht mit Sprungangriff (Lunge) zu und wechselt zurück.", GRAY);
		y = toggle(ctx, x, y, w, "Lunge-Swap an", c.lungeEnabled, v -> c.lungeEnabled = v);
		y = toggle(ctx, x, y, w, "Nur Speere mit Sprungangriff (Lunge) benutzen", c.lungeOnlyEnchanted, v -> c.lungeOnlyEnchanted = v);
		y = toggle(ctx, x, y, w, "Danach zurück zum alten Item", c.lungeReturn, v -> c.lungeReturn = v);
		y = slider(ctx, x, y, w, "Wartezeit vor dem Stoß", 0, 10, c.lungeDelay, 1, ticks(c.lungeDelay), v -> c.lungeDelay = (int) v);
		y = slider(ctx, x, y, w, "Zurückwechseln nach", 0, 20, c.lungeReturnDelay, 1, ticks(c.lungeReturnDelay), v -> c.lungeReturnDelay = (int) v);
		y = toggle(ctx, x, y, w, "Automatisch nach dem Werfen einer Windladung", c.lungeAfterWind, v -> c.lungeAfterWind = v);
		y = slider(ctx, x, y, w, "… Wartezeit nach der Windladung", 1, 20, c.lungeAfterWindDelay, 1, ticks(c.lungeAfterWindDelay), v -> c.lungeAfterWindDelay = (int) v);

		y = header(ctx, x, y + 2, w, "Attribut-Swap (Streitkolben)");
		y = paragraph(ctx, x, y, w, "Schlägst du mit Schwert oder Axt zu, wechselt die Mod genau für diesen Schlag auf den Streitkolben (Mace) und danach zurück.", GRAY);
		y = toggle(ctx, x, y, w, "Attribut-Swap an", c.maceSwap, v -> c.maceSwap = v);
		y = keyRow(ctx, x, y, w, "Taste: an/aus schalten", ArsenalClient.maceToggleKey);
		y = toggle(ctx, x, y, w, "Nur beim Fallen (für den Smash-Angriff)", c.maceOnlyFalling, v -> c.maceOnlyFalling = v);
		y = slider(ctx, x, y, w, "Mindest-Fallhöhe", 0, 10, c.maceMinFall, 0.5, fmt(c.maceMinFall) + " Blöcke", v -> c.maceMinFall = (float) v);
		y = toggle(ctx, x, y, w, "Vom Schwert aus", c.maceFromSword, v -> c.maceFromSword = v);
		y = toggle(ctx, x, y, w, "Von der Axt aus", c.maceFromAxe, v -> c.maceFromAxe = v);
		y = slider(ctx, x, y, w, "Zurückwechseln nach", 1, 10, c.maceReturnDelay, 1, ticks(c.maceReturnDelay), v -> c.maceReturnDelay = (int) v);

		y = header(ctx, x, y + 2, w, "Schild-Brecher (Axt)");
		y = toggle(ctx, x, y, w, "Blockt der Gegner mit Schild: für den Schlag auf die Axt wechseln", c.shieldBreaker, v -> c.shieldBreaker = v);
		y = keyRow(ctx, x, y, w, "Taste: an/aus schalten", ArsenalClient.shieldToggleKey);

		y = header(ctx, x, y + 2, w, "Schnell-Wurf");
		y = keyRow(ctx, x, y, w, "Enderperle werfen", ArsenalClient.pearlKey);
		y = keyRow(ctx, x, y, w, "Windladung werfen", ArsenalClient.windKey);
		y = toggle(ctx, x, y, w, "Nach dem Wurf zurückwechseln", c.quickReturn, v -> c.quickReturn = v);
		return paragraph(ctx, x, y + 2, w, "Taste ändern: auf den Knopf klicken und dann die gewünschte Taste (oder Maus-Seitentaste) drücken. "
				+ "Esc = Taste entfernen.", GRAY);
	}

	private static String ticks(int t) {
		return t + " Ticks (" + String.format("%.2f", t / 20.0).replace('.', ',') + " s)";
	}

	// ------------------------------------------------------------------ Reiter: Tasten & HUD

	private int keyRow(DrawContext ctx, int x, int y, int w, String label, KeyBinding key) {
		boolean wait = listening == key;
		int bw = Math.min(110, w / 2);
		ctx.drawTextWithShadow(textRenderer, textRenderer.trimToWidth(label, w - bw - 8), x + 3, y + 5, TEXT);
		button(ctx, x + w - bw, y, bw, 17, wait ? "> Taste drücken <" : keyName(key), wait, () -> listening = wait ? null : key);
		y += 19;
		if (!key.isUnbound() && client != null) {
			for (KeyBinding other : client.options.allKeys) {
				if (other != key && other.equals(key)) {
					ctx.drawTextWithShadow(textRenderer, textRenderer.trimToWidth("⚠ Auch belegt: " + Text.translatable(other.getId()).getString(), w - 6),
							x + 3, y, 0xFFFF7060);
					y += 11;
					break;
				}
			}
		}
		return y + 1;
	}

	private int drawHud(DrawContext ctx, int x, int y, int w) {
		ArsenalConfig c = ArsenalConfig.get();
		y = header(ctx, x, y, w, "Tasten (anklicken, dann Taste drücken)");
		y = keyRow(ctx, x, y, w, "Menü öffnen", ArsenalClient.menuKey);
		y = keyRow(ctx, x, y, w, "Inspect (Messer ansehen)", ArsenalClient.inspectKey);
		y = keyRow(ctx, x, y, w, "Lunge-Swap", ArsenalClient.lungeKey);
		y = keyRow(ctx, x, y, w, "Schnell-Enderperle", ArsenalClient.pearlKey);
		y = keyRow(ctx, x, y, w, "Schnell-Windladung", ArsenalClient.windKey);
		y = keyRow(ctx, x, y, w, "Attribut-Swap an/aus", ArsenalClient.maceToggleKey);
		y = keyRow(ctx, x, y, w, "Schild-Brecher an/aus", ArsenalClient.shieldToggleKey);
		y = keyRow(ctx, x, y, w, "Zoom (halten)", ArsenalClient.zoomKey);
		y = keyRow(ctx, x, y, w, "Tracker: jetzt suchen", ArsenalClient.trackerKey);
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
