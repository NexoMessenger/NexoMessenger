package dev.rustlike.piece;

import net.minecraft.sounds.SoundEvent;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundType;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.Items;

/**
 * Уровни строительства (материалы) — как в Rust:
 * ветки → дерево → камень → металл → улучшенный металл.
 *
 * Каждый уровень задаёт: прочность, устойчивость к взрывам,
 * звук, предмет-стоимость (для ремонта) и звуки двери.
 */
public enum StructureTier {

    TWIGS(0, 20, 0.5F, SoundType.WOOD, Items.STICK,
            SoundEvents.WOODEN_DOOR_OPEN, SoundEvents.WOODEN_DOOR_CLOSE),
    WOOD(1, 60, 1.5F, SoundType.WOOD, Items.OAK_PLANKS,
            SoundEvents.WOODEN_DOOR_OPEN, SoundEvents.WOODEN_DOOR_CLOSE),
    STONE(2, 150, 4.0F, SoundType.STONE, Items.COBBLESTONE,
            SoundEvents.IRON_DOOR_OPEN, SoundEvents.IRON_DOOR_CLOSE),
    METAL(3, 400, 8.0F, SoundType.METAL, Items.IRON_INGOT,
            SoundEvents.IRON_DOOR_OPEN, SoundEvents.IRON_DOOR_CLOSE),
    ARMORED(4, 800, 12.0F, SoundType.METAL, Items.DIAMOND,
            SoundEvents.IRON_DOOR_OPEN, SoundEvents.IRON_DOOR_CLOSE);

    private final int id;
    private final int maxDamage;
    private final float explosionResistance;
    private final SoundType soundType;
    private final Item costItem;
    private final SoundEvent doorOpen;
    private final SoundEvent doorClose;

    StructureTier(int id, int maxDamage, float explosionResistance, SoundType soundType,
                  Item costItem, SoundEvent doorOpen, SoundEvent doorClose) {
        this.id = id;
        this.maxDamage = maxDamage;
        this.explosionResistance = explosionResistance;
        this.soundType = soundType;
        this.costItem = costItem;
        this.doorOpen = doorOpen;
        this.doorClose = doorClose;
    }

    public int id() {
        return id;
    }

    /** Максимальный запас «здоровья» постройки этого уровня. */
    public int maxDamage() {
        return maxDamage;
    }

    public float explosionResistance() {
        return explosionResistance;
    }

    public SoundType soundType() {
        return soundType;
    }

    /** Предмет, которым чинится конструкция этого уровня. */
    public Item costItem() {
        return costItem;
    }

    public SoundEvent doorOpenSound() {
        return doorOpen;
    }

    public SoundEvent doorCloseSound() {
        return doorClose;
    }

    /** Ключ локализации: rustlike.tier.0 … rustlike.tier.4 */
    public String nameKey() {
        return "rustlike.tier." + id;
    }

    /** Сколько урона наносит взрыв заданной мощности с учётом сопротивления. */
    public int blastDamage(float blastPower) {
        int dmg = (int) (blastPower / Math.max(0.1F, explosionResistance));
        return Math.max(0, dmg);
    }

    public static StructureTier byId(int id) {
        if (id < 0 || id >= values().length) {
            return TWIGS;
        }
        return values()[id];
    }
}
