package dev.rustlike.piece;

import dev.rustlike.ModRegistry;
import dev.rustlike.RustConfig;
import net.minecraft.world.item.Item;
import net.minecraft.world.level.block.Block;

/**
 * Типы строительных элементов (то, что выбирается в круговом меню).
 */
public enum PieceType {

    /** Квадратный фундамент — ставится на твёрдую землю. */
    FOUNDATION(0, "foundation"),

    /** Стена — ставится на фундамент или к другой постройке. */
    WALL(1, "wall"),

    /** Дверной проём — ставится как стена, с проходом. */
    DOORWAY(2, "doorway"),

    /** Дверь — устанавливается В готовый дверной проём. */
    DOOR(3, "door");

    private final int id;
    private final String key;

    PieceType(int id, String key) {
        this.id = id;
        this.key = key;
    }

    public int id() {
        return id;
    }

    /** Ключ локализации: rustlike.piece.foundation и т.д. */
    public String nameKey() {
        return "rustlike.piece." + key;
    }

    /** Блок, который ставится этим элементом (для двери — сам проём). */
    public Block block() {
        switch (this) {
            case FOUNDATION: return ModRegistry.FOUNDATION.get();
            case WALL:       return ModRegistry.WALL.get();
            case DOORWAY:    return ModRegistry.DOORWAY.get();
            case DOOR:       return ModRegistry.DOORWAY.get();
            default:         return ModRegistry.WALL.get();
        }
    }

    /** Предмет-иконка для кругового меню. */
    public Item iconItem() {
        if (this == DOOR) {
            return net.minecraft.world.item.Items.IRON_DOOR;
        }
        return block().asItem();
    }

    /** Расход ресурсов на установку (палки, настраиваются в конфиге). */
    public int placeCost() {
        switch (this) {
            case FOUNDATION: return RustConfig.PLACE_COST_FOUNDATION.get();
            case WALL:       return RustConfig.PLACE_COST_WALL.get();
            case DOORWAY:    return RustConfig.PLACE_COST_DOORWAY.get();
            case DOOR:       return RustConfig.PLACE_COST_DOOR.get();
            default:         return 0;
        }
    }

    /** Предмет, который тратится на установку (все элементы — палки). */
    public Item placeCostItem() {
        return net.minecraft.world.item.Items.STICK;
    }

    public static PieceType byId(int id) {
        for (PieceType p : values()) {
            if (p.id == id) {
                return p;
            }
        }
        return null;
    }
}
