package dev.rustlike.block;

import net.minecraft.core.BlockPos;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.BaseEntityBlock;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.RenderShape;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.BlockEntityTicker;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.IntegerProperty;

import javax.annotation.Nullable;

/**
 * Базовый класс всех построек (фундамент, стена, дверной проём).
 *
 * Общее:
 *  - свойство TIER (0..4) — уровень материала (ветки…улучш. металл);
 *  - блок-сущность StructureBlockEntity — хранит урон (для ремонта);
 *  - обычный рендер модели (как у обычных блоков).
 */
public abstract class StructureBlock extends BaseEntityBlock {

    /** Уровень материала: 0=ветки, 1=дерево, 2=камень, 3=металл, 4=улучш. металл. */
    public static final IntegerProperty TIER = IntegerProperty.create("tier", 0, 4);

    protected StructureBlock(Properties properties) {
        super(properties);
    }

    @Override
    protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> builder) {
        builder.add(TIER);
    }

    @Nullable
    @Override
    public BlockEntity newBlockEntity(BlockPos pos, BlockState state) {
        return new StructureBlockEntity(pos, state);
    }

    @Override
    public RenderShape getRenderShape(BlockState state) {
        // Постройки рисуются обычной моделью, а не через TESR.
        return RenderShape.MODEL;
    }

    @Nullable
    @Override
    public <T extends BlockEntity> BlockEntityTicker<T> getTicker(Level level, BlockState state,
                                                                 BlockEntityType<T> type) {
        // Тикер не нужен: урон обновляется по событиям (взрывы, ремонт).
        return null;
    }
}
