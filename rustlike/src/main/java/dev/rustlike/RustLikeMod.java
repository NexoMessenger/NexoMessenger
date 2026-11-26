package dev.rustlike;

import dev.rustlike.network.ModNetwork;
import net.minecraftforge.fml.ModLoadingContext;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.config.ModConfig;
import net.minecraftforge.fml.javafmlmod.FMLJavaModLoadingContext;
import net.minecraftforge.eventbus.api.IEventBus;

/**
 * Главный класс мода RustLike.
 *
 * Регистрирует блоки, предметы, сетевые пакеты и конфигурацию.
 * Все остальные классы подключаются отсюда.
 */
@Mod(RustLikeMod.MODID)
public final class RustLikeMod {

    public static final String MODID = "rustlike";

    public RustLikeMod() {
        // Шина событий мода (регистрация контента)
        IEventBus modBus = FMLJavaModLoadingContext.get().getModEventBus();
        ModRegistry.BLOCKS.register(modBus);
        ModRegistry.ITEMS.register(modBus);
        ModRegistry.BLOCK_ENTITIES.register(modBus);

        // Сетевые каналы (команды клиент ↔ сервер)
        ModNetwork.register();

        // Конфигурация (файл config/rustlike-common.toml)
        ModLoadingContext.get().registerConfig(ModConfig.Type.COMMON, RustConfig.SPEC);
    }
}
