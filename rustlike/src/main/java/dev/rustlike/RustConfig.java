package dev.rustlike;

import net.minecraftforge.common.ForgeConfigSpec;

/**
 * Настройки мода (файл config/rustlike-common.toml).
 *
 * Позволяет менять баланс без пересборки: расход ресурсов,
 * дальность строительства, урон взрывами и т.д.
 */
public final class RustConfig {

    public static final ForgeConfigSpec SPEC;

    // --- Расход ресурсов на установку (в палках) ---
    public static final ForgeConfigSpec.IntValue PLACE_COST_FOUNDATION;
    public static final ForgeConfigSpec.IntValue PLACE_COST_WALL;
    public static final ForgeConfigSpec.IntValue PLACE_COST_DOORWAY;
    public static final ForgeConfigSpec.IntValue PLACE_COST_DOOR;

    // --- Стоимость улучшения до уровня (предметами уровня) ---
    public static final ForgeConfigSpec.IntValue UPGRADE_COST_WOOD;
    public static final ForgeConfigSpec.IntValue UPGRADE_COST_STONE;
    public static final ForgeConfigSpec.IntValue UPGRADE_COST_METAL;
    public static final ForgeConfigSpec.IntValue UPGRADE_COST_ARMORED;

    // --- Прочее ---
    public static final ForgeConfigSpec.DoubleValue REPAIR_COST_MULTIPLIER;
    public static final ForgeConfigSpec.DoubleValue REACH_DISTANCE;
    public static final ForgeConfigSpec.BooleanValue SKIP_COSTS_IN_CREATIVE;
    public static final ForgeConfigSpec.BooleanValue EXPLOSION_DAMAGE_ENABLED;

    static {
        ForgeConfigSpec.Builder b = new ForgeConfigSpec.Builder();

        b.comment("Расход ресурсов на установку конструкций (палки)").push("building");
        PLACE_COST_FOUNDATION = b.defineInRange("placeCostFoundation", 6, 0, 64);
        PLACE_COST_WALL = b.defineInRange("placeCostWall", 4, 0, 64);
        PLACE_COST_DOORWAY = b.defineInRange("placeCostDoorway", 4, 0, 64);
        PLACE_COST_DOOR = b.defineInRange("placeCostDoor", 2, 0, 64);
        b.pop();

        b.comment("Стоимость улучшения конструкции до следующего уровня").push("upgrading");
        UPGRADE_COST_WOOD = b.defineInRange("upgradeCostWood", 4, 0, 64);      // ветки  -> дерево
        UPGRADE_COST_STONE = b.defineInRange("upgradeCostStone", 6, 0, 64);     // дерево -> камень
        UPGRADE_COST_METAL = b.defineInRange("upgradeCostMetal", 8, 0, 64);     // камень -> металл
        UPGRADE_COST_ARMORED = b.defineInRange("upgradeCostArmored", 10, 0, 64);// металл -> улучш. металл
        REPAIR_COST_MULTIPLIER = b.comment("Множитель стоимости ремонта (1.0 = 1 предмет за единицу урона)")
                .defineInRange("repairCostMultiplier", 1.0, 0.0, 100.0);
        b.pop();

        b.comment("Правила строительства и взаимодействия").push("rules");
        REACH_DISTANCE = b.comment("Дальность установки (в блоках)").defineInRange("reachDistance", 6.0, 3.0, 16.0);
        SKIP_COSTS_IN_CREATIVE = b.comment("Не тратить ресурсы в творческом режиме").define("skipCostsInCreative", true);
        EXPLOSION_DAMAGE_ENABLED = b.comment("Взрывы наносят урон постройкам (вместо мгновенного разрушения)")
                .define("explosionDamageEnabled", true);
        b.pop();

        SPEC = b.build();
    }

    /** Стоимость улучшения ДО указанного уровня (1..4). */
    public static int upgradeCostTo(int targetTier) {
        switch (targetTier) {
            case 1:  return UPGRADE_COST_WOOD.get();
            case 2:  return UPGRADE_COST_STONE.get();
            case 3:  return UPGRADE_COST_METAL.get();
            case 4:  return UPGRADE_COST_ARMORED.get();
            default: return 0;
        }
    }

    private RustConfig() {
    }
}
