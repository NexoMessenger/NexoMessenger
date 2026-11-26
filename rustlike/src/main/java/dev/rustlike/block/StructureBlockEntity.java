package dev.rustlike.block;

import dev.rustlike.ModRegistry;
import net.minecraft.core.BlockPos;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.network.protocol.Packet;
import net.minecraft.network.protocol.game.ClientboundBlockEntityDataPacket;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;

/**
 * Блок-сущность постройки: хранит накопленный урон.
 *
 * Именно его данные позволяют чинить постройку молотком.
 * Данные автоматически сохраняются в мир (NBT) и переживают
 * выход из игры и перезапуск сервера.
 */
public class StructureBlockEntity extends BlockEntity {

    private static final String KEY_DAMAGE = "damage";

    private int damage = 0;

    public StructureBlockEntity(BlockPos pos, BlockState state) {
        super(ModRegistry.STRUCTURE_BE.get(), pos, state);
    }

    public int getDamage() {
        return damage;
    }

    public void setDamage(int value) {
        this.damage = Math.max(0, value);
        setChanged();
    }

    public void addDamage(int amount) {
        if (amount > 0) {
            setDamage(this.damage + amount);
        }
    }

    @Override
    protected void saveAdditional(CompoundTag tag) {
        super.saveAdditional(tag);
        tag.putInt(KEY_DAMAGE, damage);
    }

    @Override
    public void load(CompoundTag tag) {
        super.load(tag);
        damage = tag.getInt(KEY_DAMAGE);
    }

    @Override
    public CompoundTag getUpdateTag() {
        CompoundTag tag = new CompoundTag();
        saveAdditional(tag);
        return tag;
    }

    @Override
    public ClientboundBlockEntityDataPacket getUpdatePacket() {
        return ClientboundBlockEntityDataPacket.create(this);
    }
}
