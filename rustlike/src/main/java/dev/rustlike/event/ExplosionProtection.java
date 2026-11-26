package dev.rustlike.event;

import dev.rustlike.RustConfig;
import dev.rustlike.RustLikeMod;
import dev.rustlike.block.StructureBlock;
import dev.rustlike.block.StructureBlockEntity;
import dev.rustlike.piece.StructureTier;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraftforge.event.level.ExplosionEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;

import java.util.Iterator;

/**
 * Взрывы (крипер, TNT) не разрушают постройки мгновенно —
 * вместо этого наносят им урон, зависящий от уровня материала.
 * Позже постройку можно починить молотком.
 */
@Mod.EventBusSubscriber(modid = RustLikeMod.MODID)
public final class ExplosionProtection {

    /** Базовая мощность урона взрыва (примерно как у крипера/TNT). */
    private static final float BLAST_POWER = 4.0F;

    private ExplosionProtection() {
    }

    @SubscribeEvent
    public static void onDetonate(ExplosionEvent.Detonate event) {
        if (!RustConfig.EXPLOSION_DAMAGE_ENABLED.get()) {
            return;
        }

        Level level = event.getLevel();
        Iterator<BlockPos> iterator = event.getAffectedBlocks().iterator();
        while (iterator.hasNext()) {
            BlockPos pos = iterator.next();
            BlockState state = level.getBlockState(pos);
            if (!(state.getBlock() instanceof StructureBlock)) {
                continue;
            }

            // Убираем постройку из списка разрушаемых блоков.
            iterator.remove();

            StructureTier tier = StructureTier.byId(state.getValue(StructureBlock.TIER));
            int damage = tier.blastDamage(BLAST_POWER);
            if (damage > 0 && level.getBlockEntity(pos) instanceof StructureBlockEntity be) {
                be.addDamage(damage);
            }
        }
    }
}
