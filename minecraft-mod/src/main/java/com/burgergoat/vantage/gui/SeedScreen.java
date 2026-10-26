package com.burgergoat.vantage.gui;

import com.burgergoat.vantage.tracker.SeedStore;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.TextFieldWidget;
import net.minecraft.text.OrderedText;
import net.minecraft.text.Text;
import org.jetbrains.annotations.Nullable;

/** Kleines Fenster zum Eintippen des Seeds fuer den aktuellen Server. */
public class SeedScreen extends Screen {
	@Nullable
	private final Screen parent;
	private TextFieldWidget field;

	public SeedScreen(@Nullable Screen parent) {
		super(Text.literal("Seed für diesen Server"));
		this.parent = parent;
	}

	@Override
	protected void init() {
		int cx = width / 2;
		int y = height / 2 - 20;
		field = new TextFieldWidget(textRenderer, cx - 110, y, 220, 20, Text.literal("Seed"));
		field.setMaxLength(40);
		Long seed = client == null ? null : SeedStore.seed(client);
		if (seed != null) field.setText(Long.toString(seed));
		addDrawableChild(field);
		setInitialFocus(field);
		addDrawableChild(ButtonWidget.builder(Text.literal("Speichern"), b -> save()).dimensions(cx - 110, y + 28, 108, 20).build());
		addDrawableChild(ButtonWidget.builder(Text.literal("Abbrechen"), b -> close()).dimensions(cx + 2, y + 28, 108, 20).build());
		addDrawableChild(ButtonWidget.builder(Text.literal("Seed vom Server holen (/seed)"), b -> {
			if (client != null) SeedStore.request(client);
		}).dimensions(cx - 110, y + 52, 220, 20).build());
	}

	private void save() {
		if (client != null) SeedStore.set(client, SeedStore.parse(field.getText()));
		close();
	}

	@Override
	public void close() {
		if (client != null) client.setScreen(parent);
	}

	@Override
	public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
		super.render(ctx, mouseX, mouseY, delta);
		int cx = width / 2;
		int y = height / 2 - 20;
		ctx.drawCenteredTextWithShadow(textRenderer, title, cx, y - 46, 0xFFE8A33D);
		int ty = y - 32;
		for (OrderedText line : textRenderer.wrapLines(Text.literal(
				"Den Seed findest du im Aternos-Panel (Welten / Optionen) oder im Spiel mit /seed (braucht Op)."), 300)) {
			ctx.drawCenteredTextWithShadow(textRenderer, line, cx, ty, 0xFFB8C4D6);
			ty += 10;
		}
		String msg = SeedStore.message();
		if (!msg.isEmpty()) {
			int my = y + 80;
			for (OrderedText line : textRenderer.wrapLines(Text.literal(msg), 300)) {
				ctx.drawCenteredTextWithShadow(textRenderer, line, cx, my, 0xFF8FD18F);
				my += 10;
			}
			// Seed kam per /seed an -> Feld fuellen
			Long seed = client == null ? null : SeedStore.seed(client);
			if (seed != null && field.getText().isEmpty()) field.setText(Long.toString(seed));
		}
	}
}
