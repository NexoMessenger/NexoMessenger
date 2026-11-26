package dev.rustlike.network;

import dev.rustlike.client.HammerScreen;
import net.minecraft.client.Minecraft;
import net.minecraft.core.BlockPos;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraftforge.api.distmarker.Dist;
import net.minecraftforge.fml.DistExecutor;
import net.minecraftforge.network.NetworkEvent;

import java.util.function.Supplier;

/**
 * Сервер отправляет клиенту данные для экрана молотка.
 *
 * Данные: позиция, тип постройки, уровень, урон/макс. урон,
 * а также стоимость ремонта и улучшения.
 */
public record OpenHammerScreenS2C(
        BlockPos pos,
        int pieceId,
        int tier,
        int damage,
        int maxDamage,
        String repairItem,
        int repairCost,
        String upgradeItem,
        int upgradeCost) {

    public static void encode(OpenHammerScreenS2C message, FriendlyByteBuf buffer) {
        buffer.writeBlockPos(message.pos);
        buffer.writeVarInt(message.pieceId);
        buffer.writeVarInt(message.tier);
        buffer.writeVarInt(message.damage);
        buffer.writeVarInt(message.maxDamage);
        buffer.writeUtf(message.repairItem == null ? "" : message.repairItem);
        buffer.writeVarInt(message.repairCost);
        buffer.writeUtf(message.upgradeItem == null ? "" : message.upgradeItem);
        buffer.writeVarInt(message.upgradeCost);
    }

    public static OpenHammerScreenS2C decode(FriendlyByteBuf buffer) {
        return new OpenHammerScreenS2C(
                buffer.readBlockPos(),
                buffer.readVarInt(),
                buffer.readVarInt(),
                buffer.readVarInt(),
                buffer.readVarInt(),
                buffer.readUtf(),
                buffer.readVarInt(),
                buffer.readUtf(),
                buffer.readVarInt());
    }

    public static void handle(OpenHammerScreenS2C message, Supplier<NetworkEvent.Context> ctx) {
        ModNetwork.enqueue(() -> DistExecutor.unsafeRunWhenOn(Dist.CLIENT, () -> () -> {
            Minecraft.getInstance().setScreen(new HammerScreen(
                    message.pos, message.pieceId, message.tier,
                    message.damage, message.maxDamage,
                    message.repairItem, message.repairCost,
                    message.upgradeItem, message.upgradeCost));
        }), ctx);
    }
}
