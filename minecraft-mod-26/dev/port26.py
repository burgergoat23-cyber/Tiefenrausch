# Erzeugt das 26.2-Menue aus dem 1.21.11-Menue (Yarn -> Mojang-Namen).
# Aufruf: python3 minecraft-mod-26/dev/port26.py minecraft-mod/src/main/java/com/burgergoat/vantage/gui/VantageScreen.java > minecraft-mod-26/src/main/java/com/burgergoat/vantage/gui/VantageScreen.java
import re, sys
src = open(sys.argv[1], encoding='utf-8').read()
# Yarn-Importe -> Mojang-Importe (jede Zeile einzeln; unbekannte Minecraft-Importe = Fehler)
IMPORT_MAP = {
 'net.minecraft.client.gui.Click': 'net.minecraft.client.input.MouseButtonEvent',
 'net.minecraft.client.gui.DrawContext': 'net.minecraft.client.gui.GuiGraphicsExtractor',
 'net.minecraft.client.gui.screen.Screen': 'net.minecraft.client.gui.screens.Screen',
 'net.minecraft.client.gui.screen.ingame.InventoryScreen': 'net.minecraft.client.gui.screens.inventory.InventoryScreen',
 'net.minecraft.client.input.KeyInput': 'net.minecraft.client.input.KeyEvent',
 'net.minecraft.client.option.KeyBinding': 'net.minecraft.client.KeyMapping',
 'net.minecraft.client.util.InputUtil': 'com.mojang.blaze3d.platform.InputConstants',
 'net.minecraft.client.sound.PositionedSoundInstance': 'net.minecraft.client.resources.sounds.SimpleSoundInstance',
 'net.minecraft.item.Item': 'net.minecraft.world.item.Item',
 'net.minecraft.item.ItemStack': 'net.minecraft.world.item.ItemStack',
 'net.minecraft.item.Items': 'net.minecraft.world.item.Items',
 'net.minecraft.registry.RegistryKey': 'net.minecraft.resources.ResourceKey',
 'net.minecraft.sound.SoundEvents': 'net.minecraft.sounds.SoundEvents',
 'net.minecraft.text.OrderedText': 'net.minecraft.util.FormattedCharSequence',
 'net.minecraft.text.Text': 'net.minecraft.network.chat.Component',
 'net.minecraft.util.math.MathHelper': 'net.minecraft.util.Mth',
 'net.minecraft.world.World': 'net.minecraft.world.level.Level',
}
out_lines = []
for line in src.split('\n'):
    if line.startswith('import net.minecraft.'):
        name = line[len('import '):-1]
        assert name in IMPORT_MAP, 'Unbekannter Import: ' + name
        line = 'import ' + IMPORT_MAP[name] + ';'
    out_lines.append(line)
src = '\n'.join(out_lines)
R = [
 (r'\bpublic boolean shouldPause\(\)', 'public boolean isPauseScreen()'),
 (r'public void renderBackground\(DrawContext', 'public void extractBackground(GuiGraphicsExtractor'),
 (r'public void render\(DrawContext ctx, int mouseX, int mouseY, float deltaTicks\) \{\n\t\tsuper\.render\(',
  'public void extractRenderState(GuiGraphicsExtractor ctx, int mouseX, int mouseY, float deltaTicks) {\n\t\tsuper.extractRenderState('),
 (r'\bDrawContext\b', 'GuiGraphicsExtractor'),
 (r'\bKeyInput\b', 'KeyEvent'),
 (r'\bClick click\b', 'MouseButtonEvent click'),
 (r'InputUtil\.UNKNOWN_KEY', 'InputConstants.UNKNOWN'),
 (r'InputUtil\.fromKeyCode\(', 'InputConstants.getKey('),
 (r'InputUtil\.Type\.MOUSE\.createFromCode\(', 'InputConstants.Type.MOUSE.getOrCreate('),
 (r'InputUtil\.Key\b', 'InputConstants.Key'),
 (r'\.matchesKey\(input\)', '.matches(input)'),
 (r'this::close\b', 'this::onClose'),
 (r'\bclose\(\);', 'onClose();'),
 (r'client\.mouse\.getScaledX\(client\.getWindow\(\)\)', 'minecraft.mouseHandler.getScaledXPos(minecraft.getWindow())'),
 (r'client\.mouse\.getScaledY\(client\.getWindow\(\)\)', 'minecraft.mouseHandler.getScaledYPos(minecraft.getWindow())'),
 (r'key\.setBoundKey\(', 'key.setKey('),
 (r'KeyBinding\.updateKeysByCode\(\)', 'KeyMapping.resetMapping()'),
 (r'client\.options\.write\(\)', 'minecraft.options.save()'),
 (r'PositionedSoundInstance\.ui\(', 'SimpleSoundInstance.forUI('),
 (r'\bKeyBinding\b', 'KeyMapping'),
 (r'ctx\.getMatrices\(\)', 'ctx.pose()'),
 (r'ctx\.drawTextWithShadow\(textRenderer, ', 'ctx.text(font, '),
 (r'ctx\.drawText\(textRenderer, ([^;]*), false\);', r'ctx.text(font, \1, false);'),
 (r'ctx\.drawCenteredTextWithShadow\(textRenderer, ', 'ctx.centeredText(font, '),
 (r'ctx\.drawItem\(', 'ctx.item('),
 (r'ctx\.drawTooltip\(textRenderer, ', 'ctx.setComponentTooltipForNextFrame(font, '),
 (r'textRenderer\.trimToWidth\(', 'font.plainSubstrByWidth('),
 (r'textRenderer\.getWidth\(', 'font.width('),
 (r'textRenderer\.wrapLines\(', 'font.split('),
 (r'\btextRenderer\b', 'font'),
 (r'\bOrderedText\b', 'FormattedCharSequence'),
 (r'\bText\.literal\(', 'Component.literal('),
 (r'\bText\.translatable\(', 'Component.translatable('),
 (r'\bList<Text>', 'List<Component>'),
 (r'\bMathHelper\b', 'Mth'),
 (r'key\.getBoundKeyLocalizedText\(\)', 'key.getTranslatedKeyMessage()'),
 (r'client\.options\.allKeys', 'minecraft.options.keyMappings'),
 (r'other\.equals\(key\)', 'other.same(key)'),
 (r'other\.getId\(\)', 'other.getName()'),
 (r'List\.of\(item\.getName\(\)\)', 'List.of(new ItemStack(item).getHoverName())'),
 (r'client\.getServer\(\)', 'minecraft.getSingleplayerServer()'),
 (r'client\.world\.getRegistryKey\(\)', 'minecraft.level.dimension()'),
 (r'client\.world\b', 'minecraft.level'),
 (r'\.player\.getRotationVector\(\)', '.player.getLookAngle()'),
 (r'\.player\.getEyePos\(\)', '.player.getEyePosition()'),
 (r'client\.setScreen\(', 'minecraft.gui.setScreen('),
 (r'client\.getSoundManager\(\)', 'minecraft.getSoundManager()'),
 (r'\bRegistryKey<World>', 'ResourceKey<Level>'),
 (r'\bWorld\.(OVERWORLD|NETHER|END)\b', r'Level.\1'),
 (r'\bclient\b', 'minecraft'),
]
head, sep, body = src.partition('\n/**')
for a, b in R:
    body = re.sub(a, b, body)
src = head + sep + body
sys.stdout.write(src)
