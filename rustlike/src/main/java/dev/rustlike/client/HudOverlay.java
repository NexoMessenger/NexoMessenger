package dev.rustlike.client;

import dev.rustlike.item.BuildingPlanItem;
import dev.rustlike.logic.PlacementRules;
import dev.rustlike.piece.PieceType;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.network.chat.Component;
import net.minecraft.core.BlockPos;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.HitResult;
import net.minecraftforge.client.event.RenderGuiEvent;

/**
 * Информация на экране при удержании строительного плана:
 * выбранный элемент, его цена и можно ли поставить под прицелом.
 */
public final class HudOverlay {

    private HudOverlay() {
    }

    public static void render(RenderGuiEvent.Post event) {
        Minecraft mc = Minecraft.getInstance();
        if (mc.player == null || mc.level == null || mc.screen != null) {
            return;
        }
        if (!(mc.player.getMainHandItem().getItem() instanceof BuildingPlanItem)) {
            return;
        }

        GuiGraphics gui = event.getGuiGraphics();
        Font font = mc.font;
        PieceType piece = ClientState.selected();

        int x = 8;
        int y = 8;

        gui.drawString(font, Component.translatable("rustlike.hud.title"),
                x, y, 0xFFFFD755, true);
        y += 11;

        gui.drawString(font, Component.translatable(piece.nameKey()),
                x, y, 0xFFFFFF, true);
        y += 11;

        gui.drawString(font,
                Component.translatable("rustlike.radial.cost",
                        piece.placeCost(),
                        Component.translatable(piece.placeCostItem().getDescriptionId())),
                x, y, 0xAAAAAA, true);
        y += 11;

        // Статус установки под прицелом
        if (mc.hitResult instanceof BlockHitResult hit && hit.getType() != HitResult.Type.MISS) {
            BlockPos pos = PlacementRules.clientTargetPos(hit, piece);
            PlacementRules.Result result = PlacementRules.validate(
                    mc.level, mc.player, pos, piece, false);
            if (result.ok()) {
                gui.drawString(font, Component.translatable("rustlike.hud.can_place"),
                        x, y, 0x55FF55, true);
            } else {
                gui.drawString(font, result.message(), x, y, 0xFF5555, true);
            }
        } else {
            gui.drawString(font, Component.translatable("rustlike.hud.aim"),
                    x, y, 0x888888, true);
        }

        // Подсказка внизу экрана
        int screenHeight = mc.getWindow().getGuiScaledHeight();
        gui.drawString(font, Component.translatable("rustlike.hud.hint"),
                8, screenHeight - 24, 0x888888, true);
    }
}
