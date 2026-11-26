package dev.rustlike.logic;

import dev.rustlike.RustConfig;
import dev.rustlike.block.DoorwayBlock;
import dev.rustlike.block.FoundationBlock;
import dev.rustlike.block.StructureBlock;
import dev.rustlike.block.StructureBlockEntity;
import dev.rustlike.block.WallBlock;
import dev.rustlike.network.ModNetwork;
import dev.rustlike.network.OpenHammerScreenS2C;
import dev.rustlike.piece.StructureTier;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraftforge.registries.ForgeRegistries;

/**
 * Серверная часть экрана молотка: сборка данных и отправка клиенту.
 */
public final class HammerMenu {

    private HammerMenu() {
    }

    /** Открыть (или обновить) экран молотка для игрока. */
    public static void open(ServerPlayer player, BlockPos pos) {
        if (!PlacementRules.inReach(player, pos)) {
            player.displayClientMessage(
                    net.minecraft.network.chat.Component.translatable("rustlike.msg.too_far"), true);
            return;
        }

        BlockState state = player.level().getBlockState(pos);
        if (!(state.getBlock() instanceof StructureBlock)) {
            player.displayClientMessage(
                    net.minecraft.network.chat.Component.translatable("rustlike.msg.not_structure"), true);
            return;
        }

        StructureTier tier = StructureTier.byId(state.getValue(StructureBlock.TIER));
        int damage = 0;
        if (player.level().getBlockEntity(pos) instanceof StructureBlockEntity be) {
            damage = be.getDamage();
        }

        // Расход на ремонт: урон × множитель из конфига (предмет текущего уровня).
        int repairCost = damage > 0
                ? (int) Math.ceil(damage * RustConfig.REPAIR_COST_MULTIPLIER.get())
                : 0;
        String repairItem = name(tier.costItem());

        // Расход на улучшение: предметы СЛЕДУЮЩЕГО уровня.
        String upgradeItem = "";
        int upgradeCost = 0;
        if (tier.id() < 4) {
            StructureTier next = StructureTier.byId(tier.id() + 1);
            upgradeItem = name(next.costItem());
            upgradeCost = RustConfig.upgradeCostTo(tier.id() + 1);
        }

        ModNetwork.sendToPlayer(player, new OpenHammerScreenS2C(
                pos, pieceIdOf(state), tier.id(), damage, tier.maxDamage(),
                repairItem, repairCost, upgradeItem, upgradeCost));
    }

    /** Идентификатор элемента по блоку (для названия в экране). */
    private static int pieceIdOf(BlockState state) {
        if (state.getBlock() instanceof FoundationBlock) {
            return 0;
        }
        if (state.getBlock() instanceof WallBlock) {
            return 1;
        }
        if (state.getBlock() instanceof DoorwayBlock) {
            return 2;
        }
        return -1;
    }

    /** Регистрационное имя предмета, например "minecraft:stick". */
    private static String name(net.minecraft.world.item.Item item) {
        return ForgeRegistries.ITEMS.getKey(item).toString();
    }
}
