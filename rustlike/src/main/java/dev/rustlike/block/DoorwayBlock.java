package dev.rustlike.block;

import dev.rustlike.piece.StructureTier;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.BooleanProperty;
import net.minecraft.world.level.block.state.properties.HorizontalDirectionalProperty;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.shapes.CollisionContext;
import net.minecraft.world.phys.shapes.Shapes;
import net.minecraft.world.phys.shapes.VoxelShape;

/**
 * Дверной проём: рама (2 столба + перемычка сверху).
 *
 * Свойства:
 *  - TIER      — уровень материала (0..4);
 *  - HAS_DOOR  — установлена ли дверь;
 *  - OPEN      — открыта ли дверь;
 *  - FACING    — направление проёма (куда «смотрит» дверь).
 *
 * Дверь — это не отдельный блок, а состояние проёма, поэтому
 * она не может существовать без рамы (как и в Rust).
 */
public class DoorwayBlock extends StructureBlock {

    public static final BooleanProperty HAS_DOOR = BooleanProperty.create("has_door");
    public static final BooleanProperty OPEN = BooleanProperty.create("open");
    public static final HorizontalDirectionalProperty FACING =
            HorizontalDirectionalProperty.create("facing", Direction.Plane.HORIZONTAL);

    // --- Формы (VoxelShape) в ориентации «facing = south» ---
    // Рама: левый столб (x 0..3), правый столб (x 13..16), перемычка (y 13..16).
    private static final VoxelShape FRAME_S = Shapes.or(
            Block.box(0, 0, 0, 3, 16, 16),
            Block.box(13, 0, 0, 16, 16, 16),
            Block.box(0, 13, 0, 16, 16, 16)
    ).optimize();

    // Панель закрытой двери: поперёк проёма, по центру толщиной 2 px.
    private static final VoxelShape PANEL_CLOSED_S = Block.box(3, 0, 7, 13, 13, 9);

    // Панель открытой двери: сложена к левому столбу.
    private static final VoxelShape PANEL_OPEN_S = Block.box(3, 0, 2, 5, 13, 14);

    // Повороты вокруг Y: 0=юг, 1=запад, 2=север, 3=восток (совпадает с y=0/90/180/270 в blockstate).
    private static final VoxelShape[] FRAME = rotateAll(FRAME_S);
    private static final VoxelShape[] CLOSED = rotateAll(PANEL_CLOSED_S);
    private static final VoxelShape[] OPENED = rotateAll(PANEL_OPEN_S);

    // Предвычисленные комбинации: [facingIndex][hasDoor][open]
    private static final VoxelShape[][][] COMBO = buildCombos();

    private static VoxelShape[][][] buildCombos() {
        VoxelShape[][][] result = new VoxelShape[4][2][2];
        for (int f = 0; f < 4; f++) {
            for (int d = 0; d < 2; d++) {
                for (int o = 0; o < 2; o++) {
                    VoxelShape shape = FRAME[f];
                    if (d == 1) {
                        shape = Shapes.or(shape, o == 1 ? OPENED[f] : CLOSED[f]);
                    }
                    result[f][d][o] = shape.optimize();
                }
            }
        }
        return result;
    }

    private static VoxelShape[] rotateAll(VoxelShape base) {
        VoxelShape[] out = new VoxelShape[4];
        out[0] = base;
        out[1] = rotate90(out[0]);
        out[2] = rotate90(out[1]);
        out[3] = rotate90(out[2]);
        return out;
    }

    /** Поворот на 90° вокруг центра блока: (x, z) -> (16 - z, x). */
    private static VoxelShape rotate90(VoxelShape shape) {
        java.util.List<net.minecraft.world.phys.AABB> boxes = shape.toAabbs();
        net.minecraft.world.phys.AABB[] rotated = new net.minecraft.world.phys.AABB[boxes.size()];
        for (int i = 0; i < boxes.size(); i++) {
            net.minecraft.world.phys.AABB a = boxes.get(i);
            rotated[i] = new net.minecraft.world.phys.AABB(
                    16.0D - a.maxZ, a.minY, a.minX,
                    16.0D - a.minZ, a.maxY, a.maxX);
        }
        return Shapes.or(rotated).optimize();
    }

    public DoorwayBlock(Properties properties) {
        super(properties);
        // Значения по умолчанию: без двери, закрыта, «смотрит» на юг.
        registerDefaultState(this.defaultBlockState()
                .setValue(FACING, Direction.SOUTH)
                .setValue(HAS_DOOR, false)
                .setValue(OPEN, false)
                .setValue(TIER, 0));
    }

    @Override
    protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> builder) {
        super.createBlockStateDefinition(builder); // добавляет TIER
        builder.add(HAS_DOOR, OPEN, FACING);
    }

    @Override
    public BlockState getStateForPlacement(net.minecraft.world.item.context.BlockPlaceContext context) {
        Player player = context.getPlayer();
        float yRot = player != null ? player.getYRot() : 0.0F;
        return this.defaultBlockState()
                .setValue(FACING, Direction.fromYRot(yRot))
                .setValue(HAS_DOOR, false)
                .setValue(OPEN, false)
                .setValue(TIER, 0);
    }

    @Override
    public VoxelShape getShape(BlockState state, BlockGetter level, BlockPos pos, CollisionContext context) {
        int f = facingIndex(state.getValue(FACING));
        int d = state.getValue(HAS_DOOR) ? 1 : 0;
        int o = state.getValue(OPEN) ? 1 : 0;
        return COMBO[f][d][o];
    }

    @Override
    public InteractionResult use(BlockState state, Level level, BlockPos pos,
                                 Player player, InteractionHand hand, BlockHitResult hit) {
        if (!state.getValue(HAS_DOOR)) {
            // Двери нет — дальше может сработать другое взаимодействие (например, молоток).
            return InteractionResult.PASS;
        }
        if (!level.isClientSide) {
            boolean nowOpen = !state.getValue(OPEN);
            level.setBlock(pos, state.setValue(OPEN, nowOpen), 3);
            StructureTier tier = StructureTier.byId(state.getValue(TIER));
            level.playSound(null, pos,
                    nowOpen ? tier.doorOpenSound() : tier.doorCloseSound(),
                    SoundSource.BLOCKS, 1.0F, 1.0F);
        }
        return InteractionResult.sidedSuccess(level.isClientSide);
    }

    private static int facingIndex(Direction direction) {
        switch (direction) {
            case WEST:  return 1;
            case NORTH: return 2;
            case EAST:  return 3;
            case SOUTH:
            default:    return 0;
        }
    }
}
