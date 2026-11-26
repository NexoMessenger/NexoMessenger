package dev.rustlike.network;

import dev.rustlike.item.BuildingPlanItem;
import dev.rustlike.logic.PlacementRules;
import dev.rustlike.piece.PieceType;
import net.minecraft.core.BlockPos;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraftforge.network.NetworkEvent;

import java.util.function.Supplier;

/**
 * Клиент просит сервер установить выбранный элемент строительства.
 * pos — блок, куда ставить; pieceId — что ставить.
 * Сервер ВСЕГДА перепроверяет правила и ресурсы.
 */
public record PlaceStructureC2S(BlockPos pos, int pieceId) {

    public static void encode(PlaceStructureC2S message, FriendlyByteBuf buffer) {
        buffer.writeBlockPos(message.pos);
        buffer.writeVarInt(message.pieceId);
    }

    public static PlaceStructureC2S decode(FriendlyByteBuf buffer) {
        return new PlaceStructureC2S(buffer.readBlockPos(), buffer.readVarInt());
    }

    public static void handle(PlaceStructureC2S message, Supplier<NetworkEvent.Context> ctx) {
        ModNetwork.enqueue(() -> {
            ServerPlayer player = ctx.get().getSender();
            if (player == null) {
                return;
            }
            if (!(player.getMainHandItem().getItem() instanceof BuildingPlanItem)) {
                player.displayClientMessage(
                        Component.translatable("rustlike.msg.need_plan"), true);
                return;
            }
            PieceType piece = PieceType.byId(message.pieceId);
            if (piece == null) {
                return;
            }
            PlacementRules.tryPlace(player, message.pos, piece);
        }, ctx);
    }
}
