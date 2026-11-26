package dev.rustlike.client;

import dev.rustlike.RustLikeMod;
import dev.rustlike.item.BuildingPlanItem;
import dev.rustlike.logic.PlacementRules;
import dev.rustlike.network.ModNetwork;
import dev.rustlike.network.PlaceStructureC2S;
import dev.rustlike.piece.PieceType;
import net.minecraft.client.Minecraft;
import net.minecraft.core.BlockPos;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.HitResult;
import net.minecraftforge.api.distmarker.Dist;
import net.minecraftforge.client.event.InputEvent;
import net.minecraftforge.client.event.RenderGuiEvent;
import net.minecraftforge.client.event.RenderLevelStageEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;

/**
 * Клиентские события:
 *  - ЛКМ со строительным планом — установка выбранного элемента;
 *  - отрисовка превью под прицелом;
 *  - HUD-подсказки.
 */
@Mod.EventBusSubscriber(modid = RustLikeMod.MODID, value = Dist.CLIENT)
public final class ClientEvents {

    private ClientEvents() {
    }

    @SubscribeEvent
    public static void onClickInput(InputEvent.ClickInputEvent event) {
        if (!event.isAttack() || event.getButton() != 0) {
            return;
        }

        Minecraft mc = Minecraft.getInstance();
        if (mc.screen != null || mc.player == null || mc.level == null) {
            return;
        }
        if (!(mc.player.getMainHandItem().getItem() instanceof BuildingPlanItem)) {
            return;
        }

        // План не должен «бить» блоки и существ — заменяем атаку установкой.
        event.setCanceled(true);

        if (!(mc.hitResult instanceof BlockHitResult hit) || hit.getType() == HitResult.Type.MISS) {
            return;
        }

        PieceType piece = ClientState.selected();
        BlockPos pos = PlacementRules.clientTargetPos(hit, piece);

        ModNetwork.sendToServer(new PlaceStructureC2S(pos, piece.id()));
        mc.player.swing(InteractionHand.MAIN_HAND);
    }

    @SubscribeEvent
    public static void onRenderLevel(RenderLevelStageEvent event) {
        PreviewRenderer.render(event);
    }

    @SubscribeEvent
    public static void onRenderGui(RenderGuiEvent.Post event) {
        HudOverlay.render(event);
    }
}
