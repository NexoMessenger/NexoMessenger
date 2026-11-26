package dev.rustlike.client;

import dev.rustlike.network.HammerActionC2S;
import dev.rustlike.network.ModNetwork;
import dev.rustlike.piece.PieceType;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.Items;
import net.minecraftforge.registries.ForgeRegistries;

/**
 * Экран молотка: осмотр постройки, ремонт и улучшение.
 *
 * Данные приходят с сервера (OpenHammerScreenS2C), действия
 * отправляются обратно (HammerActionC2S) и перепроверяются сервером.
 */
public class HammerScreen extends Screen {

    private static final int PANEL_WIDTH = 240;
    private static final int PANEL_HEIGHT = 156;
    private static final int BUTTON_WIDTH = 190;

    private final BlockPos pos;
    private final int pieceId;
    private final int tier;
    private final int damage;
    private final int maxDamage;
    private final String repairItem;
    private final int repairCost;
    private final String upgradeItem;
    private final int upgradeCost;
    private final Component screenTitle = Component.translatable("rustlike.hammer.title");

    public HammerScreen(BlockPos pos, int pieceId, int tier, int damage, int maxDamage,
                        String repairItem, int repairCost, String upgradeItem, int upgradeCost) {
        super(Component.translatable("rustlike.hammer.title"));
        this.pos = pos;
        this.pieceId = pieceId;
        this.tier = tier;
        this.damage = damage;
        this.maxDamage = Math.max(1, maxDamage);
        this.repairItem = repairItem;
        this.repairCost = repairCost;
        this.upgradeItem = upgradeItem;
        this.upgradeCost = upgradeCost;
    }

    @Override
    protected void init() {
        int x = (this.width - BUTTON_WIDTH) / 2;
        int y = (this.height - PANEL_HEIGHT) / 2;

        // Ремонт (доступен, если есть повреждения)
        Button repair = Button.builder(repairLabel(), b -> sendAction(0))
                .bounds(x, y + 84, BUTTON_WIDTH, 20)
                .build();
        repair.active = damage > 0;
        addRenderableWidget(repair);

        // Улучшение (доступно, если уровень не максимальный)
        Button upgrade = Button.builder(upgradeLabel(), b -> sendAction(1))
                .bounds(x, y + 110, BUTTON_WIDTH, 20)
                .build();
        upgrade.active = tier < 4 && !upgradeItem.isEmpty();
        addRenderableWidget(upgrade);

        // Закрыть
        addRenderableWidget(Button.builder(
                        Component.translatable("rustlike.hammer.close"), b -> onClose())
                .bounds(x, y + 132, BUTTON_WIDTH, 18)
                .build());
    }

    private Component repairLabel() {
        return Component.translatable("rustlike.hammer.repair_cost",
                repairCost, itemName(repairItem));
    }

    private Component upgradeLabel() {
        if (tier >= 4 || upgradeItem.isEmpty()) {
            return Component.translatable("rustlike.hammer.max");
        }
        return Component.translatable("rustlike.hammer.upgrade_cost",
                Component.translatable("rustlike.tier." + (tier + 1)),
                upgradeCost, itemName(upgradeItem));
    }

    private void sendAction(int action) {
        ModNetwork.sendToServer(new HammerActionC2S(pos, action));
    }

    /** Название предмета по его регистрации ("minecraft:stick" → "Палка"). */
    private static Component itemName(String id) {
        if (id == null || id.isEmpty()) {
            return Component.literal("?");
        }
        Item item = ForgeRegistries.ITEMS.get(new ResourceLocation(id));
        if (item == null || item == Items.AIR) {
            return Component.literal(id);
        }
        return Component.translatable(item.getDescriptionId());
    }

    @Override
    public void render(GuiGraphics gui, int mouseX, int mouseY, float partialTick) {
        renderBackground(gui);

        int x0 = (this.width - PANEL_WIDTH) / 2;
        int y0 = (this.height - PANEL_HEIGHT) / 2;
        int x1 = x0 + PANEL_WIDTH;
        int y1 = y0 + PANEL_HEIGHT;

        // Панель + рамка
        gui.fill(x0 - 2, y0 - 2, x1 + 2, y1 + 2, 0xFF555555);
        gui.fill(x0, y0, x1, y1, 0xF0141418);

        int cx = this.width / 2;

        // Название элемента и материал
        gui.drawCenteredString(this.font, this.screenTitle, cx, y0 + 8, 0xFFFFD755);
        gui.drawCenteredString(this.font,
                Component.translatable(pieceNameKey()), cx, y0 + 22, 0xFFFFFFFF);
        gui.drawCenteredString(this.font,
                Component.translatable("rustlike.hammer.material",
                        Component.translatable("rustlike.tier." + tier)),
                cx, y0 + 36, 0xFFAAAAAA);

        // Прочность: число + полоска
        int health = Math.max(0, maxDamage - damage);
        gui.drawCenteredString(this.font,
                Component.translatable("rustlike.hammer.condition",
                        health, maxDamage),
                cx, y0 + 52, 0xFFFFFFFF);

        int barWidth = 200;
        int barX = (this.width - barWidth) / 2;
        int barY = y0 + 64;
        float ratio = (float) health / (float) maxDamage;
        int barColor = ratio > 0.6F ? 0xFF55FF55 : (ratio > 0.3F ? 0xFFFFAA00 : 0xFFFF5555);
        gui.fill(barX - 1, barY - 1, barX + barWidth + 1, barY + 9, 0xFF000000);
        gui.fill(barX, barY, barX + (int) (barWidth * ratio), barY + 8, barColor);

        super.render(gui, mouseX, mouseY, partialTick);
    }

    private String pieceNameKey() {
        switch (pieceId) {
            case 0:  return "rustlike.piece.foundation";
            case 1:  return "rustlike.piece.wall";
            case 2:  return "rustlike.piece.doorway";
            default: return "rustlike.piece.wall";
        }
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }
}
