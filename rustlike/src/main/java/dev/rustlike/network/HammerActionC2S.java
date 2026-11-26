package dev.rustlike.network;

import dev.rustlike.logic.StructureActions;
import net.minecraft.core.BlockPos;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.server.level.ServerPlayer;
import net.minecraftforge.network.NetworkEvent;

import java.util.function.Supplier;

/**
 * Клиент просит сервер выполнить действие молотка
 * (0 — ремонт, 1 — улучшение) над постройкой pos.
 */
public record HammerActionC2S(BlockPos pos, int action) {

    public static void encode(HammerActionC2S message, FriendlyByteBuf buffer) {
        buffer.writeBlockPos(message.pos);
        buffer.writeVarInt(message.action);
    }

    public static HammerActionC2S decode(FriendlyByteBuf buffer) {
        return new HammerActionC2S(buffer.readBlockPos(), buffer.readVarInt());
    }

    public static void handle(HammerActionC2S message, Supplier<NetworkEvent.Context> ctx) {
        ModNetwork.enqueue(() -> {
            ServerPlayer player = ctx.get().getSender();
            if (player != null) {
                StructureActions.handle(player, message.pos, message.action);
            }
        }, ctx);
    }
}
