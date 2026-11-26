package dev.rustlike.logic;

import dev.rustlike.RustConfig;
import dev.rustlike.block.DoorwayBlock;
import dev.rustlike.block.StructureBlock;
import dev.rustlike.item.BuildingPlanItem;
import dev.rustlike.piece.PieceType;
import dev.rustlike.piece.StructureTier;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.shapes.CollisionContext;

/**
 * Правила строительства: проверка возможности установки и сама установка.
 *
 * Одни и те же правила используются:
 *  - на клиенте — чтобы красить превью в зелёный/красный;
 *  - на сервере — чтобы поставить блок (защита от читов).
 */
public final class PlacementRules {

    private PlacementRules() {
    }

    /** Результат проверки: можно ставить + сообщение-причина отказа. */
    public record Result(boolean ok, Component message) {
        public static Result fail(String key, Object... args) {
            return new Result(false, Component.translatable(key, args));
        }

        public static Result success() {
            return new Result(true, Component.empty());
        }
    }

    /** Позиция установки: для двери — сам блок проёма, для остальных — блок перед прицелом. */
    public static BlockPos clientTargetPos(BlockHitResult hit, PieceType piece) {
        if (piece == PieceType.DOOR) {
            return hit.getBlockPos();
        }
        return hit.getBlockPos().relative(hit.getDirection());
    }

    /**
     * Полная проверка возможности установки.
     *
     * @param ignoreReach true — для клиентского превью (дальность считает сервер отдельно)
     */
    public static Result validate(Level level, Player player, BlockPos pos, PieceType piece, boolean ignoreReach) {
        if (piece == null) {
            return Result.fail("rustlike.msg.need_plan");
        }
        if (!level.isLoaded(pos)) {
            return Result.fail("rustlike.msg.not_loaded");
        }
        if (!ignoreReach && !inReach(player, pos)) {
            return Result.fail("rustlike.msg.too_far");
        }

        BlockState state = level.getBlockState(pos);

        if (piece == PieceType.DOOR) {
            // Дверь ставится только в пустой дверной проём.
            if (!(state.getBlock() instanceof DoorwayBlock) || state.getValue(DoorwayBlock.HAS_DOOR)) {
                return Result.fail("rustlike.msg.need_doorway");
            }
            return checkResources(player, piece);
        }

        // Остальные элементы ставятся только в свободное место
        // (пустая форма = воздух, трава, цветы, вода и т.п.).
        if (!state.getShape(level, pos, CollisionContext.empty()).isEmpty()) {
            return Result.fail("rustlike.msg.occupied");
        }

        if (piece == PieceType.FOUNDATION) {
            // Фундаменту нужна твёрдая опора снизу.
            BlockPos belowPos = pos.below();
            BlockState below = level.getBlockState(belowPos);
            if (below.getCollisionShape(level, belowPos, CollisionContext.empty()).isEmpty()) {
                return Result.fail("rustlike.msg.need_ground");
            }
        } else {
            // Стена/проём: снизу или рядом должна быть постройка.
            if (!hasStructureNeighbor(level, pos)) {
                return Result.fail("rustlike.msg.need_support");
            }
        }

        return checkResources(player, piece);
    }

    /** Есть ли постройка снизу или на одном уровне по горизонтали. */
    private static boolean hasStructureNeighbor(Level level, BlockPos pos) {
        if (level.getBlockState(pos.below()).getBlock() instanceof StructureBlock) {
            return true;
        }
        for (Direction direction : Direction.Plane.HORIZONTAL) {
            if (level.getBlockState(pos.relative(direction)).getBlock() instanceof StructureBlock) {
                return true;
            }
        }
        return false;
    }

    /** Достаточно ли ресурсов у игрока (или он в творческом режиме). */
    private static Result checkResources(Player player, PieceType piece) {
        if (isFree(player)) {
            return Result.success();
        }
        int need = piece.placeCost();
        int have = countItem(player.getInventory(), piece.placeCostItem());
        if (have < need) {
            return Result.fail("rustlike.msg.no_resources",
                    need, Component.translatable(piece.placeCostItem().getDescriptionId()));
        }
        return Result.success();
    }

    /** Тратятся ли ресурсы (творческий режим + настройка). */
    public static boolean isFree(Player player) {
        return player.getAbilities().instabuild && RustConfig.SKIP_COSTS_IN_CREATIVE.get();
    }

    /** Дальность от глаз игрока до центра блока. */
    public static boolean inReach(Player player, BlockPos pos) {
        double reach = RustConfig.REACH_DISTANCE.get();
        double dx = player.getX() - (pos.getX() + 0.5D);
        double dy = player.getEyeY() - (pos.getY() + 0.5D);
        double dz = player.getZ() - (pos.getZ() + 0.5D);
        return dx * dx + dy * dy + dz * dz <= reach * reach;
    }

    /** Сколько предметов такого типа в инвентаре. */
    public static int countItem(Inventory inventory, Item item) {
        int total = 0;
        for (ItemStack stack : inventory.items) {
            if (!stack.isEmpty() && stack.is(item)) {
                total += stack.getCount();
            }
        }
        return total;
    }

    /** Забрать предметы из инвентаря. false — если не хватает. */
    public static boolean takeItem(Player player, Item item, int amount) {
        if (amount <= 0 || isFree(player)) {
            return true;
        }
        Inventory inventory = player.getInventory();
        if (countItem(inventory, item) < amount) {
            return false;
        }
        int remaining = amount;
        for (int i = 0; i < inventory.items.size() && remaining > 0; i++) {
            ItemStack stack = inventory.items.get(i);
            if (stack.is(item)) {
                int take = Math.min(remaining, stack.getCount());
                stack.shrink(take);
                remaining -= take;
            }
        }
        return true;
    }

    /**
     * Установка конструкции (вызывается ТОЛЬКО на сервере из сетевого пакета).
     * Повторно проверяет правила, тратит ресурсы и ставит блок.
     */
    public static void tryPlace(ServerPlayer player, BlockPos pos, PieceType piece) {
        ServerLevel level = (ServerLevel) player.level();

        Result result = validate(level, player, pos, piece, false);
        if (!result.ok()) {
            player.displayClientMessage(result.message(), true);
            return;
        }

        if (!takeItem(player, piece.placeCostItem(), piece.placeCost())) {
            player.displayClientMessage(
                    Component.translatable("rustlike.msg.no_resources",
                            piece.placeCost(),
                            Component.translatable(piece.placeCostItem().getDescriptionId())), true);
            return;
        }

        BlockState newState;
        if (piece == PieceType.DOOR) {
            // Установка двери в существующий проём.
            BlockState doorway = level.getBlockState(pos);
            newState = doorway
                    .setValue(DoorwayBlock.HAS_DOOR, true)
                    .setValue(DoorwayBlock.OPEN, false);
        } else {
            newState = piece.block().defaultBlockState();
            if (piece == PieceType.DOORWAY) {
                // Направление проёма — куда смотрит игрок.
                newState = newState.setValue(DoorwayBlock.FACING,
                        Direction.fromYRot(player.getYRot()));
            }
        }

        level.setBlock(pos, newState, 3);

        StructureTier tier = StructureTier.byId(newState.getValue(StructureBlock.TIER));
        level.playSound(null, pos, tier.soundType().getPlaceSound(),
                SoundSource.BLOCKS, 1.0F, 1.0F);

        if (piece == PieceType.DOOR) {
            player.displayClientMessage(
                    Component.translatable("rustlike.msg.installed"), true);
        } else {
            player.displayClientMessage(
                    Component.translatable("rustlike.msg.placed",
                            Component.translatable(piece.nameKey())), true);
        }
    }
}
