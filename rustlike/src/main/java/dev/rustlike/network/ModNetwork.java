package dev.rustlike.network;

import dev.rustlike.RustLikeMod;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;
import net.minecraftforge.network.NetworkEvent;
import net.minecraftforge.network.NetworkRegistry;
import net.minecraftforge.network.PacketDistributor;
import net.minecraftforge.network.simple.SimpleChannel;

import java.util.function.Supplier;

/**
 * Сетевой канал мода.
 *
 * Клиент → сервер:
 *   PlaceStructureC2S   — «поставь элемент под таким-то блоком»
 *   HammerActionC2S     — «почини / улучши постройку»
 * Сервер → клиент:
 *   OpenHammerScreenS2C — «вот данные для экрана молотка»
 *
 * Все действия проверяются на сервере — это защита от читов
 * и гарантия корректной работы в мультиплеере.
 */
public final class ModNetwork {

    private static final String PROTOCOL_VERSION = "1";

    public static final SimpleChannel CHANNEL = NetworkRegistry.newSimpleChannel(
            new ResourceLocation(RustLikeMod.MODID, "main"),
            () -> PROTOCOL_VERSION,
            PROTOCOL_VERSION::equals,
            PROTOCOL_VERSION::equals);

    private ModNetwork() {
    }

    public static void register() {
        CHANNEL.registerMessage(0, PlaceStructureC2S.class,
                PlaceStructureC2S::encode, PlaceStructureC2S::decode, PlaceStructureC2S::handle);
        CHANNEL.registerMessage(1, HammerActionC2S.class,
                HammerActionC2S::encode, HammerActionC2S::decode, HammerActionC2S::handle);
        CHANNEL.registerMessage(2, OpenHammerScreenS2C.class,
                OpenHammerScreenS2C::encode, OpenHammerScreenS2C::decode, OpenHammerScreenS2C::handle);
    }

    /** Отправить сообщение серверу (с клиента). */
    public static void sendToServer(Object message) {
        CHANNEL.sendToServer(message);
    }

    /** Отправить сообщение конкретному игроку (с сервера). */
    public static void sendToPlayer(ServerPlayer player, Object message) {
        CHANNEL.send(PacketDistributor.PLAYER.with(() -> player), message);
    }

    /** Общая обёртка для обработчиков: выполняет код на главном потоке. */
    public static void enqueue(Runnable work, Supplier<NetworkEvent.Context> ctx) {
        ctx.get().enqueueWork(work);
        ctx.get().setPacketHandled(true);
    }
}
