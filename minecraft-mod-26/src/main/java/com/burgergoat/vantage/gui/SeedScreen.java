package com.burgergoat.vantage.gui;

import com.burgergoat.vantage.tracker.SeedStore;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import net.minecraft.util.FormattedCharSequence;
import org.jetbrains.annotations.Nullable;

/** Kleines Fenster zum Eintippen des Seeds fuer den aktuellen Server. */
public class SeedScreen extends Screen {
	@Nullable
	private final Screen parent;
	private EditBox field;

	public SeedScreen(@Nullable Screen parent) {
		super(Component.literal("Seed für diesen Server"));
		this.parent = parent;
	}

	@Override
	protected void init() {
		int cx = width / 2;
		int y = height / 2 - 20;
		field = new EditBox(font, cx - 110, y, 220, 20, Component.literal("Seed"));
		field.setMaxLength(40);
		Long seed = minecraft == null ? null : SeedStore.seed(minecraft);
		if (seed != null) field.setValue(Long.toString(seed));
		addRenderableWidget(field);
		setInitialFocus(field);
		addRenderableWidget(Button.builder(Component.literal("Speichern"), b -> save()).bounds(cx - 110, y + 28, 108, 20).build());
		addRenderableWidget(Button.builder(Component.literal("Abbrechen"), b -> onClose()).bounds(cx + 2, y + 28, 108, 20).build());
		addRenderableWidget(Button.builder(Component.literal("Seed vom Server holen (/seed)"), b -> {
			if (minecraft != null) SeedStore.request(minecraft);
		}).bounds(cx - 110, y + 52, 220, 20).build());
	}

	private void save() {
		if (minecraft != null) SeedStore.set(minecraft, SeedStore.parse(field.getValue()));
		onClose();
	}

	@Override
	public void onClose() {
		if (minecraft != null) minecraft.setScreen(parent);
	}

	@Override
	public void render(GuiGraphics ctx, int mouseX, int mouseY, float delta) {
		super.render(ctx, mouseX, mouseY, delta);
		int cx = width / 2;
		int y = height / 2 - 20;
		ctx.drawCenteredString(font, title, cx, y - 46, 0xFFE8A33D);
		int ty = y - 32;
		for (FormattedCharSequence line : font.split(Component.literal(
				"Den Seed findest du im Aternos-Panel (Welten / Optionen) oder im Spiel mit /seed (braucht Op)."), 300)) {
			ctx.drawCenteredString(font, line, cx, ty, 0xFFB8C4D6);
			ty += 10;
		}
		String msg = SeedStore.message();
		if (!msg.isEmpty()) {
			int my = y + 80;
			for (FormattedCharSequence line : font.split(Component.literal(msg), 300)) {
				ctx.drawCenteredString(font, line, cx, my, 0xFF8FD18F);
				my += 10;
			}
			// Seed kam per /seed an -> Feld fuellen
			Long seed = minecraft == null ? null : SeedStore.seed(minecraft);
			if (seed != null && field.getValue().isEmpty()) field.setValue(Long.toString(seed));
		}
	}
}
