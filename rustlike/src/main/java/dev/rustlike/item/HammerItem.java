package dev.rustlike.item;

import dev.rustlike.block.StructureBlock;
import dev.rustlike.logic.HammerMenu;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.context.UseOnContext;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.state.BlockState;

/**
 * Молоток.
 *
 * ПКМ по постройке — открывает экран осмотра:
 *  - показывает материал, уровень и прочность;
 *  - позволяет починить постройку за ресурсы;
 *  - позволяет улучшить постройку до следующего уровня.
 */
public class HammerItem extends Item {

    public HammerItem(Properties properties) {
        super(properties);
    }

    @Override
    public InteractionResult useOn(UseOnContext context) {
        Level level = context.getLevel();
        Player player = context.getPlayer();

        if (!level.isClientSide && player instanceof ServerPlayer serverPlayer) {
            BlockState state = level.getBlockState(context.getClickedPos());
            if (state.getBlock() instanceof StructureBlock) {
                HammerMenu.open(serverPlayer, context.getClickedPos());
            } else {
                serverPlayer.displayClientMessage(
                        Component.translatable("rustlike.msg.not_structure"), true);
            }
        }
        return InteractionResult.sidedSuccess(level.isClientSide);
    }
}
