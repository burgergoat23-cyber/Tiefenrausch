# Erzeugt das 26.2-Menue aus dem 1.21.11-Menue (Yarn -> Mojang-Namen).
# Aufruf: python3 minecraft-mod-26/dev/port26.py minecraft-mod/src/main/java/com/burgergoat/vantage/gui/VantageScreen.java > minecraft-mod-26/src/main/java/com/burgergoat/vantage/gui/VantageScreen.java
import re, sys
src = open(sys.argv[1], encoding='utf-8').read()
IMPORTS_OLD = """import net.minecraft.client.gui.Click;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.input.KeyInput;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.client.sound.PositionedSoundInstance;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.registry.RegistryKey;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.OrderedText;
import net.minecraft.text.Text;
import net.minecraft.util.math.MathHelper;
import net.minecraft.world.World;
"""
assert IMPORTS_OLD in src
src = src.replace(IMPORTS_OLD, "import com.mojang.blaze3d.platform.InputConstants;\n")
NEW_MC = """import net.minecraft.client.KeyMapping;
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
"""
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
# Mojang-Importe nach dem letzten Import einfuegen
lines = src.split('\n')
last = max(i for i, l in enumerate(lines) if l.startswith('import '))
lines.insert(last + 1, NEW_MC.rstrip('\n'))
src = '\n'.join(lines)
sys.stdout.write(src)
