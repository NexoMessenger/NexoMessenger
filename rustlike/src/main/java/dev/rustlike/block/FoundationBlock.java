package dev.rustlike.block;

import net.minecraft.core.BlockPos;
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.properties.IntegerProperty;
import net.minecraft.world.phys.shapes.CollisionContext;
import net.minecraft.world.phys.shapes.VoxelShape;

/**
 * Квадратный фундамент — плита высотой 3/16 блока.
 * Ставится только на твёрдую поверхность.
 */
public class FoundationBlock extends StructureBlock {

    private static final VoxelShape SHAPE = Block.box(0, 0, 0, 16, 3, 16);

    public FoundationBlock(Properties properties) {
        super(properties);
    }

    @Override
    public VoxelShape getShape(BlockState state, BlockGetter level, BlockPos pos, CollisionContext context) {
        return SHAPE;
    }
}
