package dev.rustlike.block;

import net.minecraft.world.level.block.state.BlockBehaviour;

/**
 * Стена — полноразмерный блок (1×1×1).
 * Ставится на фундамент или впритык к другой постройке.
 */
public class WallBlock extends StructureBlock {

    public WallBlock(Properties properties) {
        super(properties);
        // Форма по умолчанию — полный куб, отдельный getShape не нужен.
    }
}
