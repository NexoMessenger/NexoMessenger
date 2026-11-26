package dev.rustlike.logic;

import dev.rustlike.block.StructureBlock;
import dev.rustlike.block.StructureBlockEntity;
import dev.rustlike.item.HammerItem;
import dev.rustlike.piece.StructureTier;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.item.Item;
import net.minecraft.world.level.block.state.BlockState;

/**
 * Действия молотка на сервере: ремонт и улучшение построек.
 * Все действия проверяют: молоток в руке, дальность, ресурсы, уровень.
 */
public final class StructureActions {

    /** Коды действий из HammerActionC2S. */
    public static final int ACTION_REPAIR = 0;
    public static final int ACTION_UPGRADE = 1;

    private StructureActions() {
    }

    public static void handle(ServerPlayer player, BlockPos pos, int action) {
        if (!(player.getMainHandItem().getItem() instanceof HammerItem)) {
            player.displayClientMessage(
                    Component.translatable("rustlike.msg.need_hammer"), true);
            return;
        }
        if (!PlacementRules.inReach(player, pos)) {
            player.displayClientMessage(
                    Component.translatable("rustlike.msg.too_far"), true);
            return;
        }
        if (action == ACTION_REPAIR) {
            repair(player, pos);
        } else if (action == ACTION_UPGRADE) {
            upgrade(player, pos);
        }
    }

    /** Полный ремонт за ресурсы текущего уровня. */
    private static void repair(ServerPlayer player, BlockPos pos) {
        ServerLevel level = (ServerLevel) player.level();
        BlockState state = level.getBlockState(pos);
        if (!(state.getBlock() instanceof StructureBlock)) {
            player.displayClientMessage(
                    Component.translatable("rustlike.msg.not_structure"), true);
            return;
        }
        if (!(level.getBlockEntity(pos) instanceof StructureBlockEntity be)) {
            player.displayClientMessage(
                    Component.translatable("rustlike.msg.no_damage"), true);
            return;
        }
        if (be.getDamage() <= 0) {
            player.displayClientMessage(
                    Component.translatable("rustlike.msg.no_damage"), true);
            return;
        }

        StructureTier tier = StructureTier.byId(state.getValue(StructureBlock.TIER));
        int cost = (int) Math.ceil(be.getDamage() * RustConfigAccess.multiplier());
        Item costItem = tier.costItem();

        if (!PlacementRules.takeItem(player, costItem, cost)) {
            player.displayClientMessage(
                    Component.translatable("rustlike.msg.no_resources",
                            cost, Component.translatable(costItem.getDescriptionId())), true);
            return;
        }

        be.setDamage(0);
        level.playSound(null, pos, SoundEvents.BLOCK_ANVIL_USE,
                SoundSource.BLOCKS, 1.0F, 1.2F);
        player.displayClientMessage(
                Component.translatable("rustlike.msg.repaired"), true);

        // Обновить открытый экран молотка новыми данными.
        HammerMenu.open(player, pos);
    }

    /** Улучшение до следующего уровня за ресурсы. */
    private static void upgrade(ServerPlayer player, BlockPos pos) {
        ServerLevel level = (ServerLevel) player.level();
        BlockState state = level.getBlockState(pos);
        if (!(state.getBlock() instanceof StructureBlock)) {
            player.displayClientMessage(
                    Component.translatable("rustlike.msg.not_structure"), true);
            return;
        }

        StructureTier current = StructureTier.byId(state.getValue(StructureBlock.TIER));
        if (current.id() >= 4) {
            player.displayClientMessage(
                    Component.translatable("rustlike.msg.max_tier"), true);
            return;
        }

        StructureTier next = StructureTier.byId(current.id() + 1);
        int cost = RustConfigAccess.upgradeCostTo(next.id());
        Item costItem = next.costItem();

        if (!PlacementRules.takeItem(player, costItem, cost)) {
            player.displayClientMessage(
                    Component.translatable("rustlike.msg.no_resources",
                            cost, Component.translatable(costItem.getDescriptionId())), true);
            return;
        }

        BlockState upgraded = state.setValue(StructureBlock.TIER, next.id());
        level.setBlock(pos, upgraded, 3);

        level.playSound(null, pos, SoundEvents.BLOCK_ANVIL_PLACE,
                SoundSource.BLOCKS, 1.0F, 1.0F);
        player.displayClientMessage(
                Component.translatable("rustlike.msg.upgraded",
                        Component.translatable(next.nameKey())), true);

        HammerMenu.open(player, pos);
    }

    /** Небольшая прослойка к конфигу (чтобы не тянуть Forge-классы в логику). */
    private static final class RustConfigAccess {
        private static double multiplier() {
            return dev.rustlike.RustConfig.REPAIR_COST_MULTIPLIER.get();
        }

        private static int upgradeCostTo(int tier) {
            return dev.rustlike.RustConfig.upgradeCostTo(tier);
        }
    }
}
