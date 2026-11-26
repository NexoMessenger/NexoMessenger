package dev.rustlike.event;

import dev.rustlike.ModRegistry;
import dev.rustlike.RustLikeMod;
import net.minecraft.world.item.CreativeModeTabs;
import net.minecraftforge.event.BuildCreativeModeTabContentsEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;

/**
 * Предметы мода в творческих вкладках:
 *  - постройки — во вкладке «Строительные блоки»;
 *  - план и молоток — во вкладке «Инструменты».
 */
@Mod.EventBusSubscriber(modid = RustLikeMod.MODID, bus = Mod.EventBusSubscriber.Bus.MOD)
public final class CreativeTabEvents {

    private CreativeTabEvents() {
    }

    @SubscribeEvent
    public static void onTabContents(BuildCreativeModeTabContentsEvent event) {
        if (event.getTabKey().equals(CreativeModeTabs.BUILDING_BLOCKS)) {
            event.accept(ModRegistry.FOUNDATION_ITEM.get());
            event.accept(ModRegistry.WALL_ITEM.get());
            event.accept(ModRegistry.DOORWAY_ITEM.get());
        }
        if (event.getTabKey().equals(CreativeModeTabs.TOOLS_AND_UTILITIES)) {
            event.accept(ModRegistry.BUILDING_PLAN.get());
            event.accept(ModRegistry.HAMMER.get());
        }
    }
}
