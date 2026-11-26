package dev.rustlike.item;

import dev.rustlike.client.RadialMenuScreen;
import net.minecraft.client.Minecraft;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.InteractionResultHolder;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.context.UseOnContext;
import net.minecraft.world.level.Level;
import net.minecraftforge.api.distmarker.Dist;
import net.minecraftforge.fml.DistExecutor;

/**
 * Строительный план.
 *
 *  - ПКМ (воздух или блок) — открывает круговое меню выбора элемента;
 *  - ЛКМ — устанавливает выбранный элемент под прицелом
 *    (см. ClientEvents: обработка нажатия атаки).
 */
public class BuildingPlanItem extends Item {

    public BuildingPlanItem(Properties properties) {
        super(properties);
    }

    @Override
    public InteractionResultHolder<ItemStack> use(Level level, Player player, InteractionHand hand) {
        return new InteractionResultHolder<>(openMenu(level), player.getItemInHand(hand));
    }

    @Override
    public InteractionResult useOn(UseOnContext context) {
        return openMenu(context.getLevel());
    }

    private InteractionResult openMenu(Level level) {
        if (level.isClientSide) {
            // Открытие экрана — только на клиенте (класс Minecraft недоступен на сервере).
            DistExecutor.unsafeRunWhenOn(Dist.CLIENT, () -> () ->
                    Minecraft.getInstance().setScreen(new RadialMenuScreen()));
        }
        return InteractionResult.sidedSuccess(level.isClientSide);
    }
}
