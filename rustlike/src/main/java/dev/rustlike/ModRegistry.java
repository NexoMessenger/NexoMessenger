package dev.rustlike;

import dev.rustlike.block.DoorwayBlock;
import dev.rustlike.block.FoundationBlock;
import dev.rustlike.block.WallBlock;
import dev.rustlike.item.BuildingPlanItem;
import dev.rustlike.item.HammerItem;
import dev.rustlike.block.StructureBlockEntity;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.Item;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.SoundType;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.ForgeRegistries;
import net.minecraftforge.registries.RegistryObject;

/**
 * Реестр всех блоков и предметов мода.
 * Здесь объявлено всё, что появится в игре.
 */
public final class ModRegistry {

    public static final DeferredRegister<Block> BLOCKS =
            DeferredRegister.create(ForgeRegistries.BLOCKS, RustLikeMod.MODID);

    public static final DeferredRegister<Item> ITEMS =
            DeferredRegister.create(ForgeRegistries.ITEMS, RustLikeMod.MODID);

    public static final DeferredRegister<BlockEntityType<?>> BLOCK_ENTITIES =
            DeferredRegister.create(ForgeRegistries.BLOCK_ENTITY_TYPES, RustLikeMod.MODID);

    // ---------- БЛОКИ ПОСТРОЕК ----------

    public static final RegistryObject<Block> FOUNDATION = BLOCKS.register("foundation",
            () -> new FoundationBlock(props(3.0F, 4.0F)));

    public static final RegistryObject<Block> WALL = BLOCKS.register("wall",
            () -> new WallBlock(props(4.0F, 6.0F)));

    public static final RegistryObject<Block> DOORWAY = BLOCKS.register("doorway",
            () -> new DoorwayBlock(props(4.0F, 6.0F)));

    private static BlockBehaviour.Properties props(float strength, float resistance) {
        return BlockBehaviour.Properties.of()
                .strength(strength, resistance)
                .sound(SoundType.STONE)
                .noOcclusion();
    }

    // ---------- ПРЕДМЕТЫ-БЛОКИ (чтобы класть в инвентарь) ----------

    public static final RegistryObject<Item> FOUNDATION_ITEM = ITEMS.register("foundation",
            () -> new BlockItem(FOUNDATION.get(), new Item.Properties()));

    public static final RegistryObject<Item> WALL_ITEM = ITEMS.register("wall",
            () -> new BlockItem(WALL.get(), new Item.Properties()));

    public static final RegistryObject<Item> DOORWAY_ITEM = ITEMS.register("doorway",
            () -> new BlockItem(DOORWAY.get(), new Item.Properties()));

    // ---------- ИНСТРУМЕНТЫ ----------

    /** Строительный план: ПКМ — круговое меню, ЛКМ — установка. */
    public static final RegistryObject<Item> BUILDING_PLAN = ITEMS.register("building_plan",
            () -> new BuildingPlanItem(new Item.Properties().stacksTo(1)));

    /** Молоток: ПКМ по постройке — осмотр, ремонт и улучшение. */
    public static final RegistryObject<Item> HAMMER = ITEMS.register("hammer",
            () -> new HammerItem(new Item.Properties().stacksTo(1)));

    // ---------- БЛОК-СУЩНОСТЬ (хранит урон постройки) ----------

    public static final RegistryObject<BlockEntityType<StructureBlockEntity>> STRUCTURE_BE =
            BLOCK_ENTITIES.register("structure",
                    () -> BlockEntityType.Builder.of(StructureBlockEntity::new,
                            FOUNDATION.get(), WALL.get(), DOORWAY.get()).build(null));

    private ModRegistry() {
    }
}
